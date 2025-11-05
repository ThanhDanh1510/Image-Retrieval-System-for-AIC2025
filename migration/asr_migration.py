import asyncio
import json
from elasticsearch import AsyncElasticsearch
import argparse
import sys
import os

# Đảm bảo script có thể import từ thư mục app
ROOT_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT_FOLDER)

from app.core.settings import ElasticsearchSettings

async def create_asr_index(client: AsyncElasticsearch, index_name: str):
    """Tạo index ASR với mapping phù hợp."""
    if await client.indices.exists(index=index_name):
        print(f"Index '{index_name}' đã tồn tại. Sẽ xóa và tạo lại.")
        await client.indices.delete(index=index_name)

    index_body = {
        "settings": {
            "analysis": {
                "analyzer": {
                    "vi_analyzer": {
                        "type": "custom",
                        "tokenizer": "vi_tokenizer"
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                "text": {"type": "text", "analyzer": "vi_analyzer"},
                "video_name": {"type": "keyword"}, # Dùng keyword để lọc chính xác
                "group_num": {"type": "keyword"},
                "start_time": {"type": "float"},
                "end_time": {"type": "float"},
                "start_frame": {"type": "integer"},
                "end_frame": {"type": "integer"}
            }
        }
    }
    await client.indices.create(index=index_name, body=index_body)
    print(f"Index '{index_name}' đã được tạo thành công.")

async def migrate_asr_data(file_path: str, settings: ElasticsearchSettings):
    """Đọc file JSON đã gộp và bulk index vào Elasticsearch."""
    client = AsyncElasticsearch(
        hosts=[{"host": settings.ES_HOST, "port": settings.ES_PORT, "scheme": "http"}],
        basic_auth=(settings.ES_USER, settings.ELASTIC_PASSWORD)
    )

    await create_asr_index(client, settings.ES_ASR_INDEX)

    print(f"Đang đọc dữ liệu ASR từ {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        documents = json.load(f)

    print(f"Bắt đầu nạp {len(documents)} ASR segments vào Elasticsearch...")
    
    operations = []
    for doc in documents:
        operations.append({"index": {"_index": settings.ES_ASR_INDEX}})
        operations.append(doc)
        
    response = await client.bulk(operations=operations)
    
    if response['errors']:
        print("Lỗi trong quá trình bulk indexing.")
    else:
        print("Nạp dữ liệu ASR thành công!")

    await client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nạp dữ liệu ASR vào Elasticsearch.")
    parser.add_argument("--file_path", type=str, required=True, help="Đường dẫn đến file asr_preprocessed.json.")
    args = parser.parse_args()

    es_settings = ElasticsearchSettings()
    asyncio.run(migrate_asr_data(args.file_path, es_settings))