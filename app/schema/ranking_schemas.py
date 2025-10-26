from pydantic import BaseModel, Field
from typing import List, Optional

class VideoRankingRequest(BaseModel):
    events: List[str] = Field(..., min_length=1, description="List of event descriptions in sequence")
    top_k: int = Field(default=10, ge=1, le=50, description="Number of top video results to return")
    penalty_weight: Optional[float] = Field(None, ge=0, description="Penalty for gaps between events (optional, uses default if None)")
    # Optional filter fields (assuming backend handles these)
    exclude_groups: Optional[List[str]] = Field(default=None, description="List of group IDs to exclude")
    include_groups: Optional[List[str]] = Field(default=None, description="List of group IDs to include")
    include_videos: Optional[List[int]] = Field(default=None, description="List of video IDs to include")


class RankedVideoResult(BaseModel):
    video_id: str = Field(..., description="Video identifier (e.g., '19/27')")
    group_num: str = Field(..., description="Group number as string")
    video_num: int = Field(..., description="Video number as integer")
    dp_score: float = Field(..., description="Alignment score from Dynamic Programming")
    # --- Ensure BOTH fields are defined ---
    aligned_key_ids: List[int] = Field(..., description="List of aligned keyframe integer IDs (unique keys)")
    aligned_key_paths: List[str] = Field(..., description="List of full URL paths for the aligned keyframes")
    # --- END ---

class VideoRankingResponse(BaseModel):
    results: List[RankedVideoResult]
