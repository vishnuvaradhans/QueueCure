import { db, findUserByUsername, runTransaction, type UserRecord } from "./db";

export type QueueStatus =
  | "WAITING"
  | "UPCOMING"
  | "CALLED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type VisitCategory =
  | "General Fever / Cold"
  | "Diabetes Follow-up"
  | "Blood Pressure Check"
  | "Skin Problem"
  | "Child Consultation"
  | "Prescription Refill"
  | "Vaccination"
  | "First Consultation"
  | "Other";

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
  payment_method: "CASH";
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
  visit_category: VisitCategory;
  medical_notes: string | null;
  status: QueueStatus;
  estimated_wait_minutes: number;
  called_at: string | null;
  consultation_started_at: string | null;
  consultation_ended_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  full_name: string;
  user_id: number | null;
  payment_id: number | null;
  amount: number | null;
  payment_method: "CASH" | null;
  payment_status: "PENDING" | "PAID" | null;
};

export type PatientIntakeInput = {
  patientUsername?: string;
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
  visitCategory: VisitCategory;
  medicalNotes?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  amount?: number;
  billingAddressSame: boolean;
  billingAddress?: string;
  patientUserId?: number | null;
};

export type PatientProfileInput = {
  fullName: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "Other";
  phoneNumber: string;
  address: string;
};

const ACTIVE_STATUSES: QueueStatus[] = ["WAITING", "UPCOMING", "CALLED", "IN_PROGRESS"];
const DEFAULT_CONSULTATION_FEE = Number(process.env.CLINIC_CONSULTATION_FEE ?? 300);

export const VISIT_CATEGORY_DEFAULT_MINUTES: Record<VisitCategory, number> = {
  "General Fever / Cold": 5,
  "Diabetes Follow-up": 12,
  "Blood Pressure Check": 7,
  "Skin Problem": 10,
  "Child Consultation": 15,
  "Prescription Refill": 3,
  Vaccination: 5,
  "First Consultation": 20,
  Other: 15,
};

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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function positiveAmount(value: unknown) {
  const amount = Number(value ?? DEFAULT_CONSULTATION_FEE);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return Math.round(amount);
}

function validateVisitCategory(value: unknown): VisitCategory {
  const category = required(value, "Visit category");

  if (!Object.keys(VISIT_CATEGORY_DEFAULT_MINUTES).includes(category)) {
    throw new Error("Visit category is invalid.");
  }

  return category as VisitCategory;
}

function validateProfile(input: Partial<PatientProfileInput>): PatientProfileInput {
  const gender = required(input.gender, "Gender");

  if (!["Male", "Female", "Other"].includes(gender)) {
    throw new Error("Gender must be Male, Female, or Other.");
  }

  return {
    fullName: required(input.fullName, "Full name"),
    dateOfBirth: required(input.dateOfBirth, "Date of birth"),
    gender: gender as PatientProfileInput["gender"],
    phoneNumber: required(input.phoneNumber, "Phone number"),
    address: required(input.address, "Address"),
  };
}

function validateIntake(input: Partial<PatientIntakeInput>): PatientIntakeInput {
  const profile = validateProfile(input);
  const patientUsername = optional(input.patientUsername);
  const isExistingPatientVisit = Boolean(patientUsername);
  const emergencyContactPhoneNumber = isExistingPatientVisit
    ? optional(input.emergencyContactPhoneNumber) ?? "On file"
    : required(input.emergencyContactPhoneNumber, "Emergency contact phone number");

  if (
    normalizePhone(emergencyContactPhoneNumber) &&
    normalizePhone(profile.phoneNumber) === normalizePhone(emergencyContactPhoneNumber)
  ) {
    throw new Error("Emergency contact number must be different from patient phone number.");
  }

  const billingAddressSame = Boolean(input.billingAddressSame);
  const billingAddress = billingAddressSame
    ? null
    : required(input.billingAddress, "Billing address");

  return {
    ...profile,
    patientUsername: patientUsername ?? undefined,
    emergencyRelationship: isExistingPatientVisit
      ? optional(input.emergencyRelationship) ?? "On file"
      : required(input.emergencyRelationship, "Relationship"),
    emergencyContactName: isExistingPatientVisit
      ? optional(input.emergencyContactName) ?? "On file"
      : required(input.emergencyContactName, "Emergency contact name"),
    emergencyContactPhoneNumber,
    insuranceProvider: optional(input.insuranceProvider) ?? undefined,
    policyNumber: optional(input.policyNumber) ?? undefined,
    reasonForVisit: required(input.reasonForVisit, "Reason for visit"),
    visitCategory: validateVisitCategory(input.visitCategory),
    medicalNotes: optional(input.medicalNotes) ?? undefined,
    appointmentDate: optional(input.appointmentDate) ?? undefined,
    appointmentTime: optional(input.appointmentTime) ?? undefined,
    amount: positiveAmount(input.amount),
    billingAddressSame,
    billingAddress: billingAddress ?? undefined,
    patientUserId: input.patientUserId ?? null,
  };
}

function getPatientByUserId(userId: number) {
  return db.prepare("SELECT * FROM patients WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userId) as
    | PatientRow
    | undefined;
}

export function getPatientProfileByPatientId(patientId: string) {
  const username = required(patientId, "Patient ID").toLowerCase();
  const user = findUserByUsername(username);

  if (!user || user.role !== "PATIENT") {
    return undefined;
  }

  const patient = getPatientByUserId(user.id);

  if (!patient) {
    return undefined;
  }

  return {
    patientId: user.username,
    patient: {
      id: patient.id,
      fullName: patient.full_name,
      dateOfBirth: patient.date_of_birth,
      gender: patient.gender,
      phoneNumber: patient.phone_number,
      address: patient.address,
    },
  };
}

export function createPatientProfileForUser(userId: number, input: Partial<PatientProfileInput>) {
  const profile = validateProfile(input);
  const existing = getPatientByUserId(userId);

  if (existing) {
    db.prepare(
      `UPDATE patients
       SET full_name = ?, date_of_birth = ?, gender = ?, phone_number = ?,
           address = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      profile.fullName,
      profile.dateOfBirth,
      profile.gender,
      profile.phoneNumber,
      profile.address,
      existing.id,
    );
    return getPatientByUserId(userId);
  }

  const result = db
    .prepare(
      `INSERT INTO patients (
        user_id, full_name, date_of_birth, gender, phone_number, address,
        billing_address_same, billing_address, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, 'CASH')`,
    )
    .run(
      userId,
      profile.fullName,
      profile.dateOfBirth,
      profile.gender,
      profile.phoneNumber,
      profile.address,
    );

  return db.prepare("SELECT * FROM patients WHERE id = ?").get(Number(result.lastInsertRowid)) as
    | PatientRow
    | undefined;
}

function patientIdFromIntake(intake: PatientIntakeInput) {
  if (!intake.patientUsername) {
    return undefined;
  }

  const user = findUserByUsername(intake.patientUsername.toLowerCase());

  if (!user || user.role !== "PATIENT") {
    throw new Error("Patient not found. Please register patient first.");
  }

  const patient = getPatientByUserId(user.id);

  if (!patient) {
    throw new Error("Patient not found. Please register patient first.");
  }

  return {
    patientId: patient.id,
    userId: user.id,
  };
}

function nextTokenNumber(queueDate: string) {
  const row = db
    .prepare("SELECT COALESCE(MAX(token_number), 0) + 1 AS token FROM queue_entries WHERE queue_date = ?")
    .get(queueDate) as { token: number };

  return Number(row.token);
}

function categoryAverageMinutes(category: VisitCategory) {
  const row = db
    .prepare(
      `SELECT AVG((julianday(consultation_ended_at) - julianday(consultation_started_at)) * 24 * 60) AS average_minutes
       FROM queue_entries
       WHERE visit_category = ?
         AND status = 'COMPLETED'
         AND consultation_started_at IS NOT NULL
         AND consultation_ended_at IS NOT NULL
         AND consultation_ended_at > consultation_started_at`,
    )
    .get(category) as { average_minutes: number | null };

  const average = Number(row.average_minutes ?? 0);
  return average > 0
    ? Math.max(1, Math.round(average))
    : VISIT_CATEGORY_DEFAULT_MINUTES[category];
}

function recalculateWaitTimes(queueDate = today()) {
  const active = db
    .prepare(
      `SELECT id, status, visit_category
       FROM queue_entries
       WHERE queue_date = ?
         AND status IN ('WAITING', 'UPCOMING', 'CALLED', 'IN_PROGRESS')
       ORDER BY token_number ASC`,
    )
    .all(queueDate) as Array<{ id: number; status: QueueStatus; visit_category: VisitCategory }>;

  active.forEach((entry, index) => {
    const estimated = entry.status === "IN_PROGRESS" || entry.status === "CALLED"
      ? 0
      : index * categoryAverageMinutes(entry.visit_category);
    const normalizedStatus = entry.status === "WAITING" && index <= 2 ? "UPCOMING" : entry.status;

    db.prepare(
      `UPDATE queue_entries
       SET estimated_wait_minutes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(estimated, normalizedStatus, entry.id);
  });
}

function queueSelectSql(whereClause: string) {
  return `SELECT qe.*, p.full_name, p.user_id,
           pay.id AS payment_id,
           pay.amount,
           pay.payment_method,
           pay.payment_status
         FROM queue_entries qe
         JOIN patients p ON p.id = qe.patient_id
         LEFT JOIN payments pay ON pay.queue_entry_id = qe.id
         ${whereClause}`;
}

export function listQueue(queueDate = today()) {
  recalculateWaitTimes(queueDate);

  return db
    .prepare(
      `${queueSelectSql("WHERE qe.queue_date = ?")}
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

function publicQueueEntry(entry: QueueEntryRow) {
  return {
    id: entry.id,
    queue_date: entry.queue_date,
    token_number: entry.token_number,
    patient_id: entry.patient_id,
    status: entry.status,
    estimated_wait_minutes: entry.estimated_wait_minutes,
    full_name: entry.full_name,
    user_id: entry.user_id,
    payment_status: entry.payment_status ?? "PENDING",
  };
}

export function listPublicQueue(queueDate = today()) {
  return listQueue(queueDate).map(publicQueueEntry);
}

export function getPatientQueue(user: UserRecord) {
  const rows = listQueue(today());
  const ownEntry = rows.find((entry) => entry.user_id === user.id);

  return {
    queue: rows.map(publicQueueEntry),
    ownEntry: ownEntry ? publicQueueEntry(ownEntry) : null,
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
    averageConsultationMinutes: ownEntry
      ? categoryAverageMinutes(ownEntry.visit_category)
      : VISIT_CATEGORY_DEFAULT_MINUTES.Other,
    progress,
  };
}

export function createQueueEntry(input: Partial<PatientIntakeInput>) {
  const intake = validateIntake(input);
  const queueDate = intake.appointmentDate || today();
  const tokenNumber = nextTokenNumber(queueDate);
  const existingPatient = patientIdFromIntake(intake);

  const queueEntryId = runTransaction(() => {
    let patientId = existingPatient?.patientId;

    if (!patientId) {
      const patientResult = db
        .prepare(
          `INSERT INTO patients (
            user_id, full_name, date_of_birth, gender, phone_number, address,
            billing_address_same, billing_address, payment_method
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CASH')`,
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
        );
      patientId = Number(patientResult.lastInsertRowid);

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
    }

    const resolvedPatientId = patientId;

    if (!resolvedPatientId) {
      throw new Error("Patient not found. Please register patient first.");
    }

    if (intake.appointmentDate && intake.appointmentTime) {
      db.prepare(
        `INSERT INTO appointments (
          patient_id, appointment_date, appointment_time, reason_for_visit
        ) VALUES (?, ?, ?, ?)`,
      ).run(resolvedPatientId, intake.appointmentDate, intake.appointmentTime, intake.reasonForVisit);
    }

    const queueResult = db
      .prepare(
        `INSERT INTO queue_entries (
          queue_date, token_number, patient_id, reason_for_visit,
          visit_category, medical_notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'WAITING')`,
      )
      .run(
        queueDate,
        tokenNumber,
        resolvedPatientId,
        intake.reasonForVisit,
        intake.visitCategory,
        intake.medicalNotes ?? null,
      );
    const queueEntryId = Number(queueResult.lastInsertRowid);

    db.prepare(
      `INSERT INTO payments (
        queue_entry_id, patient_id, token_number, amount, payment_method, payment_status
      ) VALUES (?, ?, ?, ?, 'CASH', 'PENDING')`,
    ).run(queueEntryId, resolvedPatientId, tokenNumber, intake.amount ?? DEFAULT_CONSULTATION_FEE);

    return queueEntryId;
  });

  recalculateWaitTimes(queueDate);
  return getQueueEntry(queueEntryId);
}

export function getQueueEntry(id: number) {
  return db
    .prepare(queueSelectSql("WHERE qe.id = ?"))
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
           payment_method = 'CASH', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      intake.fullName,
      intake.dateOfBirth,
      intake.gender,
      intake.phoneNumber,
      intake.address,
      intake.billingAddressSame ? 1 : 0,
      intake.billingAddress ?? null,
      existing.patient_id,
    );

    db.prepare(
      `UPDATE queue_entries
       SET reason_for_visit = ?, visit_category = ?, medical_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      intake.reasonForVisit,
      intake.visitCategory,
      intake.medicalNotes ?? null,
      queueEntryId,
    );

    db.prepare(
      `UPDATE payments
       SET amount = ?, payment_method = 'CASH', updated_at = CURRENT_TIMESTAMP
       WHERE queue_entry_id = ? AND payment_status != 'PAID'`,
    ).run(intake.amount ?? DEFAULT_CONSULTATION_FEE, queueEntryId);
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
       SET status = 'CALLED',
           called_at = COALESCE(called_at, CURRENT_TIMESTAMP),
           consultation_started_at = COALESCE(consultation_started_at, CURRENT_TIMESTAMP),
           estimated_wait_minutes = 0,
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
     SET status = 'COMPLETED',
         consultation_ended_at = CURRENT_TIMESTAMP,
         completed_at = CURRENT_TIMESTAMP,
         estimated_wait_minutes = 0,
         updated_at = CURRENT_TIMESTAMP
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

export function markQueuePaymentPaid(queueEntryId: number) {
  const entry = getQueueEntry(queueEntryId);

  if (!entry) {
    throw new Error("Queue entry not found.");
  }

  const result = db
    .prepare(
      `UPDATE payments
       SET payment_status = 'PAID', marked_paid_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE queue_entry_id = ?`,
    )
    .run(queueEntryId);

  if (!result.changes) {
    throw new Error("Payment record not found.");
  }

  return getQueueEntry(queueEntryId);
}
