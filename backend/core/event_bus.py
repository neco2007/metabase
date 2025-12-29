import asyncio
import logging
from typing import Dict

logger = logging.getLogger("rtc_event_bus")

class EventBus:
    """ルーム単位でのイベント配信を管理するクラス"""
    def __init__(self) -> None:
        # { room_id: { user_id: queue } }
        self.rooms: Dict[str, Dict[str, asyncio.Queue]] = {}

    async def subscribe(self, room_id: str, user_id: str) -> asyncio.Queue:
        """指定したルームのイベントを購読します。"""
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        
        queue: asyncio.Queue = asyncio.Queue()
        self.rooms[room_id][user_id] = queue
        logger.info(f"SSE Subscribed: Room={room_id}, User={user_id}")
        return queue

    def unsubscribe(self, room_id: str, user_id: str) -> None:
        """購読を停止します。"""
        if room_id in self.rooms and user_id in self.rooms[room_id]:
            del self.rooms[room_id][user_id]
            if not self.rooms[room_id]: # 部屋が空なら削除
                del self.rooms[room_id]
            logger.info(f"SSE Unsubscribed: Room={room_id}, User={user_id}")

    async def broadcast(self, room_id: str, message: dict, exclude_user: str | None = None) -> None:
        """同じルーム内の全ユーザー（特定ユーザーを除く）に通知を送ります。"""
        if room_id not in self.rooms:
            return

        for uid, queue in self.rooms[room_id].items():
            if uid != exclude_user:
                await queue.put(message)

bus = EventBus()