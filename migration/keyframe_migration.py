import sys
import os
ROOT_FOLDER = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..')
)
sys.path.insert(0, ROOT_FOLDER)



from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
import json
import asyncio
import argparse


from app.core.settings import MongoDBSettings
from app.models.keyframe import Keyframe

SETTING = MongoDBSettings()

async def init_db():
    client = AsyncIOMotorClient(
        host=SETTING.MONGO_HOST,
        port=SETTING.MONGO_PORT,
        username=SETTING.MONGO_USER,
        password=SETTING.MONGO_PASSWORD,
    )
    await init_beanie(database=client[SETTING.MONGO_DB], document_models=[Keyframe])


def load_json_data(file_path):
    return json.load(open(file_path, 'r', encoding='utf-8'))


def transform_data(data: dict[str,str]) -> list[Keyframe]:
    """
    Convert the data from the old format to the new Keyframe model.
    """
    keyframes = []  
    for key, value in data.items():
        group, video, keyframe = value.split('/')
        keyframe_obj = Keyframe(
            key=int(key),
            video_num=int(video),
            group_num=int(group),
            keyframe_num=int(keyframe)
        )
        keyframes.append(keyframe_obj)
    return keyframes

async def migrate_keyframes(file_path):
    await init_db()
    data = load_json_data(file_path)
    keyframes = transform_data(data)

    await Keyframe.delete_all()
    
    await Keyframe.insert_many(keyframes)
    print(f"Inserted {len(keyframes)} keyframes into the database.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate keyframes to MongoDB.")
    parser.add_argument(
        "--file_path", type=str, help="Path to the JSON file containing keyframe data."
    )
    args = parser.parse_args()

    if not os.path.exists(args.file_path):
        print(f"File {args.file_path} does not exist.")
        sys.exit(1)

    asyncio.run(migrate_keyframes(args.file_path))

