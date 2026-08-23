import { io, type Socket } from "socket.io-client";

const SIGNAL = import.meta.env.VITE_SIGNAL_URL || "http://localhost:4000";

export const socket: Socket = io(SIGNAL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});
