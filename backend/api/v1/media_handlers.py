import logging
from aiortc import RTCPeerConnection, MediaStreamTrack
# 修正：絶対パスでのインポート
from backend.core.track_manager import register_track

logger = logging.getLogger("rtc_media")

def attach_media_handlers(pc: RTCPeerConnection, user_id: str) -> None:
    @pc.on("track")
    def on_track(track: MediaStreamTrack) -> None:
        logger.info(f"受信: {track.kind} from {user_id}")
        register_track(user_id, track)

    @pc.on("connectionstatechange")
    async def on_state_change() -> None:
        if pc.connectionState in ["failed", "closed"]:
            logger.info(f"接続終了: {user_id}")