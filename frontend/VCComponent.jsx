import React, { useState, useEffect, useCallback } from 'react';
import { WebRTCClient } from './WebRTCClient';
import VideoItem from './VideoItem';

/**
 * 2025年次世代WebRTCビデオチャットコンポーネント
 * 自動接続・ニックネーム管理対応版
 */
const VCComponent = ({ userId, token }) => {
  const [client] = useState(() => new WebRTCClient());
  const [streams, setStreams] = useState({ local: null, screen: null, remotes: {} });
  const [status, setStatus] = useState({ message: '準備中...', isError: false });
  const [nickname, setNickname] = useState('ゲスト'); // デフォルト名

  // エンドポイント設定 (必ず /api/v1 を含めてください)
  const API_BASE = 'http://163.44.110.157:8099';
  const SIGNAL_URL = `${API_BASE}/api/v1/signaling`; 
  const SSE_URL = `${API_BASE}/api/v1/notifications`;

  const handleTrack = useCallback((peerId, stream) => {
    setStreams(prev => ({
      ...prev,
      remotes: { ...prev.remotes, [peerId]: stream }
    }));
  }, []);

  // 自動接続ロジック
  const autoJoin = useCallback(async () => {
    try {
      updateStatus('接続中...', false);
      const localStream = await client.startLocalStream();
      setStreams(prev => ({ ...prev, local: localStream }));
      
      client.onTrackCallback = handleTrack;
      await client.createAndExchange('server_peer', SIGNAL_URL, token);
      updateStatus('接続完了', false);
    } catch (err) {
      updateStatus(`接続失敗: ${err.message}`, true);
    }
  }, [client, handleTrack, SIGNAL_URL, token]);

  // マウント時に即時実行
  useEffect(() => {
    autoJoin();
  }, [autoJoin]);

  // SSE連携
  useEffect(() => {
    if (status.message !== '接続完了') return;
    const eventSource = new EventSource(`${SSE_URL}?token=${token}`);
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'renegotiate_needed') {
        await client.createAndExchange('server_peer', SIGNAL_URL, token);
      }
    };
    return () => eventSource.close();
  }, [status.message, token, client, SIGNAL_URL, SSE_URL]);

  const updateStatus = (msg, isErr) => {
    setStatus({ message: msg, isError: isErr });
  };

  return (
    <div className="vc-container">
      <header className="vc-header">
        <div className={`status-badge ${status.isError ? 'error' : ''}`}>
          {status.message}
        </div>
        <div className="nickname-input-group">
          <span>表示名:</span>
          <input 
            type="text" 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)} 
            placeholder="ニックネームを入力"
          />
        </div>
      </header>

      <main className="video-grid">
        {streams.local && (
          <VideoItem stream={streams.local} label={`${nickname} (あなた)`} isMuted={true} />
        )}
        {Object.entries(streams.remotes).map(([id, stream]) => (
          <VideoItem key={id} stream={stream} label={`参加者: ${id}`} />
        ))}
      </main>

      <style>{`
        .vc-container { display: flex; flex-direction: column; height: 100vh; background: #0f172a; color: white; }
        .vc-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: #1e293b; }
        .status-badge { padding: 4px 12px; border-radius: 20px; background: #3b82f6; font-size: 0.8rem; }
        .status-badge.error { background: #ef4444; }
        .nickname-input-group { display: flex; align-items: center; gap: 10px; }
        .nickname-input-group input { background: #334155; border: 1px solid #475569; color: white; padding: 5px 10px; border-radius: 4px; }
        .video-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; padding: 1rem; }
      `}</style>
    </div>
  );
};

export default VCComponent;