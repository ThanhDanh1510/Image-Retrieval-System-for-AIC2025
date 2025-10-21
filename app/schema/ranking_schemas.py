from pydantic import BaseModel, Field
from typing import List, Optional

class VideoRankingRequest(BaseModel):
    events: List[str] = Field(..., min_items=1, description="Chuỗi N sự kiện văn bản E1...EN")
    top_k: int = Field(default=10, ge=1, le=100)

    penalty_weight: Optional[float] = Field(
        default=None,
        ge=0,
        description="Weight for distance between frames."
    )


class RankedVideoResult(BaseModel):
    video_id: str # Ví dụ: "L06_V013"
    group_num: str
    video_num: int
    dp_score: float = Field(..., description="Điểm DP alignment score")

    # --- CÁC TRƯỜNG MỚI CHO BACKTRACKING ---
    aligned_key_ids: List[int] = Field(..., description="Danh sách các ID của keyframe đã được align theo thứ tự sự kiện")
    aligned_key_paths: List[str] = Field(..., description="Danh sách các đường dẫn ảnh đầy đủ của keyframe đã được align")

class VideoRankingResponse(BaseModel):
    results: List[RankedVideoResult]
