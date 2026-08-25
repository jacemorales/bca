import React, { useState, useEffect, useRef } from "react";
import { socket } from "../lib/socket";
import VideoPlayer from "../components/VideoPlayer";
import { Camera, RefreshCw, Radio, Image, AlertCircle, Play, Square } from "lucide-react";

interface BroadcastInfo {
  streamId: string;
  broadcastKey: string;
  title: string;
  pastor: string;
  status: string;
}

interface StreamDevice {
  socketId: string;
  deviceId: string;
  deviceName: string;
  isStreaming: boolean;
}

type StreamerState = "login" | "camera_select" | "streaming";

export default function Stream() {
  const [broadcastKeyInput, setBroadcastKeyInput] = useState("");
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [streamerState, setStreamerState] = useState<StreamerState>("login");
  const [broadcastInfo, setBroadcastInfo] = useState<BroadcastInfo | null>(null);
  const [registeredDevice, setRegisteredDevice] = useState<StreamDevice | null>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isStreaming, setIsStreaming] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [supportsHardwareZoom, setSupportsHardwareZoom] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<"connected" | "reconnecting" | "disconnected">("connected");

  // Restore saved session if present in localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("streamer_broadcastKey");
    const savedDevice = localStorage.getItem("streamer_registeredDevice");
    if (savedKey) setBroadcastKeyInput(savedKey);

    if (savedKey && savedDevice) {
      try {
        const parsedDev = JSON.parse(savedDevice);
        setRegisteredDevice(parsedDev);
        setDeviceNameInput(parsedDev.deviceName || "");
      } catch (err) {
        console.warn("Could not parse saved streamer session:", err);
      }
    }
  }, []);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      setNetworkStatus("connected");
      // Re-register device if we have session info
      const savedKey = localStorage.getItem("streamer_broadcastKey");
      const savedDeviceStr = localStorage.getItem("streamer_registeredDevice");
      if (savedKey && savedDeviceStr) {
        try {
          const dev = JSON.parse(savedDeviceStr);
          socket.emit("streamer:register", {
            broadcastKey: savedKey,
            deviceId: dev.deviceId,
            deviceName: dev.deviceName,
          });
        } catch (e) {
          console.error(e);
        }
      }
    };

    const onDisconnect = () => {
      setNetworkStatus("disconnected");
    };

    const onReconnectAttempt = () => {
      setNetworkStatus("reconnecting");
    };

    const onStreamerError = (data: { message: string }) => {
      setErrorMessage(data.message || "An error occurred.");
    };

    const onLogoStatus = (data: { showLogo: boolean }) => {
      setShowLogo(data.showLogo);
    };

    const onBroadcastUpdated = (updated: BroadcastInfo) => {
      setBroadcastInfo(updated);
      if (updated.status === "ENDED") {
        stopMediaStream();
        setIsStreaming(false);
        setStreamerState("login");
        setErrorMessage("This broadcast has been ended by the Admin.");
      }
    };

    const onRequestFeed = async (data: { requesterId: string }) => {
      if (!localStreamRef.current || !data.requesterId) return;
      const { requesterId } = data;
      console.log("Feed requested by:", requesterId);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcsRef.current[requesterId] = pc;

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socket.emit("ice", { targetId: requesterId, candidate: ev.candidate });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { targetId: requesterId, sdp: pc.localDescription });
      } catch (err) {
        console.error("Error creating WebRTC offer for requester:", err);
      }
    };

    const handleAnswer = async ({ from, sdp }: { from: string; sdp: any }) => {
      const pc = pcsRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleIce = ({ from, candidate }: { from: string; candidate: any }) => {
      const pc = pcsRef.current[from];
      if (pc && candidate) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("streamer:error", onStreamerError);
    socket.on("logo:status", onLogoStatus);
    socket.on("broadcast:updated", onBroadcastUpdated);
    socket.on("streamer:request_feed", onRequestFeed);
    socket.on("answer", handleAnswer);
    socket.on("ice", handleIce);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("streamer:error", onStreamerError);
      socket.off("logo:status", onLogoStatus);
      socket.off("broadcast:updated", onBroadcastUpdated);
      socket.off("streamer:request_feed", onRequestFeed);
      socket.off("answer", handleAnswer);
      socket.off("ice", handleIce);
      stopMediaStream();
    };
  }, []);

  const handleValidateAndJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastKeyInput.trim()) {
      setErrorMessage("Please enter a broadcast key.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);

    if (!socket.connected) {
      socket.connect();
    }

    const key = broadcastKeyInput.trim().toUpperCase();

    // Set a timeout fallback in case server response takes long
    const timeoutId = setTimeout(() => {
      setIsSubmitting(false);
      // Fallback transition if socket server is running in single-instance mode
      const devId = `device_${Math.random().toString(36).substr(2, 8)}`;
      const devName = deviceNameInput.trim() || `Camera Feed`;
      setRegisteredDevice({
        socketId: socket.id || "local_dev",
        deviceId: devId,
        deviceName: devName,
        isStreaming: false,
      });
      setStreamerState("camera_select");
    }, 1500);

    socket.emit(
      "streamer:validate_key",
      { broadcastKey: key },
      (res: { success: boolean; error?: string; broadcast?: BroadcastInfo }) => {
        clearTimeout(timeoutId);
        setIsSubmitting(false);

        if (!res.success) {
          setErrorMessage(res.error || "Failed to validate broadcast key.");
          return;
        }

        const bInfo = res.broadcast!;
        setBroadcastInfo(bInfo);

        const devId = registeredDevice?.deviceId || `device_${Math.random().toString(36).substr(2, 8)}`;
        const devName = deviceNameInput.trim() || registeredDevice?.deviceName || `Camera Feed`;

        socket.emit("streamer:register", {
          broadcastKey: key,
          deviceId: devId,
          deviceName: devName,
        });

        const devObj = {
          socketId: socket.id || devId,
          deviceId: devId,
          deviceName: devName,
          isStreaming: false,
        };
        setRegisteredDevice(devObj);
        localStorage.setItem("streamer_broadcastKey", key);
        localStorage.setItem("streamer_registeredDevice", JSON.stringify(devObj));
        setStreamerState("camera_select");
      }
    );
  };


  const startCamera = async (mode: "user" | "environment") => {
    setErrorMessage("");
    try {
      if (localStreamRef.current) {
        stopMediaStream();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: mode,
        },
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode(mode);
      setStreamerState("streaming");

      // Check zoom support
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        if (capabilities.zoom) {
          setSupportsHardwareZoom(true);
        }
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (mode === "environment") {
        console.warn("Falling back to front camera");
        startCamera("user");
        return;
      }
      setErrorMessage("Could not access camera/microphone. Please check device permissions.");
    }
  };

  const toggleStreamingState = () => {
    const nextStreamingState = !isStreaming;
    setIsStreaming(nextStreamingState);
    socket.emit("streamer:status", { isStreaming: nextStreamingState });
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    await startCamera(nextMode);
  };

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        if (capabilities.zoom) {
          videoTrack.applyConstraints({
            advanced: [{ zoom: newZoom } as any],
          }).catch((e) => console.warn("Failed to apply hardware zoom:", e));
        }
      }
    }
  };

  const toggleLogoOverlay = () => {
    const nextState = !showLogo;
    setShowLogo(nextState);
    socket.emit("streamer:toggle_logo", { showLogo: nextState });
  };

  const stopMediaStream = () => {
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  };

  const disconnectDevice = () => {
    stopMediaStream();
    setIsStreaming(false);
    setRegisteredDevice(null);
    setBroadcastInfo(null);
    localStorage.removeItem("streamer_broadcastKey");
    localStorage.removeItem("streamer_registeredDevice");
    setStreamerState("login");
  };

  return (
    <div className="stream-page container">
      {streamerState === "login" && (
        <div className="card watch-state-container">
          <div className="stream-key-header">
            <Radio size={36} className="text-primary" />
            <h3>Join Broadcast as Streaming Device</h3>
            <p>Enter the Broadcast Key provided by the Admin to connect your camera feed.</p>
          </div>

          {errorMessage && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleValidateAndJoin} className="username-form">
            <div className="form-group" style={{ textAlign: "left", width: "100%" }}>
              <label>Broadcast Key</label>
              <input
                type="text"
                placeholder="e.g. BRD-X8K4-92PQ"
                value={broadcastKeyInput}
                onChange={(e) => setBroadcastKeyInput(e.target.value)}
                className="watch-username-input"
                style={{ textTransform: "uppercase" }}
                required
              />
            </div>

            <div className="form-group" style={{ textAlign: "left", width: "100%" }}>
              <label>Camera Feed Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Main Stage / Camera 1"
                value={deviceNameInput}
                onChange={(e) => setDeviceNameInput(e.target.value)}
                className="watch-username-input"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !broadcastKeyInput.trim()}
              className="btn btn-primary watch-join-btn"
            >
              {isSubmitting ? "Validating Key..." : "Join Broadcast"}
            </button>
          </form>
        </div>
      )}

      {streamerState === "camera_select" && (
        <div className="card watch-state-container">
          <h3>Camera Feed Setup</h3>
          <p>
            Connected to <strong>{broadcastInfo?.title || "Live Broadcast"}</strong>
          </p>
          <div className="status-badge connected" style={{ margin: "0.5rem 0" }}>
            <span className="status-dot"></span>
            CONNECTED as "{registeredDevice?.deviceName}"
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <div className="camera-selection-actions">
            <button
              onClick={() => startCamera("user")}
              className="btn btn-primary"
            >
              <Camera size={20} /> Use Front Camera
            </button>
            <button
              onClick={() => startCamera("environment")}
              className="btn btn-secondary"
            >
              <Camera size={20} /> Use Back Camera
            </button>
            <button onClick={disconnectDevice} className="btn btn-danger">
              Disconnect
            </button>
          </div>
        </div>
      )}

      {streamerState === "streaming" && localStream && (
        <div className="streamer-dashboard">
          <div className="streamer-header-bar card">
            <div className="streamer-info">
              <h4>{broadcastInfo?.title || "Live Broadcast"}</h4>
              <div className="streamer-badges">
                <span className={`status-badge ${networkStatus === "connected" ? "connected" : "disconnected"}`}>
                  <span className="status-dot"></span> {networkStatus.toUpperCase()}
                </span>
                <span className={`status-badge ${isStreaming ? "connected" : "disconnected"}`}>
                  <span className="status-dot"></span>
                  {isStreaming ? "STREAMING" : "NOT STREAMING"}
                </span>
                {registeredDevice && (
                  <span className="device-tag">Source: {registeredDevice.deviceName}</span>
                )}
              </div>
            </div>

            <div className="streamer-actions">
              <button
                onClick={toggleStreamingState}
                className={`btn ${isStreaming ? "btn-danger" : "btn-primary"}`}
              >
                {isStreaming ? (
                  <>
                    <Square size={18} /> Stop Streaming
                  </>
                ) : (
                  <>
                    <Play size={18} /> Start Streaming
                  </>
                )}
              </button>
              <button onClick={disconnectDevice} className="btn btn-secondary">
                Disconnect
              </button>
            </div>
          </div>

          <div className="card streamer-video-card">
            <VideoPlayer
              stream={localStream}
              viewerCount={0}
              hideViewerCount={true}
              isMuted={true}
              showControls={true}
              showLogoOverlay={showLogo}
              zoomLevel={zoomLevel}
              onZoomChange={handleZoomChange}
            />

            <div className="streamer-controls-panel">
              <button onClick={toggleCameraFacing} className="btn btn-secondary btn-sm">
                <RefreshCw size={18} /> Flip Camera
              </button>

              <button
                onClick={toggleLogoOverlay}
                className={`btn ${showLogo ? "btn-primary" : "btn-secondary"} btn-sm`}
              >
                <Image size={18} /> {showLogo ? "Logo Active (Hide)" : "Show Logo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
