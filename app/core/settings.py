from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
from dotenv import load_dotenv

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



class AppSettings(BaseSettings):
    DATA_FOLDER: str = str(BASE_DIR / "images")
    ID2INDEX_PATH: str = str(BASE_DIR / "embeddings" / "batch1.json")
    MODEL_NAME: str = "hf-hub:microsoft/beit-large-patch16-224-pt22k-ft22k"