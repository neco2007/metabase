import React, { useEffect, useRef } from 'react';

/**
 * 参加者のビデオとラベルを表示する最小単位コンポーネント
 */
const VideoItem = ({ stream, label, isMuted = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    // ストリームをビデオ要素に紐付け
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-item">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="video-element"
      />
      <div className="video-label">
        <span className="label-text">{label}</span>
      </div>
      <style>{`
        .video-item {
          position: relative;
          background: #1e293b;
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 16 / 9;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .video-label {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background: rgba(0, 0, 0, 0.6);
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          color: white;
          backdrop-filter: blur(4px);
        }
      `}</style>
    </div>
  );
};

export default VideoItem;