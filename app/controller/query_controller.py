# app/controller/query_controller.py

from pathlib import Path
import json
import os
import sys
from fastapi import UploadFile # <<< THÊM 1: Import UploadFile
from PIL import Image         # <<< THÊM 2: Import Image
import io                     # <<< THÊM 3: Import io

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../'))
sys.path.insert(0, ROOT_DIR)

# Helper functions for path generation (giữ nguyên logic của bạn)
def _prefix_from_group(group_num) -> str:
    try: g = int(group_num)
    except (TypeError, ValueError): g = 999999
    if g <= 9: return "K0"
    if g <= 20: return "K"
    return "L"

from service import ModelService, KeyframeQueryService, OcrQueryService
from schema.response import KeyframeServiceReponse
from config import DATA_FOLDER_PATH, API_BASE_URL

class QueryController:
    def __init__(
        self,
        data_folder: Path,
        id2index_path: Path,
        model_service: ModelService,
        keyframe_service: KeyframeQueryService,
        ocr_service: OcrQueryService,
        base_url: str = "http://localhost:8000"
    ):
        self.data_folder = Path(DATA_FOLDER_PATH)
        self.model_service = model_service
        self.keyframe_service = keyframe_service
        self.ocr_service = ocr_service
        self.base_url = API_BASE_URL

    def get_image_url(self, relative_path: str) -> str:
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
        ocr_text = getattr(model, 'ocr_text', "")
        
        return {
            # <<< THÊM DÒNG NÀY VÀO ĐÂY >>>
            "key": model.key,
            "path": path, "video_name": video_name, "name_img": name_img,
            "score": model.confidence_score, "ocr_text": ocr_text,
        }

    # --- SEMANTIC SEARCH METHODS ---
    async def search_text(self, query: str, top_k: int, score_threshold: float):
        embedding = self.model_service.embedding(query)
        return await self.keyframe_service.search_by_text(embedding, top_k, score_threshold)

    async def search_text_with_exclude_group(self, query: str, top_k: int, score_threshold: float, list_group_exclude: list[str]):
        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in list_group_exclude}
        repo = self.keyframe_service.keyframe_mongo_repo
        docs = await repo.find({"group_num": {"$in": list(groups)}})
        exclude_ids = [d.key for d in docs]
        embedding = self.model_service.embedding(query)
        return await self.keyframe_service.search_by_text_exclude_ids(embedding, top_k, score_threshold, exclude_ids)

    async def search_with_selected_video_group(self, query: str, top_k: int, score_threshold: float, list_of_include_groups: list[str], list_of_include_videos: list[int]):
        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in list_of_include_groups}
        videos = set(list_of_include_videos)
        repo = self.keyframe_service.keyframe_mongo_repo
        if not groups and not videos: return await self.search_text(query, top_k, score_threshold)
        
        filt = {}
        if groups: filt["group_num"] = {"$in": list(groups)}
        if videos: filt["video_num"] = {"$in": list(videos)}
        allowed_docs = await repo.find(filt)
        if not allowed_docs: return []
        allowed_ids = {d.key for d in allowed_docs}
        
        all_ids_cursor = await repo.collection.find({}, {"key": 1})
        all_ids = {doc["key"] async for doc in all_ids_cursor}
        exclude_ids = list(all_ids - allowed_ids)
        
        embedding = self.model_service.embedding(query)
        return await self.keyframe_service.search_by_text_exclude_ids(embedding, top_k, score_threshold, exclude_ids)

    # --- OCR SEARCH METHODS ---
    async def search_ocr(self, query: str, top_k: int):
        return await self.ocr_service.search_by_text(query, top_k)

    async def search_ocr_with_exclude_group(self, query: str, top_k: int, exclude_groups: list[str]):
        es_results = await self.ocr_service.ocr_repo.search(query, top_k * 10)
        if not es_results: return []

        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in exclude_groups}
        repo = self.ocr_service.keyframe_mongo_repo
        docs = await repo.find({"group_num": {"$in": list(groups)}})
        exclude_ids = {d.key for d in docs}

        filtered_es_results = [res for res in es_results if res["id"] not in exclude_ids][:top_k]
        if not filtered_es_results: return []

        return await self.ocr_service.get_full_keyframe_data(filtered_es_results)

    async def search_ocr_with_selected_video_group(self, query: str, top_k: int, include_groups: list[str], include_videos: list[int]):
        es_results = await self.ocr_service.ocr_repo.search(query, top_k * 10)
        if not es_results: return []

        groups = {str(int(g)) if str(g).isdigit() else str(g) for g in include_groups}
        videos = set(include_videos)
        repo = self.ocr_service.keyframe_mongo_repo
        
        if not groups and not videos:
            allowed_ids = {res['id'] for res in es_results}
        else:
            filt = {}
            if groups: filt["group_num"] = {"$in": list(groups)}
            if videos: filt["video_num"] = {"$in": list(videos)}
            docs = await repo.find(filt)
            allowed_ids = {d.key for d in docs}

        filtered_es_results = [res for res in es_results if res["id"] in allowed_ids][:top_k]
        if not filtered_es_results: return []
        
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