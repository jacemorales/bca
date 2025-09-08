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
  const initialPinchDistance = useRef(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  const [zoomMode, setZoomMode] = useState<'hardware' | 'visual'>('visual');
  const [hardwareZoom, setHardwareZoom] = useState(1);
  const [visualZoom, setVisualZoom] = useState(1);

  const [isZoomInVisible, setIsZoomInVisible] = useState(false);
  const [isZoomOutVisible, setIsZoomOutVisible] = useState(false);
  const [zoomFeedback, setZoomFeedback] = useState('');
  const [zoomFeedbackType, setZoomFeedbackType] = useState<'info' | 'error'>('info');

  // Determine zoom mode and set initial values
  useEffect(() => {
    if (isZoomable && zoomCapabilities && onZoomChange) {
      setZoomMode('hardware');
      setHardwareZoom(zoomCapabilities.min || 1);
      showZoomFeedback('Hardware zoom enabled', 'info');
    } else if (isZoomable) {
      setZoomMode('visual');
      showZoomFeedback('Using visual zoom fallback', 'info');
    }
  }, [isZoomable, zoomCapabilities, onZoomChange]);

  // Set video stream
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
    if (zoomMode === 'hardware' && zoomCapabilities && onZoomChange) {
      const { min, max, step } = zoomCapabilities;
      const zoomChange = direction === 'in' ? step : -step;
      const newZoom = hardwareZoom + zoomChange;
      const clampedZoom = Math.max(min, Math.min(newZoom, max));
      if (clampedZoom !== hardwareZoom) {
        setHardwareZoom(clampedZoom);
        onZoomChange(clampedZoom);
      }
      if (clampedZoom === min && direction === 'out') showZoomFeedback("Min Zoom Reached", 'error');
      else if (clampedZoom === max && direction === 'in') showZoomFeedback("Max Zoom Reached", 'error');
    } else { // Visual zoom
      const step = 0.25;
      const [min, max] = [1, 4];
      const zoomChange = direction === 'in' ? step : -step;
      const newZoom = visualZoom + zoomChange;
      const clampedZoom = Math.max(min, Math.min(newZoom, max));
      setVisualZoom(clampedZoom);
      if (clampedZoom === min && direction === 'out') showZoomFeedback("Min Zoom Reached", 'error');
      else if (clampedZoom === max && direction === 'in') showZoomFeedback("Max Zoom Reached", 'error');
    }
  };

  const handlePinchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDistance.current = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    }
  };

  const handlePinchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDistance.current > 0) {
      e.preventDefault();
      const newPinchDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const ratio = newPinchDistance / initialPinchDistance.current;
      const newZoom = Math.max(1, Math.min(visualZoom * ratio, 4));
      setVisualZoom(newZoom);
      initialPinchDistance.current = newPinchDistance;
    }
  };

  const handlePinchEnd = () => {
    initialPinchDistance.current = 0;
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

  const currentZoomForDisplay = zoomMode === 'hardware' ? hardwareZoom : visualZoom;
  const videoStyle = { transform: `scale(${visualZoom})` };

  return (
    <div
        ref={playerWrapperRef}
        className={`video-player-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}
        onMouseMove={showControlsAndResetTimer}
        onTouchStart={(e) => { showControlsAndResetTimer(); if (isZoomable) handlePinchStart(e); }}
        onTouchMove={isZoomable ? handlePinchMove : undefined}
        onTouchEnd={isZoomable ? handlePinchEnd : undefined}
        onClick={handleVideoWrapperClick}
    >
      <video ref={videoRef} style={videoStyle} className="video-player" autoPlay muted={isMuted} playsInline />

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
                {zoomFeedback || `x${currentZoomForDisplay.toFixed(1)}`}
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
