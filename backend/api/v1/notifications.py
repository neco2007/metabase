import asyncio
import json
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from core.auth import verify_access_token
from core.event_bus import bus
from typing import Optional, AsyncGenerator

router = APIRouter()

@router.get("/api/v1/notifications")
async def sse_endpoint(authorization: Optional[str] = Header(None)) -> StreamingResponse:
    """SSE接続を提供し、リアルタイムでイベントをクライアントへ流します。"""
    user_id = _authenticate_sse(authorization)
    
    return StreamingResponse(
        _event_generator(user_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

def _authenticate_sse(auth_header: Optional[str]) -> str:
    """SSEの接続権限を確認します。"""
    if not auth_header:
        raise HTTPException(status_code=401)
    
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401)
    return payload["user_id"]

async def _event_generator(user_id: str) -> AsyncGenerator[str, None]:
    """イベントバスからメッセージを受け取り、SSE形式でyieldします。"""
    queue = await bus.subscribe(user_id)
    try:
        while True:
            # メッセージの待機（タイムアウトを設けて接続維持を確認）
            try:
                data = await asyncio.wait_for(queue.get(), timeout=20.0)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n" # 接続維持用のコメント
    finally:
        bus.unsubscribe(user_id)