from pathlib import Path
import json
import os
import sys

ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)

sys.path.insert(0, ROOT_DIR)

from service import ModelService, KeyframeQueryService
from schema.response import KeyframeServiceReponse
from config import DATA_FOLDER_PATH, API_BASE_URL
from service import ModelService, KeyframeQueryService, OcrQueryService

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
        self.data_folder = DATA_FOLDER_PATH
        self.id2index = json.load(open(id2index_path, 'r'))
        print(f"Loaded id2index from: {id2index_path}")
        print(f"Sample data: {list(self.id2index.items())[:5]}")

        self.model_service = model_service
        self.keyframe_service = keyframe_service
        self.ocr_service = ocr_service
        self.base_url = API_BASE_URL

    def convert_model_to_path(
        self,
        model: KeyframeServiceReponse
    ) -> tuple[str, float]:
        """Convert KeyframeServiceReponse object thành path và score"""
        path = os.path.join(
            self.data_folder,
            f"L{model.group_num}/V{model.video_num:03d}/{model.keyframe_num}.webp"
        )
        return path, model.confidence_score

    def get_image_url(self, relative_path: str) -> str:
        """Convert relative path thành HTTP URL"""
        normalized_path = relative_path.replace('\\', '/')
        return f"{self.base_url}/images/{normalized_path}"

    def convert_to_display_result(self, model: KeyframeServiceReponse) -> dict:
        relative_path = f"L{model.group_num}/V{model.video_num:03d}/{model.keyframe_num}.webp"
        video_name = f"L{model.group_num}_V{model.video_num:03d}"
        name_img = str(model.keyframe_num)
        path = self.get_image_url(relative_path)
    
        ocr_text = getattr(model, 'ocr_text', None)
    
        return {
            "path": path,
            "video_name": video_name,
            "name_img": name_img,
            "score": model.confidence_score,
            "ocr_text": ocr_text,
        }

    async def search_text(
        self,
        query: str,
        top_k: int,
        score_threshold: float
    ):
        embedding = self.model_service.embedding(query)
        raw_result = await self.keyframe_service.search_by_text(embedding, top_k, score_threshold)
        return raw_result

    async def search_text_with_exclude_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_group_exclude: list[str]  # đã chuẩn hóa sang str từ schema
    ):
        exclude_ids = [
            int(k) for k, v in self.id2index.items()
            if v.split('/')[0] in list_group_exclude  # so sánh chuỗi -> chuỗi
        ]
        embedding = self.model_service.embedding(query)
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        return raw_result


    async def search_with_selected_video_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_of_include_groups: list[str],  # đã chuẩn hóa
        list_of_include_videos: list[int]
    ):
        exclude_ids = None

        include_groups_set = set(list_of_include_groups)
        include_videos_set = set(list_of_include_videos)

        if len(include_groups_set) > 0 and len(include_videos_set) == 0:
            exclude_ids = [
                int(k) for k, v in self.id2index.items()
                if v.split('/')[0] not in include_groups_set
            ]
        elif len(include_groups_set) == 0 and len(include_videos_set) > 0:
            exclude_ids = [
                int(k) for k, v in self.id2index.items()
                if int(v.split('/')[1]) not in include_videos_set
            ]
        elif len(include_groups_set) == 0 and len(include_videos_set) == 0:
            exclude_ids = []
        else:
            exclude_ids = [
                int(k) for k, v in self.id2index.items()
                if (v.split('/')[0] not in include_groups_set or int(v.split('/')[1]) not in include_videos_set)
            ]

        embedding = self.model_service.embedding(query)
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        return raw_result

    async def search_ocr(
        self,
        query: str,
        top_k: int
    ):
        """
        Orchestrate OCR search.
        """
        raw_result = await self.ocr_service.search_by_text(query, top_k)
        return raw_result
    async def search_ocr_with_exclude_group(
        self,
        query: str,
        top_k: int,
        exclude_groups: list[str]
    ):
        """
        OCR search loại bỏ các group được chỉ định.
        """
        # 1. Tìm kiếm trên Elasticsearch, lấy danh sách id keyframe
        es_results = await self.ocr_service.ocr_repo.search(query, top_k)
        if not es_results:
            return []

        # 2. Lấy danh sách id cần loại bỏ dựa vào group mapping từ id2index
        exclude_ids = [
            int(k) for k, v in self.id2index.items()
            if v.split('/') in exclude_groups  # Lấy group_num (phần tử đầu tiên)
        ]
        # 3. Lọc kết quả, loại bỏ các id nằm trong exclude_ids
        filtered_es_results = [res for res in es_results if res["id"] not in exclude_ids]
        if not filtered_es_results:
            return []

        # 4. Lấy thông tin đầy đủ từ MongoDB
        filtered_ids = [res['id'] for res in filtered_es_results]
        keyframes = await self.ocr_service.keyframe_mongo_repo.get_keyframe_by_list_of_keys(filtered_ids)

        # 5. Kết hợp kết quả với score
        result_map = {res["id"]: res["score"] for res in filtered_es_results}
        response = []
        for keyframe in keyframes:
            if keyframe.key in result_map:
                response.append(
                    KeyframeServiceReponse(
                        key=keyframe.key,
                        video_num=keyframe.video_num,
                        group_num=keyframe.group_num,
                        keyframe_num=keyframe.keyframe_num,
                        confidence_score=result_map[keyframe.key]
                    )
                )
        # 6. Sắp xếp lại theo thứ tự của ES trả về
        sorted_ids = [res['id'] for res in filtered_es_results]
        response.sort(key=lambda r: sorted_ids.index(r.key))
        return response
    
    async def search_ocr_with_selected_video_group(
        self,
        query: str,
        top_k: int,
        include_groups: list[str],
        include_videos: list[int]
    ):
        """OCR search chỉ giữ lại kết quả thuộc các group hoặc video được chọn."""
        es_results = await self.ocr_service.ocr_repo.search(query, top_k)
        if not es_results:
            return []

        include_groups_set = set(include_groups)
        include_videos_set = set(include_videos)
        filtered_es_results = []
    
        for res in es_results:
            meta_val = self.id2index.get(str(res["id"])) or self.id2index.get(res["id"])
            if not meta_val:
                continue
            group_str, video_str = meta_val.split('/')[:2]
            video_int = int(video_str)
        
            if (group_str in include_groups_set) or (video_int in include_videos_set):
                filtered_es_results.append(res)
    
        if not filtered_es_results:
            return []
        
        filtered_ids = [res['id'] for res in filtered_es_results]
        keyframes = await self.ocr_service.keyframe_mongo_repo.get_keyframe_by_list_of_keys(filtered_ids)
    
        result_map = {res["id"]: res["score"] for res in filtered_es_results}
        response = []
        for keyframe in keyframes:
            if keyframe.key in result_map:
                response.append(
                    KeyframeServiceReponse(
                        key=keyframe.key,
                        video_num=keyframe.video_num,
                        group_num=keyframe.group_num,
                        keyframe_num=keyframe.keyframe_num,
                        confidence_score=result_map[keyframe.key]
                    )
                )
    
        sorted_ids = [res['id'] for res in filtered_es_results]
        response.sort(key=lambda r: sorted_ids.index(r.key))
        return response
