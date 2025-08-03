from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))


from router import keyframe_api
from core.lifespan import lifespan
from core.logger import SimpleLogger

logger = SimpleLogger(__name__)


app = FastAPI(
    title="Keyframe Search API",
    description="""
    ## Keyframe Search API

    A powerful semantic search API for video keyframes using vector embeddings.

    ### Features

    * **Text-to-Video Search**: Search for video keyframes using natural language
    * **Semantic Similarity**: Uses advanced embedding models for semantic understanding
    * **Flexible Filtering**: Include/exclude specific groups and videos
    * **Configurable Results**: Adjust result count and confidence thresholds
    * **High Performance**: Optimized vector search with Milvus backend

    ### Search Types

    1. **Simple Search**: Basic text search with confidence scoring
    2. **Group Exclusion**: Exclude specific video groups from results
    3. **Selective Search**: Search only within specified groups and videos
    4. **Advanced Search**: Comprehensive filtering with multiple criteria

    ### Use Cases

    * Content discovery and retrieval
    * Video recommendation systems
    * Media asset management
    * Research and analysis tools
    * Content moderation workflows

    ### Getting Started

    Try the simple search endpoint `/keyframe/search` with a natural language query
    like "person walking in park" or "sunset over mountains".
    """,
    version="1.0.0",
    contact={
        "name": "Keyframe Search Team",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    lifespan=lifespan
)

#
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(keyframe_api.router, prefix="/api/v1")


@app.get("/", tags=["root"])
async def root():
    """
    Root endpoint with API information.
    """
    return {
        "message": "Keyframe Search API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/keyframe/health",
        "search": "/api/v1/keyframe/search"
    }


@app.get("/health", tags=["health"])
async def health():
    """
    Simple health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "keyframe-search-api"
    }


# @app.exception_handler(Exception)
# async def global_exception_handler(request, exc):
#     """
#     Global exception handler for unhandled errors.
#     """
#     logger.error(f"Unhandled exception: {str(exc)}")
#     return JSONResponse(
#         status_code=500,
#         content={
#             "detail": "Internal server error occurred",
#             "error_type": type(exc).__name__
#         }
#     )


# @app.exception_handler(HTTPException)
# async def http_exception_handler(request, exc):
#     """
#     Handler for HTTP exceptions.
#     """
#     logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
#     return JSONResponse(
#         status_code=exc.status_code,
#         content={"detail": exc.detail}
#     )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  
        log_level="info"
    )