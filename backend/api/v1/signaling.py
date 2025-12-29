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
    """SDP Offerを処理し、Answerを返却します。"""
    payload = _verify_auth(authorization)
    user_id = payload["user_id"]
    room_id = offer_data.get("room_id", "default_room")

    # 1. 自分のトラックを受け取った時の処理を設定
    @pc.on("track")
    def on_track(track):
        register_track(room_id, user_id, track)

    # 2. 同じルームの他人のトラックを自分に追加
    for track in get_remote_tracks(room_id, user_id):
        pc.addTrack(track)
    
    # 3. SDP交換
    answer = await _exchange_sdp(pc, offer_data)
    
    # 4. 同じルームの人に再交渉を通知
    await bus.broadcast(room_id, {"type": "renegotiate_needed", "from": user_id}, exclude_user=user_id)
    
    return answer

def _verify_auth(auth_header: Optional[str]) -> Dict[str, Any]:
    if not auth_header:
        raise HTTPException(status_code=401)
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401)
    return payload

async def _exchange_sdp(pc, offer_data):
    offer = RTCSessionDescription(sdp=offer_data["sdp"], type=offer_data["type"])
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}