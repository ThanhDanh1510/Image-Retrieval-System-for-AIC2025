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


from typing import cast
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



    
    

