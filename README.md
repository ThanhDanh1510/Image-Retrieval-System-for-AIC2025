# Image Retrieval System for AIC2025

A full-stack AI application for image retrieval in the AIC2025 Challenge.  

**Tech stack:**
- **Frontend:** React + TailwindCSS
- **Backend:** FastAPI + Milvus + MongoDB + MinIO
- **Vector Search:** Milvus
- **Metadata Storage:** MongoDB
- **Object Storage:** MinIO

---

## 🗂️ Architecture
```mermaid
flowchart LR
    User[User] -->|Query| Frontend[React + Tailwind]
    Frontend -->|API Calls| Backend[FastAPI]
    Backend --> Milvus
    Backend --> MongoDB
    Backend --> MinIO
````

---

## 📦 Prerequisites

- Docker
- Docker Compose
- Python 3.10
- uv
- Conda (optional)
- CUDA (GPU version, not CPU)

Convert the global2imgpath.json to this following format (id2index.json)
```json
{
  "0": "1/1/0",
  "1": "1/1/16",
  "2": "1/1/49",
  "3": "1/1/169",
  "4": "1/1/428",
  "5": "1/1/447",
}
```

Dataset directory structure:
```
data/
├── L01/
│   ├── V001/
│   │   ├── 00000001.webp
│   │   └── ...
│   └── V002/
└── L02/
    └── ...
```

---

## ⚙️ Environment Setup

### 1️⃣ Clone repository

```bash
git clone https://github.com/ThanhDanh1510/Image-Retrieval-System-for-AIC2025.git
cd Image-Retrieval-System-for-AIC2025
```

### 2️⃣ Setup `.env`

Copy example file:

```bash
cp .env.example .env
```

### 3️⃣ Install frontend dependencies

```bash
cd gui
npm install
```

### 4️⃣ Setup backend environment

```bash
cd ..
pip install uv
uv init --python=3.10
uv add aiofiles beanie dotenv fastapi[standard] httpx ipykernel motor nicegui numpy open-clip-torch pydantic-settings pymilvus streamlit torch typing-extensions usearch uvicorn
source .venv/bin/activate
```

### 5️⃣ Start services

```bash
docker compose up -d
```

### 6️⃣ Data migration

```bash
python migration/embedding_migration.py --file_path <embedding.pt>
python migration/keyframe_migration.py --file_path <id2index.json>
```

---

## 🚀 Run Application

* **Backend (FastAPI)**:

```bash
cd app
python main.py
```

* **Frontend (React + TailwindCSS)**:

```bash
cd gui
npm start
```

---

## 📁 Project Structure

```
.
├── app/                # Backend code
├── gui/                # Frontend code
├── data/               # Dataset (ignored in git)
├── migration/          # Data migration scripts
├── config.py           # Global config
├── .env.example        # Environment template
├── docker-compose.yml
├── README.md
└── .gitignore
```
