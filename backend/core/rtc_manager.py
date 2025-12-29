from aiortc import RTCPeerConnection, RTCConfiguration, RTCIceServer
from typing import Dict, Set

# ユーザーIDごとにPeerConnectionを永続化
_user_pcs: Dict[str, RTCPeerConnection] = {}

def get_or_create_pc(user_id: str) -> RTCPeerConnection:
    """ユーザーに紐づいたPeerConnectionを返却、存在しなければ作成します。"""
    if user_id in _user_pcs:
        pc = _user_pcs[user_id]
        # すでに終了している場合は削除して作り直し
        if pc.connectionState not in ["closed", "failed"]:
            return pc
            
    return _initialize_new_pc(user_id)

def _initialize_new_pc(user_id: str) -> RTCPeerConnection:
    """新しいPeerConnectionを生成し、管理リストに登録します。"""
    config = RTCConfiguration(
        iceServers=[RTCIceServer(urls="stun:stun.l.google.com:19302")]
    )
    pc = RTCPeerConnection(configuration=config)
    _user_pcs[user_id] = pc
    
    @pc.on("connectionstatechange")
    def on_state_change():
        if pc.connectionState in ["closed", "failed"]:
            _user_pcs.pop(user_id, None)
            
    return pc

async def cleanup_all_connections() -> None:
    """全接続をクローズします。"""
    for pc in list(_user_pcs.values()):
        await pc.close()
    _user_pcs.clear()