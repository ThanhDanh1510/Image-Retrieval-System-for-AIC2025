from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv
from pathlib import Path
load_dotenv()


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



class AppSettings(BaseSettings):
    BASE_DIR = Path(__file__).resolve().parent.parent  # từ core → app → project_root

    DATA_FOLDER = BASE_DIR / "images"
    ID2INDEX_PATH: str = BASE_DIR / "id2index.json"
    MODEL_NAME: str = "hf-hub:laion/CLIP-convnext_xxlarge-laion2B-s34B-b82K-augreg-soup"