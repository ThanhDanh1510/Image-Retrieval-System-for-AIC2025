
from contextlib import asynccontextmanager
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

import os
import sys
ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)

sys.path.insert(0, ROOT_DIR)


from core.settings import MongoDBSettings, KeyFrameIndexMilvusSetting, AppSettings
from models.keyframe import Keyframe
from factory.factory import ServiceFactory
from core.logger import SimpleLogger

mongo_client: AsyncIOMotorClient = None
service_factory: ServiceFactory = None
logger = SimpleLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager for startup and shutdown events
    """
    logger.info("Starting up application...")
    
    try:
        mongo_settings = MongoDBSettings()
        milvus_settings = KeyFrameIndexMilvusSetting()
        appsetting = AppSettings()
        global mongo_client
        mongo_connection_string = (
            f"mongodb://{mongo_settings.MONGO_USER}:{mongo_settings.MONGO_PASSWORD}"
            f"@{mongo_settings.MONGO_HOST}:{mongo_settings.MONGO_PORT}"
        )
        
        mongo_client = AsyncIOMotorClient(mongo_connection_string)
        
        await mongo_client.admin.command('ping')
        logger.info("Successfully connected to MongoDB")
        
        database = mongo_client[mongo_settings.MONGO_DB]
        await init_beanie(
            database=database,
            document_models=[Keyframe]
        )
        logger.info("Beanie initialized successfully")
        
        global service_factory
        milvus_search_params = {
            "metric_type": milvus_settings.METRIC_TYPE,
            "params": milvus_settings.SEARCH_PARAMS
        }
        
        service_factory = ServiceFactory(
            milvus_collection_name=milvus_settings.COLLECTION_NAME,
            milvus_host=milvus_settings.HOST,
            milvus_port=milvus_settings.PORT,
            milvus_user="",  
            milvus_password="",  
            milvus_search_params=milvus_search_params,
            model_name=appsetting.MODEL_NAME,
            mongo_collection=Keyframe
        )
        logger.info("Service factory initialized successfully")
        
        app.state.service_factory = service_factory
        app.state.mongo_client = mongo_client
        
        logger.info("Application startup completed successfully")
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    
    yield  
    

    logger.info("Shutting down application...")
    
    try:
        if mongo_client:
            mongo_client.close()
            logger.info("MongoDB connection closed")
            
        logger.info("Application shutdown completed successfully")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

