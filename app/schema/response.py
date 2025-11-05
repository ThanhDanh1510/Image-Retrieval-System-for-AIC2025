# Project-relative path: app/schema/response.py
from pydantic import BaseModel, Field
from typing import Optional

# 1. Định nghĩa một lần duy nhất, bao gồm cả ocr_text
class KeyframeServiceReponse(BaseModel):
    """
    Mô hình dữ liệu nội bộ mà các Service trả về.
    Nó chứa tất cả thông tin cần thiết.
    """
    key: int = Field(..., description="Keyframe key")
    video_num: int = Field(..., description="Video ID")
    group_num: str = Field(..., description="Group ID")
    keyframe_num: int = Field(..., description="Keyframe number")
    confidence_score: float = Field(..., description="Confidence score")
    ocr_text: str = Field(default="", description="OCR text content")

class SingleKeyframeDisplay(BaseModel):
    key: Optional[str] = None
    path: str
    score: float
    video_name: str
    name_img: str
    ocr_text: str

class KeyframeDisplay(BaseModel):
    """Mô hình response cuối cùng chứa một danh sách kết quả."""
    results: list[SingleKeyframeDisplay]
    
# --- ASR Response Models ---
class AsrSegmentWithKeyframes(BaseModel):
    """Mô tả một segment ASR tìm thấy và các keyframe đại diện của nó."""
    text: str
    score: float
    video_name: str
    start_time: float
    end_time: float
    total_keyframes_in_segment: int
    representative_keyframes: list[SingleKeyframeDisplay]

class AsrResultDisplay(BaseModel):
    """Response cuối cùng cho một tìm kiếm ASR."""
    results: list[AsrSegmentWithKeyframes]