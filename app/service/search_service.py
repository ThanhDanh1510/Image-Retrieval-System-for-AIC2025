# Project-relative path: app/service/search_service.py
import os
import sys
ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)
sys.path.insert(0, ROOT_DIR)


from repository.milvus import KeyframeVectorRepository
from repository.milvus import MilvusSearchRequest
from repository.mongo import KeyframeRepository

from schema.response import KeyframeServiceReponse

class KeyframeQueryService:
    def __init__(
            self, 
            keyframe_vector_repo: KeyframeVectorRepository,
            keyframe_mongo_repo: KeyframeRepository,
            
        ):

        self.keyframe_vector_repo = keyframe_vector_repo
        self.keyframe_mongo_repo= keyframe_mongo_repo


    async def _retrieve_keyframes(self, ids: list[int]):
        keyframes = await self.keyframe_mongo_repo.get_keyframe_by_list_of_keys(ids)

        keyframe_map = {k.key: k for k in keyframes}

        print("Type of ids:", [type(k) for k in ids])
        print("Type of keyframe_map keys:", [type(k) for k in keyframe_map.keys()])

        if len(keyframe_map) > 0:
            sample_key = next(iter(keyframe_map.keys()))
            if isinstance(sample_key, str):
                ids = list(map(str, ids))
            elif isinstance(sample_key, int):
                ids = list(map(int, ids))

        # Tránh lỗi key không tồn tại bằng cách thêm kiểm tra tồn tại key
        return_keyframe = []
        missing_keys = []
        for k in ids:
            if k in keyframe_map:
                return_keyframe.append(keyframe_map[k])
            else:
                missing_keys.append(k)

        if missing_keys:
            print(f"Warning: Missing keys in keyframe_map: {missing_keys}")

        return return_keyframe

    async def _search_keyframes(
        self,
        text_embedding: list[float],
        top_k: int,
        score_threshold: float | None = None,
        exclude_indices: list[int] | None = None
    ) -> list[KeyframeServiceReponse]:
        
        search_request = MilvusSearchRequest(
            embedding=text_embedding,
            top_k=top_k,
            exclude_ids=exclude_indices
        )

        search_response = await self.keyframe_vector_repo.search_by_embedding(search_request)

        
        filtered_results = [
            result for result in search_response.results
            if score_threshold is None or result.distance > score_threshold
        ]

        sorted_results = sorted(
            filtered_results, key=lambda r: r.distance, reverse=True
        )

        sorted_ids = [result.id_ for result in sorted_results]

        keyframes = await self._retrieve_keyframes(sorted_ids)



        keyframe_map = {k.key: k for k in keyframes}
        response = []

        for result in sorted_results:
            keyframe = keyframe_map.get(result.id_) 
            if keyframe is not None:
                response.append(
                    KeyframeServiceReponse(
                        key=keyframe.key,
                        video_num=keyframe.video_num,
                        group_num=keyframe.group_num,
                        keyframe_num=keyframe.keyframe_num,
                        confidence_score=result.distance
                    )
                )
        return response
    
    async def search_by_image_key(
        self, 
        key: int, 
        top_k: int
    ) -> list[KeyframeServiceReponse]:
        """
        Tìm kiếm các keyframe tương tự dựa trên key của một keyframe gốc.
        """
        # 1. Lấy vector của ảnh gốc từ Milvus
        source_vector = await self.keyframe_vector_repo.get_vector_by_id(key)

        if source_vector is None:
            print(f"Warning: Vector for key {key} not found in Milvus.")
            return []

        # 2. Thực hiện tìm kiếm vector, nhưng loại trừ chính ảnh gốc khỏi kết quả
        #    Chúng ta thêm key của ảnh gốc vào danh sách exclude_ids
        #    top_k + 1 vì kết quả đầu tiên có thể là chính nó (distance=1.0)
        return await self._search_keyframes(
            text_embedding=source_vector,
            top_k=top_k + 1, # Lấy nhiều hơn 1 để loại bỏ chính nó
            score_threshold=0.0, # Lấy tất cả các kết quả gần nhất
            exclude_indices=[key]
        )
        
    async def search_by_text(
        self,
        text_embedding: list[float],
        top_k: int,
        score_threshold: float | None = 0.5,
    ):
        return await self._search_keyframes(text_embedding, top_k, score_threshold, None)   
    

    async def search_by_text_range(
        self,
        text_embedding: list[float],
        top_k: int,
        score_threshold: float | None,
        range_queries: list[tuple[int,int]]
    ):
        """
        range_queries: a bunch of start end indices, and we just search inside these, ignore everything
        """

        all_ids = self.keyframe_vector_repo.get_all_id()
        allowed_ids = set()
        for start, end in range_queries:
            allowed_ids.update(range(start, end + 1))
        
        
        exclude_ids = [id_ for id_ in all_ids if id_ not in allowed_ids]

        return await self._search_keyframes(text_embedding, top_k, score_threshold, exclude_ids)   
    

    async def search_by_text_exclude_ids(
        self,
        text_embedding: list[float],
        top_k: int,
        score_threshold: float | None,
        exclude_ids: list[int] | None
    ):
        """
        range_queries: a bunch of start end indices, and we just search inside these, ignore everything
        """
        return await self._search_keyframes(text_embedding, top_k, score_threshold, exclude_ids)
































