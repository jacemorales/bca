import React, { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import SermonInfo from "../components/SermonInfo";
import Chat from "../components/Chat";
import SermonDetailsForm from "../components/SermonDetailsForm";
import VideoPlayer from "../components/VideoPlayer";
import {
  Copy,
  Check,
  Radio,
  Tv,
  Users,
  Eye,
  Activity,
  Image,
  Power,
  Layers,
  Video,
  AlertCircle,
  Clock,
} from "lucide-react";

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

interface StreamDevice {
  socketId: string;
  deviceId: string;
  deviceName: string;
  isStreaming: boolean;
  showLogo?: boolean;
  connectedAt: string;
}

interface ActivityLogItem {
  id: string;
  timestamp: string;
  text: string;
}

function generateLocalKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segment = () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `BRD-${segment()}-${segment()}-${segment()}`;
}

function MiniVideoPreview({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;

    const handleCanPlay = () => {
      video.play().catch((err) => {
        console.error("Mini preview play error:", err);
      });
    };

    video.addEventListener("canplay", handleCanPlay);

    // Also attempt play directly in case stream is already ready
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="mini-video"
    />
  );
}

export default function Admin() {
  const [broadcastState, setBroadcastState] = useState<"idle" | "creating" | "control_room">("idle");
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({
    title: "Sunday Service",
    pastor: "Rev Dr. Eugene-Ndu",
    scripture: "John 3:16",
    notes: "",
  });

  const [broadcastKey, setBroadcastKey] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [devices, setDevices] = useState<StreamDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamDuration, setStreamDuration] = useState("00:00");
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);

  // Restore Admin session from localStorage if available
  useEffect(() => {
    const savedAdminState = localStorage.getItem("admin_broadcastState");
    const savedKey = localStorage.getItem("admin_broadcastKey");
    if (savedAdminState === "control_room" && savedKey) {
      setBroadcastState("control_room");
      setBroadcastKey(savedKey);
    }
  }, []);

  // PeerConnections for mini device previews
  const previewPcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const [deviceStreams, setDeviceStreams] = useState<Record<string, MediaStream>>({});

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("role:admin");

    const onAdminInit = (data: {
      activeBroadcast: StreamInfo;
      devices: StreamDevice[];
      selectedDeviceId: string | null;
      showLogo: boolean;
      activityLogs: ActivityLogItem[];
      viewerCount: number;
    }) => {
      if (data.activeBroadcast && data.activeBroadcast.broadcastKey && data.activeBroadcast.status !== "ENDED") {
        setStreamInfo(data.activeBroadcast);
        setBroadcastKey(data.activeBroadcast.broadcastKey);
        setSelectedDeviceId(data.selectedDeviceId);
        setShowLogo(Boolean(data.showLogo));
        setBroadcastState("control_room");
        localStorage.setItem("admin_broadcastState", "control_room");
        localStorage.setItem("admin_broadcastKey", data.activeBroadcast.broadcastKey);
      }
      setDevices(data.devices || []);
      setActivityLogs(data.activityLogs || []);
      setViewerCount(data.viewerCount || 0);
    };

    const onConnect = () => {
      socket.emit("role:admin");
    };

    socket.on("connect", onConnect);

    const onBroadcastUpdated = (updated: StreamInfo) => {
      setStreamInfo((prev) => ({ ...prev, ...updated }));
      if (updated.broadcastKey) setBroadcastKey(updated.broadcastKey);
      if (updated.selectedDeviceId !== undefined) setSelectedDeviceId(updated.selectedDeviceId);
      if (updated.showLogo !== undefined) setShowLogo(updated.showLogo);
    };

    const onDevicesUpdated = (devList: StreamDevice[]) => {
      setDevices(devList);
    };

    const onDeviceJoined = (device: StreamDevice) => {
      console.log("Device joined:", device);
    };

    const onDeviceLeft = ({ socketId }: { socketId: string }) => {
      if (previewPcsRef.current[socketId]) {
        previewPcsRef.current[socketId].close();
        delete previewPcsRef.current[socketId];
      }
      setDeviceStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const onActivityLog = (logItem: ActivityLogItem) => {
      setActivityLogs((prev) => [...prev.slice(-99), logItem]);
    };

    const onOffer = async ({ from, sdp }: { from: string; sdp: any }) => {
      let pc = previewPcsRef.current[from];
      if (!pc) {
        pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        previewPcsRef.current[from] = pc;
      }

      pc.ontrack = (ev) => {
        if (ev.streams && ev.streams[0]) {
          const remoteStream = ev.streams[0];
          setDeviceStreams((prev) => ({
            ...prev,
            [from]: remoteStream,
          }));
        }
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socket.emit("ice", { targetId: from, candidate: ev.candidate });
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { targetId: from, sdp: pc.localDescription });
      } catch (err) {
        console.error("Error handling WebRTC offer in Admin:", err);
      }
    };

    const onIceCandidate = ({ from, candidate }: { from: string; candidate: any }) => {
      const pc = previewPcsRef.current[from];
      if (pc && candidate) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
          console.warn("Error adding ICE candidate:", e)
        );
      }
    };

    socket.on("admin:init", onAdminInit);
    socket.on("broadcast:updated", onBroadcastUpdated);
    socket.on("devices:updated", onDevicesUpdated);
    socket.on("device:joined", onDeviceJoined);
    socket.on("device:left", onDeviceLeft);
    socket.on("activity:log", onActivityLog);
    socket.on("viewerCount", setViewerCount);
    socket.on("offer", onOffer);
    socket.on("ice", onIceCandidate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("admin:init", onAdminInit);
      socket.off("broadcast:updated", onBroadcastUpdated);
      socket.off("devices:updated", onDevicesUpdated);
      socket.off("device:joined", onDeviceJoined);
      socket.off("device:left", onDeviceLeft);
      socket.off("activity:log", onActivityLog);
      socket.off("viewerCount", setViewerCount);
      socket.off("offer", onOffer);
      socket.off("ice", onIceCandidate);

      Object.values(previewPcsRef.current).forEach((pc) => pc.close());
      previewPcsRef.current = {};
    };
  }, []);

  // Duration timer effect
  useEffect(() => {
    const durationInterval = setInterval(() => {
      if (broadcastState === "control_room" && streamInfo.startTime) {
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
        setStreamDuration(formatted);
      }
    }, 1000);
    return () => clearInterval(durationInterval);
  }, [broadcastState, streamInfo.startTime]);

  useEffect(() => {
    if (broadcastState === "control_room") {
      devices.forEach((dev) => {
        if (dev.isStreaming && !previewPcsRef.current[dev.socketId]) {
          socket.emit("request:stream", { targetSocketId: dev.socketId });
        }
      });
    }
  }, [devices, broadcastState]);

  const handleCreateBroadcast = (info: StreamInfo) => {
    if (!socket.connected) {
      socket.connect();
    }

    const localKey = generateLocalKey();
    const fallbackBroadcast: StreamInfo = {
      ...info,
      streamId: Date.now().toString(),
      broadcastKey: localKey,
      startTime: new Date().toISOString(),
      status: "WAITING_FOR_STREAM",
      selectedDeviceId: null,
      showLogo: false,
    };

    setStreamInfo(fallbackBroadcast);
    setBroadcastKey(localKey);
    setBroadcastState("control_room");

    socket.emit(
      "admin:create_broadcast",
      info,
      (res: { success: boolean; broadcast: StreamInfo }) => {
        if (res && res.success && res.broadcast) {
          setStreamInfo(res.broadcast);
          if (res.broadcast.broadcastKey) {
            setBroadcastKey(res.broadcast.broadcastKey);
          }
        }
      }
    );
  };

  const handleCopyKey = () => {
    if (broadcastKey) {
      navigator.clipboard.writeText(broadcastKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const selectProgramSource = (socketId: string | null) => {
    setSelectedDeviceId(socketId);
    socket.emit("admin:select_program", { socketId });
  };

  const handleToggleLogo = () => {
    const nextState = !showLogo;
    setShowLogo(nextState);
    socket.emit("admin:toggle_logo", { showLogo: nextState });
  };

  const endBroadcast = () => {
    if (window.confirm("Are you sure you want to end this live broadcast?")) {
      socket.emit("admin:end_broadcast");
      setBroadcastState("idle");
      setSelectedDeviceId(null);
      setBroadcastKey("");
      setDeviceStreams({});
      localStorage.removeItem("admin_broadcastState");
      localStorage.removeItem("admin_broadcastKey");
      Object.values(previewPcsRef.current).forEach((pc) => pc.close());
      previewPcsRef.current = {};
    }
  };

  const selectedStream = selectedDeviceId ? deviceStreams[selectedDeviceId] : null;
  const activeProgramDevice = devices.find((d) => d.socketId === selectedDeviceId);

  return (
    <div className="admin-control-room container">
      {/* Top Header */}
      <div className="admin-header card">
        <div className="admin-header-left">
          <div className="admin-title-row">
            <Radio className="text-primary pulse" size={28} />
            <h2>Streaming Control Center</h2>
          </div>
          {broadcastState === "control_room" && (
            <p className="broadcast-title-sub">
              Broadcast: <strong>{streamInfo.title}</strong>
              {streamInfo.pastor && ` • Speaker: ${streamInfo.pastor}`}
            </p>
          )}
        </div>

        {broadcastState === "control_room" && (
          <div className="admin-header-right">
            <div className="broadcast-status-pills">
              <span
                className={`status-badge ${
                  streamInfo.status === "LIVE"
                    ? "connected"
                    : streamInfo.status === "WAITING_FOR_STREAM"
                    ? "connecting"
                    : "disconnected"
                }`}
              >
                <span className="status-dot"></span>
                {streamInfo.status === "LIVE"
                  ? "● LIVE"
                  : streamInfo.status === "WAITING_FOR_STREAM"
                  ? "WAITING FOR STREAM"
                  : streamInfo.status || "IDLE"}
              </span>

              <span className="duration-pill">
                <Clock size={14} /> {streamDuration}
              </span>
              <span className="viewers-pill">
                <Users size={14} /> {viewerCount} Viewers
              </span>
            </div>

            <button className="btn btn-danger btn-sm" onClick={endBroadcast}>
              <Power size={16} /> End Broadcast
            </button>
          </div>
        )}
      </div>

      {/* State: Idle / Ready to Create */}
      {broadcastState === "idle" && (
        <div className="card admin-offline-container">
          <div className="admin-offline-state">
            <Radio size={48} className="text-primary" style={{ marginBottom: "1rem" }} />
            <h3>Create a New Live Broadcast</h3>
            <p>
              Set up the broadcast details. You will receive a unique Broadcast Key to connect camera streaming devices.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setBroadcastState("creating")}
              style={{ marginTop: "1rem" }}
            >
              Configure Broadcast
            </button>
          </div>
        </div>
      )}

      {/* State: Configuring Form */}
      {broadcastState === "creating" && (
        <SermonDetailsForm
          initialInfo={streamInfo}
          onSubmit={handleCreateBroadcast}
          onCancel={() => setBroadcastState("idle")}
          isStreaming={false}
        />
      )}

      {/* State: Live Production Control Room */}
      {broadcastState === "control_room" && (
        <div className="control-room-layout">
          {/* Top Banner: Broadcast Key Sharing Bar */}
          <div className="card broadcast-key-banner">
            <div className="key-banner-info">
              <div className="key-label">
                <Radio size={18} />
                <span>BROADCAST KEY</span>
              </div>
              <div className="key-code">{broadcastKey || "BRD-XXXX-YYYY-ZZZZ"}</div>
            </div>
            <div className="key-banner-actions">
              <button onClick={handleCopyKey} className="btn btn-secondary btn-sm">
                {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                {copiedKey ? "Copied!" : "Copy Broadcast Key"}
              </button>
              <span className="key-hint">
                Share this key with streaming operators visiting <code>/stream</code>
              </span>
            </div>
          </div>

          <div className="control-room-grid">
            {/* Left Column: Program Output & Preview */}
            <div className="main-production-column">
              {/* Main Program Output Screen */}
              <div className="card program-output-card">
                <div className="section-header">
                  <div className="header-label">
                    <Tv className="text-danger" size={20} />
                    <h3>PROGRAM OUTPUT (Viewer Feed)</h3>
                  </div>
                  {activeProgramDevice && (
                    <span className="active-source-badge">
                      SOURCE: {activeProgramDevice.deviceName}
                    </span>
                  )}
                </div>

                <div className="program-player-wrapper">
                  {selectedStream ? (
                    <VideoPlayer
                      stream={selectedStream}
                      viewerCount={viewerCount}
                      isMuted={true}
                      showControls={true}
                      duration={streamDuration}
                      showLogoOverlay={showLogo}
                    />
                  ) : (
                    <div className="video-placeholder-container">
                      <div className="placeholder-content">
                        <Video size={48} className="text-muted" />
                        <h4>
                          {devices.length === 0
                            ? "Waiting for streaming devices to connect..."
                            : "No camera feed selected for Program output"}
                        </h4>
                        <p>
                          {devices.length === 0
                            ? "Visit /stream on any mobile phone or camera device and enter the Broadcast Key."
                            : "Click 'Set as Program' on any connected camera feed below to stream to viewers."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Program Controls Toolbar */}
                <div className="program-controls-toolbar">
                  <div className="toolbar-left">
                    <button
                      onClick={handleToggleLogo}
                      className={`btn ${showLogo ? "btn-primary" : "btn-secondary"}`}
                    >
                      <Image size={18} />
                      {showLogo ? "Hide Logo Overlay" : "Show Logo"}
                    </button>

                    {selectedDeviceId && (
                      <button
                        onClick={() => selectProgramSource(null)}
                        className="btn btn-secondary"
                      >
                        Clear Program Source
                      </button>
                    )}
                  </div>

                  <div className="toolbar-right">
                    <span className="logo-status-indicator">
                      Logo Overlay: <strong>{showLogo ? "ON" : "OFF"}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Connected Streams Grid (Mini Previews) */}
              <div className="card connected-sources-card">
                <div className="section-header">
                  <div className="header-label">
                    <Layers size={20} />
                    <h3>CONNECTED STREAMING DEVICES ({devices.length})</h3>
                  </div>
                </div>

                {devices.length === 0 ? (
                  <div className="no-devices-prompt">
                    <AlertCircle size={24} className="text-warning" />
                    <p>No streaming devices connected yet.</p>
                    <small>Operators can open <strong>/stream</strong> to connect.</small>
                  </div>
                ) : (
                  <div className="mini-streams-grid">
                    {devices.map((dev) => {
                      const stream = deviceStreams[dev.socketId];
                      const isSelected = dev.socketId === selectedDeviceId;

                      return (
                        <div
                          key={dev.socketId}
                          className={`mini-stream-item card ${isSelected ? "is-selected-program" : ""}`}
                        >
                          <div className="mini-stream-header">
                            <span className="mini-stream-title">{dev.deviceName}</span>
                            <span
                              className={`status-badge ${
                                dev.isStreaming ? "connected" : "disconnected"
                              }`}
                            >
                              <span className="status-dot"></span>
                              {dev.isStreaming ? "LIVE" : "IDLE"}
                            </span>
                          </div>

                          <div className="mini-video-container">
                            {stream ? (
                              <MiniVideoPreview stream={stream} />
                            ) : (
                              <div className="mini-video-placeholder">
                                <span>{dev.isStreaming ? "Connecting feed..." : "Not streaming"}</span>
                              </div>
                            )}

                            {dev.showLogo && (
                              <div className="video-logo-overlay">
                                <img src="/logo.png" alt="Logo Overlay" className="overlay-logo-img" />
                              </div>
                            )}

                            {isSelected && <div className="program-tag">PROGRAM</div>}
                          </div>

                          <div className="mini-stream-actions">
                            <button
                              disabled={!dev.isStreaming}
                              onClick={() => selectProgramSource(dev.socketId)}
                              className={`btn ${isSelected ? "btn-danger" : "btn-primary"} btn-xs`}
                              style={{ width: "100%" }}
                            >
                              {isSelected ? "Currently Live" : "Set as Program"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Chat, Sermon Meta & Real-Time Activity Log */}
            <div className="sidebar-production-column">
              {/* Activity Log Panel */}
              <div className="card activity-log-card">
                <div className="section-header">
                  <div className="header-label">
                    <Activity size={18} />
                    <h4>Activity Log</h4>
                  </div>
                </div>
                <div className="activity-logs-list">
                  {activityLogs.length === 0 ? (
                    <p className="empty-logs">No activity recorded yet.</p>
                  ) : (
                    activityLogs
                      .slice()
                      .reverse()
                      .map((log) => (
                        <div key={log.id} className="log-item">
                          <span className="log-time">{log.timestamp}</span>
                          <span className="log-text">{log.text}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Sermon Metadata Card */}
              <div className="card">
                <SermonInfo
                  streamInfo={streamInfo}
                  isAdmin={true}
                  onUpdate={(newInfo) => {
                    const updated = { ...streamInfo, ...newInfo };
                    setStreamInfo(updated);
                    socket.emit("stream:info", updated);
                  }}
                />
              </div>

              {/* Chat Panel */}
              <div className="card admin-chat-card">
                <Chat socket={socket} username="Admin" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
