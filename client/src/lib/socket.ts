import { io, type Socket } from "socket.io-client";

const SIGNAL = import.meta.env.VITE_SIGNAL_URL;

export const createSocket = (): Socket => {
  return io(SIGNAL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
  });
};
