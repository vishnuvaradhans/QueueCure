import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getQueueSocket(token: string) {
  if (socket?.connected) {
    return socket;
  }

  socket = io("http://127.0.0.1:4000", {
    auth: { token },
    transports: ["websocket"],
  });

  return socket;
}

export function disconnectQueueSocket() {
  socket?.disconnect();
  socket = null;
}
