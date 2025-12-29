import logging
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException
from aiortc import RTCSessionDescription, RTCPeerConnection
from backend.core.auth import verify_access_token
from backend.core.track_manager import get_remote_tracks, register_track
from backend.core.event_bus import bus
from backend.api.v1.media_handlers import attach_media_handlers

logger = logging.getLogger("rtc_signaling")

async def signaling_handler(
    offer_data: Dict[str, Any], 
    pc: RTCPeerConnection,
    authorization: Optional[str] = Header(None)
) -> Dict[str, str]:
    """SDP Offerを処理し、Answerを返却します。"""
    payload = _verify_auth(authorization)
    user_id = payload["user_id"]
    room_id = offer_data.get("room_id", "default")

    # 1. 自分のトラック受信イベントを設定
    @pc.on("track")
    def on_track(track):
        register_track(room_id, user_id, track)

    # 2. 同じルームの他人のトラックを同期
    _sync_remote_tracks(pc, room_id, user_id)
    
    # 3. メディア状態の監視
    attach_media_handlers(pc, user_id)
    
    return await _execute_sdp(pc, offer_data, room_id, user_id)

def _verify_auth(auth_header: Optional[str]) -> Dict[str, Any]:
    """トークンの検証を行い、ペイロードを返します。"""
    if not auth_header:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="不正なトークンです")
    return payload

def _sync_remote_tracks(pc: RTCPeerConnection, room_id: str, user_id: str) -> None:
    """送信済みでないリモートトラックのみをPCに追加します。"""
    current_senders = [s.track for s in pc.getSenders() if s.track]
    remote_tracks = get_remote_tracks(room_id, user_id)
    
    for track in remote_tracks:
        if track not in current_senders:
            pc.addTrack(track)
            logger.info(f"Track追加: From Room={room_id} to User={user_id}")

async def _execute_sdp(pc: RTCPeerConnection, offer_data: dict, room_id: str, user_id: str):
    """SDPの交換を実行し、他ユーザーへ通知をブロードキャストします。"""
    offer = RTCSessionDescription(sdp=offer_data["sdp"], type=offer_data["type"])
    await pc.setRemoteDescription(offer)
    
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    
    # ルーム内の他ユーザーへ再交渉を促す
    await bus.broadcast(room_id, {"type": "renegotiate_needed", "from": user_id}, exclude_user=user_id)
    
    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}