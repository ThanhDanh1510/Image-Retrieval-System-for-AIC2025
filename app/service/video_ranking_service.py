import numpy as np
import json
from typing import List, Dict, Tuple, Optional
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from service.model_service import ModelService
from repository.milvus import KeyframeVectorRepository
from repository.mongo import KeyframeRepository
from core.settings import AppSettings
# Schema không còn được import ở đây, service không cần biết về response model cuối cùng
# from schema.ranking_schemas import RankedVideoResult
from schema.interface import KeyframeInterface


class VideoRankingService:
    # ... (hàm __init__, _load_video_ranges, _run_dp_and_backtracking, _compute_similarity_matrix giữ nguyên) ...
    def __init__(
        self,
        model_service: ModelService,
        vector_repo: KeyframeVectorRepository,
        keyframe_repo: KeyframeRepository,
        settings: AppSettings
    ):
        self.model_service = model_service
        self.vector_repo = vector_repo
        self.keyframe_repo = keyframe_repo
        self.settings = settings  # <-- Lưu lại settings
        self.video_ranges = self._load_video_ranges(settings.VIDEO_RANGES_PATH)

    def _load_video_ranges(self, path: str) -> Dict[str, Dict[str, int]]:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"FATAL: Could not load video ranges from {path}: {e}")
            return {}

    @staticmethod
    def _run_dp_and_backtracking(S: np.ndarray, penalty_weight: float) -> Tuple[float, List[int]]:
        N, T = S.shape
        DP_table = np.full((N, T), -np.inf)
        backpointer_table = np.zeros((N, T), dtype=int)
        DP_table[0, :] = S[0, :]

        # DP Logic
        for i in range(1, N):
            for t in range(1, T):
                # --- SỬA ĐỔI LOGIC CỐT LÕI ---
                # Thay vì dùng np.argmax đơn giản, chúng ta cần lặp để tính điểm có phạt.
                # Tính điểm cho tất cả các bước đi có thể từ hàng (i-1) đến cột t.

                # Lấy tất cả điểm của hàng trước, đến cột t-1
                prev_scores = DP_table[i-1, :t]

                # Tạo một mảng các khoảng cách (gap) từ t đến mỗi t'
                gaps = t - np.arange(t)

                # Áp dụng hàm phạt tuyến tính
                scores_with_penalty = prev_scores - (penalty_weight * gaps)

                # Tìm điểm và chỉ số tốt nhất sau khi đã phạt
                best_prev_score = np.max(scores_with_penalty)
                best_prev_t = np.argmax(scores_with_penalty)

                DP_table[i, t] = S[i, t] + best_prev_score
                backpointer_table[i, t] = best_prev_t

        # Backtracking
        path = [-1] * N
        best_score = np.max(DP_table[N-1, :])
        if best_score <= -np.inf:
            return -float('inf'), []
        path[N-1] = int(np.argmax(DP_table[N-1, :]))
        for i in range(N - 1, 0, -1):
            current_t = path[i]
            prev_t = backpointer_table[i, current_t]
            path[i-1] = prev_t
        return float(best_score), path

    @staticmethod
    def _compute_similarity_matrix(q_vecs: np.ndarray, k_vecs: np.ndarray) -> np.ndarray:
        q_norm = q_vecs / np.linalg.norm(q_vecs, axis=1, keepdims=True)
        k_norm = k_vecs / np.linalg.norm(k_vecs, axis=1, keepdims=True)
        return np.dot(q_norm, k_norm.T)

    # --- SỬA ĐỔI HÀM NÀY ĐỂ NHẬN THAM SỐ PHẠT ---
    async def rank_videos(
        self,
        events: List[str],
        top_k: int,
        penalty_weight: Optional[float] # <-- Thêm tham số mới
    ) -> List[Dict]:

        # Quyết định trọng số phạt sẽ sử dụng
        # Nếu người dùng không cung cấp, dùng giá trị mặc định từ settings.
        lambda_val = penalty_weight if penalty_weight is not None else self.settings.DP_PENALTY_WEIGHT

        N = len(events)
        query_vectors = np.array(self.model_service.embed_texts(events), dtype='float32')
        all_video_results = []

        for video_id, v_range in self.video_ranges.items():
            start_id, end_id = v_range["start_id"], v_range["end_id"]

            key_ids, keyframe_vectors_list = await self.vector_repo.get_embeddings_by_range(start_id, end_id)
            if not key_ids: continue

            keyframe_vectors = np.array(keyframe_vectors_list, dtype='float32')
            T = len(key_ids)

            if T < N: continue

            S_matrix = self._compute_similarity_matrix(query_vectors, keyframe_vectors)

            # Truyền trọng số phạt vào hàm DP
            dp_score, aligned_indices = self._run_dp_and_backtracking(S_matrix, lambda_val)

            if aligned_indices:
                aligned_key_ids = [key_ids[i] for i in aligned_indices]
                all_video_results.append({
                    "video_id": video_id,
                    "score": dp_score,
                    "aligned_key_ids": aligned_key_ids
                })

        all_video_results.sort(key=lambda item: item["score"], reverse=True)
        return all_video_results[:top_k]
