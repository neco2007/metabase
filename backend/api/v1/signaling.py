import logging
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException
from aiortc import RTCSessionDescription, RTCPeerConnection
from core.auth import verify_access_token
from core.track_manager import get_remote_tracks
from core.event_bus import bus
from api.v1.media_handlers import attach_media_handlers

logger = logging.getLogger("rtc_signaling")

async def signaling_handler(
    offer_data: Dict[str, Any], 
    pc: RTCPeerConnection,
    authorization: Optional[str] = Header(None)
) -> Dict[str, str]:
    """SDP Offerを処理し、Answerを返却します。同時に他ユーザーへ通知を行います。"""
    payload = _get_verified_payload(authorization)
    user_id = payload["user_id"]

    try:
        # 1. メディアの準備（受信設定と既存トラックの注入）
        _inject_remote_tracks(pc, user_id)
        attach_media_handlers(pc, user_id)
        
        # 2. SDPの交換実行
        answer_data = await _execute_sdp_exchange(offer_data, pc)
        
        # 3. リアルタイム通知（他の参加者に再接続を促す）
        await _notify_others(user_id)
        
        return answer_data
    except Exception as e:
        logger.error(f"シグナリング失敗 (User: {user_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="SDP交換に失敗しました。")

def _get_verified_payload(auth_header: Optional[str]) -> Dict[str, Any]:
    """トークンを検証し、ユーザー情報を抽出します。"""
    if not auth_header:
        raise HTTPException(status_code=401, detail="認証が必要です。")
    
    token = auth_header.replace("Bearer ", "")
    payload = verify_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="不正なトークンです。")
    return payload

def _inject_remote_tracks(pc: RTCPeerConnection, current_user_id: str) -> None:
    """現在接続されている他のユーザーのトラックを、このPCに追加します。"""
    remote_tracks = get_remote_tracks(current_user_id)
    for track in remote_tracks:
        pc.addTrack(track)
    logger.debug(f"注入完了: {len(remote_tracks)} 個のトラックを追加 (User: {current_user_id})")

async def _execute_sdp_exchange(offer_data: Dict[str, Any], pc: RTCPeerConnection) -> Dict[str, str]:
    """aiortcを使用してSDPのOfferをセットし、Answerを生成します。"""
    offer = RTCSessionDescription(sdp=offer_data["sdp"], type=offer_data["type"])
    
    await pc.setRemoteDescription(offer)
    logger.debug("RemoteDescriptionをセットしました。")
    
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    logger.debug("LocalDescription (Answer) を生成しました。")
    
    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}

async def _notify_others(from_user_id: str) -> None:
    """イベントバスを通じて、他ユーザーへ再交渉が必要なことを知らせます。"""
    message = {"type": "renegotiate_needed", "from": from_user_id}
    await bus.broadcast(message, exclude_user=from_user_id)
    logger.info(f"再交渉通知をブロードキャスト (From: {from_user_id})")