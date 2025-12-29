from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
import json, asyncio
from backend.core.auth import verify_access_token
from backend.core.event_bus import bus

router = APIRouter()

@router.get("/api/v1/notifications")
async def sse_endpoint(
    room_id: str = Query(...),
    token: str = Query(...)
):
    """ルーム単位でのリアルタイム通知を提供します。"""
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401)
    user_id = payload["user_id"]

    return StreamingResponse(
        _event_generator(room_id, user_id),
        media_type="text/event-stream"
    )

async def _event_generator(room_id: str, user_id: str):
    queue = await bus.subscribe(room_id, user_id)
    try:
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=20.0)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        bus.unsubscribe(room_id, user_id)