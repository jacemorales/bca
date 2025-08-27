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
    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitIsFullScreen: boolean; webkitFullscreenElement: Element };
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const videoElement = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    const playerWrapper = playerWrapperRef.current as HTMLElement & { webkitRequestFullscreen?: () => void };

    const isCurrentlyFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;

    if (!isCurrentlyFullscreen) {
      // Prioritize iOS-specific video fullscreen
      if (videoElement?.webkitEnterFullscreen) {
        videoElement.webkitEnterFullscreen();
      } else if (playerWrapper?.requestFullscreen) {
        playerWrapper.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
      } else if (playerWrapper?.webkitRequestFullscreen) {
        playerWrapper.webkitRequestFullscreen(); // For older Safari
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
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
