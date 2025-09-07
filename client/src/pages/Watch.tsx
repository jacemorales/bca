import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createSocket } from "../lib/socket";
import Chat from "../components/Chat";
import SermonInfo from "../components/SermonInfo";
import VideoPlayer from "../components/VideoPlayer";
import { Socket } from "socket.io-client";
import { LoadingButton } from "../components/LoadingButton";

interface StreamInfo {
  title: string;
  pastor: string;
  scripture: string;
  notes: string;
  startTime?: string;
  streamId?: string;
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
  const [username, setUsername] = useState("");
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

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

    // Cleanup socket on component unmount
    return () => {
        socket?.disconnect();
    }
  }, []);

  const handleJoinLiveClick = () => {
    setIsRetrying(true);
    const newSocket = createSocket();

    newSocket.on('connect_error', () => {
      setIsRetrying(false);
      setUiState('serverError');
      newSocket.disconnect();
    });

    newSocket.on('connect', () => {
      const savedStreamInfo = localStorage.getItem("bca_viewer:streamInfo");
      const streamId = savedStreamInfo ? JSON.parse(savedStreamInfo).streamId : null;
      newSocket.emit("check:stream", { streamId });
    });

    newSocket.once("stream:status", (status) => {
      setIsRetrying(false);
      if (status.online && status.info) {
        setStreamInfo(status.info);
        setSocket(newSocket); // Socket is ready and stream is confirmed, save it
        if (username) {
          setUiState("watching");
        } else {
          setUiState("promptUsername");
        }
      } else {
        setUiState("noStream");
        newSocket.disconnect();
      }
    });

    newSocket.connect();
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
    socket?.disconnect();
    setSocket(null);
    setUiState("initial");
  };

  useEffect(() => {
    if (socket && uiState === 'watching') {
      const onStreamEnd = () => setUiState('streamEnded');
      const onStreamPause = () => setUiState('streamPaused');

      socket.on('stream:ended', onStreamEnd);
      socket.on('broadcaster:disconnect', onStreamPause);

      return () => {
        socket.off('stream:ended', onStreamEnd);
        socket.off('broadcaster:disconnect', onStreamPause);
      };
    }
  }, [socket, uiState]);

  if (uiState === 'watching' && socket) {
    return <WatchingView socket={socket} streamInfo={streamInfo!} username={username} onLeave={handleReturnToHome} />;
  }

  // All non-watching states are rendered here
  return (
    <div className="page-container">
        <div className="card watch-state-container">
            {uiState === 'initial' && (
                <>
                    <h3>Join the Live Worship</h3>
                    <p>Experience our service in real-time with our community online.</p>
                    <div className="watch-actions">
                        <LoadingButton onClick={handleJoinLiveClick} className="btn btn-primary" isLoading={isRetrying} loadingText="Joining...">Join Live</LoadingButton>
                        <Link to="/events" className="btn btn-secondary">View Events</Link>
                    </div>
                </>
            )}
            {uiState === 'promptRejoin' && (
                 <>
                    <h3>Stream in Progress</h3>
                    <p>It looks like you were watching the stream. Would you like to rejoin?</p>
                    <div className="watch-actions">
                        <LoadingButton onClick={handleJoinLiveClick} className="btn btn-primary" isLoading={isRetrying} loadingText="Rejoining...">Rejoin</LoadingButton>
                        <button onClick={handleReturnToHome} className="btn btn-secondary">Leave</button>
                    </div>
                </>
            )}
            {uiState === 'noStream' && (
                <>
                    <h3>No Active Stream</h3>
                    <p>There is no live stream at the moment. Please check our events page.</p>
                    <div className="watch-actions">
                        <LoadingButton onClick={handleJoinLiveClick} className="btn btn-primary" isLoading={isRetrying} loadingText="Checking...">Check Again</LoadingButton>
                        <Link to="/events" className="btn btn-secondary">View Events</Link>
                    </div>
                </>
            )}
            {uiState === 'promptUsername' && (
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
                        <LoadingButton type="submit" disabled={!username.trim()} className="btn btn-primary" isLoading={false}>Join</LoadingButton>
                    </form>
                </>
            )}
            {uiState === 'streamEnded' && (
                <>
                    <h3>Stream Has Ended</h3>
                    <p>Thank you for joining us! The live stream has concluded.</p>
                    <button onClick={handleReturnToHome} className="btn btn-primary">Return to Home</button>
                </>
            )}
            {uiState === 'streamPaused' && (
                <>
                    <h3>Stream Paused</h3>
                    <p>The host may have a temporary connection issue. Please wait or try rejoining.</p>
                    <div className="watch-actions">
                        <LoadingButton onClick={handleJoinLiveClick} className="btn btn-primary" isLoading={isRetrying} loadingText="Retrying...">
                            Retry
                        </LoadingButton>
                        <button onClick={handleReturnToHome} className="btn btn-secondary" disabled={isRetrying}>
                            Leave
                        </button>
                    </div>
                </>
            )}
             {uiState === 'serverError' && (
                <>
                    <h3>Connection Error</h3>
                    <p>Could not connect to the server. It might be temporarily down. Please try again later.</p>
                    <div className="watch-actions">
                         <Link to="/events" className="btn btn-secondary">View Events</Link>
                    </div>
                </>
            )}
        </div>
    </div>
  );
}

function WatchingView({ socket, streamInfo, username, onLeave }: { socket: Socket, streamInfo: StreamInfo, username: string, onLeave: () => void }) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoLayout, setVideoLayout] = useState<'landscape' | 'portrait'>('landscape');
  const [duration, setDuration] = useState("00:00");
  const [isLogoOverlayVisible, setIsLogoOverlayVisible] = useState(false);

  useEffect(() => {
    const durationInterval = setInterval(() => {
        if (streamInfo.startTime) {
            const now = new Date();
            const start = new Date(streamInfo.startTime);
            const diff = now.getTime() - start.getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            const formatted = h > 0
                ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            setDuration(formatted);
        }
    }, 1000);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    socket.emit("role:viewer", { username });

    const handleOffer = async (data: { from: string; sdp: any }) => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      pc.ontrack = (ev) => setRemoteStream(ev.streams[0]);
      pc.onicecandidate = (ev) => {
        if (ev.candidate) socket.emit("ice", { targetId: data.from, candidate: ev.candidate });
      };
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { targetId: data.from, sdp: pc.localDescription });
    };

    const handleIceCandidate = (data: { from: string; candidate: any }) => {
      if (pcRef.current && data.candidate) pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    };

    const handleLayoutChange = (layout: 'landscape' | 'portrait') => setVideoLayout(layout);

    socket.on("offer", handleOffer);
    socket.on("ice", handleIceCandidate);
    socket.on("viewerCount", setViewerCount);
    socket.on("stream:layoutChange", handleLayoutChange);
    socket.on("stream:logoState", setIsLogoOverlayVisible);

    return () => {
      socket.off("offer");
      socket.off("ice");
      socket.off("viewerCount");
      socket.off("stream:layoutChange");
      socket.off("stream:logoState");
      pcRef.current?.close();
      // Note: We don't disconnect the socket here because the parent `Watch` component manages its lifecycle.
    };
  }, [username, socket]);

  return (
    <div className="watch-page container">
      <div className="watch-header">
        <h2>Live Worship</h2>
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
                    isLogoOverlayVisible={isLogoOverlayVisible}
                />
            ) : (
                <div className="video-player-wrapper">
                    <div className="loading-spinner"></div>
                    <p>Connecting to stream...</p>
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
  )
}
