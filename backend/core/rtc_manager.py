from aiortc import RTCPeerConnection, RTCConfiguration, RTCIceServer
from typing import Set

# アクティブな接続を管理するセット
active_connections: Set[RTCPeerConnection] = set()

def create_peer_connection() -> RTCPeerConnection:
    """
    設定済みのRTCPeerConnectionを生成し、管理リストに追加します。
    """
    config = RTCConfiguration(
        iceServers=[RTCIceServer(urls="stun:stun.l.google.com:19302")]
    )
    pc = RTCPeerConnection(configuration=config)
    active_connections.add(pc)
    
    # 接続終了時にセットから自動削除されるように設定
    @pc.on("connectionstatechange")
    def _auto_remove() -> None:
        if pc.connectionState in ["closed", "failed"]:
            active_connections.discard(pc)
            
    return pc

async def cleanup_all_connections() -> None:
    """サーバー停止時などに全ての接続を安全に終了させます。"""
    for pc in list(active_connections):
        await pc.close()
    active_connections.clear()