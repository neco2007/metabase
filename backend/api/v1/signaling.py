import logging
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException
from aiortc import RTCSessionDescription, RTCPeerConnection

# 修正：絶対パスでのインポート
from backend.core.auth import verify_access_token
from backend.core.track_manager import get_remote_tracks
from backend.core.event_bus import bus
from backend.api.v1.media_handlers import attach_media_handlers

logger = logging.getLogger("rtc_signaling")

async def signaling_handler(
    offer_data: Dict[str, Any], 
    pc: RTCPeerConnection,
    authorization: Optional[str] = Header(None)
) -> Dict[str, str]:
    """SDP交換を処理し、他ユーザーへ通知を配信します。"""
    payload = _get_verified_payload(authorization)
    user_id = payload["user_id"]

    try:
        _inject_remote_tracks(pc, user_id)
        attach_media_handlers(pc, user_id)
        
        answer_data = await _execute_sdp_exchange(offer_data, pc)
        
        # 通知処理
        await bus.broadcast({"type": "renegotiate_needed", "from": user_id}, exclude_user=user_id)
        
        return answer_data
    except Exception as e:
        logger.error(f"Signaling Error: {str(e)}")
        raise HTTPException(status_code=500, detail="SDP交換失敗")

def _get_verified_payload(auth_header: Optional[str]) -> Dict[str, Any]:
    if not auth_header:
        raise HTTPException(status_code=401)
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401)
    return payload

def _inject_remote_tracks(pc: RTCPeerConnection, current_user_id: str) -> None:
    remote_tracks = get_remote_tracks(current_user_id)
    for track in remote_tracks:
        pc.addTrack(track)

async def _execute_sdp_exchange(offer_data: Dict[str, Any], pc: RTCPeerConnection) -> Dict[str, str]:
    offer = RTCSessionDescription(sdp=offer_data["sdp"], type=offer_data["type"])
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}