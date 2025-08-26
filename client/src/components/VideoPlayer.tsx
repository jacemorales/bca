// VideoPlayer.tsx
import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, LogOut } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream;
  viewerCount: number;
  isMuted: boolean;
  showControls: boolean;
  duration?: string;
  onLeave?: () => void;
}

export default function VideoPlayer({ stream, viewerCount, isMuted, showControls, duration = "00:00", onLeave }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      if (!isMuted) {
        videoRef.current.play().catch(error => {
          console.error("Video play failed:", error);
        });
      }
    }
  }, [stream, isMuted]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    const player = playerWrapperRef.current;
    if (!player) return;
    if (!document.fullscreenElement) {
      player.requestFullscreen().catch(err => alert(`Error enabling full-screen: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div ref={playerWrapperRef} className="video-player-wrapper">
      <video ref={videoRef} className="video-player" autoPlay muted={isMuted} playsInline />
      <div className="video-overlay-ui">
        <div className="video-overlay-top">
          <div className="live-badge is-live">LIVE</div>
          {showControls && (
            <div className="video-controls-overlay">
                <button onClick={toggleFullscreen} title="Toggle Fullscreen">
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
            </div>
          )}
        </div>
        <div className="video-overlay-bottom">
            <div className="stream-details">
                <span>{duration}</span>
                <span>•</span>
                <span>{viewerCount} viewers</span>
            </div>
            {!isMuted && onLeave && (
                <button className="leave-stream-btn" onClick={onLeave}>
                    <LogOut size={16} />
                    Leave
                </button>
            )}
        </div>
      </div>
    </div>
  );
}
