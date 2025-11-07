# Project-relative path: app/core/settings.py
from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Literal  # NEW

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # từ core → app → project_root


class MongoDBSettings(BaseSettings):
    MONGO_HOST: str = Field(..., alias='MONGO_HOST')
    MONGO_PORT: int = Field(..., alias='MONGO_PORT')
    MONGO_DB: str = Field(..., alias='MONGO_DB')
    MONGO_USER: str = Field(..., alias='MONGO_USER')
    MONGO_PASSWORD: str = Field(..., alias='MONGO_PASSWORD')





class IndexPathSettings(BaseSettings):
    FAISS_INDEX_PATH: str | None
    USEARCH_INDEX_PATH: str | None





class KeyFrameIndexMilvusSetting(BaseSettings):
    COLLECTION_NAME: str = "keyframe"
    HOST: str = 'localhost'
    PORT: str = '19530'
    METRIC_TYPE: str = 'COSINE'
    INDEX_TYPE: str = 'FLAT'
    BATCH_SIZE: int =10000
    SEARCH_PARAMS: dict = {}


class ElasticsearchSettings(BaseSettings):
    ES_HOST: str = Field(..., alias="ES_HOST")
    ES_PORT: int = Field(..., alias="ES_PORT")
    ES_USER: str = Field(..., alias="ES_USER")
    ELASTIC_PASSWORD: str = Field(..., alias="ELASTIC_PASSWORD")
    ES_OCR_INDEX: str = Field(..., alias="ES_OCR_INDEX")
    ES_ASR_INDEX: str = Field(..., alias="ES_ASR_INDEX")



class AppSettings(BaseSettings):
    DATA_FOLDER: str = str(BASE_DIR / "images")
    ID2INDEX_PATH: str = str(BASE_DIR / "embeddings" / "keyframe.json")
    MODEL_NAME: str = "hf-hub:microsoft/beit-large-patch16-224-pt22k-ft22k"
    
        # ===== Query Rewrite (optional) =====
    QUERY_REWRITE_ENABLED: bool = False             # NEW: mặc định tắt, hệ thống chạy y như cũ
    QUERY_REWRITE_PROVIDER: Optional[Literal["openai", "gemini"]] = None  # NEW: chọn provider nếu bật
    QUERY_REWRITE_TIMEOUT_MS: int = 12_000          # NEW: timeout gọi LLM (ms)

    # NEW: API key (tuỳ provider dùng cái nào thì set env cái đó)
    OPENAI_API_KEY: Optional[str] = None            # NEW
    GEMINI_API_KEY: Optional[str] = None            # NEW
    VIDEO_RANGES_PATH: str = str(BASE_DIR / "embeddings" / "video_index_ranges.json")
    DP_PENALTY_WEIGHT: float = 0.005
    MODEL_NAME: str = "hf-hub:microsoft/beit-large-patch16-224-pt22k-ft22k"

    MILVUS_PRE_THRESH: int = 1000
    
