import numpy as np
import json
from typing import List, Dict, Tuple, Optional, Set
import os
import sys
import time


# ROOT_DIR setup
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from service.model_service import ModelService
from repository.milvus import KeyframeVectorRepository
from repository.mongo import KeyframeRepository
from core.settings import AppSettings
from core.logger import SimpleLogger
from schema.interface import MilvusSearchRequest

logger = SimpleLogger(__name__)


class VideoRankingService:
    """
    Optimized Video Ranking Service with DANTE algorithm and Milvus pre-filtering.
    """

    def __init__(
        self,
        model_service: ModelService,
        vector_repo: KeyframeVectorRepository,
        keyframe_repo: KeyframeRepository,
        settings: AppSettings
    ):
        """Initialize VideoRankingService with robust path handling."""
        self.model_service = model_service
        self.vector_repo = vector_repo
        self.keyframe_repo = keyframe_repo
        self.settings = settings

        logger.info("=" * 80)
        logger.info("VideoRankingService Initialization")
        logger.info("=" * 80)

        # Load video ranges mapping with multiple fallback paths
        self.video_ranges = self._load_video_ranges_with_fallback()

        if not self.video_ranges:
            logger.error("CRITICAL: Could not load video_ranges from any path!")

        # Pre-build reverse mapping for fast ID -> video_id lookup
        self._build_id_to_video_mapping()

        logger.info(f"✓ VideoRankingService initialized")
        logger.info(f"  - Videos loaded: {len(self.video_ranges)}")
        logger.info(f"  - ID ranges built: {len(self.id_ranges_list)}")
        logger.info("=" * 80)

    # ======================== INITIALIZATION & SETUP ========================

    def _load_video_ranges_with_fallback(self) -> Dict[str, Dict[str, int]]:
        """Load video index ranges from JSON with multiple fallback paths."""
        paths_to_try = [
            self.settings.VIDEO_RANGES_PATH,
            "embeddings/video_index_ranges.json",
            "./embeddings/video_index_ranges.json",
            "../embeddings/video_index_ranges.json",
            "../../embeddings/video_index_ranges.json",
            os.path.join(ROOT_DIR, "embeddings/video_index_ranges.json"),
        ]

        logger.info(f"Attempting to load video_index_ranges.json...")
        logger.info(f"Current working directory: {os.getcwd()}")

        for path in paths_to_try:
            try:
                abs_path = os.path.abspath(path)

                if os.path.exists(abs_path):
                    logger.info(f"Found file at: {abs_path}")

                    with open(abs_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    logger.info(f"✓ Successfully loaded {len(data)} video ranges")

                    if data:
                        sample_items = list(data.items())[:2]
                        for k, v in sample_items:
                            logger.info(f"  Sample: {k} -> {v}")

                    return data

            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON at {abs_path}: {e}")
            except Exception as e:
                logger.debug(f"Could not load from {path}: {e}")

        logger.error("CRITICAL: Could not find video_index_ranges.json")
        return {}

    def _build_id_to_video_mapping(self) -> None:
        """Pre-build sorted list of (start_id, end_id, video_id)."""
        self.id_ranges_list = []

        if not self.video_ranges:
            logger.error("CRITICAL: video_ranges is empty!")
            return

        logger.info(f"Building ID-to-video mapping from {len(self.video_ranges)} videos...")

        for video_id, v_range in self.video_ranges.items():
            start_id = v_range.get("start_id")
            end_id = v_range.get("end_id")

            if start_id is None or end_id is None:
                continue

            self.id_ranges_list.append((start_id, end_id, video_id))

        self.id_ranges_list.sort(key=lambda x: x[0])

        logger.info(f"✓ Built id_ranges_list with {len(self.id_ranges_list)} entries")

        if self.id_ranges_list:
            first = self.id_ranges_list[0]
            last = self.id_ranges_list[-1]
            logger.info(f"  ID span: [{first[0]}, {last[1]}]")

    # ======================== PRE-FILTERING & MAPPING ========================

    def _extract_custom_id(self, result) -> Optional[int]:
        """Extract custom field 'id' from Milvus search result."""
        try:
            return result.id_
        except Exception as e:
            logger.debug(f"Error extracting id: {e}")
            return None

    def _map_frame_ids_to_video_ids(self, frame_ids: List[int]) -> Set[str]:
        """Map list of frame IDs to set of video_ids."""
        if not self.id_ranges_list:
            logger.warning("Cannot map: id_ranges_list is empty!")
            return set()

        video_ids_set = set()

        for frame_id in frame_ids:
            for start_id, end_id, video_id in self.id_ranges_list:
                if start_id <= frame_id <= end_id:
                    video_ids_set.add(video_id)
                    break

        return video_ids_set

    async def _get_candidate_videos_from_queries(
        self,
        query_embeddings: np.ndarray,
        top_k_frames: int = 1000
    ) -> Set[str]:
        """Pre-filter videos by finding top_k similar frames."""
        candidate_video_ids: Set[str] = set()

        if not self.id_ranges_list:
            logger.error("CRITICAL: id_ranges_list is empty!")
            return set()

        logger.info(f"Pre-filtering with Milvus (top_k={top_k_frames})...")

        for i, query_emb in enumerate(query_embeddings):
            try:
                search_request = MilvusSearchRequest(
                    embedding=query_emb.tolist(),
                    top_k=top_k_frames,
                    exclude_ids=None
                )

                search_response = await self.vector_repo.search_by_embedding(search_request)

                if not search_response or not search_response.results:
                    logger.warning(f"No Milvus results for query {i}")
                    continue

                frame_ids = []
                for result in search_response.results:
                    frame_id = self._extract_custom_id(result)
                    if frame_id is not None:
                        frame_ids.append(frame_id)

                if not frame_ids:
                    continue

                video_ids_for_query = self._map_frame_ids_to_video_ids(frame_ids)
                candidate_video_ids.update(video_ids_for_query)

                logger.debug(f"Query {i}: {len(frame_ids)} frames → {len(video_ids_for_query)} videos")

            except Exception as e:
                logger.error(f"Error processing query {i}: {e}", exc_info=True)
                continue

        logger.info(f"Pre-filtering result: {len(candidate_video_ids)} candidate videos")
        return candidate_video_ids

    # ======================== SIMILARITY MATRIX COMPUTATION ========================

    @staticmethod
    def _compute_similarity_matrix(
        q_vecs: np.ndarray,
        k_vecs: np.ndarray
    ) -> np.ndarray:
        """Compute cosine similarity matrix between query and keyframe embeddings."""
        # Normalize query vectors
        q_norms = np.linalg.norm(q_vecs, axis=1, keepdims=True)
        q_normalized = np.divide(
            q_vecs,
            q_norms,
            out=np.zeros_like(q_vecs),
            where=q_norms != 0
        )

        # Normalize keyframe vectors
        k_norms = np.linalg.norm(k_vecs, axis=1, keepdims=True)
        k_normalized = np.divide(
            k_vecs,
            k_norms,
            out=np.zeros_like(k_vecs),
            where=k_norms != 0
        )

        # Compute cosine similarity
        return np.dot(q_normalized, k_normalized.T)

    async def _compute_similarity_matrix_for_video(
        self,
        query_vectors: np.ndarray,
        start_id: int,
        end_id: int
    ) -> Tuple[np.ndarray, List[int]]:
        """Compute similarity matrix for a video by loading frames from Milvus."""
        # logger.debug(f"Loading frames [{start_id}, {end_id}]...")

        try:
            key_ids, keyframe_vectors_list = await self.vector_repo.get_embeddings_by_range(
                start_id,
                end_id
            )

            if not key_ids:
                return np.array([]), []

            keyframe_vectors = np.array(keyframe_vectors_list, dtype='float32')
            S_matrix = self._compute_similarity_matrix(query_vectors, keyframe_vectors)

            return S_matrix, key_ids

        except Exception as e:
            logger.error(f"Error loading frames [{start_id}, {end_id}]: {e}")
            raise

    # ======================== METADATA FILTERING ========================

    async def _get_filtered_keys(
        self,
        exclude_groups: Optional[List[str]] = None,
        include_groups: Optional[List[str]] = None,
        include_videos: Optional[List[int]] = None
    ) -> Tuple[Optional[Set[int]], Optional[Set[int]]]:
        """Get sets of allowed/excluded frame IDs."""
        allowed_ids: Optional[Set[int]] = None
        excluded_ids: Optional[Set[int]] = None

        try:
            if exclude_groups:
                docs = await self.keyframe_repo.find(
                    {"group_num": {"$in": exclude_groups}}
                )
                excluded_ids = {d.key for d in docs}
                logger.info(f"Excluding {len(excluded_ids)} keys")

            elif include_groups or include_videos:
                filt = {}
                if include_groups:
                    filt["group_num"] = {"$in": include_groups}
                if include_videos:
                    filt["video_num"] = {"$in": include_videos}

                if filt:
                    allowed_docs = await self.keyframe_repo.find(filt)
                    allowed_ids = {d.key for d in allowed_docs}
                    logger.info(f"Including {len(allowed_ids)} keys")

        except Exception as e:
            logger.error(f"Error getting filtered keys: {e}", exc_info=True)

        return allowed_ids, excluded_ids

    # ======================== DANTE ALGORITHM ========================

    @staticmethod
    def _run_dp_and_backtracking(
        S: np.ndarray,
        penalty_weight: float
    ) -> Tuple[float, List[int]]:
        """DANTE DP with running_max optimization: O(N*T)."""
        N, T = S.shape

        if N == 0 or T == 0:
            return -float('inf'), []

        DP_table = np.full((N, T), -np.inf, dtype=np.float32)
        backpointer_table = np.full((N, T), -1, dtype=np.int32)

        # Base case
        DP_table[0, :] = S[0, :]

        # DP with running_max
        for i in range(1, N):
            running_max = -np.inf
            best_prev_t = -1

            for t in range(i, T):
                if t > i:
                    candidate_value = DP_table[i-1, t-1] + penalty_weight * (t - 1)
                    if candidate_value > running_max:
                        running_max = candidate_value
                        best_prev_t = t - 1
                else:
                    running_max = DP_table[i-1, i-1] + penalty_weight * (i - 1)
                    best_prev_t = i - 1

                DP_table[i, t] = S[i, t] + running_max - penalty_weight * t
                backpointer_table[i, t] = best_prev_t

        # Find best score
        best_final_t = np.argmax(DP_table[N-1, :])
        best_score = DP_table[N-1, best_final_t]

        if best_score <= -np.inf or np.isnan(best_score):
            return -float('inf'), []

        # Backtrack
        path = [-1] * N
        current_t = best_final_t

        for i in range(N - 1, -1, -1):
            path[i] = current_t

            if i > 0:
                prev_t = backpointer_table[i, current_t]
                if prev_t < 0 or prev_t >= T:
                    return -float('inf'), []
                current_t = prev_t

        if any(t < 0 or t >= T for t in path):
            return -float('inf'), []

        return float(best_score), path

    # ======================== MAIN RANKING FUNCTION ========================

    async def rank_videos(
        self,
        events: List[str],
        top_k: int,
        penalty_weight: Optional[float] = None,
        exclude_groups: Optional[List[str]] = None,
        include_groups: Optional[List[str]] = None,
        include_videos: Optional[List[int]] = None,
    ) -> List[Dict]:
        """Ranks videos based on event sequence alignment using DANTE."""
        start_time = time.time()

        N = len(events)
        if N == 0:
            logger.warning("No events provided")
            return []

        if not self.id_ranges_list:
            logger.error("CRITICAL: id_ranges_list is empty!")
            return []

        lambda_val = (
            penalty_weight
            if penalty_weight is not None
            else self.settings.DP_PENALTY_WEIGHT
        )

        # ========== STEP 1: Encode events ==========
        logger.info(f"[1/4] Encoding {N} events...")
        try:
            query_vectors = np.array(
                self.model_service.embed_texts(events),
                dtype='float32'
            )
            logger.info(f"✓ Encoded {N} events")
        except Exception as e:
            logger.error(f"Error encoding events: {e}", exc_info=True)
            return []

        # ========== STEP 2: Pre-filter videos ==========
        logger.info("[2/4] Pre-filtering with Milvus...")
        try:
            candidate_video_ids = await self._get_candidate_videos_from_queries(
                query_vectors,
                top_k_frames=self.settings.MILVUS_PRE_THRESH
            )
        except Exception as e:
            logger.error(f"Error pre-filtering: {e}", exc_info=True)
            return []

        if not candidate_video_ids:
            logger.warning("No candidate videos found")
            return []

        logger.info(f"✓ Pre-filtering: {len(self.video_ranges)} → {len(candidate_video_ids)}")

        # ========== STEP 3: Get metadata filters ==========
        try:
            allowed_ids, excluded_ids = await self._get_filtered_keys(
                exclude_groups,
                include_groups,
                include_videos
            )
        except Exception as e:
            logger.error(f"Error getting filters: {e}", exc_info=True)
            return []

        all_video_results = []
        processed_count = 0

        # ========== STEP 4: Run DANTE ==========
        logger.info(f"[3/4] Running DANTE on {len(candidate_video_ids)} videos ...")

        for idx, video_id in enumerate(candidate_video_ids):
            try:
                v_range = self.video_ranges.get(video_id)
                if v_range is None:
                    continue

                start_id = v_range.get("start_id")
                end_id = v_range.get("end_id")

                if start_id is None or end_id is None:
                    continue

                # Load frames and compute similarity
                try:
                    S_matrix, frame_ids_all = await self._compute_similarity_matrix_for_video(
                        query_vectors,
                        start_id,
                        end_id
                    )

                    if S_matrix.size == 0:
                        continue

                except Exception as e:
                    logger.error(f"Error computing S for {video_id}: {e}")
                    continue

                # Apply metadata filters
                frame_ids_filtered = []
                col_indices_filtered = []

                for col_idx, frame_id in enumerate(frame_ids_all):
                    is_allowed = True

                    if excluded_ids is not None and frame_id in excluded_ids:
                        is_allowed = False

                    if allowed_ids is not None and frame_id not in allowed_ids:
                        is_allowed = False

                    if is_allowed:
                        frame_ids_filtered.append(frame_id)
                        col_indices_filtered.append(col_idx)

                if not frame_ids_filtered:
                    continue

                S_matrix_filtered = S_matrix[:, col_indices_filtered]
                T = len(frame_ids_filtered)

                if T < N:
                    continue

                # Run DANTE
                try:
                    dp_score, aligned_indices = self._run_dp_and_backtracking(
                        S_matrix_filtered,
                        lambda_val
                    )

                    if dp_score <= -np.inf or np.isnan(dp_score):
                        continue

                except Exception as e:
                    logger.error(f"Error DP for {video_id}: {e}")
                    continue

                # Store result
                if aligned_indices and all(0 <= idx < T for idx in aligned_indices):
                    aligned_frame_ids = [frame_ids_filtered[i] for i in aligned_indices]

                    all_video_results.append({
                        "video_id": video_id,
                        "score": dp_score,
                        "aligned_key_ids": aligned_frame_ids
                    })

                    processed_count += 1

            except Exception as e:
                logger.error(f"Error processing {video_id}: {e}", exc_info=True)
                continue

        # ========== STEP 5: Sort and return ==========
        logger.info("[4/4] Finalizing...")

        all_video_results.sort(key=lambda x: x["score"], reverse=True)
        final_results = all_video_results[:top_k]

        elapsed_time = time.time() - start_time
        logger.info(
            f"✓ Complete: {processed_count} processed, {len(final_results)} returned, {elapsed_time:.2f}s"
        )

        return final_results
