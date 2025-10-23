# app/schema/request.py

from pydantic import BaseModel, Field, validator
from typing import List, Union

class BaseSearchRequest(BaseModel):
    """Base search request with common parameters"""
    query: str = Field(..., description="Search query text", min_length=1, max_length=1000)
    top_k: int = Field(default=10, ge=1, le=500, description="Number of top results to return")
    score_threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum confidence score threshold for semantic search")

class TextSearchRequest(BaseSearchRequest):
    """Simple text search request, also used for simple OCR search."""
    pass

class TextSearchWithExcludeGroupsRequest(BaseSearchRequest):
    """Text search request with group exclusion"""
    exclude_groups: List[Union[int, str]] = Field(
        default_factory=list,
        description="List of group IDs to exclude from search results",
    )

    @validator('exclude_groups', pre=True)
    def convert_groups_to_str(cls, v):
        if isinstance(v, list):
            return [str(item) for item in v]
        return v

class TextSearchWithSelectedGroupsAndVideosRequest(BaseSearchRequest):
    """Text search request with specific group and video selection"""
    include_groups: List[Union[int, str]] = Field(
        default_factory=list,
        description="List of group IDs to include in search results",
    )
    include_videos: List[int] = Field(
        default_factory=list,
        description="List of video IDs to include in search results",
    )

    @validator('include_groups', pre=True)
    def convert_groups_to_str(cls, v):
        if isinstance(v, list):
            return [str(item) for item in v]
        return v