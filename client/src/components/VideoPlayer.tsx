// VideoPlayer.tsx
import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, RefreshCw, LogOut, ZoomIn, ZoomOut } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream;
  viewerCount: number;
  hideViewerCount?: boolean;
  isMuted: boolean;
  showControls: boolean;
  onLayoutChange?: (layout: 'landscape' | 'portrait') => void;
  initialLayout?: 'landscape' | 'portrait';
  duration?: string;
  onLeave?: () => void;
  showLogoOverlay?: boolean;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
}

export default function VideoPlayer({
  stream,
  viewerCount,
  hideViewerCount = false,
  isMuted,
  showControls,
  onLayoutChange,
  initialLayout = 'landscape',
  duration = "00:00",
  onLeave,
  showLogoOverlay = false,
  zoomLevel: propZoomLevel,
  onZoomChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);

  const [videoLayout, setVideoLayout] = useState<'landscape' | 'portrait'>(initialLayout);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localZoom, setLocalZoom] = useState(1);
  const touchStartDistRef = useRef<number | null>(null);

  const currentZoom = propZoomLevel !== undefined ? propZoomLevel : localZoom;

  const updateZoom = (newZoom: number) => {
    const clamped = Math.min(Math.max(newZoom, 1), 4);
    if (onZoomChange) {
      onZoomChange(clamped);
    } else {
      setLocalZoom(clamped);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;

    const handleCanPlay = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Autoplay was prevented: ", error);
        });
      }
    };

    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
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

  // Touch gesture handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      const delta = dist - touchStartDistRef.current;
      const zoomFactor = delta * 0.005;
      updateZoom(currentZoom + zoomFactor);
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  const toggleFullscreen = () => {
    const player = playerWrapperRef.current;
    if (!player) return;
    if (!document.fullscreenElement) {
      player.requestFullscreen().catch((err) => alert(`Error enabling full-screen: ${err.message}`));
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
  };

  return (
    <div
      ref={playerWrapperRef}
      className={`video-player-wrapper ${videoLayout}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        className="video-player"
        autoPlay
        muted={isMuted}
        playsInline
        style={{
          transform: `scale(${currentZoom})`,
          transition: 'transform 0.1s linear',
          transformOrigin: 'center center',
        }}
      />

      {/* Show Logo Overlay Mask */}
      {showLogoOverlay && (
        <div className="video-logo-overlay">
          <img src="/logo.png" alt="Broadcast Logo Overlay" className="overlay-logo-img" />
        </div>
      )}

      <div className="video-overlay-ui">
        <div className="video-overlay-top">
          <div className="live-badge is-live">LIVE</div>
          {currentZoom > 1 && (
            <div className="zoom-badge">
              <span>{currentZoom.toFixed(1)}x</span>
            </div>
          )}
          {showControls && (
            <div className="video-controls-overlay">
              <button onClick={() => updateZoom(currentZoom + 0.2)} title="Zoom In">
                <ZoomIn size={18} />
              </button>
              <button onClick={() => updateZoom(currentZoom - 0.2)} title="Zoom Out">
                <ZoomOut size={18} />
              </button>
              <button onClick={toggleVideoLayout} title="Toggle Aspect Ratio">
                <RefreshCw size={18} />
              </button>
              <button onClick={toggleFullscreen} title="Toggle Fullscreen">
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          )}
        </div>
        <div className="video-overlay-bottom">
          <div className="stream-details">
            <span>{duration}</span>
            {!hideViewerCount && (
              <>
                <span>•</span>
                <span>{viewerCount} viewers</span>
              </>
            )}
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
