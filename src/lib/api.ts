import type { AuthUser, UserRole } from "../types/user";
import type {
  FullPatientPayload,
  PatientIntakePayload,
  PatientQueueState,
  PaymentQrPayload,
  QueueEntry,
} from "../types/queue";

const TOKEN_STORAGE_KEY = "queuecure.authToken";

type AuthResponse = {
  token: string;
  user: AuthUser;
};

type ApiErrorPayload = {
  message?: string;
};

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.message ?? "Something went wrong.");
  }

  return payload as T;
}

export async function login(username: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  return parseResponse<AuthResponse>(response);
}

export async function registerPatient(
  username: string,
  password: string,
  confirmPassword: string,
) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, confirmPassword }),
  });

  return parseResponse<{ user: AuthUser }>(response);
}

export async function fetchCurrentUser(token: string) {
  const response = await fetch("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponse<{ user: AuthUser }>(response);
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchOfficialQueue(token: string) {
  const response = await fetch("/api/queue", {
    headers: authHeaders(token),
  });

  return parseResponse<{ queue: QueueEntry[] }>(response);
}

export async function fetchPatientQueue(token: string) {
  const response = await fetch("/api/queue/me", {
    headers: authHeaders(token),
  });

  return parseResponse<PatientQueueState>(response);
}

export async function addQueuePatient(token: string, payload: PatientIntakePayload) {
  const response = await fetch("/api/queue", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  return parseResponse<{ entry: QueueEntry }>(response);
}

export async function fetchQueuePatient(token: string, queueEntryId: number) {
  const response = await fetch(`/api/queue/${queueEntryId}/patient`, {
    headers: authHeaders(token),
  });

  return parseResponse<FullPatientPayload>(response);
}

export async function updateQueuePatient(
  token: string,
  queueEntryId: number,
  payload: PatientIntakePayload,
) {
  const response = await fetch(`/api/queue/${queueEntryId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  return parseResponse<{ entry: QueueEntry }>(response);
}

export async function callQueuePatient(token: string, queueEntryId: number) {
  const response = await fetch(`/api/queue/${queueEntryId}/call`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return parseResponse<{ entry: QueueEntry }>(response);
}

export async function callNextQueuePatient(token: string) {
  const response = await fetch("/api/queue/call-next", {
    method: "POST",
    headers: authHeaders(token),
  });

  return parseResponse<{ entry: QueueEntry }>(response);
}

export async function completeQueuePatient(token: string, queueEntryId: number) {
  const response = await fetch(`/api/queue/${queueEntryId}/complete`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return parseResponse<{ entry: QueueEntry }>(response);
}

export async function removeQueuePatient(token: string, queueEntryId: number) {
  const response = await fetch(`/api/queue/${queueEntryId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  return parseResponse<{ entry: QueueEntry }>(response);
}

export async function generatePaymentQr(token: string, queueEntryId: number) {
  const response = await fetch(`/api/queue/${queueEntryId}/payment/qr`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return parseResponse<PaymentQrPayload>(response);
}

export async function confirmQueuePayment(
  token: string,
  queueEntryId: number,
  transactionId: string,
) {
  const response = await fetch(`/api/queue/${queueEntryId}/payment/confirm`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ transactionId }),
  });

  return parseResponse<{ entry: QueueEntry }>(response);
}

export function dashboardPathForRole(role: UserRole) {
  if (role === "PATIENT") {
    return "/patient-dashboard";
  }

  if (role === "OFFICIAL") {
    return "/official-dashboard";
  }

  return "/admin";
}
