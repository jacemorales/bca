
import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import SermonInfo from "../components/SermonInfo";
import Chat from "../components/Chat";
import SermonDetailsForm from "../components/SermonDetailsForm";
import VideoPlayer from "../components/VideoPlayer";
import PostStreamSummary from "../components/PostStreamSummary";

type PeerMap = Record<string, RTCPeerConnection>;
type AdminState = 'offline' | 'configuring' | 'selecting_camera' | 'resuming' | 'streaming' | 'post-stream';

interface StreamStats {
  duration: string;
  viewerCount: number;
}

interface StreamInfo {
  title: string;
  pastor: string;
  scripture: string;
  notes: string;
  startTime?: string;
  streamId?: string;
  streamCamera?: 'user' | 'environment';
  layout?: 'landscape' | 'portrait';
}

export default function Admin() {
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<PeerMap>({});
  
  const [adminState, setAdminState] = useState<AdminState>('offline');
  const [isLoading, setIsLoading] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamDuration, setStreamDuration] = useState("00:00");
  const [lastStreamStats, setLastStreamStats] = useState<StreamStats | null>(null);
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({
    title: "Sunday Service",
    pastor: "Rev Dr. Eugene-Ndu",
    scripture: "John 3:16",
    notes: "",
  });

  useEffect(() => {
    if (adminState === 'streaming' || adminState === 'offline') {
        setIsLoading(false);
    }
  }, [adminState]);

  useEffect(() => {
    const savedStream = localStorage.getItem("bca_admin:streamInfo");
    if (savedStream) {
        setStreamInfo(JSON.parse(savedStream));
        setAdminState('resuming');
    }

    socket.connect();
    socket.on("viewer:join", handleViewerJoin);
    socket.on("answer", handleAnswer);
    socket.on("ice", handleIceCandidate);
    socket.on("viewerCount", setViewerCount);

    return () => {
      socket.off("viewer:join");
      socket.off("answer");
      socket.off("ice");
      socket.off("viewerCount");
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
      if (ev.candidate) socket.emit("ice", { targetId: viewerId, candidate: ev.candidate });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { targetId: viewerId, sdp: pc.localDescription });
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
      setIsLoading(true);
      const fullStreamInfo = { ...streamInfo, streamId: Date.now().toString(), startTime: new Date().toISOString() };
      await getMediaAndBroadcast(facingMode, fullStreamInfo);
  };

  const resumeStream = async () => {
      setIsLoading(true);
      const camera = streamInfo.streamCamera || 'user';
      await getMediaAndBroadcast(camera, streamInfo);
  }

  const getMediaAndBroadcast = async (facingMode: 'user' | 'environment', info: StreamInfo) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
        },
      });
      localStreamRef.current = stream;
      const updatedInfo = { ...info, streamCamera: facingMode, layout: 'landscape' };
      setStreamInfo(updatedInfo);
      setAdminState('streaming');
      localStorage.setItem("bca_admin:streamInfo", JSON.stringify(updatedInfo));
      socket.emit("role:broadcaster", updatedInfo);
    } catch (err: any) {
      console.error("Failed to get media", err);
      if (facingMode === 'environment' && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
        console.warn("Back camera not found, falling back to front camera.");
        getMediaAndBroadcast('user', info);
        return;
      }
      alert("Could not access camera. Please check permissions.");
      setAdminState('offline');
    }
  };

  const handleLayoutChange = async (layout: 'landscape' | 'portrait') => {
    if (!localStreamRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    videoTrack.stop();

    const newConstraints = {
        video: {
            width: { ideal: layout === 'landscape' ? 1280 : 720 },
            height: { ideal: layout === 'landscape' ? 720 : 1280 },
            facingMode: streamInfo.streamCamera || 'user'
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
        }
    };

    try {
        const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
        const newVideoTrack = newStream.getVideoTracks()[0];

        localStreamRef.current.removeTrack(videoTrack);
        localStreamRef.current.addTrack(newVideoTrack);

        Object.values(pcsRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
        });

        const updated = { ...streamInfo, layout };
        setStreamInfo(updated);
        socket.emit("stream:layoutChange", layout);
        socket.emit("stream:info", updated);
        localStorage.setItem("bca_admin:streamInfo", JSON.stringify(updated));
    } catch (err) {
        console.error("Failed to change layout", err);
        // If layout change fails, maybe try to revert to old stream?
        // For now, we just log the error. A more robust solution could be added later.
    }
  };

  const stopStreaming = () => {
    if (document.fullscreenElement) document.exitFullscreen();

    setLastStreamStats({
      duration: streamDuration,
      viewerCount: viewerCount,
    });

    socket.emit("stream:ended");
    cleanupStream();
    localStorage.removeItem("bca_admin:streamInfo");
    setAdminState('post-stream');
  };

  const handleClosePostStreamSummary = () => {
    setLastStreamStats(null);
    setAdminState('offline');
  }

  const cleanupStream = () => {
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
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
                        <button onClick={resumeStream} className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? 'Starting...' : 'Continue Stream'}
                        </button>
                        <button onClick={stopStreaming} className="btn btn-secondary" disabled={isLoading}>
                            Start New Stream
                        </button>
                    </div>
                </div>
            )
        case 'selecting_camera':
             return (
                <div className="admin-offline-state">
                    <h3>Select Camera</h3>
                    <div className="camera-selection-actions">
                        <button onClick={() => startNewStream('user')} className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? 'Starting...' : 'Use Front Camera'}
                        </button>
                        <button onClick={() => startNewStream('environment')} className="btn btn-secondary" disabled={isLoading}>
                            {isLoading ? 'Starting...' : 'Use Back Camera'}
                        </button>
                    </div>
                </div>
            );
        case 'offline':
        default:
            return (
                <div className="admin-offline-state">
                    <h3>Ready to Go Live</h3>
                    <p>Click "Configure Stream" to set sermon details and start.</p>
                     <button className="btn btn-primary" onClick={() => setAdminState('configuring')}>
                        Configure Stream
                    </button>
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
                initialLayout={streamInfo.layout}
                onLayoutChange={handleLayoutChange}
              />
              <SermonInfo 
                streamInfo={streamInfo} 
                isAdmin={true}
                onUpdate={(newInfo) => {
                    const updated = { ...streamInfo, ...newInfo };
                    setStreamInfo(updated);
                    socket.emit("stream:info", updated);
                    localStorage.setItem("bca_admin:streamInfo", JSON.stringify(updated));
                }}
              />
            </div>
          ) : (
            adminState !== 'post-stream' && (
              <div className="card admin-offline-container">
                {renderOfflineContent()}
              </div>
            )
          )}
        </div>

        {adminState === 'streaming' && (
          <div className="admin-chat-sidebar">
            <div className="card chat-card">
              <Chat socket={socket} username="Admin" />
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

      {adminState === 'post-stream' && lastStreamStats && (
        <PostStreamSummary
          stats={lastStreamStats}
          onClose={handleClosePostStreamSummary}
        />
      )}
    </div>
  );
}
