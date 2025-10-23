# Project-relative path: app/controller/ranking_controller.py
import json
from pathlib import Path
from typing import List

# Import các thành phần cần thiết
from app.service.video_ranking_service import VideoRankingService
from app.schema.ranking_schemas import VideoRankingRequest, VideoRankingResponse, RankedVideoResult
from app.config import API_BASE_URL # Import URL cơ sở từ config

# Helper function này tương tự như trong QueryController của bạn.
def _prefix_from_group(group_num_str: str) -> str:
    """Trả về tiền tố (K0, K, L) dựa trên group number."""
    try:
        g = int(group_num_str)
    except (TypeError, ValueError):
        g = 99999
    if g <= 9: return "K0"
    elif g <= 20: return "K"
    else: return "L"

class RankingController:
    def __init__(
        self,
        ranking_service: VideoRankingService,
        id2index_path: Path
    ):
        self.ranking_service = ranking_service
        self.id2index = self._load_id2index(id2index_path)

    def _load_id2index(self, path: Path) -> dict:
        """Tải file JSON chứa map từ key_id sang 'group/video/kf_num'."""
        if not path.exists():
            print(f"CẢNH BÁO: Không tìm thấy file id2index tại: {path}")
            return {}
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    # --- LOGIC ĐÃ ĐƯỢC SỬA ĐỔI HOÀN TOÀN ---
    def _get_full_path_from_key(self, key_id: int) -> str:
        """
        Chuyển đổi một key_id (ví dụ: 293976) thành một URL ảnh đầy đủ.
        Sử dụng 'keyframe_num' từ id2index.json để tạo tên file.
        """
        key_str = str(key_id)
        if key_str not in self.id2index:
            return f"{API_BASE_URL}/images/not_found.webp"

        # Lấy giá trị "group/video/keyframe_num", ví dụ: "19/27/56789"
        path_info = self.id2index[key_str]
        try:
            # Tách ra cả 3 phần
            group, video, keyframe_num = path_info.split('/')

            # 1. Tạo cấu trúc thư mục đúng: K19/V027
            prefix = _prefix_from_group(group)
            group_folder = f"{prefix}{int(group)}"
            video_folder = f"V{int(video):03d}"

            # 2. Tạo tên file ảnh từ keyframe_num (đã được pad 8 chữ số)
            img_name = f"{int(keyframe_num)}.webp"

            # 3. Kết hợp lại thành URL cuối cùng
            return f"{API_BASE_URL}/images/{group_folder}/{video_folder}/{img_name}"

        except Exception as e:
            print(f"Lỗi khi xử lý đường dẫn cho key {key_id} (path_info: '{path_info}'): {e}")
            return f"{API_BASE_URL}/images/invalid_path.webp"

    async def rank_videos_by_dp(self, request: VideoRankingRequest) -> VideoRankingResponse:
        """
        Hàm chính của controller, gọi service và định dạng lại kết quả.
        """
        service_results = await self.ranking_service.rank_videos(
            events=request.events,
            top_k=request.top_k,
            penalty_weight=request.penalty_weight  # <-- Truyền tham số mới xuống service
        )

        final_results: List[RankedVideoResult] = []
        for res_dict in service_results:
            try:
                video_id = res_dict["video_id"] # ví dụ: "19/27"
                group, video = video_id.split('/')

                # Tạo đường dẫn ảnh đầy đủ cho các keyframe đã được align
                aligned_paths = [self._get_full_path_from_key(key_id) for key_id in res_dict["aligned_key_ids"]]

                # Tạo đối tượng Pydantic cuối cùng
                result_obj = RankedVideoResult(
                    video_id=video_id,
                    group_num=str(group),
                    video_num=int(video),
                    dp_score=res_dict["score"],
                    aligned_key_ids=res_dict["aligned_key_ids"],
                    aligned_key_paths=aligned_paths
                )
                final_results.append(result_obj)

            except Exception as e:
                print(f"Lỗi khi xử lý kết quả cho video_id '{res_dict.get('video_id')}': {e}")
                continue

        return VideoRankingResponse(results=final_results)
