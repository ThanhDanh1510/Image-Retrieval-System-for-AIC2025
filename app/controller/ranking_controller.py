import json
from pathlib import Path
from typing import List, Optional # Added Optional

from app.service.video_ranking_service import VideoRankingService
from app.schema.ranking_schemas import VideoRankingRequest, VideoRankingResponse, RankedVideoResult
from app.config import API_BASE_URL
from core.logger import SimpleLogger # Use logger

logger = SimpleLogger(__name__)

# Helper function to get prefix (K0, K, L)
def _prefix_from_group(group_num_str: str) -> str:
    try:
        g = int(group_num_str)
    except (TypeError, ValueError):
        g = 99999 # Assign 'L' prefix for invalid inputs
    if g <= 9: return "K0"
    elif g <= 20: return "K"
    else: return "L"

class RankingController:
    def __init__(
        self,
        ranking_service: VideoRankingService,
        id2index_path: Path # Path to keyframe.json
    ):
        self.ranking_service = ranking_service
        # This map translates unique key ID (int) -> "group/video/frame_idx" (str)
        self.id2index = self._load_id2index(id2index_path)
        logger.info("RankingController initialized.")

    def _load_id2index(self, path: Path) -> dict:
        """Loads the JSON map from unique key_id (str key) to 'group/video/frame_idx'."""
        if not path.exists():
            logger.error(f"FATAL: id2index file not found at: {path}")
            return {}
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Convert keys back to int if they are stored as strings in JSON
                # Assuming keys in keyframe.json are strings like "108779"
                # Keep keys as strings internally for consistent lookup
                # int_key_map = {int(k): v for k, v in data.items() if k.isdigit()}
                logger.info(f"Loaded {len(data)} mappings from id2index file: {path}")
                return data # Keep keys as strings from JSON
        except json.JSONDecodeError as e:
            logger.error(f"ERROR: Failed to decode JSON from id2index file {path}: {e}")
            return {}
        except Exception as e:
            logger.error(f"ERROR: Could not load id2index from {path}: {e}")
            return {}

    def _get_full_path_from_key(self, key_id: int) -> str:
        """
        Converts a unique keyframe integer ID (key) into a full image URL.
        Uses the id2index map to find group/video/frame_idx.
        """
        key_str = str(key_id) # Convert key to string for lookup in id2index map

        # Look up using the string version of the key
        path_info = self.id2index.get(key_str)

        if not path_info:
            logger.warning(f"Key ID {key_id} (str: '{key_str}') not found in id2index map. Returning placeholder.")
            return f"{API_BASE_URL}/images/not_found.webp"

        # Expected format: "group/video/frame_idx_str", e.g., "1/1/0"
        try:
            group_str, video_str, frame_idx_str = path_info.split('/')

            # Validate parts
            if not group_str.isdigit() or not video_str.isdigit() or not frame_idx_str.isdigit():
                 raise ValueError("Invalid format in id2index value")

            group_num = int(group_str)
            video_num = int(video_str)
            # Lấy số thứ tự khung hình (frame index)
            frame_idx = int(frame_idx_str) 

            prefix = _prefix_from_group(group_str)
            group_folder = f"{prefix}{group_num:02d}" if prefix != "K0" else f"{prefix}{group_num:01d}"
            video_folder = f"V{video_num:03d}"

            # *** ĐÃ SỬA: Tên file ảnh là số thứ tự khung hình (frame_idx) ***
            img_name = f"{frame_idx}.webp" 
            
            full_path = f"{API_BASE_URL}/images/{group_folder}/{video_folder}/{img_name}"
            # logger.debug(f"Generated path for key {key_id}: {full_path}") # Debug log
            return full_path

        except ValueError:
             logger.error(f"Invalid path_info format '{path_info}' for key {key_id} in id2index map.")
             return f"{API_BASE_URL}/images/invalid_path.webp"
        except Exception as e:
            logger.error(f"Error processing path for key {key_id} (path_info: '{path_info}'): {e}", exc_info=True)
            return f"{API_BASE_URL}/images/invalid_path.webp"


    async def rank_videos_by_dp(self, request: VideoRankingRequest) -> VideoRankingResponse:
        """
        Main controller method. Calls the service with filters and formats the response.
        Ensures both aligned_key_ids (unique keys) and aligned_key_paths are returned.
        """
        logger.info(f"Received TRAKE request: {request.dict(exclude_none=True)}")

        try:
            # Call the service, passing filter parameters
            service_results: List[dict] = await self.ranking_service.rank_videos(
                events=request.events,
                top_k=request.top_k,
                penalty_weight=request.penalty_weight,
                exclude_groups=request.exclude_groups,
                include_groups=request.include_groups,
                include_videos=request.include_videos,
            )
            logger.info(f"TRAKE service returned {len(service_results)} potential video results.")

        except Exception as service_err:
             logger.error(f"Error calling VideoRankingService: {service_err}", exc_info=True)
             # Return empty list or raise HTTPException depending on desired behavior
             return VideoRankingResponse(results=[])


        final_results: List[RankedVideoResult] = []
        for rank, res_dict in enumerate(service_results):
            try:
                video_id = res_dict.get("video_id")
                score = res_dict.get("score")
                # --- Get the UNIQUE KEY IDs from the service result ---
                aligned_ids: List[int] = res_dict.get("aligned_key_ids", [])
                # --- END ---

                if not video_id or score is None:
                     logger.warning(f"Skipping invalid service result at rank {rank+1}: {res_dict}")
                     continue

                group, video = video_id.split('/') # Assume valid video_id format "group/video"

                # --- Generate paths using the UNIQUE KEY IDs ---
                aligned_paths = [self._get_full_path_from_key(key_id) for key_id in aligned_ids]
                # --- END ---

                # Create the final Pydantic response object
                result_obj = RankedVideoResult(
                    video_id=video_id,
                    group_num=str(group),
                    video_num=int(video),
                    dp_score=score,
                    aligned_key_ids=aligned_ids,      # Include the unique IDs
                    aligned_key_paths=aligned_paths   # Include the generated paths
                )
                final_results.append(result_obj)

            except Exception as format_err:

                logger.error(f"Error formatting TRAKE result for video '{res_dict.get('video_id')}': {format_err}", exc_info=True)
                continue

        logger.info(f"Returning {len(final_results)} formatted TRAKE results.")
        return VideoRankingResponse(results=final_results)