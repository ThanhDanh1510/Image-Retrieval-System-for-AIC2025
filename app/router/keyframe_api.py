# Project-relative path: app/router/keyframe_api.py

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Optional

from schema.request import (
    TextSearchRequest,
    TextSearchWithExcludeGroupsRequest,
    TextSearchWithSelectedGroupsAndVideosRequest,
)

from schema.response import KeyframeServiceReponse, SingleKeyframeDisplay, KeyframeDisplay
from controller.query_controller import QueryController
from core.dependencies import get_query_controller
from core.logger import SimpleLogger

logger = SimpleLogger(__name__)

router = APIRouter(
    prefix="/keyframe",
    tags=["keyframe"],
    responses={404: {"description": "Not found"}},
)

@router.post(
    "/search",
    response_model=KeyframeDisplay,
    summary="Simple text search for keyframes",
    description="""
    Perform a simple text-based search for keyframes using semantic similarity.
    This endpoint converts the input text query to an embedding and searches for
    the most similar keyframes in the database.

    **Parameters:**
    - **query**: The search text (1-1000 characters)
    - **top_k**: Maximum number of results to return (1-100, default: 10)
    - **score_threshold**: Minimum confidence score (0.0-1.0, default: 0.0)

    **Returns:**
    List of keyframes with their metadata and confidence scores, ordered by similarity.

    **Example:**
    ```
    {
        "query": "person walking in the park",
        "top_k": 5,
        "score_threshold": 0.7
    }
    ```
    """,
    response_description="List of matching keyframes with confidence scores"
)

async def search_keyframes(
    request: TextSearchRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """Search for keyframes using text query with semantic similarity."""
    logger.info(f"Text search request: query='{request.query}', top_k={request.top_k}, threshold={request.score_threshold}")

    results = await controller.search_text(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold
    )

    logger.info(f"Found {len(results)} results for query: '{request.query}'")

    # Sử dụng convert_to_display_result
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
    summary="Text search with group exclusion",
    description="""
    Perform text-based search for keyframes while excluding specific groups.
    Groups can be specified as integers or strings - they will be automatically converted to strings.

    **Example:**
    ```
    {
        "query": "sunset landscape",
        "top_k": 15,
        "score_threshold": 0.6,
        "exclude_groups": ["1", 3, "group_7"]
    }
    ```
    """,
    response_description="List of matching keyframes excluding specified groups"
)
async def search_keyframes_exclude_groups(
    request: TextSearchWithExcludeGroupsRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """Search for keyframes with group exclusion filtering."""
    logger.info(f"Text search with group exclusion: query='{request.query}', exclude_groups={request.exclude_groups}")

    results = await controller.search_text_with_exclude_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_group_exclude=request.exclude_groups  # Đã được convert thành str bởi validator
    )

    logger.info(f"Found {len(results)} results excluding groups {request.exclude_groups}")

    display_results = []
    for result in results:
        display_data = controller.convert_to_display_result(result)
        display_results.append(SingleKeyframeDisplay(
            path=display_data["path"],
            score=display_data["score"],
            video_name=display_data.get("video_name", ""),  # hoặc lấy mặc định nếu không có
            name_img=display_data.get("name_img", "")
        ))

    return KeyframeDisplay(results=display_results)

@router.post(
    "/search/selected-groups-videos",
    response_model=KeyframeDisplay,
    summary="Text search within selected groups and videos",
    description="""
    Perform text-based search for keyframes within specific groups and videos only.
    Groups can be specified as integers or strings - they will be automatically converted to strings.
    Videos remain as integers.

    **Example:**
    ```
    {
        "query": "car driving on highway",
        "top_k": 20,
        "score_threshold": 0.5,
        "include_groups": ["2", 4, "group_6"],
        "include_videos":
    }
    ```
    """,
    response_description="List of matching keyframes from selected groups and videos"
)
async def search_keyframes_selected_groups_videos(
    request: TextSearchWithSelectedGroupsAndVideosRequest,
    controller: QueryController = Depends(get_query_controller)
):
    """Search for keyframes within selected groups and videos."""
    logger.info(f"Text search with selection: query='{request.query}', include_groups={request.include_groups}, include_videos={request.include_videos}")

    results = await controller.search_with_selected_video_group(
        query=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        list_of_include_groups=request.include_groups,  # Đã được convert thành str bởi validator
        list_of_include_videos=request.include_videos   # Giữ nguyên int
    )

    logger.info(f"Found {len(results)} results within selected groups/videos")

    display_results = []
    for result in results:
        display_data = controller.convert_to_display_result(result)
        display_results.append(SingleKeyframeDisplay(
           path=display_data["path"],
            score=display_data["score"],
            video_name=display_data.get("video_name", ""),  # hoặc lấy mặc định nếu không có
            name_img=display_data.get("name_img", "")
        ))

    return KeyframeDisplay(results=display_results)
