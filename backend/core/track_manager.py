import logging
from typing import Dict, List, Set
from aiortc import MediaStreamTrack

logger = logging.getLogger("rtc_tracks")

# ユーザーIDごとのトラックリストを保持 { user_id: [track1, track2, ...] }
_user_tracks: Dict[str, List[MediaStreamTrack]] = {}

def register_track(user_id: str, track: MediaStreamTrack) -> None:
    """ユーザーのトラックをレジストリに登録します。"""
    if user_id not in _user_tracks:
        _user_tracks[user_id] = []
    
    _user_tracks[user_id].append(track)
    logger.info(f"Track登録完了: User={user_id}, Kind={track.kind}")

    @track.on("ended")
    def on_ended() -> None:
        remove_user_tracks(user_id)

def remove_user_tracks(user_id: str) -> None:
    """ユーザーに関連付けられた全てのトラックを削除します。"""
    if user_id in _user_tracks:
        _user_tracks.pop(user_id)
        logger.info(f"User={user_id} の全トラックを削除しました。")

def get_remote_tracks(exclude_user_id: str) -> List[MediaStreamTrack]:
    """自分以外の全ユーザーのトラックリストを取得します。"""
    all_remote_tracks: List[MediaStreamTrack] = []
    for uid, tracks in _user_tracks.items():
        if uid != exclude_user_id:
            all_remote_tracks.extend(tracks)
    return all_remote_tracks