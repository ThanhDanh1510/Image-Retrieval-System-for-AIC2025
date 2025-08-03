from pydantic import BaseModel, Field


class KeyframeServiceReponse(BaseModel):
    key: int = Field(..., description="Keyframe key")
    video_num: int = Field(..., description="Video ID")
    group_num: int = Field(..., description="Group ID")
    keyframe_num: int = Field(..., description="Keyframe number")
    confidence_score: float = Field(..., description="Keyframe number")



class SingleKeyframeDisplay(BaseModel):
    path: str
    score: float

class KeyframeDisplay(BaseModel):
    results: list[SingleKeyframeDisplay]