# migrations/ocr_migration.py

# ... (imports and other code remain the same) ...
import asyncio
import json
import argparse
import sys
import os
import logging

try:
    from elasticsearch import AsyncElasticsearch, NotFoundError, BadRequestError, ConnectionError as ESConnectionError
except ModuleNotFoundError:
    print("ERROR: 'elasticsearch' module not found. Please run: pip install \"elasticsearch[async]\"")
    sys.exit(1)

ROOT_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT_FOLDER)

try:
    from app.core.settings import ElasticsearchSettings
except ModuleNotFoundError:
    print("ERROR: Could not import ElasticsearchSettings. Make sure 'pydantic-settings' is installed and the app structure is correct.")
    sys.exit(1)
except ImportError:
    print("ERROR: ImportError while importing ElasticsearchSettings. Check dependencies.")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Hàm create_index_with_vi_analyzer (giữ nguyên) ---
async def create_index_with_vi_analyzer(client: AsyncElasticsearch, index_name: str):
    # ... (code for creating index remains the same) ...
    if not index_name:
        raise ValueError("Tên chỉ mục không được rỗng")
    if not index_name.islower() or any(c in index_name for c in r'\/*?"<>|, #'):
        raise ValueError(f"Tên chỉ mục '{index_name}' không hợp lệ (phải là chữ thường, không chứa ký tự đặc biệt).")

    logger.info(f"Kiểm tra sự tồn tại của chỉ mục: '{index_name}'")
    index_exists = False
    try:
        await client.indices.get(index=index_name, ignore=[404])
        if await client.indices.exists(index=index_name):
             index_exists = True
             logger.info(f"Chỉ mục '{index_name}' đã tồn tại.")
        else:
             logger.warning(f"client.indices.get không báo lỗi NotFound nhưng client.indices.exists trả về false cho index '{index_name}'. Coi như chưa tồn tại.")
             index_exists = False
    except NotFoundError:
        logger.info(f"Chỉ mục '{index_name}' không tồn tại.")
        index_exists = False
    except BadRequestError as e:
        logger.error(f"Lỗi Bad Request khi kiểm tra chỉ mục '{index_name}': Status={e.status_code}, Info={e.info}, Meta={e.meta}")
        try:
             error_body = await e.body() if hasattr(e, 'body') and callable(e.body) else str(e)
             logger.error(f"Response Body: {error_body}")
        except Exception:
             logger.error("Could not retrieve error body from BadRequestError.")
        raise
    except Exception as e:
        logger.error(f"Lỗi không xác định khi kiểm tra chỉ mục '{index_name}': {e}", exc_info=True)
        raise

    if index_exists:
        try:
            logger.warning(f"Đang xóa chỉ mục đã tồn tại: '{index_name}'...")
            await client.indices.delete(index=index_name, ignore=[400, 404])
            logger.info(f"Đã xóa chỉ mục '{index_name}'.")
        except Exception as e:
            logger.error(f"Lỗi khi xóa chỉ mục '{index_name}': {e}", exc_info=True)
            raise

    index_body = {
        "settings": {
            "analysis": {
                "analyzer": {"vi_analyzer": {"tokenizer": "vi_tokenizer", "filter": ["lowercase", "vi_stop"]}},
                "tokenizer": {"vi_tokenizer": {"type": "vi_tokenizer", "keep_punctuation": False, "split_url": False}},
                "filter": {"vi_stop": {"type": "vi_stop", "stopwords": "_vi_"}}
            }
        },
        "mappings": {"properties": {"text": {"type": "text", "analyzer": "vi_analyzer"}}}
    }

    logger.info(f"Đang tạo chỉ mục '{index_name}' với analyzer tiếng Việt...")
    try:
        await client.indices.create(index=index_name, body=index_body)
        logger.info(f"Đã tạo thành công chỉ mục '{index_name}'.")
    except BadRequestError as e:
        logger.error(f"Lỗi Bad Request khi tạo chỉ mục '{index_name}': Status={e.status_code}, Info={e.info}")
        try:
             error_body = await e.body() if hasattr(e, 'body') and callable(e.body) else str(e)
             logger.error(f"Response Body: {error_body}")
        except Exception:
             logger.error("Could not retrieve error body from BadRequestError.")
        logger.error(f"Request Body gửi đi:\n{json.dumps(index_body, indent=2)}")
        raise
    except Exception as e:
        logger.error(f"Lỗi không xác định khi tạo chỉ mục '{index_name}': {e}", exc_info=True)
        logger.error(f"Request Body đã gửi:\n{json.dumps(index_body, indent=2)}")
        raise


async def migrate_ocr_data(file_path: str, settings: ElasticsearchSettings):
    """Đọc file JSON và bulk index vào Elasticsearch."""
    logger.info("Khởi tạo kết nối đến Elasticsearch...")
    connection_error = None

    # --- 👇 FIX: Include scheme in hosts, remove scheme= argument 👇 ---
    async with AsyncElasticsearch(
        hosts=[f"http://{settings.ES_HOST}:{settings.ES_PORT}"], # Add http:// here
        http_auth=(settings.ES_USER, settings.ELASTIC_PASSWORD),
        # scheme="http", # REMOVE THIS LINE
        verify_certs=False,
        ssl_show_warn=False,
        request_timeout=60
    ) as client:
    # --- END FIX ---

        try:
            logger.info("Đang kiểm tra kết nối Elasticsearch bằng client.info()...")
            info = await client.info()
            logger.info(f"Kết nối Elasticsearch thành công. Cluster: {info.get('cluster_name')}, Version: {info.get('version', {}).get('number')}")
        except ESConnectionError as e:
            connection_error = f"Lỗi kết nối đến Elasticsearch: {e}"
        except BadRequestError as e:
             logger.error(f"Lỗi Bad Request khi gọi client.info(): Status={e.status_code}, Info={e.info}")
             connection_error = f"Lỗi Bad Request khi kiểm tra kết nối (client.info): {e}"
        except Exception as e:
            connection_error = f"Lỗi không xác định khi kiểm tra kết nối Elasticsearch: {e}"

        if connection_error:
             logger.critical(connection_error)
             raise ConnectionError(connection_error)

        await create_index_with_vi_analyzer(client, settings.ES_OCR_INDEX)

        # ... (rest of the data loading and bulk indexing code remains the same) ...
        logger.info(f"Đang tải dữ liệu OCR từ: {file_path}...")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, dict):
                 raise TypeError("Định dạng file JSON không đúng, cần là một dictionary.")
        except FileNotFoundError:
            logger.error(f"Lỗi: Không tìm thấy file JSON tại '{file_path}'")
            return
        except json.JSONDecodeError as e:
             logger.error(f"Lỗi: File JSON không hợp lệ tại '{file_path}': {e}")
             return
        except Exception as e:
             logger.error(f"Lỗi không xác định khi đọc file JSON: {e}", exc_info=True)
             return

        operations = []
        for key, value in data.items():
            doc_id = str(key)
            doc_text = str(value) if value is not None else ""
            operations.append({"index": {"_index": settings.ES_OCR_INDEX, "_id": doc_id}})
            operations.append({"text": doc_text})

        if not operations:
            logger.warning("Không có dữ liệu OCR nào để index.")
            return

        logger.info(f"Bắt đầu index {len(data)} documents vào '{settings.ES_OCR_INDEX}'...")
        try:
            response = await client.bulk(operations=operations, request_timeout=120)

            if response.get('errors', False):
                error_count = 0
                logger.error("Lỗi xảy ra trong quá trình bulk indexing:")
                for i, item in enumerate(response.get('items', [])):
                    operation_result = item.get('index') or item.get('create')
                    if operation_result and operation_result.get('status', 0) >= 400:
                        error_count += 1
                        error_details = operation_result.get('error', {})
                        logger.error(f"  - Lỗi document #{i+1} (ID: {operation_result.get('_id', 'N/A')}): Status={operation_result.get('status', 'N/A')}, Type={error_details.get('type', 'N/A')}, Reason={error_details.get('reason', 'N/A')}")
                logger.error(f"Tổng cộng {error_count} lỗi trong {len(operations)//2} documents.")
            else:
                logger.info("Bulk indexing hoàn tất thành công.")
        except ConnectionTimeout: # Bắt lỗi Timeout cụ thể của client
             logger.error("Lỗi: Timeout khi thực hiện bulk index. Thử tăng request_timeout trong client.bulk().")
        except Exception as e:
            logger.error(f"Lỗi không xác định trong quá trình bulk indexing: {e}", exc_info=True)


    logger.info("Đã đóng kết nối Elasticsearch (do dùng async with).")

# --- Main execution block (giữ nguyên) ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate OCR data from JSON to Elasticsearch.")
    parser.add_argument("--file_path", type=str, required=True, help="Path to the JSON file containing OCR data (format: {\"key\": \"text\"}).")
    args = parser.parse_args()

    try:
        es_settings = ElasticsearchSettings()
        asyncio.run(migrate_ocr_data(args.file_path, es_settings))
    except ConnectionError as conn_err:
         logger.critical(f"Script bị dừng do lỗi kết nối: {conn_err}")
         sys.exit(1)
    except Exception as main_error:
         logger.critical(f"Script bị dừng do lỗi nghiêm trọng: {main_error}", exc_info=True)
         sys.exit(1)