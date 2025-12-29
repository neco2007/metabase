from fastapi import Header, HTTPException
from typing import Dict, Any, Optional
from aiortc import RTCSessionDescription, RTCPeerConnection
from core.auth import verify_access_token
from core.track_manager import get_remote_tracks
from api.v1.media_handlers import attach_media_handlers
from core.event_bus import bus

async def signaling_handler(
    offer_data: Dict[str, Any], 
    pc: RTCPeerConnection,
    authorization: Optional[str] = Header(None)
) -> Dict[str, str]:
    """
    他ユーザーのトラックを現在のPCに追加してから、Answerを生成します。
    """
    payload = _get_verified_payload(authorization)
    user_id = payload["user_id"]

    # 1. 他の参加者のトラックを自分に追加（転送準備）
    _inject_remote_tracks(pc, user_id)
    
    # 2. 自分のトラックを受け取る準備
    attach_media_handlers(pc, user_id)
    
    response = await _execute_sdp_exchange(offer_data, pc)
    
    await bus.broadcast(
        {"type": "renegotiate_needed", "from": user_id},
        exclude_user=user_id
    )
    
    return response

def _get_verified_payload(auth_header: Optional[str]) -> Dict[str, Any]:
    """認証を確認しペイロードを返します。"""
    if not auth_header:
        raise HTTPException(status_code=401, detail="認証が必要です。")
    
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="不正なトークンです。")
    return payload

def _inject_remote_tracks(pc: RTCPeerConnection, current_user_id: str) -> None:
    """自分以外のユーザーのトラックをPCに追加します。"""
    remote_tracks = get_remote_tracks(current_user_id)
    for track in remote_tracks:
        pc.addTrack(track)