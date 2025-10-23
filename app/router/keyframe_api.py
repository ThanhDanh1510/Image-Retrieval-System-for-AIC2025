# Project-relative path: app/router/keyframe_api.py

from fastapi import (
    APIRouter, Depends, HTTPException, Query, Path as FastAPIPath,
    UploadFile, File, Form
)
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel, Field

# --- Request/Response Models for Rewrite ---
class RewriteRequest(BaseModel):
    query: str = Field(..., description="Query to rewrite", min_length=1)

class RewriteResponse(BaseModel):
    original_query: str
    rewritten_query: str
# -------------------------------------------

# --- Import Request/Response Schemas ---
from schema.request import (
    TextSearchRequest,
    TextSearchWithExcludeGroupsRequest,
    TextSearchWithSelectedGroupsAndVideosRequest,
)
from schema.response import KeyframeServiceReponse, SingleKeyframeDisplay, KeyframeDisplay
# ----------------------------------------

# --- Import Controller and Dependencies ---
from controller.query_controller import QueryController
from core.dependencies import get_query_controller, get_query_rewrite_service_dep
from service.query_rewrite_service import QueryRewriteService
# ----------------------------------------

from core.logger import SimpleLogger

logger = SimpleLogger(__name__)

# --- Router Definition ---
router = APIRouter(
    prefix="/keyframe",
    tags=["keyframe"],
    # responses={404: {"description": "Not found"}} # Optional: Add default responses if needed
)
# -------------------------

# --- Helper Function to Format Results ---
def _format_results_for_display(
    results: List[KeyframeServiceReponse],
    controller: QueryController
) -> KeyframeDisplay:
    """
    Helper to convert raw controller results into the display format.
    """
    display_results = [
        # Unpack the dictionary returned by convert_to_display_result
        # This automatically includes all matching fields like path, score, video_name, name_img, ocr_text etc.
        SingleKeyframeDisplay(**controller.convert_to_display_result(result))
        for result in results
        if result is not None # Add a check in case controller returns None for some reason
    ]
    return KeyframeDisplay(results=display_results)
# -----------------------------------------

# === SEMANTIC SEARCH ENDPOINTS ===

@router.post("/search", response_model=KeyframeDisplay, summary="Simple Semantic Search")
async def search_keyframes(
    request: TextSearchRequest,
    controller: QueryController = Depends(get_query_controller),
):
    """Search keyframes using semantic text query."""
    logger.info(f"Semantic search: query='{request.query}', k={request.top_k}, threshold={request.score_threshold}")
    results = await controller.search_text(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
    )
    logger.info(f"Found {len(results)} semantic results for query: '{request.query}'")
    return _format_results_for_display(results, controller)

@router.post("/search/exclude-groups", response_model=KeyframeDisplay, summary="Semantic Search with Group Exclusion")
async def search_keyframes_exclude_groups(
    request: TextSearchWithExcludeGroupsRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """Semantic search excluding specified groups."""
    logger.info(f"Semantic search excluding groups: query='{request.query}', exclude={request.exclude_groups}")
    results = await controller.search_text_with_exclude_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_group_exclude=request.exclude_groups,
    )
    logger.info(f"Found {len(results)} semantic results excluding groups {request.exclude_groups}")
    return _format_results_for_display(results, controller)

@router.post("/search/selected-groups-videos", response_model=KeyframeDisplay, summary="Semantic Search with Group/Video Selection")
async def search_keyframes_selected_groups_videos(
    request: TextSearchWithSelectedGroupsAndVideosRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """Semantic search within specified groups and videos."""
    logger.info(f"Semantic search selection: query='{request.query}', groups={request.include_groups}, videos={request.include_videos}")
    results = await controller.search_with_selected_video_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_of_include_groups=request.include_groups,
        list_of_include_videos=request.include_videos,
    )
    logger.info(f"Found {len(results)} semantic results within selected groups/videos")
    return _format_results_for_display(results, controller)

# === OCR SEARCH ENDPOINTS ===

@router.post("/search/ocr", response_model=KeyframeDisplay, summary="Simple OCR Search")
async def search_keyframes_ocr(
    request: TextSearchRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """Search keyframes based on recognized text content (OCR)."""
    logger.info(f"OCR search: query='{request.query}', k={request.top_k}")
    # Assuming controller has a search_ocr method similar to search_text
    # You might need to adjust the controller method name if it's different
    results = await controller.search_ocr(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold # Assuming OCR search also uses threshold
    )
    logger.info(f"Found {len(results)} OCR results for query: '{request.query}'")
    return _format_results_for_display(results, controller)

@router.post("/search/ocr/exclude-groups", response_model=KeyframeDisplay, summary="OCR Search with Group Exclusion")
async def search_keyframes_ocr_exclude_groups(
    request: TextSearchWithExcludeGroupsRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """OCR search excluding specified groups."""
    logger.info(f"OCR search excluding groups: query='{request.query}', exclude={request.exclude_groups}")
    # Assuming controller has search_ocr_with_exclude_group
    results = await controller.search_ocr_with_exclude_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_group_exclude=request.exclude_groups
    )
    logger.info(f"Found {len(results)} OCR results excluding groups {request.exclude_groups}")
    return _format_results_for_display(results, controller)

@router.post("/search/ocr/selected-groups-videos", response_model=KeyframeDisplay, summary="OCR Search with Group/Video Selection")
async def search_keyframes_ocr_selected_groups_videos(
    request: TextSearchWithSelectedGroupsAndVideosRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """OCR search within specified groups and videos."""
    logger.info(f"OCR search selection: query='{request.query}', groups={request.include_groups}, videos={request.include_videos}")
    # Assuming controller has search_ocr_with_selected_video_group
    results = await controller.search_ocr_with_selected_video_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_of_include_groups=request.include_groups,
        list_of_include_videos=request.include_videos
    )
    logger.info(f"Found {len(results)} OCR results within selected groups/videos")
    return _format_results_for_display(results, controller)

# === SIMILAR IMAGE SEARCH ENDPOINTS ===

@router.get(
    "/search/similar/{keyframe_key}",
    response_model=KeyframeDisplay,
    summary="Find similar images (Image-to-Image search)",
    description="Provide a keyframe key to find visually similar keyframes."
)
async def search_similar_keyframes(
    keyframe_key: int = FastAPIPath(..., ge=0, description="The unique key of the source keyframe"),
    top_k: int = Query(default=100, ge=1, le=200, description="Number of similar results"), # Increased max slightly
    controller: QueryController = Depends(get_query_controller)
):
    """Find keyframes visually similar to the one specified by key."""
    logger.info(f"Image similarity search: key={keyframe_key}, k={top_k}")
    # Assuming controller has search_similar_images
    results = await controller.search_similar_images(
        key=keyframe_key,
        top_k=top_k
    )
    logger.info(f"Found {len(results)} similar images for key: {keyframe_key}")
    return _format_results_for_display(results, controller)

@router.post(
    "/search/similar/upload",
    response_model=KeyframeDisplay,
    summary="Find similar images by uploading an image",
    description="Upload an image file to find visually similar keyframes."
)
async def search_similar_by_upload(
    file: UploadFile = File(..., description="The image file to search with"),
    top_k: int = Form(default=100, ge=1, le=200, description="Number of similar results"), # Increased max slightly
    controller: QueryController = Depends(get_query_controller)
):
    """Find keyframes visually similar to the uploaded image."""
    logger.info(f"Image similarity search by upload: filename='{file.filename}', k={top_k}")
    # Assuming controller has search_similar_by_upload
    results = await controller.search_similar_by_upload(
        image_file=file,
        top_k=top_k
    )
    logger.info(f"Found {len(results)} similar images for uploaded file: '{file.filename}'")
    return _format_results_for_display(results, controller)

# === QUERY REWRITE ENDPOINT ===

@router.post(
    "/rewrite",
    response_model=RewriteResponse,
    summary="Rewrite a query using LLM",
    description="Rewrites the input query for better semantic search.",
)
async def rewrite_query_endpoint(
    request: RewriteRequest,
    rewrite_service: Optional[QueryRewriteService] = Depends(get_query_rewrite_service_dep),
):
    """Endpoint to rewrite a user query using an external LLM."""
    if rewrite_service is None:
        logger.warning("Rewrite requested but service is not available/configured.")
        return RewriteResponse(original_query=request.query, rewritten_query=request.query)

    try:
        rewritten = rewrite_service.rewrite(request.query)
        logger.info(f"Rewriting '{request.query}' -> '{rewritten}'")
        return RewriteResponse(original_query=request.query, rewritten_query=rewritten)
    except Exception as e:
        logger.error(f"Error during query rewrite for '{request.query}': {e}", exc_info=True)
        # Return original query on error to avoid breaking search flow
        return RewriteResponse(original_query=request.query, rewritten_query=request.query)