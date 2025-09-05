# app/repository/elasticsearch.py

from elasticsearch import AsyncElasticsearch
from schema.response import KeyframeServiceReponse # Tái sử dụng response schema

class OcrRepository:
    def __init__(self, client: AsyncElasticsearch, index_name: str):
        self.client = client
        self.index_name = index_name

    async def search(self, query: str, top_k: int) -> list[dict]:
        try:
            resp = await self.client.search(
                index=self.index_name,
                query={
                    "match": {
                        "text": {
                            "query": query,
                            "analyzer": "vi_analyzer"
                        }
                    }
                },
                _source=["text"],
                size=top_k
            )
        
            results = []
            for hit in resp['hits']['hits']:
                results.append({
                    "id": int(hit['_id']),
                    "score": hit['_score'],
                    "text": hit['_source'].get('text', '')
                })
            return results
        except Exception as e:
            print(f"Elasticsearch search error: {e}")
            return []


    async def bulk_index(self, documents: list[dict]):
        """
        Index một loạt các document OCR.
        Mỗi document có dạng: {"id": keyframe_id, "text": "nội dung ocr"}
        """
        operations = []
        for doc in documents:
            operations.append({"index": {"_index": self.index_name, "_id": doc["id"]}})
            operations.append({"text": doc["text"]})
        
        return await self.client.bulk(operations=operations)
    
    async def create_index_if_not_exists(self):
        """Tạo index với mapping Vietnamese analyzer"""
        if not await self.client.indices.exists(index=self.index_name):
            mapping = {
                "settings": {
                    "analysis": {
                        "analyzer": {
                            "vi_analyzer": {
                                "type": "custom",
                                "tokenizer": "coccoc_tokenizer",  # Sử dụng coccoc tokenizer
                                "filter": ["lowercase", "stop"]
                            }
                        }
                    }
                },
                "mappings": {
                    "properties": {
                        "text": {
                            "type": "text",
                            "analyzer": "vi_analyzer",
                            "search_analyzer": "vi_analyzer"
                        }
                    }
                }
            }
            await self.client.indices.create(index=self.index_name, body=mapping)
