import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

const SOCKET_URL =
  import.meta.env.VITE_API_URL ||
  "https://queuecure-6me4.onrender.com";

export function getQueueSocket(token: string) {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
  });

  return socket;
}

export function disconnectQueueSocket() {
  socket?.disconnect();
  socket = null;
}