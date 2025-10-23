# Project-relative path: app/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

# Đảm bảo import router keyframe_api
from router import keyframe_api
from core.lifespan import lifespan
from core.logger import SimpleLogger
# Đảm bảo import router video_api
from router import video_api

logger = SimpleLogger(__name__)

IMAGES_DIR = os.getenv("IMAGES_DIR",
    os.path.join(os.path.dirname(__file__), "..", "images"))



# Custom middleware để thêm CORS headers cho static files
class CORSStaticFilesMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/images"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response

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

    Try the simple search endpoint `/api/v1/keyframe/search` with a natural language query
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(CORSStaticFilesMiddleware)

# --- Include API routes ---
# Dòng này đăng ký /api/v1/keyframe/search, /api/v1/keyframe/rewrite, etc.
app.include_router(keyframe_api.router, prefix="/api/v1")
# Dòng này đăng ký /api/v1/video/rank-by-events
app.include_router(video_api.router, prefix="/api/v1")
# -------------------------

# Mount static files với error handling
try:
    abs_images_dir = os.path.abspath(IMAGES_DIR)
    if os.path.exists(abs_images_dir):
        app.mount("/images", StaticFiles(directory=abs_images_dir), name="images")
        logger.info(f"Mounted static files from: {abs_images_dir}")
    else:
        logger.error(f"Images directory not found: {abs_images_dir}")
        possible_paths = [
            "../images",
            "../../images",
            "./images",
            os.path.join(os.path.dirname(__file__), "..", "images")
        ]
        for path in possible_paths:
            if os.path.exists(path):
                logger.info(f"Found images directory at: {os.path.abspath(path)}")
                break
except Exception as e:
    logger.error(f"Failed to mount static files: {e}")

# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """
    Root endpoint with API information.
    """
    return {
        "message": "Keyframe Search API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
        "api_health": "/api/v1/keyframe/health", # Giả định bạn có endpoint này
        "search_endpoint": "/api/v1/keyframe/search",
        "rewrite_endpoint": "/api/v1/keyframe/rewrite", # Thêm thông tin endpoint rewrite
        "ranking_endpoint": "/api/v1/video/rank-by-events", # Thêm thông tin endpoint ranking
        "images_endpoint": "/images",
        "status": "running"
    }

# Health check endpoint
@app.get("/health", tags=["health"])
async def health():
    """
    Simple health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "keyframe-search-api",
        "images_dir": IMAGES_DIR,
        "images_mounted": os.path.exists(IMAGES_DIR)
    }

# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global exception handler for unhandled errors.
    """
    logger.error(f"Unhandled exception on {request.url}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error occurred",
            "error_type": type(exc).__name__,
            "path": str(request.url)
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """
    Handler for HTTP exceptions.
    """
    logger.warning(f"HTTP exception on {request.url}: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "path": str(request.url)
        }
    )

# Debug endpoints (giữ nguyên nếu bạn cần)
@app.get("/debug/paths", tags=["debug"])
async def debug_paths():
    """Debug endpoint để kiểm tra đường dẫn"""
    return {
        "cwd": os.getcwd(),
        "script_dir": os.path.dirname(__file__),
        "images_dir": IMAGES_DIR,
        "images_exists": os.path.exists(IMAGES_DIR),
        "is_directory": os.path.isdir(IMAGES_DIR) if os.path.exists(IMAGES_DIR) else False,
        "absolute_images_path": os.path.abspath(IMAGES_DIR)
    }

@app.get("/debug/mount-status", tags=["debug"])
async def mount_status():
    """Kiểm tra trạng thái mount và sample file"""
    sample_path = "L06/V013/00015158.webp" # Thay đổi nếu cần
    full_path = os.path.join(IMAGES_DIR, sample_path)

    return {
        "images_dir": IMAGES_DIR,
        "images_dir_exists": os.path.exists(IMAGES_DIR),
        "sample_file_path": full_path,
        "sample_file_exists": os.path.exists(full_path),
        "is_file": os.path.isfile(full_path) if os.path.exists(full_path) else False,
        "file_size": os.path.getsize(full_path) if os.path.exists(full_path) else None,
        "app_routes": [str(route) for route in app.routes],
        "mounted_apps": [str(route) for route in app.routes if hasattr(route, 'app')]
    }

@app.get("/debug/file-permissions/{path:path}", tags=["debug"])
async def check_file_permissions(path: str):
    """Kiểm tra quyền truy cập file"""
    full_path = os.path.join(IMAGES_DIR, path)
    result = {
        "requested_path": path,
        "full_path": full_path,
        "exists": os.path.exists(full_path)
    }

    if os.path.exists(full_path):
        try:
            with open(full_path, 'rb') as f:
                f.read(100)
            result["readable"] = True
        except Exception as e:
            result["readable"] = False
            result["read_error"] = str(e)

    return result

# Run server
if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Keyframe Search API...")
    logger.info(f"Images directory: {IMAGES_DIR}")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True, # Giữ reload=True khi đang phát triển
        log_level="info"
    )