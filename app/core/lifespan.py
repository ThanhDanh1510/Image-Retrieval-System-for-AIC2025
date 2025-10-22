# Project-relative path: app/core/lifespan.py
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
# --- XÓA DÒNG GÂY LỖI ---
# Dòng import "init_dependencies" đã được xóa vì nó không cần thiết và gây ra lỗi.
# Toàn bộ logic khởi tạo đã nằm trong ServiceFactory.

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

        # ServiceFactory sẽ khởi tạo TẤT CẢ các service và controller cần thiết
        service_factory = ServiceFactory(
            milvus_collection_name=milvus_settings.COLLECTION_NAME,
            milvus_host=milvus_settings.HOST,
            milvus_port=milvus_settings.PORT,
            milvus_user="",
            milvus_password="",
            milvus_search_params=milvus_search_params,
            model_checkpoint=r"D:\data\beit3_large_patch16_384_f30k_retrieval.pth",
            tokenizer_checkpoint=r"D:\data\beit3.spm",
            app_settings=appsetting, # Truyền app_settings vào đây
            mongo_collection=Keyframe
        )

        # --- XÓA DÒNG GÂY LỖI ---
        # Lệnh gọi init_dependencies() đã được xóa.

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

