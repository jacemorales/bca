// server/server.js (ESM)
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "db.json");

const app = express();
app.use(cors());
const server = http.createServer(app);

// Allow Vite to connect
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Broadcast and device state
let activeBroadcast = {
  streamId: null,
  broadcastKey: null,
  title: null,
  pastor: null,
  scripture: null,
  notes: null,
  startTime: null,
  status: "ENDED", // "DRAFT" | "WAITING_FOR_STREAM" | "LIVE" | "PAUSED" | "ENDED"
  selectedDeviceId: null,
  showLogo: false,
};

const streamingDevices = new Map(); // socket.id -> { socketId, deviceId, deviceName, isStreaming, connectedAt }
const viewers = new Map(); // socket.id -> username
let adminSocketId = null;
let activityLogs = [];

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data.activeBroadcast) {
        activeBroadcast = { ...activeBroadcast, ...data.activeBroadcast };
      }
      if (Array.isArray(data.activityLogs)) {
        activityLogs = data.activityLogs;
      }
      console.log("Database loaded successfully from db.json. Active Key:", activeBroadcast.broadcastKey);
    }
  } catch (err) {
    console.error("Failed to load db.json:", err.message);
  }
}

function saveDatabase() {
  try {
    const data = {
      activeBroadcast,
      activityLogs,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save db.json:", err.message);
  }
}

loadDatabase();

function generateBroadcastKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segment = () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `BRD-${segment()}-${segment()}`;
}

function addActivityLog(text) {
  const logItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    text,
  };
  activityLogs.push(logItem);
  if (activityLogs.length > 100) activityLogs.shift();
  saveDatabase();
  io.emit("activity:log", logItem);
}

function emitViewerCount() {
  io.emit("viewerCount", viewers.size);
  io.emit("chat:userCount", viewers.size);
}

function getDevicesList() {
  return Array.from(streamingDevices.values());
}

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // --- ADMIN REGISTRATION & BROADCAST CREATION ---
  socket.on("role:admin", () => {
    adminSocketId = socket.id;
    console.log("Admin connected:", adminSocketId);

    socket.emit("admin:init", {
      activeBroadcast,
      devices: getDevicesList(),
      selectedDeviceId: activeBroadcast.selectedDeviceId,
      showLogo: activeBroadcast.showLogo,
      activityLogs,
      viewerCount: viewers.size,
    });
  });

  // Legacy broadcaster registration fallback/adapter
  socket.on("role:broadcaster", (streamInfo) => {
    adminSocketId = socket.id;
    if (!activeBroadcast.broadcastKey) {
      activeBroadcast.broadcastKey = generateBroadcastKey();
    }
    activeBroadcast.streamId = streamInfo.streamId || Date.now().toString();
    activeBroadcast.startTime = streamInfo.startTime || new Date().toISOString();
    activeBroadcast.title = streamInfo.title || "Live Stream";
    activeBroadcast.pastor = streamInfo.pastor || "";
    activeBroadcast.scripture = streamInfo.scripture || "";
    activeBroadcast.notes = streamInfo.notes || "";
    activeBroadcast.status = "WAITING_FOR_STREAM";

    saveDatabase();
    addActivityLog(`Broadcast "${activeBroadcast.title}" initialized.`);

    io.emit("broadcast:updated", activeBroadcast);
    io.emit("stream:status", {
      online: true,
      info: { ...activeBroadcast },
    });
  });

  socket.on("admin:create_broadcast", (info, callback) => {
    adminSocketId = socket.id;
    const key = generateBroadcastKey();
    activeBroadcast = {
      streamId: Date.now().toString(),
      broadcastKey: key,
      title: info.title || "Live Broadcast",
      pastor: info.pastor || "",
      scripture: info.scripture || "",
      notes: info.notes || "",
      startTime: new Date().toISOString(),
      status: "WAITING_FOR_STREAM",
      selectedDeviceId: null,
      showLogo: false,
    };

    saveDatabase();
    addActivityLog(`Broadcast "${activeBroadcast.title}" created. Key: ${key}`);

    io.emit("broadcast:updated", activeBroadcast);
    io.emit("stream:status", {
      online: true,
      info: activeBroadcast,
    });

    if (typeof callback === "function") {
      callback({ success: true, broadcast: activeBroadcast });
    }
  });

  socket.on("admin:select_program", ({ socketId }) => {
    const targetDevice = socketId ? streamingDevices.get(socketId) : null;
    activeBroadcast.selectedDeviceId = socketId || null;

    if (socketId && activeBroadcast.status === "WAITING_FOR_STREAM") {
      activeBroadcast.status = "LIVE";
    }

    saveDatabase();
    const deviceName = targetDevice ? targetDevice.deviceName : "None";
    addActivityLog(
      socketId
        ? `Camera "${deviceName}" selected as Program source.`
        : "Program source cleared."
    );

    io.emit("program:changed", {
      selectedDeviceId: activeBroadcast.selectedDeviceId,
      deviceName,
    });
    io.emit("broadcast:updated", activeBroadcast);
  });

  socket.on("admin:toggle_logo", ({ showLogo }) => {
    activeBroadcast.showLogo = Boolean(showLogo);
    saveDatabase();
    addActivityLog(`Show Logo ${activeBroadcast.showLogo ? "enabled" : "disabled"}.`);
    io.emit("logo:status", { showLogo: activeBroadcast.showLogo });
    io.emit("broadcast:updated", activeBroadcast);
  });

  socket.on("admin:end_broadcast", () => {
    activeBroadcast.status = "ENDED";
    activeBroadcast.selectedDeviceId = null;
    saveDatabase();
    addActivityLog("Broadcast ended by Admin.");

    io.emit("stream:ended");
    io.emit("broadcast:updated", activeBroadcast);
  });

  // --- STREAMING DEVICE ROUTING & VALIDATION ---
  socket.on("streamer:validate_key", ({ broadcastKey }, callback) => {
    if (!broadcastKey) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Broadcast key is required." });
      }
      return;
    }

    const cleanKey = broadcastKey.trim().toUpperCase();

    if (!activeBroadcast.broadcastKey) {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "Broadcast not found. Please check the broadcast key and try again.",
        });
      }
      return;
    }

    if (activeBroadcast.status === "ENDED") {
      if (typeof callback === "function") {
        callback({
          success: false,
          error: "This broadcast is no longer active.",
        });
      }
      return;
    }

    if (activeBroadcast.broadcastKey !== cleanKey) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Invalid broadcast key." });
      }
      return;
    }

    if (typeof callback === "function") {
      callback({ success: true, broadcast: activeBroadcast });
    }
  });

  socket.on("streamer:register", ({ broadcastKey, deviceId, deviceName }) => {
    const cleanKey = (broadcastKey || "").trim().toUpperCase();
    if (
      !activeBroadcast.broadcastKey ||
      activeBroadcast.broadcastKey !== cleanKey ||
      activeBroadcast.status === "ENDED"
    ) {
      socket.emit("streamer:error", { message: "Invalid or inactive broadcast key." });
      return;
    }

    const assignedId = deviceId || `device_${Math.random().toString(36).substr(2, 8)}`;
    const assignedName = deviceName && deviceName.trim()
      ? deviceName.trim()
      : `Camera ${streamingDevices.size + 1}`;

    const deviceObj = {
      socketId: socket.id,
      deviceId: assignedId,
      deviceName: assignedName,
      isStreaming: false,
      showLogo: false,
      connectedAt: new Date().toISOString(),
    };

    streamingDevices.set(socket.id, deviceObj);
    addActivityLog(`Streaming device connected: "${assignedName}" (${assignedId})`);

    socket.emit("streamer:registered", {
      device: deviceObj,
      broadcast: activeBroadcast,
    });

    io.emit("devices:updated", getDevicesList());
    io.emit("device:joined", deviceObj);
  });

  socket.on("streamer:status", ({ isStreaming }) => {
    const device = streamingDevices.get(socket.id);
    if (device) {
      device.isStreaming = Boolean(isStreaming);
      addActivityLog(
        `"${device.deviceName}" ${
          device.isStreaming ? "started streaming" : "stopped streaming"
        }.`
      );

      io.emit("devices:updated", getDevicesList());
      io.emit("device:status_changed", {
        socketId: socket.id,
        isStreaming: device.isStreaming,
      });
    }
  });

  socket.on("streamer:toggle_logo", ({ showLogo }) => {
    const device = streamingDevices.get(socket.id);
    if (device) {
      device.showLogo = Boolean(showLogo);
      addActivityLog(
        `"${device.deviceName}" logo overlay ${
          device.showLogo ? "enabled" : "disabled"
        }.`
      );
      io.emit("devices:updated", getDevicesList());
    }
  });


  // --- VIEWER REGISTRATION ---
  socket.on("role:viewer", (data) => {
    const username = data?.username || "Anonymous";
    viewers.set(socket.id, username);

    emitViewerCount();

    socket.emit("stream:status", {
      online: activeBroadcast.status !== "ENDED" && activeBroadcast.status !== "DRAFT",
      info: activeBroadcast,
      selectedDeviceId: activeBroadcast.selectedDeviceId,
      showLogo: activeBroadcast.showLogo,
    });

    io.emit("chat:userJoin", username);
  });

  socket.on("check:stream", (data) => {
    socket.emit("stream:status", {
      online: activeBroadcast.status !== "ENDED" && activeBroadcast.status !== "DRAFT",
      info: activeBroadcast,
      selectedDeviceId: activeBroadcast.selectedDeviceId,
      showLogo: activeBroadcast.showLogo,
    });
  });

  // --- WEBRTC SIGNALING ROUTING ---
  // Any client (Admin or Viewer) can request a feed from a specific streaming device socket ID
  socket.on("request:stream", ({ targetSocketId }) => {
    if (!targetSocketId) return;
    io.to(targetSocketId).emit("streamer:request_feed", {
      requesterId: socket.id,
    });
  });

  // Forwarding offers, answers, and ice candidates
  socket.on("offer", (payload, callback) => {
    const { targetId, sdp } = payload;
    if (!targetId) {
      if (callback) callback({ success: false, error: "No target ID provided" });
      return;
    }
    io.to(targetId).emit("offer", { from: socket.id, sdp });
    if (callback) callback({ success: true });
  });

  socket.on("answer", (payload) => {
    const { targetId, sdp } = payload;
    if (!targetId) return;
    io.to(targetId).emit("answer", { from: socket.id, sdp });
  });

  socket.on("ice", (payload) => {
    const { targetId, candidate } = payload;
    if (!targetId) return;
    io.to(targetId).emit("ice", { from: socket.id, candidate });
  });

  // --- CHAT FUNCTIONALITY ---
  socket.on("chat:join", (data) => {
    const username = data?.username || "Anonymous";
    console.log("User joined chat:", username);
  });

  socket.on("chat:message", (data) => {
    const messageData = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: data.username || "Anonymous",
      message: data.message,
      timestamp: data.timestamp || Date.now(),
      type: "message",
    };
    io.emit("chat:message", messageData);
  });

  socket.on("chat:prayer", (data) => {
    const prayerData = {
      id: `prayer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: data.username || "Anonymous",
      message: data.message,
      timestamp: data.timestamp || Date.now(),
      type: "prayer",
    };
    io.emit("chat:prayer", prayerData);
  });

  socket.on("chat:system", (message) => {
    if (socket.id === adminSocketId) {
      io.emit("chat:system", message);
    }
  });

  socket.on("stream:info", (info) => {
    if (socket.id === adminSocketId) {
      Object.assign(activeBroadcast, info);
      saveDatabase();
      io.emit("stream:info", activeBroadcast);
      io.emit("broadcast:updated", activeBroadcast);
    }
  });

  socket.on("stream:offline", () => {
    if (socket.id === adminSocketId) {
      activeBroadcast.status = "PAUSED";
      saveDatabase();
      io.emit("stream:status", { online: false, info: activeBroadcast });
      io.emit("broadcast:updated", activeBroadcast);
    }
  });

  socket.on("stream:ended", () => {
    if (socket.id === adminSocketId) {
      activeBroadcast.status = "ENDED";
      activeBroadcast.selectedDeviceId = null;
      saveDatabase();
      io.emit("stream:ended");
      io.emit("broadcast:updated", activeBroadcast);
    }
  });

  socket.on("leave", (data) => {
    const username = data?.username || viewers.get(socket.id) || "Anonymous";
    if (viewers.has(socket.id)) {
      viewers.delete(socket.id);
      emitViewerCount();
      io.emit("chat:userLeave", username);
    }
  });

  // --- DISCONNECT HANDLING ---
  socket.on("disconnect", () => {
    console.log("disconnect:", socket.id);

    if (socket.id === adminSocketId) {
      console.log("Admin disconnected.");
      adminSocketId = null;
    }

    if (streamingDevices.has(socket.id)) {
      const device = streamingDevices.get(socket.id);
      streamingDevices.delete(socket.id);
      addActivityLog(`Streaming device disconnected: "${device.deviceName}"`);

      io.emit("devices:updated", getDevicesList());
      io.emit("device:left", { socketId: socket.id, device });

      if (activeBroadcast.selectedDeviceId === socket.id) {
        activeBroadcast.selectedDeviceId = null;
        addActivityLog("Program source disconnected and cleared.");
        io.emit("program:changed", {
          selectedDeviceId: null,
          deviceName: null,
          unavailable: true,
        });
        io.emit("broadcast:updated", activeBroadcast);
      }
    }

    if (viewers.has(socket.id)) {
      const username = viewers.get(socket.id);
      viewers.delete(socket.id);
      emitViewerCount();
      io.emit("chat:userLeave", username || "Anonymous");
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Signaling Port running on http://localhost:${PORT}`);
});
