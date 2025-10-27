# app/service/ocr_service.py

from repository.elasticsearch import OcrRepository
from repository.mongo import KeyframeRepository
from schema.response import KeyframeServiceReponse

class OcrQueryService:
    def __init__(
        self, 
        ocr_repo: OcrRepository,
        keyframe_mongo_repo: KeyframeRepository,
    ):
        self.ocr_repo = ocr_repo
        self.keyframe_mongo_repo = keyframe_mongo_repo

    async def search_by_text(
        self,
        query: str,
        top_k: int,
    ) -> list[KeyframeServiceReponse]:
        # 1. Tìm kiếm trong Elasticsearch để lấy ID và score
        es_results = await self.ocr_repo.search(query, top_k)
        
        if not es_results:
            return []

        # 2. Dùng các ID tìm được để lấy thông tin đầy đủ
        #    (Tái sử dụng logic mới được thêm vào)
        return await self.get_full_keyframe_data(es_results)
    
    async def get_full_keyframe_data(
        self,
        es_results: list[dict]
    ) -> list[KeyframeServiceReponse]:
        """
        Nhận vào kết quả thô từ Elasticsearch (gồm id, score, text)
        và trả về danh sách KeyframeServiceReponse đầy đủ thông tin từ MongoDB.
        """
        if not es_results:
            return []

        result_map = {res["id"]: res["score"] for res in es_results}
        sorted_ids = [res["id"] for res in es_results]
        
        es_text_map = {}
        for res in es_results:
            es_text_map[res["id"]] = res.get("text", "")
        
        # 2. Dùng các ID tìm được để lấy thông tin đầy đủ từ MongoDB
        keyframes = await self.keyframe_mongo_repo.get_keyframe_by_list_of_keys(sorted_ids)

        # 3. Kết hợp thông tin từ hai nguồn và tạo response
        response = []
        for keyframe in keyframes:
            if keyframe.key in result_map:
                response.append(
                    KeyframeServiceReponse(
                        key=keyframe.key,
                        video_num=keyframe.video_num,
                        group_num=keyframe.group_num,
                        keyframe_num=keyframe.keyframe_num,
                        confidence_score=result_map[keyframe.key],
                        ocr_text=es_text_map.get(keyframe.key, "")
                    )
                )
        
        # Sắp xếp lại response theo thứ tự của ES trả về
        response.sort(key=lambda r: sorted_ids.index(r.key))

        return response