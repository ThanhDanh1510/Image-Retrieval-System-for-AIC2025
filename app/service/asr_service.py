import re
from typing import TYPE_CHECKING, List

from repository.asr import AsrRepository
from repository.mongo import KeyframeRepository
from schema.response import AsrSegmentWithKeyframes, SingleKeyframeDisplay
from models.keyframe import Keyframe

if TYPE_CHECKING:
    from controller.query_controller import QueryController

class AsrQueryService:
    def __init__(
        self,
        asr_repo: AsrRepository,
        keyframe_mongo_repo: KeyframeRepository,
    ):
        self.asr_repo = asr_repo
        self.keyframe_mongo_repo = keyframe_mongo_repo
        self._query_controller: "QueryController" | None = None

    def set_query_controller(self, controller: "QueryController"):
        self._query_controller = controller

    async def _get_keyframes_for_segments(self, segments: List[dict]) -> List[AsrSegmentWithKeyframes]:
        if not self._query_controller:
            raise Exception("QueryController has not been injected into AsrQueryService.")

        response_list = []
        for segment in segments:
            video_name = segment.get("video_name", "")
            match = re.match(r"([A-Z0-9]+)_V(\d+)", video_name)
            if not match: continue
            
            group_num_str = match.group(1)
            video_num_int = int(match.group(2))
            
            # --- LOGIC CHUẨN HÓA GROUP_NUM ĐÃ SỬA LỖI ---
            group_digits = re.sub(r'\D', '', group_num_str)
            if not group_digits: continue # Bỏ qua nếu không có số nào
            normalized_group_num = str(int(group_digits))

            start_frame = segment.get("start_frame")
            end_frame = segment.get("end_frame")

            # Xây dựng các điều kiện lọc cơ bản
            base_filter = {
                "group_num": normalized_group_num,
                "video_num": video_num_int,
            }

            # 1. Tìm các keyframe BÊN TRONG segment
            in_segment_filter = {**base_filter, "keyframe_num": {"$gte": start_frame, "$lte": end_frame}}
            keyframes_in_segment = await Keyframe.find(in_segment_filter).to_list()
            count_in = len(keyframes_in_segment)

            all_keyframes = list(keyframes_in_segment)
            
            # 2. Kiểm tra nếu chưa đủ 10 keyframe
            if count_in < 10:
                needed = 10 - count_in
                needed_before = needed // 2
                needed_after = needed - needed_before

                # 3. Lấy các keyframe TRƯỚC segment (nếu cần)
                if needed_before > 0:
                    before_filter = {**base_filter, "keyframe_num": {"$lt": start_frame}}
                    keyframes_before = await Keyframe.find(before_filter).sort(-Keyframe.keyframe_num).limit(needed_before).to_list()
                    all_keyframes.extend(keyframes_before)

                # 4. Lấy các keyframe SAU segment (nếu cần)
                if needed_after > 0:
                    after_filter = {**base_filter, "keyframe_num": {"$gt": end_frame}}
                    keyframes_after = await Keyframe.find(after_filter).sort(Keyframe.keyframe_num).limit(needed_after).to_list()
                    all_keyframes.extend(keyframes_after)

            # 5. Sắp xếp lại toàn bộ keyframe theo đúng thứ tự thời gian
            all_keyframes.sort(key=lambda doc: doc.keyframe_num)
            
            # Đảm bảo không vượt quá 10 ảnh cuối cùng
            final_keyframes = all_keyframes[:10]
            
            # Đếm tổng số keyframe trong segment (chỉ để hiển thị thông tin)
            total_keyframes_in_segment = await Keyframe.find(in_segment_filter).count()

            representative_keyframes = []
            for kf_doc in final_keyframes:
                display_data = self._query_controller.convert_to_display_result(kf_doc.model_dump())
                representative_keyframes.append(SingleKeyframeDisplay(**display_data))
            
            response_list.append(AsrSegmentWithKeyframes(
                text=segment.get("text"),
                score=segment.get("score"),
                video_name=video_name,
                start_time=segment.get("start_time"),
                end_time=segment.get("end_time"),
                total_keyframes_in_segment=total_keyframes_in_segment,
                representative_keyframes=representative_keyframes
            ))
            
        return response_list

    async def search_by_text(self, query: str, top_k: int):
        segments = await self.asr_repo.search(query, top_k)
        return await self._get_keyframes_for_segments(segments)