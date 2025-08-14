import os
from pathlib import Path

# Environment-based configuration
DATA_FOLDER = os.getenv("DATA_FOLDER", "./data/images")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
IMAGES_MOUNT_PATH = "/images"

# Convert to Path object
DATA_FOLDER_PATH = Path(DATA_FOLDER).resolve()