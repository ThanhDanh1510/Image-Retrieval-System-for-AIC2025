from fastapi import APIRouter, Depends
from app.schema.ranking_schemas import VideoRankingRequest, VideoRankingResponse
from app.controller.ranking_controller import RankingController
from app.core.dependencies import get_ranking_controller # Sẽ tạo ở Bước 5

router = APIRouter(
    prefix="/video",
    tags=["video_ranking"],
)

@router.post(
    "/rank-by-events",
    response_model=VideoRankingResponse,
    summary="Rank videos by event sequence alignment (DP)"
)
async def rank_videos_by_dp(
    request: VideoRankingRequest,
    controller: RankingController = Depends(get_ranking_controller)
):
    return await controller.rank_videos_by_dp(request)
