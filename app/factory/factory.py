# Project-relative path: app/factory/factory.py
import os
import sys
from pathlib import Path # <-- THÊM IMPORT NÀY

ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)

sys.path.insert(0, ROOT_DIR)



from repository.mongo import KeyframeRepository
from repository.milvus import KeyframeVectorRepository
from service import KeyframeQueryService, ModelService
from models.keyframe import Keyframe
from core.beit3_processor import load_model_and_processor
from pymilvus import connections, Collection as MilvusCollection

# NEW: thêm import cho query rewrite
from typing import Optional  # NEW
from core.settings import AppSettings  # NEW
from service.query_rewrite_service import QueryRewriteService  # NEW

from service import KeyframeQueryService, ModelService, VideoRankingService # Thêm VideoRankingService
from controller.query_controller import QueryController
from controller.ranking_controller import RankingController # Thêm RankingController
from core.settings import AppSettings # Thêm AppSettings

class ServiceFactory:
    def __init__(
        self,
        milvus_collection_name: str,
        milvus_host: str,
        milvus_port: str ,
        milvus_user: str ,
        milvus_password: str ,
        milvus_search_params: dict,
        model_checkpoint: str,
        tokenizer_checkpoint: str,
        app_settings: AppSettings, # Thêm app_settings,
        milvus_db_name: str = "default",
        milvus_alias: str = "default",
        mongo_collection=Keyframe
    ):
        self._mongo_keyframe_repo = KeyframeRepository(collection=mongo_collection)
        self._milvus_keyframe_repo = self._init_milvus_repo(
            search_params=milvus_search_params,
            collection_name=milvus_collection_name,
            host=milvus_host,
            port=milvus_port,
            user=milvus_user,
            password=milvus_password,
            db_name=milvus_db_name,
            alias=milvus_alias
        )

        self._model_service = self._init_model_service(model_checkpoint, tokenizer_checkpoint)

        self._keyframe_query_service = KeyframeQueryService(
            keyframe_mongo_repo=self._mongo_keyframe_repo,
            keyframe_vector_repo=self._milvus_keyframe_repo
        )

        # NEW --- Query Rewrite wiring (optional, non-invasive) ---
        self._query_rewrite_service: Optional[QueryRewriteService] = None  # NEW
        try:  # NEW
            _app_settings = AppSettings()  # NEW
            if getattr(_app_settings, "QUERY_REWRITE_ENABLED", False):  # NEW
                _provider = getattr(_app_settings, "QUERY_REWRITE_PROVIDER", None)  # NEW
                _timeout_ms = int(getattr(_app_settings, "QUERY_REWRITE_TIMEOUT_MS", 12_000))  # NEW

                _api_key: Optional[str] = None  # NEW
                if _provider == "openai":  # NEW
                    _api_key = getattr(_app_settings, "OPENAI_API_KEY", None)  # NEW
                elif _provider == "gemini":  # NEW
                    _api_key = getattr(_app_settings, "GEMINI_API_KEY", None)  # NEW

                if _provider and _api_key:  # NEW
                    self._query_rewrite_service = QueryRewriteService(  # NEW
                        provider=_provider,
                        api_key=_api_key,
                        timeout_ms=_timeout_ms,
                    )  # NEW
        except Exception:  # NEW
            # Giữ nguyên hành vi cũ nếu thiếu config/lỗi khởi tạo  # NEW
            self._query_rewrite_service = None  # NEW
        # NEW --- end Query Rewrite wiring ---
        # --- THÊM MỚI ---
        # Service mới dùng chung repo và model
        self._video_ranking_service = VideoRankingService(
            model_service=self._model_service,
            vector_repo=self._milvus_keyframe_repo,
            keyframe_repo=self._mongo_keyframe_repo,
            settings=app_settings # Truyền AppSettings
        )
        # Controller mới
        self._ranking_controller = RankingController(
            ranking_service=self._video_ranking_service,
            id2index_path=Path(app_settings.ID2INDEX_PATH)
        )

        # Controller cũ (cần AppSettings)
        self._query_controller = QueryController(
            data_folder=Path(app_settings.DATA_FOLDER),
            id2index_path=Path(app_settings.ID2INDEX_PATH),
            model_service=self._model_service,
            keyframe_service=self._keyframe_query_service
        )

    def _init_milvus_repo(
        self,
        search_params: dict,
        collection_name: str,
        host: str,
        port: str,
        user: str,
        password: str,
        db_name: str = "default",
        alias: str = "default"
    ):
        if connections.has_connection(alias):
            connections.remove_connection(alias)

        conn_params = {
            "host": host,
            "port": port,
            "db_name": db_name
        }

        if user and password:
            conn_params["user"] = user
            conn_params["password"] = password

        connections.connect(alias=alias, **conn_params)
        collection = MilvusCollection(collection_name, using=alias)

        return KeyframeVectorRepository(collection=collection, search_params=search_params)

    def _init_model_service(self, model_checkpoint: str, tokenizer_checkpoint: str):
        return ModelService(
            model_checkpoint=model_checkpoint,
            tokenizer_checkpoint=tokenizer_checkpoint
        )

    def get_mongo_keyframe_repo(self):
        return self._mongo_keyframe_repo

    def get_milvus_keyframe_repo(self):
        return self._milvus_keyframe_repo

    def get_model_service(self):
        return self._model_service

    def get_keyframe_query_service(self):
        return self._keyframe_query_service

    # NEW
    def get_query_rewrite_service(self):
        return self._query_rewrite_service
    # --- THÊM MỚI ---
    def get_video_ranking_service(self):
        return self._video_ranking_service

    def get_ranking_controller(self):
        return self._ranking_controller

    # --- THÊM MỚI (hoặc di dời logic từ dependencies.py) ---
    # Tốt hơn là nên để Factory tạo luôn Controller
    def get_query_controller(self):
        return self._query_controller
