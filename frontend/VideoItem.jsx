import React, { useEffect, useRef } from 'react';

/**
 * 個別のビデオストリームを表示するコンポーネント
 * @param {Object} props { stream, label, isMuted }
 */
const VideoItem = ({ stream, label, isMuted = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
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
      <div className="video-label">{label}</div>
    </div>
  );
};

export default VideoItem;