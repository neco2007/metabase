import asyncio
import logging
from typing import Dict, Set

logger = logging.getLogger("rtc_event_bus")

class EventBus:
    """サーバー内部のイベント配信を管理するクラス"""
    def __init__(self) -> None:
        # ユーザーIDごとのキューを保持
        self.queues: Dict[str, asyncio.Queue] = {}

    async def subscribe(self, user_id: str) -> asyncio.Queue:
        """ユーザーごとのイベントキューを作成し、購読を開始します。"""
        queue: asyncio.Queue = asyncio.Queue()
        self.queues[user_id] = queue
        logger.info(f"SSE Subscribed: {user_id}")
        return queue

    def unsubscribe(self, user_id: str) -> None:
        """購読を停止し、リソースを解放します。"""
        if user_id in self.queues:
            del self.queues[user_id]
            logger.info(f"SSE Unsubscribed: {user_id}")

    async def broadcast(self, message: dict, exclude_user: str | None = None) -> None:
        """全接続ユーザー（特定のユーザーを除く）にイベントを送信します。"""
        for uid, queue in self.queues.items():
            if uid != exclude_user:
                await queue.put(message)

# シングルトンインスタンスとしてエクスポート
bus = EventBus()