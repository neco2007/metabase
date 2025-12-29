import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WebRTCClient } from './WebRTCClient';
import VideoItem from './VideoItem';

/**
 * 2025年次世代WebRTCビデオチャットコンポーネント
 * メタバース学校への即時導入を想定した柔軟なUI設計
 */
const VCComponent = ({ userId, token }) => {
  // --- 状態管理 ---
  const [client] = useState(() => new WebRTCClient());
  const [streams, setStreams] = useState({ local: null, screen: null, remotes: {} });
  const [status, setStatus] = useState({ message: '未接続', isError: false });
  
  // エンドポイント設定
  const API_BASE = 'http://<VPSのIP>:8099/api/v1'; // ←ここを修正
  const SIGNAL_URL = `${API_BASE}/signaling`;
  const SSE_URL = `${API_BASE}/notifications`;

  // --- メディア制御関数 ---

  /**
   * リモートトラック受信時のコールバック
   */
  const handleTrack = useCallback((peerId, stream) => {
    setStreams(prev => ({
      ...prev,
      remotes: { ...prev.remotes, [peerId]: stream }
    }));
  }, []);

  /**
   * ビデオ会議への参加処理
   */
  const joinSession = async () => {
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
  };

  /**
   * 画面共有の開始/停止切り替え
   */
  const handleToggleScreen = async () => {
    try {
      if (streams.screen) {
        await client.stopScreenShare(SIGNAL_URL, token);
        setStreams(prev => ({ ...prev, screen: null }));
      } else {
        const screenStream = await client.addScreenShare(SIGNAL_URL, token);
        setStreams(prev => ({ ...prev, screen: screenStream }));
      }
    } catch (err) {
      updateStatus(`画面共有エラー: ${err.message}`, true);
    }
  };

  // --- ユーティリティ ---

  const updateStatus = (msg, isErr) => {
    setStatus({ message: msg, isError: isErr });
    if (isErr) console.error(`[VC_ERROR] ${msg}`);
  };

  // --- ライフサイクル (SSE連携) ---

  useEffect(() => {
    // 接続完了後、サーバーからの更新通知を待機
    if (status.message !== '接続完了') return;

    const eventSource = new EventSource(`${SSE_URL}?token=${token}`);

    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'renegotiate_needed') {
        console.log('再ネゴシエーション通知を受信: 更新を開始します');
        await client.createAndExchange('server_peer', SIGNAL_URL, token);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE切断。再接続を試みます...');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [status.message, token, client]);

  // --- レンダリング ---

  return (
    <div className="vc-container">
      <header className={`status-banner ${status.isError ? 'error' : ''}`}>
        {status.message}
      </header>

      <main className="video-grid">
        {/* ローカル映像（カメラ） */}
        {streams.local && (
          <VideoItem stream={streams.local} label="自分 (カメラ)" isMuted={true} />
        )}
        
        {/* ローカル映像（画面共有） */}
        {streams.screen && (
          <VideoItem stream={streams.screen} label="共有中" isMuted={true} />
        )}

        {/* 他参加者の映像 */}
        {Object.entries(streams.remotes).map(([id, stream]) => (
          <VideoItem key={id} stream={stream} label={`参加者: ${id}`} />
        ))}
      </main>

      <footer className="control-bar">
        <button onClick={joinSession} className="btn-join">授業に参加</button>
        <button 
          onClick={handleToggleScreen} 
          className={`btn-screen ${streams.screen ? 'active' : ''}`}
        >
          {streams.screen ? '共有停止' : '画面共有'}
        </button>
      </footer>

      <style jsx>{`
        .vc-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0f172a;
          color: white;
          font-family: 'Inter', sans-serif;
        }
        .status-banner {
          padding: 8px;
          text-align: center;
          background: #1e293b;
          font-size: 0.9rem;
        }
        .status-banner.error { background: #991b1b; }
        .video-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
          padding: 1rem;
          overflow-y: auto;
        }
        .control-bar {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          padding: 1.5rem;
          background: #1e293b;
        }
        button {
          padding: 10px 24px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-join { background: #3b82f6; color: white; }
        .btn-join:hover { background: #2563eb; }
        .btn-screen { background: #475569; color: white; }
        .btn-screen.active { background: #ef4444; }
      `}</style>
    </div>
  );
};

export default VCComponent;