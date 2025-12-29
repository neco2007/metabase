import React, { useState, useEffect, useCallback } from 'react';
import { WebRTCClient } from './WebRTCClient';
import VideoItem from './VideoItem';

/**
 * 2025年次世代WebRTCビデオチャットコンポーネント
 * 自動接続・ルーム隔離・画面共有対応版
 */
const VCComponent = ({ userId, token, locationName }) => {
  const [client] = useState(() => new WebRTCClient());
  const [streams, setStreams] = useState({ local: null, screen: null, remotes: {} });
  const [status, setStatus] = useState({ message: '初期化中...', isError: false });

  const API_BASE = 'http://163.44.110.157:8099/api/v1';
  const SIGNAL_URL = `${API_BASE}/signaling`;
  const SSE_URL = `${API_BASE}/notifications`;

  const handleTrack = useCallback((peerId, stream) => {
    setStreams(prev => ({
      ...prev,
      remotes: { ...prev.remotes, [peerId]: stream }
    }));
  }, []);

  const updateStatus = (msg, isErr) => {
    setStatus({ message: msg, isError: isErr });
  };

  /**
   * 授業（セッション）への自動参加処理
   */
  const joinSession = useCallback(async () => {
    if (!locationName) return;
    try {
      updateStatus(`${locationName} に接続中...`, false);
      const localStream = await client.startLocalStream();
      setStreams(prev => ({ ...prev, local: localStream }));
      
      client.onTrackCallback = handleTrack;
      // room_id として場所名をサーバーへ送信
      await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      updateStatus(`${locationName} で通話中`, false);
    } catch (err) {
      updateStatus(`接続失敗: ${err.message}`, true);
    }
  }, [client, handleTrack, SIGNAL_URL, token, locationName]);

  /**
   * 画面共有の切り替え
   */
  const toggleScreenShare = async () => {
    try {
      if (streams.screen) {
        // 停止処理
        await client.stopScreenShare(SIGNAL_URL, token, { room_id: locationName });
        setStreams(prev => ({ ...prev, screen: null }));
      } else {
        // 開始処理
        const stream = await client.addScreenShare(SIGNAL_URL, token, { room_id: locationName });
        setStreams(prev => ({ ...prev, screen: stream }));
      }
    } catch (err) {
      updateStatus(`画面共有エラー: ${err.message}`, true);
    }
  };

  useEffect(() => {
    joinSession();
    
    const encodedRoom = encodeURIComponent(locationName);
    const eventSource = new EventSource(`${SSE_URL}?room_id=${encodedRoom}&token=${token}`);
    
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'renegotiate_needed') {
        // 他ユーザーの入室時に再ネゴシエーションを実行
        await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      }
    };
    return () => eventSource.close();
  }, [joinSession, locationName, token, SSE_URL, SIGNAL_URL, client]);

  return (
    <div className="vc-container">
      <header className="vc-header">
        <div className={`status-badge ${status.isError ? 'error' : ''}`}>{status.message}</div>
        <div className="user-id-badge">ID: {userId}</div>
      </header>

      <main className="video-grid">
        {/* カメラ映像 */}
        {streams.local && <VideoItem stream={streams.local} label="あなた" isMuted={true} />}
        {/* 画面共有映像 */}
        {streams.screen && <VideoItem stream={streams.screen} label="共有中の画面" isMuted={true} />}
        {/* 他の参加者 */}
        {Object.entries(streams.remotes).map(([id, stream]) => (
          <VideoItem key={id} stream={stream} label={id} />
        ))}
      </main>

      <footer className="control-bar">
        <button 
          onClick={toggleScreenShare} 
          className={`btn-screen ${streams.screen ? 'active' : ''}`}
        >
          {streams.screen ? '共有停止' : '画面共有'}
        </button>
      </footer>

      <style>{`
        .vc-container { display: flex; flex-direction: column; height: 100vh; background: #0f172a; color: white; }
        .vc-header { display: flex; justify-content: space-between; padding: 10px 20px; background: #1e293b; align-items: center; }
        .status-badge { background: #3b82f6; padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; }
        .status-badge.error { background: #ef4444; }
        .user-id-badge { font-size: 0.9rem; opacity: 0.8; }
        .video-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; padding: 15px; overflow-y: auto; }
        .control-bar { display: flex; justify-content: center; padding: 15px; background: #1e293b; gap: 20px; }
        .btn-screen { padding: 10px 25px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: #475569; color: white; transition: 0.2s; }
        .btn-screen.active { background: #ef4444; }
        .btn-screen:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
};

export default VCComponent;