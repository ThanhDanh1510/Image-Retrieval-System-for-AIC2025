# How settings are used (conceptually)
from app.core.settings import MongoDBSettings, AppSettings

# When this code runs, Pydantic automatically reads from environment variables
mongo_settings = MongoDBSettings()
app_settings = AppSettings()

print(f"MongoDB Host: {mongo_settings.MONGO_HOST}")
print(f"App Data Folder: {app_settings.DATA_FOLDER}")
print(f"App ID2Index Path: {app_settings.ID2INDEX_PATH}")
# Output (if .env is used):
# MongoDB Host: localhost
# App Data Folder: /app/data/images
# App ID2Index Path: /app/data/id2index.json