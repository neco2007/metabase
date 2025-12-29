import logging
from aiortc import RTCPeerConnection, MediaStreamTrack
# 絶対パスでのインポート
from backend.core.track_manager import register_track

logger = logging.getLogger("rtc_media")

def attach_media_handlers(pc: RTCPeerConnection, user_id: str, room_id: str) -> None:
    """
    PeerConnectionのメディア状態を監視し、受信したトラックを管理下に登録します。
    """
    @pc.on("track")
    def on_track(track: MediaStreamTrack) -> None:
        logger.info(f"受信開始: {track.kind} from {user_id} in Room {room_id}")
        # 修正ポイント: 引数を3つ(room_id, user_id, track)正しく渡す
        register_track(room_id, user_id, track)

    @pc.on("connectionstatechange")
    async def on_state_change() -> None:
        logger.info(f"Connection State: {user_id} -> {pc.connectionState}")
        if pc.connectionState in ["failed", "closed"]:
            logger.info(f"接続終了または失敗: {user_id}")