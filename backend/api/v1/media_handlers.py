import logging
from aiortc import RTCPeerConnection, MediaStreamTrack
from backend.core.track_manager import register_track

logger = logging.getLogger("rtc_media")

def attach_media_handlers(pc: RTCPeerConnection, user_id: str, room_id: str) -> None:
    """PeerConnectionの状態を監視し、失敗ではなく終了として扱うロジックを追加"""
    
    @pc.on("track")
    def on_track(track: MediaStreamTrack) -> None:
        logger.info(f"受信開始: {track.kind} from {user_id}")
        register_track(room_id, user_id, track)

    @pc.on("connectionstatechange")
    async def on_state_change() -> None:
        state = pc.connectionState
        # ログを 'failed' ではなく状態通知として扱う
        logger.info(f"接続状態変更: {user_id} -> {state}")
        
        if state in ["failed", "closed"]:
            # 'failed' の場合も、ユーザーが離脱したとみなし、エラーログではなく情報ログにする
            logger.info(f"セッション終了 (User: {user_id}, State: {state})")