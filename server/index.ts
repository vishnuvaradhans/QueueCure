import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import QRCode from "qrcode";
import {
  authResponse,
  authenticate,
  hashPassword,
  requireRoles,
  verifyPassword,
  type AuthenticatedRequest,
} from "./auth";
import {
  createUser,
  findUserByUsername,
  publicUser,
  runMigrations,
} from "./db";
import {
  normalizeLoginUsername,
  normalizeOfficialUsername,
  normalizePatientRegistrationUsername,
  validatePassword,
} from "./validation";
import {
  callNextQueueEntry,
  callQueueEntry,
  cancelQueueEntry,
  completeQueueEntry,
  confirmQueuePayment,
  createQueueEntry,
  getFullPatientForQueue,
  getPaymentForQueue,
  getPatientQueue,
  listQueue,
  updatePatientForQueue,
} from "./queue";
import { broadcastQueueUpdate, notifyPatient, setupRealtime } from "./realtime";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const server = createServer(app);
const clinicUpiId = process.env.CLINIC_UPI_ID ?? "clinic@upi";
const clinicUpiName = process.env.CLINIC_UPI_NAME ?? "QueueCureClinic";

runMigrations();
setupRealtime(server);

app.use(
  cors({
    origin: "http://127.0.0.1:5173",
  }),
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/auth/register", async (request, response) => {
  try {
    const username = normalizePatientRegistrationUsername(request.body.username);
    const password = validatePassword(request.body.password);

    if (request.body.password !== request.body.confirmPassword) {
      response.status(400).json({ message: "Passwords do not match." });
      return;
    }

    if (findUserByUsername(username)) {
      response.status(409).json({ message: "Username already exists." });
      return;
    }

    const user = createUser({
      username,
      role: "PATIENT",
      passwordHash: await hashPassword(password),
    });

    response.status(201).json({ user: user ? publicUser(user) : undefined });
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Registration failed.",
    });
  }
});

app.post("/api/auth/login", async (request, response) => {
  try {
    const username = normalizeLoginUsername(request.body.username);
    const password = String(request.body.password ?? "");
    const user = findUserByUsername(username);

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      response.status(401).json({ message: "Invalid username or password." });
      return;
    }

    response.json(authResponse(user));
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Login failed.",
    });
  }
});

app.get("/api/auth/me", authenticate, (request: AuthenticatedRequest, response) => {
  response.json({ user: publicUser(request.user!) });
});

app.post(
  "/api/admin/officials",
  authenticate,
  requireRoles(["ADMIN"]),
  async (request, response) => {
    try {
      const username = normalizeOfficialUsername(request.body.username);
      const password = validatePassword(request.body.password);

      if (findUserByUsername(username)) {
        response.status(409).json({ message: "Username already exists." });
        return;
      }

      const user = createUser({
        username,
        role: "OFFICIAL",
        passwordHash: await hashPassword(password),
      });

      response.status(201).json({ user: user ? publicUser(user) : undefined });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Official creation failed.",
      });
    }
  },
);

app.get(
  "/api/patient/profile",
  authenticate,
  requireRoles(["PATIENT"]),
  (request: AuthenticatedRequest, response) => {
    response.json({ user: publicUser(request.user!) });
  },
);

app.get(
  "/api/official/profile",
  authenticate,
  requireRoles(["OFFICIAL"]),
  (request: AuthenticatedRequest, response) => {
    response.json({ user: publicUser(request.user!) });
  },
);

app.get(
  "/api/queue",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (_request, response) => {
    response.json({ queue: listQueue() });
  },
);

app.get(
  "/api/queue/me",
  authenticate,
  requireRoles(["PATIENT"]),
  (request: AuthenticatedRequest, response) => {
    response.json(getPatientQueue(request.user!));
  },
);

app.post(
  "/api/queue",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (request, response) => {
    try {
      const entry = createQueueEntry(request.body);
      broadcastQueueUpdate("patient_added");
      response.status(201).json({ entry });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Patient intake failed.",
      });
    }
  },
);

app.get(
  "/api/queue/:id/patient",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (request, response) => {
    const entryId = Number(request.params.id);
    const entry = Number.isFinite(entryId) ? getFullPatientForQueue(entryId) : undefined;

    if (!entry) {
      response.status(404).json({ message: "Patient not found." });
      return;
    }

    response.json(entry);
  },
);

app.put(
  "/api/queue/:id",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (request, response) => {
    try {
      const entry = updatePatientForQueue(Number(request.params.id), request.body);
      broadcastQueueUpdate("queue_updated");
      response.json({ entry });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Patient update failed.",
      });
    }
  },
);

app.post(
  "/api/queue/:id/call",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (request, response) => {
    try {
      const entry = callQueueEntry(Number(request.params.id));
      broadcastQueueUpdate("patient_called");

      if (entry?.user_id) {
        notifyPatient(entry.user_id, {
          title: "QueueCure",
          message: "Your token is now being called.",
        });
      }

      response.json({ entry });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Unable to call patient.",
      });
    }
  },
);

app.post(
  "/api/queue/call-next",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (_request, response) => {
    try {
      const entry = callNextQueueEntry();
      broadcastQueueUpdate("patient_called");

      if (entry?.user_id) {
        notifyPatient(entry.user_id, {
          title: "QueueCure",
          message: "Your token is now being called.",
        });
      }

      response.json({ entry });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Unable to call next patient.",
      });
    }
  },
);

app.post(
  "/api/queue/:id/complete",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (request, response) => {
    try {
      const entry = completeQueueEntry(Number(request.params.id));
      broadcastQueueUpdate("patient_completed");
      response.json({ entry });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Unable to complete patient.",
      });
    }
  },
);

app.delete(
  "/api/queue/:id",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (request, response) => {
    try {
      const entry = cancelQueueEntry(Number(request.params.id));
      broadcastQueueUpdate("queue_updated");
      response.json({ entry });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Unable to remove patient.",
      });
    }
  },
);

app.post(
  "/api/queue/:id/payment/qr",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  async (request, response) => {
    try {
      const payment = getPaymentForQueue(Number(request.params.id));

      if (!payment) {
        response.status(404).json({ message: "Payment record not found." });
        return;
      }

      const upiUri = `upi://pay?pa=${encodeURIComponent(clinicUpiId)}&pn=${encodeURIComponent(
        clinicUpiName,
      )}&am=${encodeURIComponent(String(payment.amount))}&cu=INR`;
      const qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
        margin: 2,
        width: 260,
      });

      response.json({ payment, upiUri, qrCodeDataUrl });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Unable to generate QR.",
      });
    }
  },
);

app.post(
  "/api/queue/:id/payment/confirm",
  authenticate,
  requireRoles(["OFFICIAL", "ADMIN"]),
  (request, response) => {
    try {
      const entry = confirmQueuePayment(Number(request.params.id), request.body.transactionId);
      broadcastQueueUpdate("payment_confirmed");
      response.json({ entry });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Unable to confirm payment.",
      });
    }
  },
);

server.listen(port, "127.0.0.1", () => {
  console.log(`QueueCure API listening on http://127.0.0.1:${port}`);
});
