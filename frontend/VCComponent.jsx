import React, { useState, useEffect, useCallback } from 'react';
import { WebRTCClient } from './WebRTCClient';
import VideoItem from './VideoItem';

const VCComponent = ({ userId, token, locationName }) => {
  const [client] = useState(() => new WebRTCClient());
  const [streams, setStreams] = useState({ local: null, remotes: {} });
  const [status, setStatus] = useState({ message: '接続準備中...', isError: false });

  const API_BASE = 'http://163.44.110.157:8099/api/v1';
  const SIGNAL_URL = `${API_BASE}/signaling`;
  const SSE_URL = `${API_BASE}/notifications`;

  const joinSession = useCallback(async () => {
    try {
      setStatus({ message: `${locationName} に接続中...`, isError: false });
      const stream = await client.startLocalStream();
      setStreams(prev => ({ ...prev, local: stream }));
      
      client.onTrackCallback = (peerId, remoteStream) => {
        setStreams(prev => ({
          ...prev,
          remotes: { ...prev.remotes, [peerId]: remoteStream }
        }));
      };

      // signalingにroom_id(locationName)を渡す
      await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      setStatus({ message: `${locationName} で通話中`, isError: false });
    } catch (err) {
      setStatus({ message: `接続失敗: ${err.message}`, isError: true });
    }
  }, [client, locationName, token, SIGNAL_URL]);

  useEffect(() => {
    joinSession();
    
    // SSE接続 (room_idをパラメータで送る)
    const eventSource = new EventSource(`${SSE_URL}?room_id=${locationName}&token=${token}`);
    eventSource.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'renegotiate_needed') {
        await client.createAndExchange('server_peer', SIGNAL_URL, token, { room_id: locationName });
      }
    };
    return () => eventSource.close();
  }, [joinSession, locationName, token, SSE_URL, SIGNAL_URL, client]);

  return (
    <div className="vc-container">
      <div className="status-badge">{status.message}</div>
      <div className="video-grid">
        {streams.local && <VideoItem stream={streams.local} label={`${userId} (あなた)`} isMuted={true} />}
        {Object.entries(streams.remotes).map(([id, stream]) => (
          <VideoItem key={id} stream={stream} label={id} />
        ))}
      </div>
      <style>{`
        .vc-container { height: 100vh; background: #0f172a; color: white; padding: 10px; }
        .status-badge { background: #3b82f6; display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; margin-bottom: 10px; }
        .video-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; }
      `}</style>
    </div>
  );
};

export default VCComponent;