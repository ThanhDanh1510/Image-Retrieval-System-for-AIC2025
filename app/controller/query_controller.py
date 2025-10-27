# Project-relative path: app/controller/query_controller.py
from pathlib import Path
import json
import os
import sys
from fastapi import UploadFile # <<< THÊM 1: Import UploadFile
from PIL import Image         # <<< THÊM 2: Import Image
import io                     # <<< THÊM 3: Import io

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../'))

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

from service import ModelService, KeyframeQueryService, OcrQueryService
from schema.response import KeyframeServiceReponse
from config import DATA_FOLDER_PATH, API_BASE_URL
from typing import Optional



class QueryController:
    def __init__(
        self,
        data_folder: Path,
        id2index_path: Path,
        model_service: ModelService,
        keyframe_service: KeyframeQueryService,
        ocr_service: OcrQueryService,
        base_url: str = "http://localhost:8000",
        rewrite_service: Optional[object] = None,  # NEW: optional injection
    ):
        self.data_folder = DATA_FOLDER_PATH
        self.id2index = json.load(open(id2index_path, 'r'))
        print(f"Loaded id2index from: {id2index_path}")
        # print(f"Sample data: {list(self.id2index.items())[:5]}")

        self.model_service = model_service
        self.keyframe_service = keyframe_service
        self.ocr_service = ocr_service
        self.base_url = API_BASE_URL

        self._rewrite_service = rewrite_service  # NEW

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
            f"{prefix}{g:01d}/V{v:03d}/{kf}.webp"
        )
        return path, model.confidence_score


    def get_image_url(self, relative_path: str) -> str:
        normalized_path = relative_path.replace('\\', '/')
        return f"{self.base_url}/images/{normalized_path}"

    def convert_to_display_result(self, model: KeyframeServiceReponse) -> dict:
        relative_path, score = self.convert_model_to_path(model)
        # Tách video_name và name_img từ model thay vì path
        prefix = _prefix_from_group(model.group_num)
        g = int(model.group_num)
        v = int(model.video_num)
        ocr_text = getattr(model, 'ocr_text', "")
        if prefix == "K0":
            video_name = f"{prefix}{g:01d}_V{v:03d}"
        else:
            video_name = f"{prefix}{g:02d}_V{v:03d}"
             
        name_img = str(model.keyframe_num)
        
        path = self.get_image_url(relative_path) # Chuyển đổi sang URL ở đây
        return {
            "key": str(model.key),  # <<< THÊM DÒNG NÀY ĐỂ FIX LỖI
            "path": path,
            "video_name": video_name,
            "name_img": name_img,
            "score": score, 
            "ocr_text": ocr_text,
        }
        


    async def search_text_with_exclude_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_group_exclude: list[str],
    ):
        # Chuẩn hóa nhóm về chuỗi số không leading zero (vd "022"->"22")
        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in list_group_exclude}

        # Lấy trực tiếp tất cả key thuộc các group cần loại trừ từ Mongo
        repo = self.keyframe_service.keyframe_mongo_repo
        docs = await repo.find({"group_num": {"$in": list(groups)}})
        exclude_ids = [d.key for d in docs]

        # Milvus search với expr: id not in exclude_ids
        embedding = self.model_service.embedding(query)
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        return raw_result
        

    async def search_text(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
    ):

    # --- Embedding & search ---
        embedding = self.model_service.embedding(query)
        raw_result = await self.keyframe_service.search_by_text(
            embedding, top_k, score_threshold
        )

        return raw_result

    # --- OCR SEARCH METHODS ---
    async def search_ocr(self, query: str, top_k: int):
        return await self.ocr_service.search_by_text(query, top_k)

    async def search_ocr_with_exclude_group(
        self, 
        query: str, 
        top_k: int, 
        list_group_exclude: list[str]  # <<< SỬA 1: Đổi tên tham số
    ):
        # 1. Lấy kết quả lớn từ ES
        es_results = await self.ocr_service.ocr_repo.search(query, top_k * 10) # Lấy nhiều hơn để lọc
        if not es_results: return []

        # 2. Chuẩn hóa nhóm
        # <<< SỬA 2: Dùng list_group_exclude
        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in list_group_exclude} 
        
        # 3. Lấy các ID cần loại trừ từ Mongo
        repo = self.ocr_service.keyframe_mongo_repo
        docs = await repo.find({"group_num": {"$in": list(groups)}})
        exclude_ids = {d.key for d in docs}

        # 4. Lọc kết quả ES trong Python
        filtered_es_results = [res for res in es_results if res["id"] not in exclude_ids][:top_k]
        if not filtered_es_results: return []

        # 5. Lấy data đầy đủ cho các ID đã lọc
        return await self.ocr_service.get_full_keyframe_data(filtered_es_results)

    async def search_ocr_with_selected_video_group(
        self, 
        query: str, 
        top_k: int, 
        list_of_include_groups: list[str], # <<< SỬA 3: Đổi tên tham số
        list_of_include_videos: list[int]  # <<< SỬA 4: Đổi tên tham số
    ):
        # 1. Lấy kết quả lớn từ ES
        es_results = await self.ocr_service.ocr_repo.search(query, top_k * 10) # Lấy nhiều hơn để lọc
        if not es_results: return []

        # 2. Chuẩn hóa nhóm
        # <<< SỬA 5: Dùng list_of_include_groups
        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in list_of_include_groups}
        # <<< SỬA 6: Dùng list_of_include_videos
        videos = set(list_of_include_videos)
        repo = self.ocr_service.keyframe_mongo_repo
        
        # 3. Lấy các ID được phép từ Mongo
        if not groups and not videos:
            # Nếu không có bộ lọc, tất cả ID từ ES đều được phép
            allowed_ids = {res['id'] for res in es_results}
        else:
            filt = {}
            if groups: filt["group_num"] = {"$in": list(groups)}
            if videos: filt["video_num"] = {"$in": list(videos)}
            docs = await repo.find(filt)
            allowed_ids = {d.key for d in docs}

        # 4. Lọc kết quả ES trong Python
        filtered_es_results = [res for res in es_results if res["id"] in allowed_ids][:top_k]
        if not filtered_es_results: return []
        
        # 5. Lấy data đầy đủ
        return await self.ocr_service.get_full_keyframe_data(filtered_es_results)
    
    async def search_similar_images(self, key: int, top_k: int):
        """
        Điều phối việc tìm kiếm các ảnh tương tự.
        """
        return await self.keyframe_service.search_by_image_key(key, top_k)
    
    async def search_similar_by_upload(self, image_file: UploadFile, top_k: int):
        """
        Điều phối việc tìm kiếm tương tự bằng file ảnh upload.
        """
        # 1. Đọc nội dung file ảnh
        contents = await image_file.read()
        
        # 2. Chuyển đổi file ảnh thành đối tượng PIL Image
        try:
            pil_image = Image.open(io.BytesIO(contents))
        except Exception as e:
            print(f"Error opening image: {e}")
            return []

        # 3. Tạo vector embedding từ ảnh
        image_embedding = self.model_service.embedding_image(pil_image)
        
        # 4. Tái sử dụng logic tìm kiếm bằng vector đã có
        #    score_threshold=0.0 để lấy tất cả kết quả gần nhất
        return await self.keyframe_service.search_by_text(
            text_embedding=image_embedding,
            top_k=top_k,
            score_threshold=0.0
        )
    async def search_with_selected_video_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_of_include_groups: list[str],
        list_of_include_videos: list[int],
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
        
        embedding = self.model_service.embedding(query)
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        return raw_result