import asyncio
import json
import logging
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from core.auth import verify_access_token
from core.event_bus import bus

router = APIRouter()
logger = logging.getLogger("rtc_notifications")

@router.get("/api/v1/notifications")
async def sse_endpoint(authorization: Optional[str] = Header(None)) -> StreamingResponse:
    """Server-Sent Events を用いてリアルタイム通知のストリームを開始します。"""
    user_id = _authenticate_sse(authorization)
    
    logger.info(f"SSE接続開始: User={user_id}")
    return StreamingResponse(
        _event_generator(user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no" # Nginx等のバッファリング無効化用
        }
    )

def _authenticate_sse(auth_header: Optional[str]) -> str:
    """SSE接続時の認証を行います。"""
    if not auth_header:
        raise HTTPException(status_code=401, detail="認証が必要です。")
    
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="認証エラー")
    return payload["user_id"]

async def _event_generator(user_id: str) -> AsyncGenerator[str, None]:
    """イベントキューを監視し、新しいメッセージをSSEフォーマットで送信します。"""
    queue = await bus.subscribe(user_id)
    
    try:
        while True:
            try:
                # 20秒間イベントがなければpingを送信して接続を維持
                data = await asyncio.wait_for(queue.get(), timeout=20.0)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    except Exception as e:
        logger.warning(f"SSEストリーム切断 (User={user_id}): {str(e)}")
    finally:
        bus.unsubscribe(user_id)
        logger.info(f"SSE接続終了: User={user_id}")