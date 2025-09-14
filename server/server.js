
// server/server.js (ESM)
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { log } from "console";
import dotenv from "dotenv";
dotenv.config();


const app = express();
app.use(cors());
const server = http.createServer(app);

// Allow Vite (5173) to connect \u2014 change if your frontend host differs
const io = new Server(server, {
  cors: { origin: process.env.VITE_VIEWER_URL, methods: ["GET","POST"] },
});

let broadcasterId = null;
let isLogoOverlayVisible = false;
let endStreamTimeout = null; // Timeout to end stream after grace period
const viewers = new Map(); // Map to store viewer data (id -> username)
const activeStreamInfo = {
  streamId: null,
  startTime: null,
  title: null,
  pastor: null,
  notes: null
};

function emitViewerCount() {
  io.emit("viewerCount", viewers.size);
  io.emit("chat:userCount", viewers.size);
}

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // Admin registers as broadcaster
  socket.on("role:broadcaster", (streamInfo) => {
    // If the broadcaster is rejoining an existing stream, cancel the end-stream timeout
    if (endStreamTimeout && streamInfo.streamId && streamInfo.streamId === activeStreamInfo.streamId) {
      console.log("Broadcaster reconnected within grace period. Cancelling stream end.");
      clearTimeout(endStreamTimeout);
      endStreamTimeout = null;
    }

    broadcasterId = socket.id;
    console.log("broadcaster set:", broadcasterId);
    
    // Store stream info
    activeStreamInfo.streamId = streamInfo.streamId || Date.now().toString();
    activeStreamInfo.startTime = streamInfo.startTime || new Date().toISOString();
    activeStreamInfo.title = streamInfo.title || "Live Stream";
    activeStreamInfo.pastor = streamInfo.pastor || "";
    activeStreamInfo.notes = streamInfo.notes || "";
    
    // Notify all clients that stream is online with stream info
    io.emit("stream:status", { 
      online: true,
      info: {
        ...activeStreamInfo
      }
    });
    
    // Emit stream started event for chat
    io.emit("stream:started");
  });

  // Viewer registers
  socket.on("role:viewer", (data) => {
    const username = data.username || "Anonymous";
    viewers.set(socket.id, username);
    console.log("viewer registered:", socket.id, username);
    
    emitViewerCount();
    
    // Tell this viewer whether a broadcaster exists and send stream info
    socket.emit("stream:status", { 
      online: Boolean(broadcasterId),
      info: broadcasterId ? activeStreamInfo : null
    });
    
    // If a broadcaster exists, notify the broadcaster that a specific viewer joined
    if (broadcasterId) {
      io.to(broadcasterId).emit("viewer:join", { viewerId: socket.id });
      console.log("notified broadcaster to create offer for:", socket.id);
    }
    
    // Also send the current logo state
    socket.emit("stream:logoState", isLogoOverlayVisible);

    // Emit user join event for chat
    io.emit("chat:userJoin", username);
  });

  // Check if stream is active
  socket.on("check:stream", (data) => {
    // FIX: Guard against undefined data payload from new joiners
    if (data && data.streamId && data.streamId === activeStreamInfo.streamId && broadcasterId) {
      // This is a user with a streamId, likely rejoining.
      socket.emit("stream:status", { 
        online: true,
        info: activeStreamInfo
      });
    } else {
      // This is a new user checking if any stream is online.
      socket.emit("stream:status", {
        online: Boolean(broadcasterId),
        info: broadcasterId ? activeStreamInfo : null
      });
    }
  });

  // Stream info updates
  socket.on("stream:info", (info) => {
    if (socket.id === broadcasterId) {
      Object.assign(activeStreamInfo, info);
      io.emit("stream:info", activeStreamInfo);
    }
  });

  // Stream offline notification
  socket.on("stream:offline", () => {
    if (socket.id === broadcasterId) {
      io.emit("stream:status", { online: false });
    }
  });

  // Stream ended notification
  socket.on("stream:ended", () => {
    if (socket.id === broadcasterId) {
      io.emit("stream:ended");
    }
  });

  socket.on("stream:toggleLogo", () => {
    if (socket.id === broadcasterId) {
      isLogoOverlayVisible = !isLogoOverlayVisible;
      // Emit to all clients, including the sender
      io.emit("stream:logoState", isLogoOverlayVisible);
    }
  });

  socket.on("stream:visualZoom", ({ zoom }) => {
    if (socket.id === broadcasterId) {
      // Emit to all other clients
      socket.broadcast.emit("stream:visualZoom", { zoom });
    }
  });

  // Viewer leaves explicitly
  socket.on("leave", (data) => {
    const username = data?.username || viewers.get(socket.id) || "Anonymous";
    
    if (viewers.has(socket.id)) {
      viewers.delete(socket.id);
      emitViewerCount();
      
      // Emit user leave event for chat
      io.emit("chat:userLeave", username);
    }
  });

  // Broadcaster -> viewer offer (targetId must be viewer socket id)
  socket.on("offer", (payload, callback) => {
    const { targetId, sdp } = payload;
    if (!targetId) {
      if (callback) callback({ success: false, error: "No target ID provided" });
      return;
    }
    
    io.to(targetId).emit("offer", { from: socket.id, sdp });
    console.log("offer forwarded from broadcaster", socket.id, "to", targetId);
    
    if (callback) callback({ success: true });
  });

  // Viewer -> broadcaster answer (targetId must be broadcaster socket id)
  socket.on("answer", (payload) => {
    const { targetId, sdp } = payload;
    if (!targetId) return;
    io.to(targetId).emit("answer", { from: socket.id, sdp });
    console.log("answer forwarded from viewer", socket.id, "to", targetId);
  });

  // ICE candidates: each message includes targetId
  socket.on("ice", (payload) => {
    const { targetId, candidate } = payload;
    if (!targetId) return;
    io.to(targetId).emit("ice", { from: socket.id, candidate });
    //console.log("ice from", socket.id, "to", targetId);
  });

  // Chat functionality
  socket.on("chat:join", (data) => {
    const username = data.username || "Anonymous";
    // We already track viewers, but this is specifically for chat
    console.log("User joined chat:", username);
  });
  
  socket.on("chat:message", (data) => {
    const messageData = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: data.username || "Anonymous",
      message: data.message,
      timestamp: data.timestamp || Date.now(),
      type: "message"
    };
    
    io.emit("chat:message", messageData);
  });
  
  socket.on("chat:prayer", (data) => {
    const prayerData = {
      id: `prayer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: data.username || "Anonymous",
      message: data.message,
      timestamp: data.timestamp || Date.now(),
      type: "prayer"
    };
    
    io.emit("chat:prayer", prayerData);
  });
  
  socket.on("chat:system", (message) => {
    if (socket.id === broadcasterId) {
      io.emit("chat:system", message);
    }
  });

  socket.on("disconnect", () => {
    console.log("disconnect:", socket.id);
    
    // If broadcaster disconnects, start a grace period
    if (socket.id === broadcasterId) {
      console.log("Broadcaster disconnected. Starting 30-second grace period.");
      io.emit('broadcaster:disconnect'); // Notify viewers stream is paused

      // Clear any existing timeout to be safe
      if (endStreamTimeout) clearTimeout(endStreamTimeout);

      endStreamTimeout = setTimeout(() => {
        console.log("Grace period expired. Ending stream for good.");
        broadcasterId = null;
        isLogoOverlayVisible = false; // Reset logo state
        io.emit("stream:ended"); // Notify all clients the stream is over

        // Reset stream info
        Object.keys(activeStreamInfo).forEach(key => activeStreamInfo[key] = null);

        endStreamTimeout = null;
      }, 30000); // 30-second grace period
    }
    
    // If viewer disconnects
    if (viewers.has(socket.id)) {
      const username = viewers.get(socket.id);
      viewers.delete(socket.id);
      emitViewerCount();
      
      // Emit user leave event for chat
      io.emit("chat:userLeave", username || "Anonymous");
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Signaling Port running on http://localhost:${PORT}`);
  console.log(`Signal URL: ${process.env.VITE_SIGNAL_URL}`);
  console.log(`Viewer URL: ${process.env.VITE_VIEWER_URL}`);

});
