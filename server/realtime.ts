import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { findUserById, type UserRecord } from "./db";
import { getPatientQueue, listQueue } from "./queue";

const JWT_SECRET = process.env.JWT_SECRET ?? "queuecure-dev-secret-change-me";

let io: Server | undefined;
const nearTurnNotified = new Set<number>();

type TokenPayload = {
  sub: string;
};

function resolveUser(token?: string): UserRecord | undefined {
  if (!token) {
    return undefined;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return findUserById(Number(payload.sub));
  } catch {
    return undefined;
  }
}

export function setupRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "http://127.0.0.1:5173",
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const user = resolveUser(token);

    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as UserRecord;
    socket.join("queue");
    socket.join(`user:${user.id}`);

    socket.emit("queue:update", {
      queue: listQueue(),
      patient: user.role === "PATIENT" ? getPatientQueue(user) : null,
    });
  });

  return io;
}

export function broadcastQueueUpdate(eventName = "queue_updated") {
  if (!io) {
    return;
  }

  const queue = listQueue();
  const payload = { queue, event: eventName };

  io.to("queue").emit("queue:update", payload);
  io.to("queue").emit(eventName, payload);

  queue.forEach((entry) => {
    if (
      entry.user_id &&
      entry.estimated_wait_minutes <= 5 &&
      ["WAITING", "UPCOMING"].includes(entry.status) &&
      !nearTurnNotified.has(entry.id)
    ) {
      nearTurnNotified.add(entry.id);
      notifyPatient(entry.user_id, {
        title: "QueueCure",
        message: "Your turn is expected within approximately 5 minutes.",
      });
    }
  });
}

export function notifyPatient(userId: number, notification: { title: string; message: string }) {
  io?.to(`user:${userId}`).emit("queue:notification", notification);
}
