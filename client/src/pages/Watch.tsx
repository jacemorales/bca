import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { socket } from "../lib/socket";
import Chat from "../components/Chat";
import SermonInfo from "../components/SermonInfo";
import VideoPlayer from "../components/VideoPlayer";
import { Radio, AlertCircle, Video, Image } from "lucide-react";

interface StreamInfo {
  title: string;
  pastor: string;
  scripture: string;
  notes: string;
  startTime?: string;
  streamId?: string;
  broadcastKey?: string;
  status?: string;
  selectedDeviceId?: string | null;
  showLogo?: boolean;
}

type UiState =
  | "initial"
  | "promptRejoin"
  | "promptUsername"
  | "noStream"
  | "watching"
  | "streamEnded"
  | "streamPaused"
  | "serverError";

export default function Watch() {
  const [uiState, setUiState] = useState<UiState>("initial");
  const [isRetrying, setIsRetrying] = useState(false);
  const [connectionErrorCount, setConnectionErrorCount] = useState(0);
  const [username, setUsername] = useState("");
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);

  useEffect(() => {
    const savedUsername = localStorage.getItem("bca:viewerName");
    if (savedUsername) setUsername(savedUsername);

    const savedStreamInfo = localStorage.getItem("bca_viewer:streamInfo");
    if (savedStreamInfo) {
      try {
        setStreamInfo(JSON.parse(savedStreamInfo));
        setUiState("promptRejoin");
      } catch {
        localStorage.removeItem("bca_viewer:streamInfo");
      }
    }

    const onConnectError = () => {
      setConnectionErrorCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= 5) {
          setUiState("serverError");
        }
        return newCount;
      });
    };

    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect_error", onConnectError);
    };
  }, []);

  const handleJoinLiveClick = () => {
    setIsRetrying(true);
    setConnectionErrorCount(0);
    socket.connect();

    const savedStreamInfo = localStorage.getItem("bca_viewer:streamInfo");
    const streamId = savedStreamInfo ? JSON.parse(savedStreamInfo).streamId : null;

    socket.emit("check:stream", { streamId });

    socket.once("stream:status", (status: { online: boolean; info?: StreamInfo }) => {
      setIsRetrying(false);
      if (status.online) {
        setStreamInfo(status.info || null);
        if (username) {
          setUiState("watching");
        } else {
          setUiState("promptUsername");
        }
      } else {
        if (uiState === "streamPaused") {
          // Stay paused
        } else if (uiState === "promptRejoin") {
          setUiState("streamEnded");
        } else {
          setUiState("noStream");
        }
      }
    });
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    localStorage.setItem("bca:viewerName", username);
    if (streamInfo) {
      localStorage.setItem("bca_viewer:streamInfo", JSON.stringify(streamInfo));
    }
    setUiState("watching");
  };

  const handleReturnToHome = () => {
    localStorage.removeItem("bca_viewer:streamInfo");
    setStreamInfo(null);
    socket.disconnect();
    setUiState("initial");
  };

  useEffect(() => {
    if (uiState === "watching") {
      const onStreamEnd = () => setUiState("streamEnded");
      const onStreamPause = () => setUiState("streamPaused");

      socket.on("stream:ended", onStreamEnd);
      socket.on("broadcaster:disconnect", onStreamPause);

      return () => {
        socket.off("stream:ended", onStreamEnd);
        socket.off("broadcaster:disconnect", onStreamPause);
      };
    }
  }, [uiState]);

  if (uiState === "watching") {
    return (
      <WatchingView
        initialStreamInfo={streamInfo!}
        username={username}
        onLeave={handleReturnToHome}
      />
    );
  }

  return (
    <div className="page-container">
      <div className="card watch-state-container">
        {uiState === "initial" && (
          <>
            <Radio size={40} className="text-primary pulse" />
            <h3>Join Live Broadcast</h3>
            <p>Experience our live worship service with our online community.</p>
            <div className="watch-actions">
              <button onClick={handleJoinLiveClick} className="btn btn-primary">
                Join Live
              </button>
              <Link to="/events" className="btn btn-secondary">
                View Events
              </Link>
            </div>
          </>
        )}
        {uiState === "promptRejoin" && (
          <>
            <h3>Stream in Progress</h3>
            <p>It looks like you were watching the stream. Would you like to rejoin?</p>
            <div className="watch-actions">
              <button onClick={handleJoinLiveClick} className="btn btn-primary">
                Rejoin
              </button>
              <button onClick={handleReturnToHome} className="btn btn-secondary">
                Leave
              </button>
            </div>
          </>
        )}
        {uiState === "noStream" && (
          <>
            <h3>No Active Broadcast</h3>
            <p>There is no live broadcast at the moment. Please check back later.</p>
            <div className="watch-actions">
              <button onClick={handleJoinLiveClick} className="btn btn-primary">
                Check Again
              </button>
              <Link to="/events" className="btn btn-secondary">
                View Events
              </Link>
            </div>
          </>
        )}
        {uiState === "promptUsername" && (
          <>
            <h3>Join the Conversation</h3>
            <p>Enter your name to participate in the live chat.</p>
            <form onSubmit={handleUsernameSubmit} className="username-form">
              <input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="watch-username-input"
                autoFocus
              />
              <button type="submit" disabled={!username.trim()} className="btn btn-primary">
                Join
              </button>
            </form>
          </>
        )}
        {uiState === "streamEnded" && (
          <>
            <h3>Broadcast Has Ended</h3>
            <p>Thank you for joining us! The live broadcast has concluded.</p>
            <button onClick={handleReturnToHome} className="btn btn-primary">
              Return to Home
            </button>
          </>
        )}
        {uiState === "streamPaused" && (
          <>
            <h3>Broadcast Paused</h3>
            <p>The host or video source has a temporary connection issue. Please wait or try rejoining.</p>
            <div className="watch-actions">
              <button onClick={handleJoinLiveClick} className="btn btn-primary" disabled={isRetrying}>
                {isRetrying ? "Checking..." : "Retry"}
              </button>
              <button onClick={handleReturnToHome} className="btn btn-secondary" disabled={isRetrying}>
                Leave
              </button>
            </div>
          </>
        )}
        {uiState === "serverError" && (
          <>
            <h3>Connection Error</h3>
            <p>Could not connect to the server. Please try again later.</p>
            <div className="watch-actions">
              <Link to="/events" className="btn btn-secondary">
                View Events
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WatchingView({
  initialStreamInfo,
  username,
  onLeave,
}: {
  initialStreamInfo: StreamInfo;
  username: string;
  onLeave: () => void;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [streamInfo, setStreamInfo] = useState<StreamInfo>(initialStreamInfo);
  const [viewerCount, setViewerCount] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoLayout, setVideoLayout] = useState<"landscape" | "portrait">("landscape");
  const [duration, setDuration] = useState("00:00");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    initialStreamInfo.selectedDeviceId || null
  );
  const [showLogo, setShowLogo] = useState<boolean>(Boolean(initialStreamInfo.showLogo));
  const [feedState, setFeedState] = useState<
    "connecting" | "waiting_for_feed" | "active" | "unavailable"
  >("waiting_for_feed");

  const connectToSource = (targetSocketId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    setRemoteStream(null);
    setFeedState("connecting");

    socket.emit("request:stream", { targetSocketId });
  };

  useEffect(() => {
    const durationInterval = setInterval(() => {
      if (streamInfo.startTime) {
        const now = new Date();
        const start = new Date(streamInfo.startTime);
        const diff = Math.max(0, now.getTime() - start.getTime());
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const formatted =
          h > 0
            ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
            : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        setDuration(formatted);
      }
    }, 1000);

    window.scrollTo({ top: 0, behavior: "smooth" });
    const onConnect = () => {
      socket.emit("role:viewer", { username });
      if (selectedDeviceId) {
        connectToSource(selectedDeviceId);
      }
    };

    socket.on("connect", onConnect);

    socket.emit("role:viewer", { username });

    if (selectedDeviceId) {
      connectToSource(selectedDeviceId);
    } else {
      setFeedState("waiting_for_feed");
    }

    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ];

    const handleOffer = async (data: { from: string; sdp: any }) => {
      if (pcRef.current) pcRef.current.close();

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      pendingIceCandidatesRef.current = [];

      pc.ontrack = (ev) => {
        if (ev.streams && ev.streams[0]) {
          setRemoteStream(ev.streams[0]);
        } else {
          setRemoteStream(new MediaStream([ev.track]));
        }
        setFeedState("active");
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socket.emit("ice", { targetId: data.from, candidate: ev.candidate });
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { targetId: data.from, sdp: pc.localDescription });

        // Flush queued ICE candidates
        for (const cand of pendingIceCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        pendingIceCandidatesRef.current = [];
      } catch (err) {
        console.error("Viewer error handling offer:", err);
      }
    };

    const handleIceCandidate = (data: { from: string; candidate: any }) => {
      const pc = pcRef.current;
      if (data.candidate) {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        } else {
          pendingIceCandidatesRef.current.push(data.candidate);
        }
      }
    };

    const handleProgramChanged = (data: {
      selectedDeviceId: string | null;
      deviceName: string | null;
      unavailable?: boolean;
    }) => {
      setSelectedDeviceId(data.selectedDeviceId);

      if (data.unavailable) {
        if (pcRef.current) pcRef.current.close();
        pcRef.current = null;
        setRemoteStream(null);
        setFeedState("unavailable");
      } else if (data.selectedDeviceId) {
        connectToSource(data.selectedDeviceId);
      } else {
        if (pcRef.current) pcRef.current.close();
        pcRef.current = null;
        setRemoteStream(null);
        setFeedState("waiting_for_feed");
      }
    };

    const handleLogoStatus = (data: { showLogo: boolean }) => {
      setShowLogo(Boolean(data.showLogo));
    };

    const handleBroadcastUpdated = (updated: StreamInfo) => {
      setStreamInfo((prev) => ({ ...prev, ...updated }));
      if (updated.showLogo !== undefined) setShowLogo(Boolean(updated.showLogo));
      if (updated.selectedDeviceId !== undefined && updated.selectedDeviceId !== selectedDeviceId) {
        setSelectedDeviceId(updated.selectedDeviceId);
        if (updated.selectedDeviceId) {
          connectToSource(updated.selectedDeviceId);
        } else {
          setRemoteStream(null);
          setFeedState("waiting_for_feed");
        }
      }
    };

    const handleLayoutChange = (layout: "landscape" | "portrait") => setVideoLayout(layout);

    socket.on("offer", handleOffer);
    socket.on("ice", handleIceCandidate);
    socket.on("program:changed", handleProgramChanged);
    socket.on("logo:status", handleLogoStatus);
    socket.on("broadcast:updated", handleBroadcastUpdated);
    socket.on("viewerCount", setViewerCount);
    socket.on("stream:layoutChange", handleLayoutChange);

    return () => {
      clearInterval(durationInterval);
      socket.off("connect", onConnect);
      socket.off("offer", handleOffer);
      socket.off("ice", handleIceCandidate);
      socket.off("program:changed", handleProgramChanged);
      socket.off("logo:status", handleLogoStatus);
      socket.off("broadcast:updated", handleBroadcastUpdated);
      socket.off("viewerCount", setViewerCount);
      socket.off("stream:layoutChange", handleLayoutChange);
      if (pcRef.current) pcRef.current.close();
    };
  }, [username]);

  return (
    <div className="watch-page container">
      <div className="watch-header">
        <h2>Live Worship</h2>
        <div className="live-indicator">
          <span className="pulse-dot">●</span> LIVE
        </div>
      </div>

      <div className="watch-layout with-chat">
        <div className="watch-main-content">
          <div className="card">
            {remoteStream ? (
              <VideoPlayer
                stream={remoteStream}
                viewerCount={viewerCount}
                isMuted={false}
                showControls={true}
                initialLayout={videoLayout}
                duration={duration}
                onLeave={onLeave}
                showLogoOverlay={showLogo}
              />
            ) : (
              <div className="video-player-wrapper video-placeholder-container">
                <div className="placeholder-content">
                  {feedState === "connecting" && (
                    <>
                      <div className="loading-spinner"></div>
                      <p>Connecting to live video feed...</p>
                    </>
                  )}
                  {feedState === "waiting_for_feed" && (
                    <>
                      <Video size={48} className="text-muted" />
                      <h4>Waiting for video feed...</h4>
                      <p>The broadcast has started, but the video feed hasn't connected yet.</p>
                    </>
                  )}
                  {feedState === "unavailable" && (
                    <>
                      <AlertCircle size={48} className="text-warning" />
                      <h4>Program source unavailable.</h4>
                      <p>The selected camera feed disconnected. Waiting for host to select another camera.</p>
                    </>
                  )}
                </div>
              </div>
            )}
            <SermonInfo streamInfo={streamInfo} />
          </div>
        </div>

        <div className="watch-chat-sidebar">
          <div className="card chat-card">
            <Chat socket={socket} username={username} />
          </div>
        </div>
      </div>
    </div>
  );
}
