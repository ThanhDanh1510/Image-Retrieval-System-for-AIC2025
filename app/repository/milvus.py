# Project-relative path: app/repository/milvus.py
"""
The implementation of Vector Repository. The following class is responsible for getting the vector by many ways
Including Faiss and Usearch
"""


import os
import sys
ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)
sys.path.insert(0, ROOT_DIR)


from typing import cast, List, Tuple
from common.repository import MilvusBaseRepository
from pymilvus import Collection as MilvusCollection
from pymilvus.client.search_result import SearchResult
from schema.interface import  MilvusSearchRequest, MilvusSearchResult, MilvusSearchResponse







class KeyframeVectorRepository(MilvusBaseRepository):
    def __init__(
        self,
        collection: MilvusCollection,
        search_params: dict
    ):

        super().__init__(collection)
        self.search_params = search_params

    async def search_by_embedding(
        self,
        request: MilvusSearchRequest
    ):
        expr = None
        if request.exclude_ids:
            expr = f"id not in {request.exclude_ids}"

        search_results= cast(SearchResult, self.collection.search(
            data=[request.embedding],
            anns_field="embedding",
            param=self.search_params,
            limit=request.top_k,
            expr=expr ,
            output_fields=["id", "embedding"],
            _async=False
        ))


        results = []
        for hits in search_results:
            for hit in hits:
                result = MilvusSearchResult(
                    id_=hit.id,
                    distance=hit.distance,
                    embedding=hit.entity.get("embedding") if hasattr(hit, 'entity') else None
                )
                results.append(result)

        return MilvusSearchResponse(
            results=results,
            total_found=len(results),
        )

    def get_all_id(self) -> list[int]:
        return list(range(self.collection.num_entities))

    async def get_embeddings_by_range(
        self,
        start_id: int,
        end_id: int
    ) -> Tuple[List[int], List[List[float]]]:
        """
        Lấy TẤT CẢ các vector embedding và ID của chúng trong khoảng [start, end].
        Hàm này sẽ trả về chính xác 2 giá trị: (danh sách ID, danh sách vector).
        """
        num_expected = end_id - start_id + 1
        if num_expected <= 0:
            return [], [] # Trả về một tuple rỗng gồm 2 phần tử

        try:
            # Truy vấn Milvus, yêu cầu output "id" và "embedding"
            entities = self.collection.query(
                expr=f"id >= {start_id} and id <= {end_id}",
                output_fields=["embedding", "id"],
                limit=num_expected
            )

            # Đảm bảo thứ tự thời gian cho thuật toán DP
            entities.sort(key=lambda x: x['id'])

            # Tách thành hai danh sách riêng biệt
            ids = [entity['id'] for entity in entities]
            vectors = [entity['embedding'] for entity in entities]

            # --- CÂU LỆNH RETURN ĐÚNG ---
            # Trả về một tuple chứa chính xác 2 phần tử
            return ids, vectors

        except Exception as e:
            logger.error(f"Lỗi khi truy vấn Milvus trong khoảng {start_id}-{end_id}: {e}")
            return [], []
