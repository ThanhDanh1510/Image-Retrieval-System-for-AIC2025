from pydantic import BaseModel, Field
from typing import Optional

class KeyframeServiceReponse(BaseModel):
    key: int = Field(..., description="Keyframe key")
    video_num: int = Field(..., description="Video ID")
    group_num: str = Field(..., description="Group ID")
    keyframe_num: int = Field(..., description="Keyframe number")
    confidence_score: float = Field(..., description="Keyframe number")



class SingleKeyframeDisplay(BaseModel):
    path: str
    score: float
    video_name: str
    name_img: str

class KeyframeDisplay(BaseModel):
    results: list[SingleKeyframeDisplay]
    
class KeyframeServiceReponse(BaseModel):
    key: int = Field(..., description="Keyframe key")
    video_num: int = Field(..., description="Video ID")
    group_num: str = Field(..., description="Group ID")
    keyframe_num: int = Field(..., description="Keyframe number")
    confidence_score: float = Field(..., description="Confidence score")
    ocr_text: Optional[str] = Field(default="", description="OCR text content")
