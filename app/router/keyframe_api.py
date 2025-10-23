# app/router/keyframe_api.py

from fastapi import APIRouter, Depends, Path as FastAPIPath, Query, UploadFile, File, Form
from typing import List

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
router = APIRouter(prefix="/keyframe", tags=["keyframe"])

# --- Helper Function để tránh lặp code ---
def _format_results_for_display(
    results: List[KeyframeServiceReponse],
    controller: QueryController
) -> KeyframeDisplay:
    """
    Hàm helper để nhận kết quả thô từ controller và chuyển đổi sang định dạng hiển thị.
    """
    # Sử dụng list comprehension cho gọn gàng
    display_results = [
        # SỬA LỖI: Dùng ** để unpack dictionary, tự động điền tất cả các trường khớp tên.
        # Điều này sẽ tự động bao gồm cả 'ocr_text' mà không cần liệt kê thủ công.
        SingleKeyframeDisplay(**controller.convert_to_display_result(result))
        for result in results
    ]
    return KeyframeDisplay(results=display_results)

# --- SEMANTIC SEARCH ENDPOINTS ---
@router.post("/search", response_model=KeyframeDisplay, summary="Simple Semantic Search")
async def search_keyframes(
    request: TextSearchRequest,
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_text(request.query, request.top_k, request.score_threshold)
    return _format_results_for_display(results, controller)

@router.post("/search/exclude-groups", response_model=KeyframeDisplay, summary="Semantic Search with Group Exclusion")
async def search_keyframes_exclude_groups(
    request: TextSearchWithExcludeGroupsRequest,
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_text_with_exclude_group(request.query, request.top_k, request.score_threshold, request.exclude_groups)
    return _format_results_for_display(results, controller)

@router.post("/search/selected-groups-videos", response_model=KeyframeDisplay, summary="Semantic Search with Group/Video Selection")
async def search_keyframes_selected_groups_videos(
    request: TextSearchWithSelectedGroupsAndVideosRequest,
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_with_selected_video_group(request.query, request.top_k, request.score_threshold, request.include_groups, request.include_videos)
    return _format_results_for_display(results, controller)

# --- OCR SEARCH ENDPOINTS ---
@router.post("/search/ocr", response_model=KeyframeDisplay, summary="Simple OCR Search")
async def search_keyframes_ocr(
    request: TextSearchRequest,
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_ocr(request.query, request.top_k)
    return _format_results_for_display(results, controller)

@router.post("/search/ocr/exclude-groups", response_model=KeyframeDisplay, summary="OCR Search with Group Exclusion")
async def search_keyframes_ocr_exclude_groups(
    request: TextSearchWithExcludeGroupsRequest,
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_ocr_with_exclude_group(request.query, request.top_k, request.exclude_groups)
    return _format_results_for_display(results, controller)

@router.post("/search/ocr/selected-groups-videos", response_model=KeyframeDisplay, summary="OCR Search with Group/Video Selection")
async def search_keyframes_ocr_selected_groups_videos(
    request: TextSearchWithSelectedGroupsAndVideosRequest,
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_ocr_with_selected_video_group(request.query, request.top_k, request.include_groups, request.include_videos)
    return _format_results_for_display(results, controller)

@router.get(
    "/search/similar/{keyframe_key}",
    response_model=KeyframeDisplay,
    summary="Find similar images (Image-to-Image search)",
    description="Cung cấp key của một keyframe, API sẽ trả về các keyframe có vector gần nhất."
)
async def search_similar_keyframes(
    keyframe_key: int = FastAPIPath(..., ge=0, description="The unique key of the source keyframe"),
    top_k: int = Query(default=100, ge=1, le=100, description="Number of similar results to return"),
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_similar_images(
        key=keyframe_key,
        top_k=top_k
    )
    return _format_results_for_display(results, controller)

@router.post(
    "/search/similar/upload",
    response_model=KeyframeDisplay,
    summary="Find similar images by uploading an image",
    description="Upload một file ảnh, API sẽ trả về các keyframe có vector gần nhất."
)
async def search_similar_by_upload(
    # FastAPI sẽ nhận file từ một form-data có key là "file"
    file: UploadFile = File(..., description="The image file to search with"),
    # Nhận top_k cũng từ form-data
    top_k: int = Form(default=100, ge=1, le=100, description="Number of similar results to return"),
    controller: QueryController = Depends(get_query_controller)
):
    results = await controller.search_similar_by_upload(
        image_file=file,
        top_k=top_k
    )
    return _format_results_for_display(results, controller)