# Project-relative path: app/repository/mongo.py
"""
The implementation of Keyframe repositories. The following class is responsible for getting the keyframe by many ways
"""

import os
import sys
ROOT_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), '../'
    )
)

sys.path.insert(0, ROOT_DIR)

from typing import Any
from models.keyframe import Keyframe
from common.repository import MongoBaseRepository
from schema.interface import KeyframeInterface




class KeyframeRepository(MongoBaseRepository[Keyframe]):
    async def get_keyframe_by_list_of_keys(
        self, keys: list[int]
    ):
        result = await self.find({"key": {"$in": keys}})
        return [
            KeyframeInterface(
                key=keyframe.key,
                video_num=keyframe.video_num,
                group_num=keyframe.group_num,
                keyframe_num=keyframe.keyframe_num
            ) for keyframe in result

        ]

    async def get_keyframe_by_video_num(
        self,
        video_num: int,
    ):
        result = await self.find({"video_num": video_num})
        return [
            KeyframeInterface(
                key=keyframe.key,
                video_num=keyframe.video_num,
                group_num=keyframe.group_num,
                keyframe_num=keyframe.keyframe_num
            ) for keyframe in result
        ]

    async def get_keyframe_by_keyframe_num(
        self,
        keyframe_num: int,
    ):
        result = await self.find({"keyframe_num": keyframe_num})
        return [
            KeyframeInterface(
                key=keyframe.key,
                video_num=keyframe.video_num,
                group_num=keyframe.group_num,
                keyframe_num=keyframe.keyframe_num
            ) for keyframe in result
        ]

    async def get_metadata_for_video(
        self,
        video_num: int,
    ) -> KeyframeInterface | None:
        """
        Lấy metadata (như group_num) cho một video,
        chỉ cần lấy 1 keyframe đại diện là đủ.
        """
        result = await self.find_one({"video_num": video_num})
        if result:
            return KeyframeInterface(
                key=result.key,
                video_num=result.video_num,
                group_num=result.group_num,
                keyframe_num=result.keyframe_num
            )
        return None
