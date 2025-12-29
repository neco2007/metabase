import logging
from typing import Dict, List
from aiortc import MediaStreamTrack

logger = logging.getLogger("rtc_tracks")

# { room_id: { user_id: [tracks] } }
_room_tracks: Dict[str, Dict[str, List[MediaStreamTrack]]] = {}

def register_track(room_id: str, user_id: str, track: MediaStreamTrack) -> None:
    """ルームとユーザーに関連付けてトラックを登録します。"""
    if room_id not in _room_tracks:
        _room_tracks[room_id] = {}
    if user_id not in _room_tracks[room_id]:
        _room_tracks[room_id][user_id] = []
    
    _room_tracks[room_id][user_id].append(track)
    logger.info(f"Track登録: Room={room_id}, User={user_id}, Kind={track.kind}")

    @track.on("ended")
    def on_ended() -> None:
        remove_user_tracks(room_id, user_id)

def remove_user_tracks(room_id: str, user_id: str) -> None:
    """特定のルームからユーザーのトラックを削除します。"""
    if room_id in _room_tracks and user_id in _room_tracks[room_id]:
        _room_tracks[room_id].pop(user_id)
        if not _room_tracks[room_id]:
            _room_tracks.pop(room_id)
        logger.info(f"Track削除: Room={room_id}, User={user_id}")

def get_remote_tracks(room_id: str, exclude_user_id: str) -> List[MediaStreamTrack]:
    """同じルームにいる「自分以外」の全トラックを取得します。"""
    all_remote_tracks: List[MediaStreamTrack] = []
    if room_id not in _room_tracks:
        return all_remote_tracks

    for uid, tracks in _room_tracks[room_id].items():
        if uid != exclude_user_id:
            all_remote_tracks.extend(tracks)
    return all_remote_tracks