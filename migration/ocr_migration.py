# migrations/ocr_migration.py (Phiên bản ĐỀ XUẤT SỬA ĐỔI)

import asyncio
import json
from elasticsearch import AsyncElasticsearch # Sử dụng AsyncElasticsearch
import argparse
import sys
import os

ROOT_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT_FOLDER)

from app.core.settings import ElasticsearchSettings

# --- Script để nạp dữ liệu OCR vào Elasticsearch ---

async def create_index_with_vi_analyzer(client: AsyncElasticsearch, index_name: str): # Sửa kiểu dữ liệu client
    """Tạo index với custom analyzer cho tiếng Việt."""
    if await client.indices.exists(index=index_name):
        print(f"Index '{index_name}' already exists. Deleting it.")
        await client.indices.delete(index=index_name)

    index_body = {
        "settings": {
            "analysis": {
                "analyzer": {
                    "vi_analyzer": { # Đặt tên là vi_analyzer để repository có thể dùng
                        "tokenizer": "vi_tokenizer", # <--- THÊM DÒNG NÀY: Khai báo tokenizer được sử dụng
                        "filter": ["lowercase", "vi_stop"] # THÊM DÒNG NÀY: Các filter mặc định của vi_analyzer theo README
                    }
                },
                "tokenizer": { # <--- THÊM KHAI BÁO TOKENIZER
                    "vi_tokenizer": {
                        "type": "vi_tokenizer", # Đây là type của tokenizer được plugin cung cấp
                        "keep_punctuation": False,
                        "split_url": False # Đặt rõ ràng split_url
                    }
                },
                "filter": { # <--- THÊM KHAI BÁO FILTER STOPWORD
                    "vi_stop": {
                        "type": "vi_stop", # Type của stop filter được plugin cung cấp
                        "stopwords": "_vi_" # Sử dụng stopwords mặc định của plugin
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                "text": {
                    "type": "text",
                    "analyzer": "vi_analyzer" # Áp dụng analyzer cho trường text
                }
            }
        }
    }
    
    try: # THÊM TRY-EXCEPT BLOCK để debug tốt hơn
        await client.indices.create(index=index_name, body=index_body)
        print(f"Index '{index_name}' created with Vietnamese analyzer.")
    except Exception as e:
        print(f"ERROR creating index '{index_name}': {e}")
        print(f"Full Request Body Sent to ES:\n{json.dumps(index_body, indent=2)}")
        raise # Ném lại lỗi để có traceback đầy đủ

async def migrate_ocr_data(file_path: str, settings: ElasticsearchSettings):
    """Đọc file JSON và bulk index vào Elasticsearch."""
    # Khởi tạo client ASYNC cho script, vì hàm create_index_with_vi_analyzer là async
    client = AsyncElasticsearch( # SỬA TỪ Elasticsearch THÀNH AsyncElasticsearch
        hosts=[{"host": settings.ES_HOST, "port": settings.ES_PORT, "scheme": "http"}],
        basic_auth=(settings.ES_USER, settings.ELASTIC_PASSWORD)
    )

    await create_index_with_vi_analyzer(client, settings.ES_OCR_INDEX)

    print(f"Loading OCR data from {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f) # Giả định file có dạng {"id1": "text1", "id2": "text2"}

    documents = [{"id": key, "text": value} for key, value in data.items()]
    
    print(f"Start indexing {len(documents)} documents...")
    
    # Bulk index
    operations = []
    for doc in documents:
        operations.append({"index": {"_index": settings.ES_OCR_INDEX, "_id": doc["id"]}})
        operations.append({"text": doc["text"]})
        
    response = await client.bulk(operations=operations)
    
    if response['errors']:
        print("Bulk indexing had errors.")
        # In thêm thông tin lỗi nếu có
        for item in response['items']:
            if 'error' in item['index']:
                print(f"  ID: {item['index']['_id']}, Error: {item['index']['error']['reason']}")
    else:
        print("Bulk indexing completed successfully.")

    await client.close()

async def create_index_with_vi_analyzer(client: AsyncElasticsearch, index_name: str):
    """Tạo index với custom analyzer cho tiếng Việt."""
    if not index_name:
        raise ValueError("Tên chỉ mục không được rỗng")
    if not index_name.islower() or any(c in index_name for c in r'\/*?"<>|,#'):
        raise ValueError(f"Tên chỉ mục '{index_name}' không hợp lệ.")

    print(f"Kiểm tra chỉ mục: {index_name}")
    try:
        exists_response = await client.indices.exists(index=index_name)
        print(f"Kết quả exists_response: {exists_response}")
        if exists_response:
            print(f"Index '{index_name}' already exists. Deleting it.")
            await client.indices.delete(index=index_name)
    except Exception as e:
        print(f"Lỗi khi kiểm tra chỉ mục '{index_name}': {e}")
        if hasattr(e, 'info'):
            print(f"Chi tiết lỗi từ Elasticsearch: {e.info}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate OCR data to Elasticsearch.")
    parser.add_argument("--file_path", type=str, required=True, help="Path to the JSON file with OCR data.")
    args = parser.parse_args()

    es_settings = ElasticsearchSettings()
    asyncio.run(migrate_ocr_data(args.file_path, es_settings))