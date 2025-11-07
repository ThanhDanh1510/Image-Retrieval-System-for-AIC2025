# app/schema/ranking_schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional

class VideoRankingRequest(BaseModel):
    events: List[str] = Field(..., min_length=1, description="List of event descriptions in sequence")
    top_k: int = Field(default=10, ge=1, le=200, description="Number of top video results to return")
    penalty_weight: Optional[float] = Field(None, ge=0, description="Penalty for gaps between events (optional, uses default if None)")
    exclude_groups: Optional[List[str]] = Field(default=None, description="List of group IDs to exclude")
    include_groups: Optional[List[str]] = Field(default=None, description="List of group IDs to include")
    include_videos: Optional[List[int]] = Field(default=None, description="List of video IDs to include")

class AlignedFrameResult(BaseModel):
    """
    Một đối tượng duy nhất chứa cả key và path của keyframe đã được căn chỉnh.
    """
    key: int = Field(..., description="The unique key ID of the aligned keyframe")
    path: str = Field(..., description="The full URL path to the keyframe image")

class RankedVideoResult(BaseModel):
    video_id: str = Field(..., description="Video identifier (e.g., '19/27')")
    group_num: str = Field(..., description="Group number as string")
    video_num: int = Field(..., description="Video number as integer")
    dp_score: float = Field(..., description="Alignment score from Dynamic Programming")
    
    aligned_frames: List[AlignedFrameResult] = Field(..., description="List of aligned keyframes, each with its unique key and path")

class VideoRankingResponse(BaseModel):
    results: List[RankedVideoResult]