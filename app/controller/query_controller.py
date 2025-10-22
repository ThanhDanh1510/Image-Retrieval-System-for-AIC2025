# Project-relative path: app/controller/query_controller.py
from pathlib import Path
import json
import os
import sys

ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)

# Helper ở cấp module: chọn tiền tố theo group_num
def _prefix_from_group(group_num) -> str:
    """
    Trả về tiền tố theo quy tắc:
    - Nếu group_num <= 9: 'K0'
    - Nếu 10 <= group_num <= 20: 'K'
    - Nếu group_num > 20 hoặc không hợp lệ: 'L'
    """
    try:
        g = int(group_num)
    except (TypeError, ValueError):
        # Nếu không ép được thì mặc định 'L'
        g = 999999

    if g <= 9:
        return "K0"
    elif g <= 20:
        return "K"
    else:
        return "L"

def _normalize_group_token(group_token: str) -> str:
    # Lấy các chữ số trong token, ví dụ "K03" -> "03" -> "3"; nếu đã là "21" -> "21"
    digits = ''.join(ch for ch in group_token if ch.isdigit())
    return str(int(digits)) if digits else group_token

sys.path.insert(0, ROOT_DIR)

from service import ModelService, KeyframeQueryService
from schema.response import KeyframeServiceReponse
from config import DATA_FOLDER_PATH, API_BASE_URL

# NEW
from typing import Optional  # NEW
# Không bắt buộc import type cụ thể để tránh phụ thuộc cứng.  # NEW


class QueryController:
    def __init__(
        self,
        data_folder: Path,
        id2index_path: Path,
        model_service: ModelService,
        keyframe_service: KeyframeQueryService,
        base_url: str = "http://localhost:8000",
        rewrite_service: Optional[object] = None,  # NEW: optional injection
    ):
        self.data_folder = DATA_FOLDER_PATH
        self.id2index = json.load(open(id2index_path, 'r'))
        print(f"Loaded id2index from: {id2index_path}")
        print(f"Sample data: {list(self.id2index.items())[:5]}")

        self.model_service = model_service
        self.keyframe_service = keyframe_service
        self.base_url = API_BASE_URL

        self._rewrite_service = rewrite_service  # NEW

    # NEW: helper để rewrite có kiểm soát/fallback
    def _rewrite_if_needed(
        self,
        query: str,
        rewrite: bool = False,
        rewrite_provider: Optional[str] = None
    ) -> str:
        """
        Nếu rewrite=True và có rewrite_service thì rewrite query.
        Bất kỳ lỗi/case không phù hợp -> trả lại query gốc (fail-open).
        rewrite_provider chỉ là gợi ý, implementation hiện tại dùng provider đã cấu hình trong service.
        """
        if not rewrite:
            return query
        svc = getattr(self, "_rewrite_service", None)
        if svc is None:
            return query
        try:
            # Nếu service hỗ trợ set provider động thì có thể dùng rewrite_provider ở đây.
            # Hiện tại service đã cố định provider theo config -> chỉ gọi rewrite(query).
            return svc.rewrite(query)  # type: ignore[attr-defined]
        except Exception:
            return query

    def convert_model_to_path(
        self,
        model: KeyframeServiceReponse
    ) -> tuple[str, float]:
        """Convert KeyframeServiceReponse object thành path và score"""
        prefix = _prefix_from_group(model.group_num)
        # Ép kiểu về int để đảm bảo đúng định dạng và tránh lỗi
        g = int(model.group_num)
        v = int(model.video_num)
        kf = int(model.keyframe_num)
        path = os.path.join(
            self.data_folder,
            f"{prefix}{g:01d}/V{v:03d}/{kf}.webp"
        )
        return path, model.confidence_score


    def get_image_url(self, relative_path: str) -> str:
        """Convert relative path thành HTTP URL"""
        normalized_path = relative_path.replace('\\', '/')
        return f"{self.base_url}/images/{normalized_path}"

    def convert_to_display_result(self, model: KeyframeServiceReponse) -> dict:
        prefix = _prefix_from_group(model.group_num)
        g = int(model.group_num)
        v = int(model.video_num)
        kf = int(model.keyframe_num)
        relative_path = f"{prefix}{g}/V{v:03d}/{kf}.webp"
        video_name = f"{prefix}{g}_V{v:03d}"
        name_img = str(kf)
        path = self.get_image_url(relative_path)
        return {
            "path": path,
            "video_name": video_name,
            "name_img": name_img,
            "score": model.confidence_score,
        }

    async def search_text(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        rewrite: bool = False,                    # NEW: tùy chọn, mặc định False
        rewrite_provider: Optional[str] = None,   # NEW: tùy chọn
    ):
        """
        Thực hiện tìm kiếm text — nếu rewrite bật, query sẽ được rewrite trước khi embed.
        """
    # --- Rewrite query (nếu được bật) ---
        effective_query = self._rewrite_if_needed(
            query,
            rewrite=rewrite,
            rewrite_provider=rewrite_provider,
        )

    # Log rõ ràng phần rewrite để bạn thấy câu mới
        if effective_query != query:
            from core.logger import SimpleLogger
            SimpleLogger(__name__).info(
                f"[QueryRewrite] '{query}' -> '{effective_query}'"
            )
        else:
            from core.logger import SimpleLogger
            SimpleLogger(__name__).info(
                f"[QueryRewrite] No rewrite applied (using original query: '{query}')"
            )

    # --- Embedding & search ---
        embedding = self.model_service.embedding(effective_query)
        raw_result = await self.keyframe_service.search_by_text(
            embedding, top_k, score_threshold
        )

        return raw_result


    async def search_text_with_exclude_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_group_exclude: list[str],
        rewrite: bool = False,                    # NEW
        rewrite_provider: Optional[str] = None,   # NEW
    ):
        # Chuẩn hóa nhóm về chuỗi số không leading zero (vd "022"->"22")
        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in list_group_exclude}

        # Lấy trực tiếp tất cả key thuộc các group cần loại trừ từ Mongo
        repo = self.keyframe_service.keyframe_mongo_repo
        docs = await repo.find({"group_num": {"$in": list(groups)}})
        exclude_ids = [d.key for d in docs]

        # NEW: rewrite trước khi embed (nếu bật)
        effective_query = self._rewrite_if_needed(query, rewrite=rewrite, rewrite_provider=rewrite_provider)  # NEW

        # Milvus search với expr: id not in exclude_ids
        embedding = self.model_service.embedding(effective_query)
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        return raw_result


    async def search_with_selected_video_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_of_include_groups: list[str],
        list_of_include_videos: list[int],
        rewrite: bool = False,                    # NEW
        rewrite_provider: Optional[str] = None,   # NEW
    ):
        # Chuẩn hóa group về chuỗi số không leading zero (vd "L22" -> "22", "003" -> "3")
        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in list_of_include_groups}
        videos = set(list_of_include_videos)

        repo = self.keyframe_service.keyframe_mongo_repo

        if not groups and not videos:
            exclude_ids = []
        else:
            # Xây filter dict hợp lệ cho Beanie/PyMongo (AND mặc định giữa các trường)
            filt = {}
            if groups:
                filt["group_num"] = {"$in": list(groups)}
            if videos:
                filt["video_num"] = {"$in": list(videos)}

            # Lấy id được phép
            allowed_docs = await repo.find(filt)
            allowed_ids = {d.key for d in allowed_docs}

            # Lấy tất cả id rồi trừ đi allowed -> exclude (để Milvus chỉ trả trong tập allowed)
            all_docs = await repo.get_all()
            all_ids = {d.key for d in all_docs}
            exclude_ids = list(all_ids - allowed_ids)

        # NEW: rewrite trước khi embed (nếu bật)
        effective_query = self._rewrite_if_needed(query, rewrite=rewrite, rewrite_provider=rewrite_provider)  # NEW

        embedding = self.model_service.embedding(effective_query)
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        return raw_result
