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
  const controlsTimerRef = useRef<number | null>(null);
  const lastTap = useRef(0);
  const zoomInTimer = useRef<number | null>(null);
  const zoomOutTimer = useRef<number | null>(null);
  const zoomIndicatorTimer = useRef<number | null>(null);
  const initialPinchDistance = useRef(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isZoomInVisible, setIsZoomInVisible] = useState(false);
  const [isZoomOutVisible, setIsZoomOutVisible] = useState(false);
  const [zoomIndicatorContent, setZoomIndicatorContent] = useState('');
  const [isZoomIndicatorVisible, setIsZoomIndicatorVisible] = useState(false);

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
      if (zoomIndicatorTimer.current) clearTimeout(zoomIndicatorTimer.current);
    };
  }, []);

  const showControlsAndResetTimer = () => {
    setIsControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setIsControlsVisible(false), 3000);
  };

  const showZoomIndicator = (text: string) => {
    setZoomIndicatorContent(text);
    setIsZoomIndicatorVisible(true);
    if (zoomIndicatorTimer.current) clearTimeout(zoomIndicatorTimer.current);
    zoomIndicatorTimer.current = window.setTimeout(() => {
      setIsZoomIndicatorVisible(false);
      setZoomIndicatorContent('');
    }, 2000); // The indicator itself has a resetting timer
  };

  const handleZoom = (newZoom: number) => {
    const min = 1;
    const max = 16;
    const clampedZoom = Math.max(min, Math.min(newZoom, max));
    setZoom(clampedZoom);
    showZoomIndicator(`x${clampedZoom.toFixed(1)}`);

    if (clampedZoom === min && newZoom < min) {
      showZoomIndicator("Min Zoom Reached");
    } else if (clampedZoom === max && newZoom > max) {
      showZoomIndicator("Max Zoom Reached");
    }
  };

  const handleManualZoom = (direction: 'in' | 'out') => {
    const step = 0.5;
    const zoomChange = direction === 'in' ? step : -step;
    handleZoom(zoom + zoomChange);
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
      handleZoom(zoom * ratio);
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

  const videoStyle = { transform: `scale(${zoom})` };
  const isFeedbackError = zoomIndicatorContent.includes("Reached");

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

      {isZoomable && (
          <>
            <div className={`video-zoom-indicator ${isZoomIndicatorVisible ? 'visible' : ''} ${isFeedbackError ? 'error' : 'info'}`}>
                {zoomIndicatorContent || `x${zoom.toFixed(1)}`}
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
          <div className="live-badge is-live">LIVE</div>
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
