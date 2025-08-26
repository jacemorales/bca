// VideoPlayer.tsx
import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, RefreshCw, LogOut } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream;
  viewerCount: number;
  isMuted: boolean;
  showControls: boolean;
  onLayoutChange?: (layout: 'landscape' | 'portrait') => void;
  initialLayout?: 'landscape' | 'portrait';
  duration?: string;
  onLeave?: () => void;
}

export default function VideoPlayer({ stream, viewerCount, isMuted, showControls, onLayoutChange, initialLayout = 'landscape', duration = "00:00", onLeave }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);

  const [videoLayout, setVideoLayout] = useState<'landscape' | 'portrait'>(initialLayout);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(error => {
        console.error("Video play failed:", error);
      });
    }
  }, [stream]);

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

  const toggleVideoLayout = () => {
    const newLayout = videoLayout === 'landscape' ? 'portrait' : 'landscape';
    setVideoLayout(newLayout);
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
  }

  return (
    <div ref={playerWrapperRef} className={`video-player-wrapper ${videoLayout}`}>
      <video ref={videoRef} className="video-player" autoPlay muted={isMuted} playsInline />
      <div className="video-overlay-ui">
        <div className="video-overlay-top">
          <div className="live-badge is-live">LIVE</div>
          {showControls && (
            <div className="video-controls-overlay">
                {onLayoutChange && (
                    <button onClick={toggleVideoLayout} title="Toggle Aspect Ratio">
                        <RefreshCw size={20} />
                    </button>
                )}
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
