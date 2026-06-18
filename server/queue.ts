import { db, findUserByUsername, runTransaction, type UserRecord } from "./db";

export type QueueStatus =
  | "WAITING"
  | "UPCOMING"
  | "CALLED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type PatientRow = {
  id: number;
  user_id: number | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | "Other";
  phone_number: string;
  address: string;
  billing_address_same: number;
  billing_address: string | null;
  payment_method: "CASH" | "UPI";
};

type EmergencyContactRow = {
  relationship: string;
  contact_name: string;
  contact_phone_number: string;
};

type InsuranceRow = {
  insurance_provider: string | null;
  policy_number: string | null;
};

type AppointmentRow = {
  appointment_date: string;
  appointment_time: string;
  reason_for_visit: string;
};

export type QueueEntryRow = {
  id: number;
  queue_date: string;
  token_number: number;
  patient_id: number;
  reason_for_visit: string;
  status: QueueStatus;
  estimated_wait_minutes: number;
  called_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  full_name: string;
  user_id: number | null;
  payment_id: number | null;
  amount: number | null;
  payment_method: "CASH" | "UPI" | null;
  payment_status: "PENDING" | "PAID" | "FAILED" | null;
  transaction_id: string | null;
};

export type PaymentRow = {
  id: number;
  queue_entry_id: number;
  patient_id: number;
  token_number: number;
  amount: number;
  payment_method: "CASH" | "UPI";
  payment_status: "PENDING" | "PAID" | "FAILED";
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
  full_name: string;
};

export type PatientIntakeInput = {
  fullName: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "Other";
  phoneNumber: string;
  address: string;
  emergencyRelationship: string;
  emergencyContactName: string;
  emergencyContactPhoneNumber: string;
  insuranceProvider?: string;
  policyNumber?: string;
  reasonForVisit: string;
  appointmentDate?: string;
  appointmentTime?: string;
  paymentMethod: "CASH" | "UPI";
  amount?: number;
  billingAddressSame: boolean;
  billingAddress?: string;
  patientUserId?: number | null;
  patientUsername?: string;
};

const ACTIVE_STATUSES: QueueStatus[] = ["WAITING", "UPCOMING", "CALLED", "IN_PROGRESS"];
const FALLBACK_CONSULTATION_MINUTES = 10;
const DEFAULT_CONSULTATION_FEE = Number(process.env.CLINIC_CONSULTATION_FEE ?? 300);
const MIN_TRANSACTION_ID_LENGTH = 6;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function required(value: unknown, label: string) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function optional(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function positiveAmount(value: unknown) {
  const amount = Number(value ?? DEFAULT_CONSULTATION_FEE);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return Math.round(amount);
}

function validateIntake(input: Partial<PatientIntakeInput>): PatientIntakeInput {
  const gender = required(input.gender, "Gender");
  const paymentMethod = required(input.paymentMethod, "Payment method");

  if (!["Male", "Female", "Other"].includes(gender)) {
    throw new Error("Gender must be Male, Female, or Other.");
  }

  if (!["CASH", "UPI"].includes(paymentMethod)) {
    throw new Error("Payment method must be CASH or UPI.");
  }

  const billingAddressSame = Boolean(input.billingAddressSame);
  const billingAddress = billingAddressSame
    ? null
    : required(input.billingAddress, "Billing address");

  const patientUsername = optional(input.patientUsername);
  const patientUser = patientUsername ? findUserByUsername(patientUsername.toLowerCase()) : undefined;

  if (patientUsername && (!patientUser || patientUser.role !== "PATIENT")) {
    throw new Error("Registered patient username must belong to a PATIENT account.");
  }

  return {
    fullName: required(input.fullName, "Full name"),
    dateOfBirth: required(input.dateOfBirth, "Date of birth"),
    gender: gender as PatientIntakeInput["gender"],
    phoneNumber: required(input.phoneNumber, "Phone number"),
    address: required(input.address, "Address"),
    emergencyRelationship: required(input.emergencyRelationship, "Relationship"),
    emergencyContactName: required(input.emergencyContactName, "Emergency contact name"),
    emergencyContactPhoneNumber: required(
      input.emergencyContactPhoneNumber,
      "Emergency contact phone number",
    ),
    insuranceProvider: optional(input.insuranceProvider) ?? undefined,
    policyNumber: optional(input.policyNumber) ?? undefined,
    reasonForVisit: required(input.reasonForVisit, "Reason for visit"),
    appointmentDate: optional(input.appointmentDate) ?? undefined,
    appointmentTime: optional(input.appointmentTime) ?? undefined,
    paymentMethod: paymentMethod as PatientIntakeInput["paymentMethod"],
    amount: positiveAmount(input.amount),
    billingAddressSame,
    billingAddress: billingAddress ?? undefined,
    patientUserId: patientUser?.id ?? input.patientUserId ?? null,
    patientUsername: patientUsername ?? undefined,
  };
}

function nextTokenNumber(queueDate: string) {
  const row = db
    .prepare("SELECT COALESCE(MAX(token_number), 0) + 1 AS token FROM queue_entries WHERE queue_date = ?")
    .get(queueDate) as { token: number };

  return Number(row.token);
}

function ensurePaymentsForQueue(queueDate = today()) {
  db.prepare(
    `INSERT INTO payments (
      queue_entry_id, patient_id, token_number, amount, payment_method, payment_status
    )
    SELECT qe.id, qe.patient_id, qe.token_number, ?, p.payment_method, 'PENDING'
    FROM queue_entries qe
    JOIN patients p ON p.id = qe.patient_id
    LEFT JOIN payments pay ON pay.queue_entry_id = qe.id
    WHERE qe.queue_date = ? AND pay.id IS NULL`,
  ).run(DEFAULT_CONSULTATION_FEE, queueDate);
}

export function averageConsultationMinutes(queueDate = today()) {
  const row = db
    .prepare(
      `SELECT AVG((julianday(completed_at) - julianday(called_at)) * 24 * 60) AS average_minutes
       FROM queue_entries
       WHERE queue_date = ?
         AND status = 'COMPLETED'
         AND called_at IS NOT NULL
         AND completed_at IS NOT NULL
         AND completed_at > called_at`,
    )
    .get(queueDate) as { average_minutes: number | null };

  const average = Number(row.average_minutes ?? 0);
  return average > 0 ? Math.max(1, Math.round(average)) : FALLBACK_CONSULTATION_MINUTES;
}

function recalculateWaitTimes(queueDate = today()) {
  const averageMinutes = averageConsultationMinutes(queueDate);
  const active = db
    .prepare(
      `SELECT id, status
       FROM queue_entries
       WHERE queue_date = ?
         AND status IN ('WAITING', 'UPCOMING', 'CALLED', 'IN_PROGRESS')
       ORDER BY token_number ASC`,
    )
    .all(queueDate) as Array<{ id: number; status: QueueStatus }>;

  active.forEach((entry, index) => {
    const estimated = entry.status === "IN_PROGRESS" || entry.status === "CALLED"
      ? 0
      : index * averageMinutes;
    const normalizedStatus = entry.status === "WAITING" && index <= 2 ? "UPCOMING" : entry.status;

    db.prepare(
      `UPDATE queue_entries
       SET estimated_wait_minutes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(estimated, normalizedStatus, entry.id);
  });
}

export function listQueue(queueDate = today()) {
  ensurePaymentsForQueue(queueDate);
  recalculateWaitTimes(queueDate);

  return db
    .prepare(
      `SELECT qe.*, p.full_name, p.user_id,
         pay.id AS payment_id,
         pay.amount,
         pay.payment_method,
         pay.payment_status,
         pay.transaction_id
       FROM queue_entries qe
       JOIN patients p ON p.id = qe.patient_id
       LEFT JOIN payments pay ON pay.queue_entry_id = qe.id
       WHERE qe.queue_date = ?
       ORDER BY
         CASE qe.status
           WHEN 'IN_PROGRESS' THEN 0
           WHEN 'CALLED' THEN 1
           WHEN 'UPCOMING' THEN 2
           WHEN 'WAITING' THEN 3
           WHEN 'COMPLETED' THEN 4
           ELSE 5
         END,
         qe.token_number ASC`,
    )
    .all(queueDate) as QueueEntryRow[];
}

export function getPatientQueue(user: UserRecord) {
  const rows = listQueue(today());
  const ownEntry = rows.find((entry) => entry.user_id === user.id);

  return {
    queue: rows,
    ownEntry: ownEntry ?? null,
    summary: buildQueueSummary(rows, ownEntry ?? null),
  };
}

export function buildQueueSummary(rows: QueueEntryRow[], ownEntry: QueueEntryRow | null) {
  const activeRows = rows.filter((entry) => ACTIVE_STATUSES.includes(entry.status));
  const current = activeRows.find((entry) =>
    entry.status === "IN_PROGRESS" || entry.status === "CALLED"
  ) ?? activeRows[0] ?? null;
  const patientsAhead = ownEntry
    ? ["CALLED", "IN_PROGRESS"].includes(ownEntry.status)
      ? 0
      : activeRows.filter((entry) => entry.token_number < ownEntry.token_number).length
    : 0;
  const completedBefore = ownEntry
    ? rows.filter((entry) =>
      entry.token_number < ownEntry.token_number &&
      ["COMPLETED", "CANCELLED"].includes(entry.status)
    ).length
    : 0;
  const progress = ownEntry
    ? Math.min(100, Math.round((completedBefore / Math.max(ownEntry.token_number, 1)) * 100))
    : 0;

  return {
    currentToken: current?.token_number ?? null,
    patientsAhead,
    estimatedWaitMinutes: ownEntry?.estimated_wait_minutes ?? 0,
    averageConsultationMinutes: averageConsultationMinutes(),
    progress,
  };
}

export function createQueueEntry(input: Partial<PatientIntakeInput>) {
  const intake = validateIntake(input);
  const queueDate = intake.appointmentDate || today();
  const tokenNumber = nextTokenNumber(queueDate);

  const queueEntryId = runTransaction(() => {
    const patientResult = db
      .prepare(
        `INSERT INTO patients (
          user_id, full_name, date_of_birth, gender, phone_number, address,
          billing_address_same, billing_address, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        intake.patientUserId ?? null,
        intake.fullName,
        intake.dateOfBirth,
        intake.gender,
        intake.phoneNumber,
        intake.address,
        intake.billingAddressSame ? 1 : 0,
        intake.billingAddress ?? null,
        intake.paymentMethod,
      );
    const patientId = Number(patientResult.lastInsertRowid);

    db.prepare(
      `INSERT INTO emergency_contacts (
        patient_id, relationship, contact_name, contact_phone_number
      ) VALUES (?, ?, ?, ?)`,
    ).run(
      patientId,
      intake.emergencyRelationship,
      intake.emergencyContactName,
      intake.emergencyContactPhoneNumber,
    );

    db.prepare(
      `INSERT INTO insurance_details (
        patient_id, insurance_provider, policy_number
      ) VALUES (?, ?, ?)`,
    ).run(patientId, intake.insuranceProvider ?? null, intake.policyNumber ?? null);

    if (intake.appointmentDate && intake.appointmentTime) {
      db.prepare(
        `INSERT INTO appointments (
          patient_id, appointment_date, appointment_time, reason_for_visit
        ) VALUES (?, ?, ?, ?)`,
      ).run(patientId, intake.appointmentDate, intake.appointmentTime, intake.reasonForVisit);
    }

    const queueResult = db
      .prepare(
        `INSERT INTO queue_entries (
          queue_date, token_number, patient_id, reason_for_visit, status
        ) VALUES (?, ?, ?, ?, 'WAITING')`,
      )
      .run(queueDate, tokenNumber, patientId, intake.reasonForVisit);

    const queueEntryId = Number(queueResult.lastInsertRowid);

    db.prepare(
      `INSERT INTO payments (
        queue_entry_id, patient_id, token_number, amount, payment_method, payment_status
      ) VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    ).run(queueEntryId, patientId, tokenNumber, intake.amount, intake.paymentMethod);

    return queueEntryId;
  });

  recalculateWaitTimes(queueDate);
  return getQueueEntry(queueEntryId);
}

export function getQueueEntry(id: number) {
  return db
    .prepare(
      `SELECT qe.*, p.full_name, p.user_id,
         pay.id AS payment_id,
         pay.amount,
         pay.payment_method,
         pay.payment_status,
         pay.transaction_id
       FROM queue_entries qe
       JOIN patients p ON p.id = qe.patient_id
       LEFT JOIN payments pay ON pay.queue_entry_id = qe.id
       WHERE qe.id = ?`,
    )
    .get(id) as QueueEntryRow | undefined;
}

export function getFullPatient(patientId: number) {
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(patientId) as
    | PatientRow
    | undefined;

  if (!patient) {
    return undefined;
  }

  return {
    patient,
    emergencyContact: db
      .prepare("SELECT relationship, contact_name, contact_phone_number FROM emergency_contacts WHERE patient_id = ?")
      .get(patientId) as EmergencyContactRow | undefined,
    insurance: db
      .prepare("SELECT insurance_provider, policy_number FROM insurance_details WHERE patient_id = ?")
      .get(patientId) as InsuranceRow | undefined,
    appointment: db
      .prepare("SELECT appointment_date, appointment_time, reason_for_visit FROM appointments WHERE patient_id = ? ORDER BY id DESC LIMIT 1")
      .get(patientId) as AppointmentRow | undefined,
  };
}

export function getFullPatientForQueue(queueEntryId: number) {
  const entry = getQueueEntry(queueEntryId);

  if (!entry) {
    return undefined;
  }

  return getFullPatient(entry.patient_id);
}

export function updatePatientForQueue(queueEntryId: number, input: Partial<PatientIntakeInput>) {
  const existing = getQueueEntry(queueEntryId);

  if (!existing) {
    throw new Error("Queue entry not found.");
  }

  const intake = validateIntake(input);

  runTransaction(() => {
    db.prepare(
      `UPDATE patients
       SET full_name = ?, date_of_birth = ?, gender = ?, phone_number = ?,
           address = ?, billing_address_same = ?, billing_address = ?,
           payment_method = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      intake.fullName,
      intake.dateOfBirth,
      intake.gender,
      intake.phoneNumber,
      intake.address,
      intake.billingAddressSame ? 1 : 0,
      intake.billingAddress ?? null,
      intake.paymentMethod,
      existing.patient_id,
    );

    db.prepare(
      `UPDATE payments
       SET amount = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
       WHERE queue_entry_id = ? AND payment_status != 'PAID'`,
    ).run(intake.amount, intake.paymentMethod, queueEntryId);

    db.prepare(
      `UPDATE emergency_contacts
       SET relationship = ?, contact_name = ?, contact_phone_number = ?
       WHERE patient_id = ?`,
    ).run(
      intake.emergencyRelationship,
      intake.emergencyContactName,
      intake.emergencyContactPhoneNumber,
      existing.patient_id,
    );

    db.prepare(
      `UPDATE insurance_details
       SET insurance_provider = ?, policy_number = ?
       WHERE patient_id = ?`,
    ).run(intake.insuranceProvider ?? null, intake.policyNumber ?? null, existing.patient_id);

    db.prepare(
      `UPDATE queue_entries
       SET reason_for_visit = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(intake.reasonForVisit, queueEntryId);
  });

  recalculateWaitTimes(existing.queue_date);
  return getQueueEntry(queueEntryId);
}

export function callQueueEntry(id: number) {
  const entry = getQueueEntry(id);

  if (!entry) {
    throw new Error("Queue entry not found.");
  }

  runTransaction(() => {
    db.prepare(
      `UPDATE queue_entries
       SET status = CASE WHEN status IN ('COMPLETED', 'CANCELLED') THEN status ELSE 'UPCOMING' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE queue_date = ? AND id != ? AND status IN ('CALLED', 'IN_PROGRESS')`,
    ).run(entry.queue_date, id);

    db.prepare(
      `UPDATE queue_entries
       SET status = 'CALLED', called_at = CURRENT_TIMESTAMP, estimated_wait_minutes = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
    ).run(id);
  });

  recalculateWaitTimes(entry.queue_date);
  return getQueueEntry(id);
}

export function callNextQueueEntry() {
  const queue = listQueue(today());
  const next = queue.find((entry) => ["WAITING", "UPCOMING"].includes(entry.status));

  if (!next) {
    throw new Error("No waiting patient is available.");
  }

  return callQueueEntry(next.id);
}

export function completeQueueEntry(id: number) {
  const entry = getQueueEntry(id);

  if (!entry) {
    throw new Error("Queue entry not found.");
  }

  db.prepare(
    `UPDATE queue_entries
     SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
         estimated_wait_minutes = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(id);

  recalculateWaitTimes(entry.queue_date);
  return getQueueEntry(id);
}

export function cancelQueueEntry(id: number) {
  const entry = getQueueEntry(id);

  if (!entry) {
    throw new Error("Queue entry not found.");
  }

  db.prepare(
    `UPDATE queue_entries
     SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP,
         estimated_wait_minutes = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(id);

  recalculateWaitTimes(entry.queue_date);
  return getQueueEntry(id);
}

export function getPaymentForQueue(queueEntryId: number) {
  const entry = getQueueEntry(queueEntryId);

  if (entry && !entry.payment_id) {
    db.prepare(
      `INSERT INTO payments (
        queue_entry_id, patient_id, token_number, amount, payment_method, payment_status
      )
      SELECT qe.id, qe.patient_id, qe.token_number, ?, p.payment_method, 'PENDING'
      FROM queue_entries qe
      JOIN patients p ON p.id = qe.patient_id
      WHERE qe.id = ?`,
    ).run(DEFAULT_CONSULTATION_FEE, queueEntryId);
  }

  return db
    .prepare(
      `SELECT pay.*, p.full_name
       FROM payments pay
       JOIN patients p ON p.id = pay.patient_id
       WHERE pay.queue_entry_id = ?`,
    )
    .get(queueEntryId) as PaymentRow | undefined;
}

export function confirmQueuePayment(queueEntryId: number, transactionIdInput: unknown) {
  const transactionId = required(transactionIdInput, "Transaction ID").trim();

  if (transactionId.length < MIN_TRANSACTION_ID_LENGTH) {
    throw new Error(`Transaction ID must be at least ${MIN_TRANSACTION_ID_LENGTH} characters.`);
  }

  const entry = getQueueEntry(queueEntryId);

  if (!entry) {
    throw new Error("Queue entry not found.");
  }

  const result = db
    .prepare(
      `UPDATE payments
       SET payment_status = 'PAID', transaction_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE queue_entry_id = ?`,
    )
    .run(transactionId, queueEntryId);

  if (!result.changes) {
    throw new Error("Payment record not found.");
  }

  recalculateWaitTimes(entry.queue_date);
  return getQueueEntry(queueEntryId);
}
