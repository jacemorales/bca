
import { useEffect, useRef, useState } from "react";
import { createSocket } from "../lib/socket";
import SermonInfo from "../components/SermonInfo";
import Chat from "../components/Chat";
import SermonDetailsForm from "../components/SermonDetailsForm";
import VideoPlayer from "../components/VideoPlayer";
import { Socket } from "socket.io-client";
import { LoadingButton } from "../components/LoadingButton";

type PeerMap = Record<string, RTCPeerConnection>;
type AdminState = 'offline' | 'configuring' | 'selecting_camera' | 'resuming' | 'streaming';

interface StreamInfo {
  title: string;
  pastor: string;
  scripture: string;
  notes: string;
  startTime?: string;
  streamId?: string;
}

export default function Admin() {
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<PeerMap>({});
  const socketRef = useRef<Socket | null>(null);
  
  const [adminState, setAdminState] = useState<AdminState>('offline');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamDuration, setStreamDuration] = useState("00:00");
  const [isLogoOverlayVisible, setIsLogoOverlayVisible] = useState(false);
  const [zoomCapabilities, setZoomCapabilities] = useState<MediaTrackCapabilities['zoom'] | null>(null);
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({
    title: "Sunday Service",
    pastor: "Rev Dr. Eugene-Ndu",
    scripture: "John 3:16",
    notes: "",
  });

  useEffect(() => {
    const savedStream = localStorage.getItem("bca_admin:streamInfo");
    if (savedStream) {
        setStreamInfo(JSON.parse(savedStream));
        setAdminState('resuming');
    }

    const socket = createSocket();
    socketRef.current = socket;
    socket.connect();
    socket.on("viewer:join", handleViewerJoin);
    socket.on("answer", handleAnswer);
    socket.on("ice", handleIceCandidate);
    socket.on("viewerCount", setViewerCount);
    socket.on("stream:logoState", setIsLogoOverlayVisible);

    return () => {
      socket.off("viewer:join");
      socket.off("answer");
      socket.off("ice");
      socket.off("viewerCount");
      socket.off("stream:logoState");
      cleanupStream();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const durationInterval = setInterval(() => {
        if (adminState === 'streaming' && streamInfo.startTime) {
            const now = new Date();
            const start = new Date(streamInfo.startTime);
            const diff = now.getTime() - start.getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            const formatted = h > 0
                ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            setStreamDuration(formatted);
        }
    }, 1000);
    return () => clearInterval(durationInterval);
  }, [adminState, streamInfo.startTime]);

  const handleViewerJoin = async ({ viewerId }: { viewerId: string }) => {
    if (!localStreamRef.current) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcsRef.current[viewerId] = pc;
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    pc.onicecandidate = (ev) => {
      if (ev.candidate) socketRef.current?.emit("ice", { targetId: viewerId, candidate: ev.candidate });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit("offer", { targetId: viewerId, sdp: pc.localDescription });
  };

  const handleAnswer = async ({ from, sdp }: { from: string; sdp: any }) => {
    const pc = pcsRef.current[from];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  };

  const handleIceCandidate = ({ from, candidate }: { from: string; candidate: any }) => {
    const pc = pcsRef.current[from];
    if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const handleSermonSubmit = (info: StreamInfo) => {
    setStreamInfo(info);
    setAdminState('selecting_camera');
  };

  const startNewStream = async (facingMode: 'user' | 'environment') => {
      const fullStreamInfo = { ...streamInfo, streamId: Date.now().toString(), startTime: new Date().toISOString() };
      await getMediaAndBroadcast(facingMode, fullStreamInfo);
  };

  const resumeStream = async () => {
      await getMediaAndBroadcast('user', streamInfo); // Default to user camera on resume
  }

  const getMediaAndBroadcast = async (facingMode: 'user' | 'environment', info: StreamInfo) => {
    setIsActionLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode },
        audio: true,
      });
      localStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && 'zoom' in videoTrack.getCapabilities()) {
        setZoomCapabilities(videoTrack.getCapabilities().zoom);
      } else {
        setZoomCapabilities(null);
      }

      setStreamInfo(info);
      setAdminState('streaming');
      localStorage.setItem("bca_admin:streamInfo", JSON.stringify(info));
      socketRef.current?.emit("role:broadcaster", info);
    } catch (err: any) {
      console.error("Failed to get media", err);
      if (facingMode === 'environment' && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
        console.warn("Back camera not found, falling back to front camera.");
        getMediaAndBroadcast('user', info);
        return;
      }
      alert("Could not access camera. Please check permissions.");
      setAdminState('offline');
    } finally {
        setIsActionLoading(false);
    }
  };

  const stopStreaming = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    socketRef.current?.emit("stream:ended");
    cleanupStream();
    localStorage.removeItem("bca_admin:streamInfo");
    setAdminState('offline');
  };

  const cleanupStream = () => {
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const handleToggleLogoOverlay = () => {
    socketRef.current?.emit("stream:toggleLogo");
  };

  const handleZoomChange = (newZoom: number) => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack && 'zoom' in videoTrack.getSettings()) {
      try {
        videoTrack.applyConstraints({ advanced: [{ zoom: newZoom }] });
      } catch (error) {
        console.error("Failed to apply zoom constraints:", error);
      }
    }
  };

  const renderOfflineContent = () => {
    switch(adminState) {
        case 'resuming':
            return (
                <div className="admin-offline-state">
                    <h3>Existing Stream Found</h3>
                    <p>Do you want to continue your previous stream?</p>
                    <div className="camera-selection-actions">
                        <LoadingButton onClick={resumeStream} className="btn btn-primary" isLoading={isActionLoading} loadingText="Resuming...">Continue Stream</LoadingButton>
                        <button onClick={() => { localStorage.removeItem("bca_admin:streamInfo"); setAdminState('configuring');}} className="btn btn-secondary">Start New Stream</button>
                    </div>
                </div>
            )
        case 'selecting_camera':
             return (
                <div className="admin-offline-state">
                    <h3>Select Camera</h3>
                    <div className="camera-selection-actions">
                        <LoadingButton onClick={() => startNewStream('user')} className="btn btn-primary" isLoading={isActionLoading} loadingText="Starting...">Use Front Camera</LoadingButton>
                        <LoadingButton onClick={() => startNewStream('environment')} className="btn btn-secondary" isLoading={isActionLoading} loadingText="Starting...">Use Back Camera</LoadingButton>
                    </div>
                </div>
            );
        case 'offline':
        default:
            return (
                <div className="admin-offline-state">
                    <h3>Ready to Go Live</h3>
                    <p>Click "Configure Stream" to set sermon details and start.</p>
                     <LoadingButton className="btn btn-primary" onClick={() => setAdminState('configuring')} isLoading={isActionLoading}>
                        Configure Stream
                    </LoadingButton>
                </div>
            );
    }
  }

  return (
    <div className="admin-page container">
      <div className="admin-header">
        <div className="admin-header-left">
          <h2>Broadcast Control</h2>
        </div>
        {adminState === 'streaming' && (
            <button className="btn btn-danger" onClick={stopStreaming}>
                Stop Streaming
            </button>
        )}
      </div>

      <div className={`admin-layout ${adminState === 'streaming' ? 'is-streaming' : ''}`}>
        <div className="admin-main-content">
          {adminState === 'streaming' && localStreamRef.current ? (
            <div className="card">
              <VideoPlayer
                stream={localStreamRef.current}
                viewerCount={viewerCount}
                isMuted={true}
                showControls={true}
                duration={streamDuration}
                onLayoutChange={(layout) => socketRef.current?.emit("stream:layoutChange", layout)}
                isCoverVisible={isLogoOverlayVisible}
                onToggleLogo={handleToggleLogoOverlay}
                isZoomable={true}
                onZoomChange={handleZoomChange}
                zoomCapabilities={zoomCapabilities}
              />
              <SermonInfo 
                streamInfo={streamInfo} 
                isAdmin={true}
                onUpdate={(newInfo) => {
                    const updated = { ...streamInfo, ...newInfo };
                    setStreamInfo(updated);
                    socketRef.current?.emit("stream:info", updated);
                    localStorage.setItem("bca_admin:streamInfo", JSON.stringify(updated));
                }}
              />
            </div>
          ) : (
            <div className="card admin-offline-container">
              {renderOfflineContent()}
            </div>
          )}
        </div>

        {adminState === 'streaming' && socketRef.current && (
          <div className="admin-chat-sidebar">
            <div className="card chat-card">
              <Chat socket={socketRef.current} username="Admin" />
            </div>
          </div>
        )}
      </div>

      {adminState === 'configuring' && (
        <SermonDetailsForm
          initialInfo={streamInfo}
          onSubmit={handleSermonSubmit}
          onCancel={() => setAdminState('offline')}
          isStreaming={false}
        />
      )}
    </div>
  );
}
