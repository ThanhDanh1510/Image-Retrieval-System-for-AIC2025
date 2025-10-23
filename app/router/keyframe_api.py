# Project-relative path: app/router/keyframe_api.py

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Optional

# --- Thêm Pydantic model cho request/response của rewrite ---
from pydantic import BaseModel, Field # Đảm bảo đã import

class RewriteRequest(BaseModel):
    query: str = Field(..., description="Query to rewrite", min_length=1)

class RewriteResponse(BaseModel):
    original_query: str
    rewritten_query: str
# -----------------------------------------------------------

from schema.request import (
    TextSearchRequest,
    TextSearchWithExcludeGroupsRequest,
    TextSearchWithSelectedGroupsAndVideosRequest,
)

from schema.response import KeyframeServiceReponse, SingleKeyframeDisplay, KeyframeDisplay
from controller.query_controller import QueryController
# --- Thêm dependency cho rewrite service ---
from core.dependencies import get_query_controller, get_query_rewrite_service_dep
from service.query_rewrite_service import QueryRewriteService
# ----------------------------------------
from core.logger import SimpleLogger

logger = SimpleLogger(__name__)

router = APIRouter(
    prefix="/keyframe",
    tags=["keyframe"],
    responses={404: {"description": "Not found"}},
)

# --- ✨ NEW ENDPOINT: /rewrite ---
@router.post(
    "/rewrite",
    response_model=RewriteResponse,
    summary="Rewrite a query using LLM",
    description="Rewrites the input query for better semantic search, focusing on visual descriptions.",
)
async def rewrite_query_endpoint(
    request: RewriteRequest,
    rewrite_service: Optional[QueryRewriteService] = Depends(get_query_rewrite_service_dep),
):
    if rewrite_service is None:
        logger.warning("Rewrite requested but service is not available/configured.")
        # Trả về query gốc nếu service không có
        return RewriteResponse(
            original_query=request.query,
            rewritten_query=request.query
        )

    try:
        rewritten = rewrite_service.rewrite(request.query)
        logger.info(f"Rewriting '{request.query}' -> '{rewritten}'")
        return RewriteResponse(
            original_query=request.query,
            rewritten_query=rewritten
        )
    except Exception as e:
        logger.error(f"Error during query rewrite: {e}")
        # Trả về query gốc khi có lỗi
        return RewriteResponse(
            original_query=request.query,
            rewritten_query=request.query
        )
# --- End new endpoint ---

@router.post(
    "/search",
    response_model=KeyframeDisplay,
    # ... (summary, description, response_description giữ nguyên) ...
)
async def search_keyframes(
    request: TextSearchRequest, # Sử dụng model gốc không có rewrite flag
    controller: QueryController = Depends(get_query_controller),
    # http_req: Request = None, # Không cần nữa
):
    """Search for keyframes using text query with semantic similarity."""
    logger.info(f"Text search request: query='{request.query}', top_k={request.top_k}, threshold={request.score_threshold}")

    # --- Xóa logic gọi rewrite ở đây ---
    results = await controller.search_text(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        # rewrite và rewrite_provider đã bị xóa khỏi controller.search_text
    )

    logger.info(f"Found {len(results)} results for query: '{request.query}'")

    display_results = []
    for result in results:
        display_data = controller.convert_to_display_result(result)
        display_results.append(SingleKeyframeDisplay(
            path=display_data["path"],
            score=display_data["score"],
            video_name=display_data["video_name"],
            name_img=display_data["name_img"]
        ))

    return KeyframeDisplay(results=display_results)

@router.post(
    "/search/exclude-groups",
    response_model=KeyframeDisplay,
    # ... (summary, description, response_description giữ nguyên) ...
)
async def search_keyframes_exclude_groups(
    request: TextSearchWithExcludeGroupsRequest, # Sử dụng model gốc không có rewrite flag
    controller: QueryController = Depends(get_query_controller)
):
    """Search for keyframes with group exclusion filtering."""
    logger.info(f"Text search with group exclusion: query='{request.query}', exclude_groups={request.exclude_groups}")

    # --- Xóa logic gọi rewrite ở đây ---
    results = await controller.search_text_with_exclude_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_group_exclude=request.exclude_groups,
        # rewrite và rewrite_provider đã bị xóa
    )

    logger.info(f"Found {len(results)} results excluding groups {request.exclude_groups}")

    display_results = []
    for result in results:
        display_data = controller.convert_to_display_result(result)
        display_results.append(SingleKeyframeDisplay(
            path=display_data["path"],
            score=display_data["score"],
            video_name=display_data.get("video_name", ""),
            name_img=display_data.get("name_img", "")
        ))

    return KeyframeDisplay(results=display_results)

@router.post(
    "/search/selected-groups-videos",
    response_model=KeyframeDisplay,
     # ... (summary, description, response_description giữ nguyên) ...
)
async def search_keyframes_selected_groups_videos(
    request: TextSearchWithSelectedGroupsAndVideosRequest, # Sử dụng model gốc không có rewrite flag
    controller: QueryController = Depends(get_query_controller)
):
    """Search for keyframes within selected groups and videos."""
    logger.info(f"Text search with selection: query='{request.query}', include_groups={request.include_groups}, include_videos={request.include_videos}")

    # --- Xóa logic gọi rewrite ở đây ---
    results = await controller.search_with_selected_video_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_of_include_groups=request.include_groups,
        list_of_include_videos=request.include_videos,
         # rewrite và rewrite_provider đã bị xóa
    )

    logger.info(f"Found {len(results)} results within selected groups/videos")

    display_results = []
    for result in results:
        display_data = controller.convert_to_display_result(result)
        display_results.append(SingleKeyframeDisplay(
           path=display_data["path"],
            score=display_data["score"],
            video_name=display_data.get("video_name", ""),
            name_img=display_data.get("name_img", "")
        ))

    return KeyframeDisplay(results=display_results)