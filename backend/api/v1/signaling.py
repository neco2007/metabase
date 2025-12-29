import logging
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException
from aiortc import RTCSessionDescription, RTCPeerConnection
from backend.core.auth import verify_access_token
from backend.core.track_manager import get_remote_tracks, register_track
from backend.core.event_bus import bus

async def signaling_handler(
    offer_data: Dict[str, Any], 
    pc: RTCPeerConnection,
    authorization: Optional[str] = Header(None)
) -> Dict[str, str]:
    payload = _verify_auth(authorization)
    user_id = payload["user_id"]
    room_id = offer_data.get("room_id", "default")

    # リモートトラック（他人の映像）を重複なく追加
    _sync_remote_tracks(pc, room_id, user_id)
    
    # 自分のメディア受信設定（すでに設定済みの場合はスキップされる）
    attach_media_handlers(pc, user_id)
    
    return await _execute_sdp(pc, offer_data, room_id, user_id)

def _sync_remote_tracks(pc: RTCPeerConnection, room_id: str, user_id: str) -> None:
    """既存の送信機(Sender)を確認し、未登録のトラックのみ追加します。"""
    current_tracks = [s.track for s in pc.getSenders() if s.track]
    remote_tracks = get_remote_tracks(room_id, user_id)
    
    for track in remote_tracks:
        if track not in current_tracks:
            pc.addTrack(track)

async def _execute_sdp(pc, offer_data, room_id, user_id):
    """SDP交換を行い、通知をブロードキャストします。"""
    offer = RTCSessionDescription(sdp=offer_data["sdp"], type=offer_data["type"])
    await pc.setRemoteDescription(offer)
    
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    
    # 他ユーザーへ更新を通知
    await bus.broadcast(room_id, {"type": "renegotiate_needed", "from": user_id}, user_id)
    
    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}