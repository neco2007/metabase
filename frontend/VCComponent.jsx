import React, { useState, useEffect, useCallback } from 'react';
import { WebRTCClient } from './WebRTCClient';
import VideoItem from './VideoItem';

const VCComponent = ({ userId, token, locationName }) => {
  const [client] = useState(() => new WebRTCClient());
  const [streams, setStreams] = useState({ local: null, screen: null, remotes: {} });
  const [status, setStatus] = useState({ message: '準備中...', isError: false });
  const [mediaStates, setMediaStates] = useState({ mic: true, cam: true });

  const API_BASE = 'http://163.44.110.157:8099/api/v1'; // ConohaVPS IP
  const SIGNAL_URL = `${API_BASE}/signaling`;
  const SSE_URL = `${API_BASE}/notifications`;

  // --- メディア処理 ---

  const handleTrack = useCallback((peerId, stream) => {
    setStreams(prev => ({
      ...prev,
      remotes: { ...prev.remotes, [peerId]: stream }
    }));
  }, []);

  const toggleMedia = (type) => {
    const isEnabled = !mediaStates[type];
    const tracks = type === 'mic' 
      ? streams.local?.getAudioTracks() 
      : streams.local?.getVideoTracks();
    
    tracks?.forEach(t => (t.enabled = isEnabled));
    setMediaStates(prev => ({ ...prev, [type]: isEnabled }));
  };

  // --- 通信ロジック ---

  const joinSession = useCallback(async () => {
    if (!locationName) return;
    try {
      const localStream = await client.startLocalStream();
      setStreams(prev => ({ ...prev, local: localStream }));
      
      client.onTrackCallback = handleTrack;
      await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      setStatus({ message: `${locationName} で通話中`, isError: false });
    } catch (err) {
      setStatus({ message: `接続失敗: ${err.message}`, isError: true });
    }
  }, [client, handleTrack, SIGNAL_URL, token, locationName]);

  const toggleScreen = async () => {
    try {
      if (streams.screen) {
        await client.stopScreenShare(SIGNAL_URL, token, { room_id: locationName });
        setStreams(prev => ({ ...prev, screen: null }));
      } else {
        const stream = await client.addScreenShare(SIGNAL_URL, token, { room_id: locationName });
        setStreams(prev => ({ ...prev, screen: stream }));
      }
    } catch (err) {
      setStatus({ message: `画面共有エラー: ${err.message}`, isError: true });
    }
  };

  // --- ライフサイクル ---

  useEffect(() => {
    joinSession();
    const encodedRoom = encodeURIComponent(locationName);
    const eventSource = new EventSource(`${SSE_URL}?room_id=${encodedRoom}&token=${token}`);
    
    eventSource.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'renegotiate_needed') {
        await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      }
    };
    return () => {
      eventSource.close();
      streams.local?.getTracks().forEach(t => t.stop());
    };
  }, [joinSession, locationName, token, SSE_URL, SIGNAL_URL, client]);

  return (
    <div className="vc-wrapper">
      <header className="vc-header">
        <div className={`status-badge ${status.isError ? 'error' : ''}`}>{status.message}</div>
        <div className="info">ID: {userId}</div>
      </header>

      <main className="video-grid">
        {streams.local && <VideoItem stream={streams.local} label={`${userId} (自分)`} isMuted={true} />}
        {streams.screen && <VideoItem stream={streams.screen} label="共有画面" isMuted={true} />}
        {Object.entries(streams.remotes).map(([id, stream]) => (
          <VideoItem key={id} stream={stream} label={id} />
        ))}
      </main>

      <footer className="controls">
        <button onClick={() => toggleMedia('mic')} className={mediaStates.mic ? 'btn' : 'btn off'}>
          {mediaStates.mic ? 'マイクON' : 'マイク消音'}
        </button>
        <button onClick={() => toggleMedia('cam')} className={mediaStates.cam ? 'btn' : 'btn off'}>
          {mediaStates.cam ? 'カメラON' : 'カメラOFF'}
        </button>
        <button onClick={toggleScreen} className={streams.screen ? 'btn active' : 'btn'}>
          {streams.screen ? '共有停止' : '画面共有'}
        </button>
      </footer>

      <style>{`
        .vc-wrapper { display: flex; flex-direction: column; height: 100vh; background: #0f172a; color: white; }
        .vc-header { display: flex; justify-content: space-between; padding: 12px 24px; background: #1e293b; align-items: center; }
        .status-badge { background: #3b82f6; padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; }
        .status-badge.error { background: #ef4444; }
        .video-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; padding: 16px; overflow-y: auto; align-content: start; }
        .controls { display: flex; justify-content: center; gap: 16px; padding: 20px; background: #1e293b; }
        .btn { background: #475569; border: none; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: 600; }
        .btn.off { background: #ef4444; }
        .btn.active { background: #10b981; }
        .btn:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
};

export default VCComponent;