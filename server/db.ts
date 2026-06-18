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
