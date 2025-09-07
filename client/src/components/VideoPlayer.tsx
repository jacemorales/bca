// VideoPlayer.tsx
import { TouchEvent, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, RefreshCw, LogOut, Camera } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream;
  viewerCount: number;
  isMuted: boolean;
  showControls: boolean;
  onLayoutChange?: (layout: 'landscape' | 'portrait') => void;
  initialLayout?: 'landscape' | 'portrait';
  duration?: string;
  onLeave?: () => void;
  isCoverVisible?: boolean;
  onToggleLogo?: () => void;
  isZoomable?: boolean;
  showWatermark?: boolean;
}

export default function VideoPlayer({
  stream,
  viewerCount,
  isMuted,
  showControls,
  onLayoutChange,
  initialLayout = 'landscape',
  duration = "00:00",
  onLeave,
  isCoverVisible,
  onToggleLogo,
  isZoomable,
  showWatermark
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);
  const initialTouchDistance = useRef<number | null>(null);

  const [videoLayout, setVideoLayout] = useState<'landscape' | 'portrait'>(initialLayout);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (initialLayout) {
        setVideoLayout(initialLayout);
    }
  }, [initialLayout]);


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

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
        initialTouchDistance.current = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2 && initialTouchDistance.current) {
          const newTouchDistance = Math.hypot(
              e.touches[0].pageX - e.touches[1].pageX,
              e.touches[0].pageY - e.touches[1].pageY
          );
          const scale = Math.max(1, Math.min(transform.scale * (newTouchDistance / initialTouchDistance.current), 4));
          setTransform({ ...transform, scale });
          initialTouchDistance.current = newTouchDistance;
      }
  };

  const handleTouchEnd = () => {
      initialTouchDistance.current = null;
  };

  const handleDoubleClick = () => {
    setTransform({ scale: 1, x: 0, y: 0 }); // Reset zoom on double tap/click
  };

  const videoStyle = {
    transform: `scale(${transform.scale})`,
    transition: 'transform 0.1s ease-out',
  };

  return (
    <div
        ref={playerWrapperRef}
        className={`video-player-wrapper ${videoLayout}`}
        onTouchStart={isZoomable ? handleTouchStart : undefined}
        onTouchMove={isZoomable ? handleTouchMove : undefined}
        onTouchEnd={isZoomable ? handleTouchEnd : undefined}
        onDoubleClick={isZoomable ? handleDoubleClick : undefined}
    >
      <video ref={videoRef} style={videoStyle} className="video-player" autoPlay muted={isMuted} playsInline />

      {showWatermark && <img src="/logo_transparent.png" alt="Watermark" className="video-watermark" />}

      {isCoverVisible && (
        <div className="video-cover-overlay">
          <img src="/logo.png" alt="Cover Logo" />
        </div>
      )}

      <div className="video-overlay-ui">
        <div className="video-overlay-top">
          <div className="live-badge is-live">LIVE</div>
          {showControls && (
            <div className="video-controls-overlay">
                {onToggleLogo && (
                    <button
                        onClick={onToggleLogo}
                        title="Toggle Cover"
                        className={isCoverVisible ? 'active' : ''}
                    >
                        <Camera size={20} />
                    </button>
                )}
                <button onClick={toggleVideoLayout} title="Toggle Aspect Ratio">
                <RefreshCw size={20} />
                </button>
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
