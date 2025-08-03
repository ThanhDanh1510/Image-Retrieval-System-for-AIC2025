# HCMAI2025_Baseline

A FastAPI-based AI application powered by Milvus for vector search, MongoDB for metadata storage, and MinIO for object storage.

## 🧑‍💻 Getting Started

### Prerequisites
- Docker
- Docker Compose
- Python 3.10
- uv

### Download the dataset
1. [Embedding data and keys](https://www.kaggle.com/datasets/anhnguynnhtinh/embedding-data)
2. [Keyframes](https://www.kaggle.com/datasets/anhnguynnhtinh/aic-keyframe-batch-one)


Convert the global2imgpath.json to this following format(id2index.json)
```json
{
  "0": "1/1/0",
  "1": "1/1/16",
  "2": "1/1/49",
  "3": "1/1/169",
  "4": "1/1/428",
  "5": "1/1/447",
  "6": "1/1/466",
  "7": "1/1/467",
}
```


### 🔧 Local Development
1. Clone the repo and start all services:
```bash
git clone https://github.com/yourusername/aio-aic.git
cd aio-aic
```

2. Install uv and setup env
```bash
pip install uv
uv init --python=3.10
uv add aiofiles beanie dotenv fastapi[standard] httpx ipykernel motor nicegui numpy open-clip-torch pydantic-settings pymilvus streamlit torch typing-extensions usearch uvicorn
```

3. Activate .venv
```bash
source .venv/bin/activate
```
4. Run docker compose
```bash
docker compose up -d
```

4. Data Migration 
```bash
python migration/embedding_migration.py --file_path <emnedding.pt file>
python migration/keyframe_migration.py --file_path <id2index.json file path>
```

5. Run the application

Open 2 tabs

5.1. Run the FastAPI application
```bash
cd gui
streamlit run main.py
```

5.1. Run the Streamlit application
```bash
cd app
python main.py
```



 

