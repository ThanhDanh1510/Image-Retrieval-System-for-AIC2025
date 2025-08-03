
from pathlib import Path
from fastapi import Depends, Request, HTTPException
from functools import lru_cache
import json

import os
import sys
ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)

sys.path.insert(0, ROOT_DIR)


from controller.query_controller import QueryController
from service import ModelService, KeyframeQueryService
from core.settings import KeyFrameIndexMilvusSetting, MongoDBSettings, AppSettings
from factory.factory import ServiceFactory
from core.logger import SimpleLogger

logger = SimpleLogger(__name__)



@lru_cache()
def get_app_settings():
    """Get MongoDB settings (cached)"""
    return AppSettings()


@lru_cache()
def get_milvus_settings():
    """Get Milvus settings (cached)"""
    return KeyFrameIndexMilvusSetting()


@lru_cache()
def get_mongo_settings():
    """Get MongoDB settings (cached)"""
    return MongoDBSettings()



def get_service_factory(request: Request) -> ServiceFactory:
    """Get ServiceFactory from app state"""
    service_factory = getattr(request.app.state, 'service_factory', None)
    if service_factory is None:
        logger.error("ServiceFactory not found in app state")
        raise HTTPException(
            status_code=503, 
            detail="Service factory not initialized. Please check application startup."
        )
    return service_factory





def get_model_service(service_factory: ServiceFactory = Depends(get_service_factory)) -> ModelService:
    try:
        model_service = service_factory.get_model_service()
        if model_service is None:
            logger.error("Model service not available from factory")
            raise HTTPException(
                status_code=503,
                detail="Model service not available"
            )
        return model_service
    except Exception as e:
        logger.error(f"Failed to get model service: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Model service initialization failed: {str(e)}"
        )
    

def get_keyframe_service(service_factory: ServiceFactory = Depends(get_service_factory)) -> KeyframeQueryService:
    """Get keyframe query service from ServiceFactory"""
    try:
        keyframe_service = service_factory.get_keyframe_query_service()
        if keyframe_service is None:
            logger.error("Keyframe service not available from factory")
            raise HTTPException(
                status_code=503,
                detail="Keyframe service not available"
            )
        return keyframe_service
    except Exception as e:
        logger.error(f"Failed to get keyframe service: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Keyframe service initialization failed: {str(e)}"
        )



def get_mongo_client(request: Request):
    """Get MongoDB client from app state"""
    mongo_client = getattr(request.app.state, 'mongo_client', None)
    if mongo_client is None:
        logger.error("MongoDB client not found in app state")
        raise HTTPException(
            status_code=503,
            detail="MongoDB client not initialized"
        )
    return mongo_client

async def check_mongodb_health(request: Request) -> bool:
    """Check MongoDB connection health"""
    try:
        mongo_client = get_mongo_client(request)
        await mongo_client.admin.command('ping')
        return True
    except Exception as e:
        logger.error(f"MongoDB health check failed: {str(e)}")
        return False



def get_milvus_repository(service_factory: ServiceFactory = Depends(get_service_factory)):
    """Get Milvus repository from ServiceFactory"""
    try:
        repository = service_factory.get_milvus_keyframe_repo()
        if repository is None:
            raise HTTPException(
                status_code=503,
                detail="Milvus repository not available"
            )
        return repository
    except Exception as e:
        logger.error(f"Failed to get Milvus repository: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Milvus repository initialization failed: {str(e)}"
        )


def get_query_controller(
    model_service: ModelService = Depends(get_model_service),
    keyframe_service: KeyframeQueryService = Depends(get_keyframe_service),
    milvus_settings: KeyFrameIndexMilvusSetting = Depends(get_milvus_settings),
    app_settings: AppSettings = Depends(get_app_settings)
) -> QueryController:
    """Get query controller instance"""
    try:
        logger.info("Creating query controller...")
        
        data_folder = Path(app_settings.DATA_FOLDER)
        id2index_path = Path(app_settings.ID2INDEX_PATH)
        
        if not data_folder.exists():
            logger.warning(f"Data folder does not exist: {data_folder}")
            data_folder.mkdir(parents=True, exist_ok=True)
            
        if not id2index_path.exists():
            logger.warning(f"ID2Index file does not exist: {id2index_path}")
            id2index_path.parent.mkdir(parents=True, exist_ok=True)
            with open(id2index_path, 'w') as f:
                json.dump({}, f)
        
        controller = QueryController(
            data_folder=data_folder,
            id2index_path=id2index_path,
            model_service=model_service,
            keyframe_service=keyframe_service
        )
        
        logger.info("Query controller created successfully")
        return controller
        
    except Exception as e:
        logger.error(f"Failed to create query controller: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Query controller initialization failed: {str(e)}"
        )