CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('PATIENT', 'OFFICIAL', 'ADMIN')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  full_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  phone_number TEXT NOT NULL,
  address TEXT NOT NULL,
  billing_address_same INTEGER NOT NULL DEFAULT 1,
  billing_address TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL UNIQUE,
  relationship TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone_number TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS insurance_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL UNIQUE,
  insurance_provider TEXT,
  policy_number TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  reason_for_visit TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_date TEXT NOT NULL,
  token_number INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  reason_for_visit TEXT NOT NULL,
  visit_category TEXT NOT NULL DEFAULT 'Other',
  medical_notes TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('WAITING', 'UPCOMING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
  ),
  estimated_wait_minutes INTEGER NOT NULL DEFAULT 0,
  called_at TEXT,
  consultation_started_at TEXT,
  consultation_ended_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  UNIQUE(queue_date, token_number)
);

CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_date ON queue_entries(queue_date);
CREATE INDEX IF NOT EXISTS idx_queue_entries_patient_id ON queue_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries(status);

CREATE TABLE IF NOT EXISTS payments (
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

CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_queue_entry_id ON payments(queue_entry_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
