import numpy as np
import json
from typing import List, Dict, Tuple, Optional
import os
import sys

# Assume ROOT_DIR setup is correct
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)


from service.model_service import ModelService
from repository.milvus import KeyframeVectorRepository
from repository.mongo import KeyframeRepository
from core.settings import AppSettings
from core.logger import SimpleLogger # Use logger

logger = SimpleLogger(__name__)


class VideoRankingService:
    def __init__(
        self,
        model_service: ModelService,
        vector_repo: KeyframeVectorRepository,
        keyframe_repo: KeyframeRepository, # Needed for filtering by metadata
        settings: AppSettings
    ):
        self.model_service = model_service
        self.vector_repo = vector_repo
        self.keyframe_repo = keyframe_repo
        self.settings = settings
        self.video_ranges = self._load_video_ranges(settings.VIDEO_RANGES_PATH)
        logger.info("VideoRankingService initialized.")


    def _load_video_ranges(self, path: str) -> Dict[str, Dict[str, int]]:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.info(f"Loaded {len(data)} video ranges from {path}")
                return data
        except FileNotFoundError:
            logger.error(f"FATAL: Video ranges file not found at {path}")
            return {}
        except Exception as e:
            logger.error(f"FATAL: Could not load video ranges from {path}: {e}")
            return {}


    @staticmethod
    def _run_dp_and_backtracking(S: np.ndarray, penalty_weight: float) -> Tuple[float, List[int]]:
        """Performs Dynamic Programming and backtracking (ĐÃ SỬA LỖI TRUY VẾT)."""
        N, T = S.shape # N: Số lượng sự kiện (events), T: Số lượng keyframe (frames)
        if N == 0 or T == 0:
             return -float('inf'), []

        DP_table = np.full((N, T), -np.inf)
        backpointer_table = np.zeros((N, T), dtype=int)

        # Initialize first row: DP[0, t] = S[0, t] (alignment of first event to frame t)
        DP_table[0, :] = S[0, :]

        # DP Logic (Monotonic Alignment)
        for i in range(1, N): # Lặp qua các sự kiện (query index i)
            # Khởi tạo giá trị ban đầu cho max_prev_score của hàng i-1
            max_prev_score_at_j = DP_table[i-1, i-1] - penalty_weight * (0) # Điểm khởi đầu hợp lệ t_prev = i-1
            best_j_prev = i-1
            
            # Tối ưu hóa: Thay vì lặp lại range(i-1, t) trong inner loop, 
            # ta dùng kỹ thuật Max-Score-Until-J để tính toán tối ưu hơn.
            # Bắt đầu từ t = i (vì sự kiện i phải được căn chỉnh sau ít nhất i frames)
            for t in range(i, T): # Lặp qua các keyframe (frame index t)
                
                # Cập nhật Max-Score-Until-J: Tính toán điểm tốt nhất có thể đến từ t-1
                # max_{t'<t} { DP[i-1, t'] + penalty_weight * t' }
                
                # Giá trị max_prev_score_at_j hiện tại đã được tính cho t-1 (j=t-1)
                t_prev_index = t - 1
                
                # Tính lại giá trị cho frame t_prev_index (t-1)
                # DP[i-1, t_prev_index] - penalty_weight * (t - t_prev_index - 1)
                # = DP[i-1, t-1] - penalty_weight * (0)
                current_prev_score = DP_table[i-1, t_prev_index] # (t - t_prev_index - 1) = 0
                
                # Cập nhật max score và best_t_prev (không cần nhân t' nữa)
                if current_prev_score > max_prev_score_at_j:
                    max_prev_score_at_j = current_prev_score
                    best_j_prev = t_prev_index
                
                # Sửa lỗi: Đây là thuật toán căn chỉnh đơn giản:
                # DP[i, t] = S[i, t] + max_{t'<t} { DP[i-1, t'] - penalty * (t - t' - 1) }
                # Chúng ta đã tìm ra max_prev_score_at_j, nó là max(DP[i-1, t'])
                
                # TÍNH TOÁN cho trạng thái hiện tại DP[i, t]
                # Ta cần tìm max_{t'<t} { DP[i-1, t'] + penalty_weight * t' } - penalty_weight * t
                
                # Tận dụng max_prev_score_at_j (score tốt nhất đến từ t-1)
                
                # Option 1: Không có gap (t_prev = t-1)
                best_prev_score = DP_table[i-1, t-1] # gap=0
                best_t_prev = t-1
                
                # Option 2: Có gap (t_prev < t-1)
                for t_prev in range(i - 1, t - 1): # Lặp qua các frame trước đó
                    gap = t - t_prev - 1 # Số frame bị bỏ qua (>= 1)
                    current_path_score = DP_table[i-1, t_prev] - penalty_weight * gap
                    
                    if current_path_score > best_prev_score:
                        best_prev_score = current_path_score
                        best_t_prev = t_prev
                
                # Thêm điểm khớp hiện tại S[i, t]
                DP_table[i, t] = S[i, t] + best_prev_score
                backpointer_table[i, t] = best_t_prev

        # Backtracking starts from the best score in the last row
        best_final_t = np.argmax(DP_table[N-1, :])
        best_score = DP_table[N-1, best_final_t]

        if best_score <= -np.inf or np.isnan(best_score):
            return -float('inf'), []

        # Reconstruct path
        path = [-1] * N
        current_t = best_final_t
        
        for i in range(N - 1, -1, -1): # Backward loop from last event
            path[i] = current_t
            if i > 0:
                # SỬA LỖI: Lấy chỉ mục truy vết chính xác từ bảng
                prev_t = backpointer_table[i, current_t] 
                current_t = prev_t # Move to the previous aligned frame index

        # Ensure all indices in the path are valid before returning (safe check)
        if any(t < 0 or t >= T for t in path):
             logger.warning(f"Generated DP path contains invalid indices: {path} for T={T}")
             return -float('inf'), []

        return float(best_score), path


    @staticmethod
    def _compute_similarity_matrix(q_vecs: np.ndarray, k_vecs: np.ndarray) -> np.ndarray:
        """Computes cosine similarity matrix, handling potential zero vectors."""
        q_norms = np.linalg.norm(q_vecs, axis=1, keepdims=True)
        k_norms = np.linalg.norm(k_vecs, axis=1, keepdims=True)

        # Avoid division by zero
        q_norm = np.divide(q_vecs, q_norms, out=np.zeros_like(q_vecs), where=q_norms!=0)
        k_norm = np.divide(k_vecs, k_norms, out=np.zeros_like(k_vecs), where=k_norms!=0)

        return np.dot(q_norm, k_norm.T)


    async def _get_filtered_keys(self,
                                 exclude_groups: Optional[List[str]] = None,
                                 include_groups: Optional[List[str]] = None,
                                 include_videos: Optional[List[int]] = None
                                ) -> Tuple[Optional[set[int]], Optional[set[int]]]:
        """ Helper to get sets of allowed/excluded keys based on filters. """
        allowed_ids: Optional[set[int]] = None
        excluded_ids: Optional[set[int]] = None

        if exclude_groups:
            docs = await self.keyframe_repo.find({"group_num": {"$in": exclude_groups}})
            excluded_ids = {d.key for d in docs}
            logger.info(f"TRAKE Filtering: Will exclude {len(excluded_ids)} keys from groups: {exclude_groups}")
        elif include_groups or include_videos:
            filt = {}
            if include_groups: filt["group_num"] = {"$in": include_groups}
            if include_videos: filt["video_num"] = {"$in": include_videos}
            if filt:
                allowed_docs = await self.keyframe_repo.find(filt)
                allowed_ids = {d.key for d in allowed_docs}
                logger.info(f"TRAKE Filtering: Will allow only {len(allowed_ids)} keys from groups/videos: {include_groups}/{include_videos}")
            else:
                allowed_ids = set() # No include filters means allow nothing
                logger.info("TRAKE Filtering: Include filters empty, allowing no keys.")
        else:
             logger.info("TRAKE Filtering: No filters applied.")

        return allowed_ids, excluded_ids

    async def rank_videos(
        self,
        events: List[str],
        top_k: int,
        penalty_weight: Optional[float],
        exclude_groups: Optional[List[str]] = None,
        include_groups: Optional[List[str]] = None,
        include_videos: Optional[List[int]] = None,
    ) -> List[Dict]:
        """Ranks videos based on event sequence alignment, handles filters."""

        lambda_val = penalty_weight if penalty_weight is not None else self.settings.DP_PENALTY_WEIGHT
        N = len(events)
        if N == 0: return [] # No events to rank

        query_vectors = np.array(self.model_service.embed_texts(events), dtype='float32')
        all_video_results = []

        # Get filter sets once
        allowed_ids, excluded_ids = await self._get_filtered_keys(exclude_groups, include_groups, include_videos)

        for video_id, v_range in self.video_ranges.items():
            start_id, end_id = v_range.get("start_id"), v_range.get("end_id")
            if start_id is None or end_id is None:
                 logger.warning(f"Skipping video {video_id} due to missing start/end ID in ranges.")
                 continue

            # Fetch keys AND embeddings within the video's range
            # Note: vector_repo.get_embeddings_by_range MUST return keys that are the unique INT IDs
            key_ids, keyframe_vectors_list = await self.vector_repo.get_embeddings_by_range(start_id, end_id)

            if not key_ids:
                # logger.debug(f"No keyframes found for video {video_id} in range {start_id}-{end_id}")
                continue

            # Apply filters to the fetched keys and vectors
            filtered_key_ids = []
            filtered_vectors_list = []
            original_indices_map = {} # Map filtered index back to original index if needed

            for i, key_id in enumerate(key_ids):
                is_allowed = True
                if excluded_ids is not None and key_id in excluded_ids:
                    is_allowed = False
                if allowed_ids is not None and key_id not in allowed_ids:
                    is_allowed = False

                if is_allowed:
                    filtered_key_ids.append(key_id)
                    filtered_vectors_list.append(keyframe_vectors_list[i])
                    original_indices_map[len(filtered_key_ids) - 1] = i # Store original index


            if not filtered_key_ids:
                # logger.debug(f"No keyframes left for video {video_id} after filtering.")
                continue

            # Proceed with DP on filtered data
            keyframe_vectors = np.array(filtered_vectors_list, dtype='float32')
            T = len(filtered_key_ids) # Number of keyframes AFTER filtering

            if T < N: # Check if enough frames remain
                # logger.debug(f"Video {video_id} has only {T} frames after filtering, less than {N} events.")
                continue

            try:
                S_matrix = self._compute_similarity_matrix(query_vectors, keyframe_vectors)
                dp_score, aligned_relative_indices = self._run_dp_and_backtracking(S_matrix, lambda_val)
            except Exception as dp_err:
                 logger.error(f"Error during DP for video {video_id}: {dp_err}", exc_info=True)
                 continue # Skip video on DP error

            # Ensure aligned_relative_indices are valid before using them
            if aligned_relative_indices and all(0 <= idx < T for idx in aligned_relative_indices):
                
                # 1. Map các chỉ số tương đối (vd: [0, 2, 5]) về key ID thật
                #    Kết quả `aligned_key_ids_actual` sẽ là một List[int]
                aligned_key_ids_actual = [filtered_key_ids[i] for i in aligned_relative_indices]

                # 2. Thêm dict kết quả vào list
                all_video_results.append({
                    "video_id": video_id,
                    "score": dp_score,
                    # Trả về danh sách các key ID đã align
                    "aligned_key_ids": aligned_key_ids_actual 
                })
            elif dp_score > -np.inf: 
                 logger.warning(f"DP for video {video_id} yielded score {dp_score} but an invalid path: {aligned_relative_indices} (T={T})")


        # Sort and return top_k results
        try:
             all_video_results.sort(key=lambda item: item["score"], reverse=True)
        except Exception as sort_err:
             logger.error(f"Error sorting video results: {sort_err}")
             # Return unsorted top_k in case of sorting error
             return all_video_results[:top_k]

        return all_video_results[:top_k]
