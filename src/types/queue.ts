export type QueueStatus =
  | "WAITING"
  | "UPCOMING"
  | "CALLED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod = "CASH" | "UPI";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED";
export type Gender = "Male" | "Female" | "Other";

export type QueueEntry = {
  id: number;
  queue_date: string;
  token_number: number;
  patient_id: number;
  reason_for_visit: string;
  status: QueueStatus;
  estimated_wait_minutes: number;
  full_name: string;
  user_id: number | null;
  payment_id: number | null;
  amount: number | null;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus | null;
  transaction_id: string | null;
};

export type QueueSummary = {
  currentToken: number | null;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  averageConsultationMinutes: number;
  progress: number;
};

export type PatientQueueState = {
  queue: QueueEntry[];
  ownEntry: QueueEntry | null;
  summary: QueueSummary;
};

export type PatientIntakePayload = {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
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
  paymentMethod: PaymentMethod;
  amount?: number;
  billingAddressSame: boolean;
  billingAddress?: string;
  patientUsername?: string;
};

export type PaymentQrPayload = {
  payment: {
    id: number;
    queue_entry_id: number;
    patient_id: number;
    token_number: number;
    amount: number;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
    transaction_id: string | null;
    full_name: string;
  };
  upiUri: string;
  qrCodeDataUrl: string;
};

export type FullPatientPayload = {
  patient: {
    full_name: string;
    date_of_birth: string;
    gender: Gender;
    phone_number: string;
    address: string;
    billing_address_same: number;
    billing_address: string | null;
    payment_method: PaymentMethod;
  };
  emergencyContact?: {
    relationship: string;
    contact_name: string;
    contact_phone_number: string;
  };
  insurance?: {
    insurance_provider: string | null;
    policy_number: string | null;
  };
  appointment?: {
    appointment_date: string;
    appointment_time: string;
    reason_for_visit: string;
  };
};
