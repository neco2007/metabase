from aiortc import RTCPeerConnection, RTCConfiguration, RTCIceServer
import logging
from typing import Dict

logger = logging.getLogger("rtc_manager")

# ユーザーIDごとに接続を保持して再利用する
_user_pcs: Dict[str, RTCPeerConnection] = {}

def get_or_create_pc(user_id: str) -> RTCPeerConnection:
    """既存のPeerConnectionを返すか、必要に応じて新規作成します。"""
    if user_id in _user_pcs:
        pc = _user_pcs[user_id]
        # 接続が生きている場合はそのまま返す
        if pc.connectionState not in ["closed", "failed"]:
            return pc
        logger.info(f"古い接続を破棄し再作成します: {user_id}")

    return _initialize_pc(user_id)

def _initialize_pc(user_id: str) -> RTCPeerConnection:
    """新しいPeerConnectionを初期化します。"""
    config = RTCConfiguration(
        iceServers=[RTCIceServer(urls="stun:stun.l.google.com:19302")]
    )
    pc = RTCPeerConnection(configuration=config)
    _user_pcs[user_id] = pc
    
    @pc.on("connectionstatechange")
    def on_state_change():
        logger.info(f"Connection State Change: {user_id} -> {pc.connectionState}")
        if pc.connectionState in ["closed", "failed"]:
            _user_pcs.pop(user_id, None)

    return pc

async def cleanup_all_connections() -> None:
    """サーバー停止時に全接続を安全に閉じます。"""
    for user_id, pc in list(_user_pcs.items()):
        await pc.close()
    _user_pcs.clear()