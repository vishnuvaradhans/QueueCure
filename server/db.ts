import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type UserRole = "PATIENT" | "OFFICIAL" | "ADMIN";

export type UserRecord = {
  id: number;
  username: string;
  role: UserRole;
  password_hash: string;
  created_at: string;
};

const serverDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(serverDir, "data");
const dbPath = join(dataDir, "queuecure.sqlite");

mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function runMigrations() {
  const schema = readFileSync(join(serverDir, "schema.sql"), "utf8");
  db.exec(schema);
  applyPhase4Migrations();
}

export function findUserByUsername(username: string): UserRecord | undefined {
  return db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRecord | undefined;
}

export function findUserById(id: number): UserRecord | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRecord
    | undefined;
}

export function createUser(params: {
  username: string;
  role: UserRole;
  passwordHash: string;
}) {
  const result = db
    .prepare(
      "INSERT INTO users (username, role, password_hash) VALUES (?, ?, ?)",
    )
    .run(params.username, params.role, params.passwordHash);

  return findUserById(Number(result.lastInsertRowid));
}

export function publicUser(user: UserRecord) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at,
  };
}

export function runTransaction<T>(operation: () => T) {
  db.exec("BEGIN");

  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function columnExists(tableName: string, columnName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  if (!columnExists(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function applyPhase4Migrations() {
  addColumnIfMissing("queue_entries", "visit_category", "TEXT NOT NULL DEFAULT 'Other'");
  addColumnIfMissing("queue_entries", "medical_notes", "TEXT");
  addColumnIfMissing("queue_entries", "consultation_started_at", "TEXT");
  addColumnIfMissing("queue_entries", "consultation_ended_at", "TEXT");

  addColumnIfMissing("payments", "marked_paid_at", "TEXT");
  db.exec(`
    UPDATE patients SET payment_method = 'CASH' WHERE payment_method != 'CASH';
    UPDATE payments SET payment_method = 'CASH' WHERE payment_method != 'CASH';
    UPDATE payments SET payment_status = 'PENDING' WHERE payment_status NOT IN ('PENDING', 'PAID');
  `);

  if (columnExists("payments", "transaction_id")) {
    db.exec(`
      CREATE TABLE payments_phase4 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue_entry_id INTEGER NOT NULL UNIQUE,
        patient_id INTEGER NOT NULL,
        token_number INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH')) DEFAULT 'CASH',
        payment_status TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'PAID')) DEFAULT 'PENDING',
        marked_paid_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (queue_entry_id) REFERENCES queue_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      INSERT INTO payments_phase4 (
        id, queue_entry_id, patient_id, token_number, amount, payment_method,
        payment_status, marked_paid_at, created_at, updated_at
      )
      SELECT
        id, queue_entry_id, patient_id, token_number, amount, 'CASH',
        CASE WHEN payment_status = 'PAID' THEN 'PAID' ELSE 'PENDING' END,
        marked_paid_at, created_at, updated_at
      FROM payments;

      DROP TABLE payments;
      ALTER TABLE payments_phase4 RENAME TO payments;

      CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_payments_queue_entry_id ON payments(queue_entry_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
    `);
  }
}
