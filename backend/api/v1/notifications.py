import asyncio
import json
import logging
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

# 修正：絶対パスでのインポート
from backend.core.auth import verify_access_token
from backend.core.event_bus import bus

router = APIRouter()
logger = logging.getLogger("rtc_notifications")

@router.get("/api/v1/notifications")
async def sse_endpoint(authorization: Optional[str] = Header(None)) -> StreamingResponse:
    """SSE接続を提供し、リアルタイムイベントを配信します。"""
    user_id = _authenticate_sse(authorization)
    
    logger.info(f"SSE接続開始: User={user_id}")
    return StreamingResponse(
        _event_generator(user_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

def _authenticate_sse(auth_header: Optional[str]) -> str:
    """SSE接続権限を検証します。"""
    if not auth_header:
        raise HTTPException(status_code=401)
    
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401)
    return payload["user_id"]

async def _event_generator(user_id: str) -> AsyncGenerator[str, None]:
    """イベントバスからデータを取得し、SSE形式で送信します。"""
    queue = await bus.subscribe(user_id)
    try:
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=20.0)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        bus.unsubscribe(user_id)