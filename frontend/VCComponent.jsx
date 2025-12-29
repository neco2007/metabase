import React, { useState, useEffect, useCallback } from 'react';
import { WebRTCClient } from './WebRTCClient';
import VideoItem from './VideoItem';

const VCComponent = ({ userId, token, locationName }) => {
  const [client] = useState(() => new WebRTCClient());
  const [streams, setStreams] = useState({ local: null, remotes: {} });
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

  const joinSession = useCallback(async () => {
    if (!locationName) return;
    try {
      updateStatus(`${locationName} に自動接続中...`, false);
      const localStream = await client.startLocalStream();
      setStreams(prev => ({ ...prev, local: localStream }));
      
      client.onTrackCallback = handleTrack;
      // room_id を送信データに含める
      await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      updateStatus(`${locationName} で通話中`, false);
    } catch (err) {
      updateStatus(`接続失敗: ${err.message}`, true);
    }
  }, [client, handleTrack, SIGNAL_URL, token, locationName]);

  useEffect(() => {
    const init = async () => {
      if (!locationName) return;
      try {
        const stream = await client.startLocalStream();
        setStreams(prev => ({ ...prev, local: stream }));
        client.onTrackCallback = handleTrack;
        
        // ルームIDを送信
        await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
        setStatus({ message: `${locationName} で通話中`, isError: false });
      } catch (err) {
        setStatus({ message: `接続失敗: ${err.message}`, isError: true });
      }
    };
    init();

    // SSE接続 (日本語の文字化け対策で encodeURIComponent を使用)
    const encodedRoom = encodeURIComponent(locationName);
    const eventSource = new EventSource(`${SSE_URL}?room_id=${encodedRoom}&token=${token}`);
    
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'renegotiate_needed') {
        await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      }
    };
    return () => eventSource.close();
  }, [locationName, token, SIGNAL_URL, SSE_URL, client, handleTrack]);

  const updateStatus = (msg, isErr) => {
    setStatus({ message: msg, isError: isErr });
  };

  return (
    <div className="vc-container">
      <div className={`status-badge ${status.isError ? 'error' : ''}`}>{status.message}</div>
      <main className="video-grid">
        {streams.local && <VideoItem stream={streams.local} label={`${userId} (あなた)`} isMuted={true} />}
        {Object.entries(streams.remotes).map(([id, stream]) => (
          <VideoItem key={id} stream={stream} label={id} />
        ))}
      </main>
      <style>{`
        .vc-container { height: 100vh; background: #0f172a; color: white; padding: 15px; }
        .status-badge { background: #3b82f6; display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; margin-bottom: 15px; }
        .status-badge.error { background: #ef4444; }
        .video-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
      `}</style>
    </div>
  );
};

export default VCComponent;