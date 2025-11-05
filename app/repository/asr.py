from elasticsearch import AsyncElasticsearch

class AsrRepository:
    def __init__(self, client: AsyncElasticsearch, index_name: str):
        self.client = client
        self.index_name = index_name

    async def search(self, query: str, top_k: int) -> list[dict]:
        """Thực hiện tìm kiếm và trả về toàn bộ document khớp nhất."""
        try:
            resp = await self.client.search(
                index=self.index_name,
                query={"match": {"text": {"query": query, "analyzer": "vi_analyzer"}}},
                size=top_k
            )
            results = []
            for hit in resp['hits']['hits']:
                source = hit['_source']
                source['score'] = hit['_score']
                results.append(source)
            return results
        except Exception as e:
            print(f"ASR Elasticsearch search error: {e}")
            return []