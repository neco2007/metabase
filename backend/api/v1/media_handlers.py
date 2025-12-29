import logging
from aiortc import RTCPeerConnection, MediaStreamTrack
from core.track_manager import register_track

logger = logging.getLogger("rtc_media")

def attach_media_handlers(pc: RTCPeerConnection, user_id: str) -> None:
    """
    PeerConnectionにメディアハンドラを紐付け、
    受信したトラックをTrackManagerに登録します。
    """
    @pc.on("track")
    def on_track(track: MediaStreamTrack) -> None:
        logger.info(f"受信開始: {track.kind} from {user_id}")
        register_track(user_id, track)

    @pc.on("connectionstatechange")
    async def on_state_change() -> None:
        if pc.connectionState in ["failed", "closed"]:
            logger.info(f"接続終了: User={user_id}")
            # 本来はここで詳細なクリーンアップを実施