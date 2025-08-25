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

class QueryController:
    
    def __init__(
        self,
        data_folder: Path,
        id2index_path: Path,
        model_service: ModelService,
        keyframe_service: KeyframeQueryService,
        base_url: str = "http://localhost:8000"
    ):
        self.data_folder = DATA_FOLDER_PATH
        self.id2index = json.load(open(id2index_path, 'r'))
        self.model_service = model_service
        self.keyframe_service = keyframe_service
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
        """Convert KeyframeServiceReponse thành format cho frontend"""
        # Tạo relative path
        relative_path = f"L{model.group_num}/V{model.video_num:03d}/{model.keyframe_num}.webp"
        
        return {
            "path": self.get_image_url(relative_path),
            "score": model.confidence_score,
            "video_id": model.video_num,
            "group_id": model.group_num,
            "keyframe_id": model.keyframe_num
        }
        
    async def search_text(
        self, 
        query: str,
        top_k: int,
        score_threshold: float
    ):
        embedding = self.model_service.embedding(query).tolist()[0]
        raw_result = await self.keyframe_service.search_by_text(embedding, top_k, score_threshold)
        
        # Trả về list KeyframeServiceReponse cho API endpoint
        return raw_result

    async def search_text_with_exclude_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_group_exclude: list[int]
    ):
        exclude_ids = [
            int(k) for k, v in self.id2index.items()
            if int(v.split('/')[0]) in list_group_exclude
        ]
        
        embedding = self.model_service.embedding(query).tolist()[0]
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        
        return raw_result

    async def search_with_selected_video_group(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        list_of_include_groups: list[int],
        list_of_include_videos: list[int]  
    ):     
        exclude_ids = None
        
        if len(list_of_include_groups) > 0 and len(list_of_include_videos) == 0:
            exclude_ids = [
                int(k) for k, v in self.id2index.items()
                if int(v.split('/')[0]) not in list_of_include_groups
            ]
        elif len(list_of_include_groups) == 0 and len(list_of_include_videos) > 0:
            exclude_ids = [
                int(k) for k, v in self.id2index.items()
                if int(v.split('/')[1]) not in list_of_include_videos
            ]
        elif len(list_of_include_groups) == 0 and len(list_of_include_videos) == 0:
            exclude_ids = []
        else:
            exclude_ids = [
                int(k) for k, v in self.id2index.items()
                if (
                    int(v.split('/')[0]) not in list_of_include_groups or
                    int(v.split('/')[1]) not in list_of_include_videos
                )
            ]

        embedding = self.model_service.embedding(query).tolist()[0]
        raw_result = await self.keyframe_service.search_by_text_exclude_ids(
            embedding, top_k, score_threshold, exclude_ids
        )
        
        return raw_result
