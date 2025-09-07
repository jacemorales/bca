import { TouchEvent, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Image, ZoomIn, ZoomOut, LogOut } from 'lucide-react';

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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isZoomInVisible, setIsZoomInVisible] = useState(false);
  const [isZoomOutVisible, setIsZoomOutVisible] = useState(false);
  const [zoomFeedback, setZoomFeedback] = useState('');
  const [zoomFeedbackType, setZoomFeedbackType] = useState<'info' | 'error'>('info');

  // Set video stream
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Set initial zoom from capabilities
  useEffect(() => {
    if (zoomCapabilities) {
      // Assuming the track starts at its minimum zoom, which is usually 1
      setCurrentZoom(zoomCapabilities.min);
    }
  }, [zoomCapabilities]);

  // Manage fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Show controls on initial load and clear all timers on unmount
  useEffect(() => {
    showControlsAndResetTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (zoomInTimer.current) clearTimeout(zoomInTimer.current);
      if (zoomOutTimer.current) clearTimeout(zoomOutTimer.current);
      if (zoomFeedbackTimer.current) clearTimeout(zoomFeedbackTimer.current);
    };
  }, []);

  const showControlsAndResetTimer = () => {
    setIsControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setIsControlsVisible(false), 3000);
  };

  const showZoomFeedback = (message: string, type: 'info' | 'error' = 'info') => {
    setZoomFeedback(message);
    setZoomFeedbackType(type);
    if (zoomFeedbackTimer.current) clearTimeout(zoomFeedbackTimer.current);
    zoomFeedbackTimer.current = window.setTimeout(() => setZoomFeedback(''), 1500);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (!isZoomable || !onZoomChange) return;

    if (!zoomCapabilities) {
      showZoomFeedback("Zoom not supported", 'error');
      return;
    }

    const { min, max, step } = zoomCapabilities;
    const zoomChange = direction === 'in' ? step : -step;
    const newZoom = currentZoom + zoomChange;
    const clampedZoom = Math.max(min, Math.min(newZoom, max));

    if (clampedZoom !== currentZoom) {
      setCurrentZoom(clampedZoom);
      onZoomChange(clampedZoom);
    }

    if (clampedZoom === min && direction === 'out') {
        showZoomFeedback("Min Zoom Reached", 'error');
    } else if (clampedZoom === max && direction === 'in') {
        showZoomFeedback("Max Zoom Reached", 'error');
    }
  };

  const handleWrapperInteraction = (e: ReactMouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
    showControlsAndResetTimer();
    if ('touches' in e && isZoomable) {
      e.preventDefault();
    }
  };

  const handleVideoWrapperClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isZoomable) return;
    const now = Date.now();
    if (now - lastTap.current < 300) { // Double tap
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX > rect.width / 2) { // Right side
            handleZoom('in');
            setIsZoomInVisible(true);
            if (zoomInTimer.current) clearTimeout(zoomInTimer.current);
            zoomInTimer.current = window.setTimeout(() => setIsZoomInVisible(false), 2000);
        } else { // Left side
            handleZoom('out');
            setIsZoomOutVisible(true);
            if (zoomOutTimer.current) clearTimeout(zoomOutTimer.current);
            zoomOutTimer.current = window.setTimeout(() => setIsZoomOutVisible(false), 2000);
        }
    }
    lastTap.current = now;
  };

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
        className={`video-player-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}
        onMouseMove={handleWrapperInteraction}
        onTouchStart={handleWrapperInteraction}
        onClick={handleVideoWrapperClick}
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
            <div className={`video-zoom-indicator ${zoomFeedback ? 'visible' : ''} ${zoomFeedbackType}`}>
                {zoomFeedback || `x${currentZoom.toFixed(1)}`}
            </div>
            <div
                className={`video-zoom-control left ${isZoomOutVisible ? 'visible' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleZoom('out'); }}
            >
                <ZoomOut size={24} />
            </div>
            <div
                className={`video-zoom-control right ${isZoomInVisible ? 'visible' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleZoom('in'); }}
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
                        <Image size={20} />
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
