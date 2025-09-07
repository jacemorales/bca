import { TouchEvent, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, RefreshCw, LogOut, Camera, ZoomIn, ZoomOut } from 'lucide-react';

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
  onZoomChange?: (zoom: number) => void;
  zoomCapabilities?: MediaTrackCapabilities['zoom'] | null;
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
  showWatermark,
  onZoomChange,
  zoomCapabilities
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const lastTap = useRef(0);
  const zoomInTimer = useRef<number | null>(null);
  const zoomOutTimer = useRef<number | null>(null);
  const zoomFeedbackTimer = useRef<number | null>(null);

  const [videoLayout, setVideoLayout] = useState<'landscape' | 'portrait'>(initialLayout);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isZoomInVisible, setIsZoomInVisible] = useState(false);
  const [isZoomOutVisible, setIsZoomOutVisible] = useState(false);
  const [zoomFeedback, setZoomFeedback] = useState('');

  // Effect to set initial zoom state when capabilities are known
  useEffect(() => {
    if (zoomCapabilities) {
      setCurrentZoom(1); // Assuming stream starts at 1x zoom
    }
  }, [zoomCapabilities]);

  // Effect to manage fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Effect to show controls on initial load and clear timers on unmount
  useEffect(() => {
    showControlsAndResetTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (zoomInTimer.current) clearTimeout(zoomInTimer.current);
      if (zoomOutTimer.current) clearTimeout(zoomOutTimer.current);
      if (zoomFeedbackTimer.current) clearTimeout(zoomFeedbackTimer.current);
    };
  }, []);

  // Set video stream
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const showControlsAndResetTimer = () => {
    setIsControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setIsControlsVisible(false), 3000);
  };

  const handleZoom = (newZoom: number, step: number) => {
    if (!isZoomable || !zoomCapabilities || !onZoomChange) return;

    const { min, max } = zoomCapabilities;
    const clampedZoom = Math.max(min, Math.min(newZoom, max));

    setCurrentZoom(clampedZoom);
    onZoomChange(clampedZoom);

    if (clampedZoom === min && step < 0) {
        showZoomFeedback("Min Zoom Reached");
    } else if (clampedZoom === max && step > 0) {
        showZoomFeedback("Max Zoom Reached");
    }
  };

  const showZoomFeedback = (message: string) => {
    setZoomFeedback(message);
    if (zoomFeedbackTimer.current) clearTimeout(zoomFeedbackTimer.current);
    zoomFeedbackTimer.current = window.setTimeout(() => setZoomFeedback(''), 1500);
  }

  const handleManualZoom = (direction: 'in' | 'out') => {
    const step = zoomCapabilities?.step || 0.1;
    const zoomChange = direction === 'in' ? step : -step;
    handleZoom(currentZoom + zoomChange, zoomChange);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isZoomable || e.touches.length !== 2) return;
    e.preventDefault();
    // This part is tricky without a proper gesture library.
    // The visual scale is not implemented anymore, only hardware zoom.
  };

  const handleVideoWrapperClick = (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
      const now = Date.now();
      if (now - lastTap.current < 300) { // Double tap
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (clickX > rect.width / 2) { // Right side
              handleManualZoom('in');
              setIsZoomInVisible(true);
              if (zoomInTimer.current) clearTimeout(zoomInTimer.current);
              zoomInTimer.current = window.setTimeout(() => setIsZoomInVisible(false), 2000);
          } else { // Left side
              handleManualZoom('out');
              setIsZoomOutVisible(true);
              if (zoomOutTimer.current) clearTimeout(zoomOutTimer.current);
              zoomOutTimer.current = window.setTimeout(() => setIsZoomOutVisible(false), 2000);
          }
      }
      lastTap.current = now;
  }

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
    <div
        ref={playerWrapperRef}
        className={`video-player-wrapper ${videoLayout} ${isFullscreen ? 'is-fullscreen' : ''}`}
        onMouseMove={showControlsAndResetTimer}
        onTouchStart={showControlsAndResetTimer}
        onClick={isZoomable ? handleVideoWrapperClick : undefined}
        onTouchMove={handleTouchMove}
    >
      <video ref={videoRef} className="video-player" autoPlay muted={isMuted} playsInline />

      {showWatermark && <img src="/logo_transparent.png" alt="Watermark" className="video-watermark" />}

      {isCoverVisible && (
        <div className="video-cover-overlay">
          <img src="/logo.png" alt="Cover Logo" />
        </div>
      )}

      <div className="live-badge-wrapper">
        <div className="live-badge is-live">LIVE</div>
      </div>

      {isZoomable && (
          <>
            <div className={`video-zoom-indicator ${zoomFeedback ? 'visible' : ''}`}>
                {zoomFeedback || `x${currentZoom.toFixed(1)}`}
            </div>
            <div
                className={`video-zoom-control left ${isZoomOutVisible ? 'visible' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleManualZoom('out'); }}
            >
                <ZoomOut size={24} />
            </div>
            <div
                className={`video-zoom-control right ${isZoomInVisible ? 'visible' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleManualZoom('in'); }}
            >
                <ZoomIn size={24} />
            </div>
          </>
      )}

      <div className={`video-overlay-ui ${isControlsVisible ? 'visible' : ''}`}>
        <div className="video-overlay-top">
          {showControls && (
            <div className="video-controls-overlay">
                {onToggleLogo && (
                    <button onClick={onToggleLogo} title="Toggle Cover" className={isCoverVisible ? 'active' : ''}>
                        <Camera size={20} />
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
