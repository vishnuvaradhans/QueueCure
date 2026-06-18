import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  CheckCircle2,
  ClipboardPlus,
  IndianRupee,
  Edit3,
  PhoneCall,
  QrCode,
  Trash2,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  addQueuePatient,
  callNextQueuePatient,
  callQueuePatient,
  completeQueuePatient,
  confirmQueuePayment,
  fetchOfficialQueue,
  fetchQueuePatient,
  generatePaymentQr,
  removeQueuePatient,
  updateQueuePatient,
} from "../lib/api";
import { getQueueSocket } from "../lib/socket";
import type { Gender, PatientIntakePayload, PaymentMethod, PaymentQrPayload, QueueEntry } from "../types/queue";

const emptyForm: PatientIntakePayload = {
  fullName: "",
  dateOfBirth: "",
  gender: "Male",
  phoneNumber: "",
  address: "",
  emergencyRelationship: "",
  emergencyContactName: "",
  emergencyContactPhoneNumber: "",
  insuranceProvider: "",
  policyNumber: "",
  reasonForVisit: "",
  appointmentDate: "",
  appointmentTime: "",
  paymentMethod: "CASH",
  amount: 300,
  billingAddressSame: true,
  billingAddress: "",
  patientUsername: "",
};

const statusStyles: Record<string, string> = {
  WAITING: "bg-slate-100 text-slate-700",
  UPCOMING: "bg-blue-50 text-clinic-blue",
  CALLED: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-clinic-green",
  CANCELLED: "bg-slate-200 text-slate-500",
};

const paymentStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-clinic-green",
  FAILED: "bg-red-50 text-red-700",
};

function inputClass() {
  return "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100";
}

export default function OfficialDashboardPage() {
  const { token, user, signOut } = useAuth();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [form, setForm] = useState<PatientIntakePayload>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [qrPayloads, setQrPayloads] = useState<Record<number, PaymentQrPayload>>({});
  const [transactionIds, setTransactionIds] = useState<Record<number, string>>({});

  const activeQueue = useMemo(
    () => queue.filter((entry) => !["COMPLETED", "CANCELLED"].includes(entry.status)),
    [queue],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    fetchOfficialQueue(token).then(({ queue }) => setQueue(queue)).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load queue.");
    });

    const socket = getQueueSocket(token);
    socket.on("queue:update", (payload: { queue?: QueueEntry[] }) => {
      if (payload.queue) {
        setQueue(payload.queue);
      }
    });

    return () => {
      socket.off("queue:update");
    };
  }, [token]);

  function updateField<K extends keyof PatientIntakePayload>(field: K, value: PatientIntakePayload[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      if (editingId) {
        await updateQueuePatient(token, editingId, form);
        setMessage("Patient updated.");
      } else {
        await addQueuePatient(token, form);
        setMessage("Patient added to queue.");
      }

      setForm(emptyForm);
      setEditingId(null);
      const fresh = await fetchOfficialQueue(token);
      setQueue(fresh.queue);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save patient.");
    } finally {
      setIsSaving(false);
    }
  }

  async function editEntry(entry: QueueEntry) {
    if (!token) {
      return;
    }

    const details = await fetchQueuePatient(token, entry.id);
    setEditingId(entry.id);
    setForm({
      fullName: details.patient.full_name,
      dateOfBirth: details.patient.date_of_birth,
      gender: details.patient.gender,
      phoneNumber: details.patient.phone_number,
      address: details.patient.address,
      emergencyRelationship: details.emergencyContact?.relationship ?? "",
      emergencyContactName: details.emergencyContact?.contact_name ?? "",
      emergencyContactPhoneNumber: details.emergencyContact?.contact_phone_number ?? "",
      insuranceProvider: details.insurance?.insurance_provider ?? "",
      policyNumber: details.insurance?.policy_number ?? "",
      reasonForVisit: entry.reason_for_visit,
      appointmentDate: details.appointment?.appointment_date ?? "",
      appointmentTime: details.appointment?.appointment_time ?? "",
              paymentMethod: details.patient.payment_method,
      amount: entry.amount ?? 300,
      billingAddressSame: Boolean(details.patient.billing_address_same),
      billingAddress: details.patient.billing_address ?? "",
      patientUsername: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runAction(action: () => Promise<unknown>) {
    if (!token) {
      return;
    }

    try {
      await action();
      const fresh = await fetchOfficialQueue(token);
      setQueue(fresh.queue);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Queue action failed.");
    }
  }

  async function handleGenerateQr(entry: QueueEntry) {
    if (!token) {
      return;
    }

    try {
      const payload = await generatePaymentQr(token, entry.id);
      setQrPayloads((current) => ({ ...current, [entry.id]: payload }));
      setMessage(`QR generated for token #${entry.token_number}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate QR.");
    }
  }

  async function handleConfirmPayment(entry: QueueEntry) {
    if (!token) {
      return;
    }

    const transactionId = (transactionIds[entry.id] ?? "").trim();

    if (transactionId.length < 6) {
      setMessage("Transaction ID must be at least 6 characters.");
      return;
    }

    await runAction(() => confirmQueuePayment(token, entry.id, transactionId));
    setTransactionIds((current) => ({ ...current, [entry.id]: "" }));
    setMessage(`Payment confirmed for token #${entry.token_number}.`);
  }

  return (
    <main className="min-h-screen bg-clinic-surface text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-clinic-blue">
              QueueCure Official
            </p>
            <h1 className="text-2xl font-bold text-clinic-navy">
              Clinic Management Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => runAction(() => callNextQueuePatient(token!))}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-soft transition hover:bg-red-700"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              Call Next Patient
            </button>
            <button
              type="button"
              onClick={signOut}
              className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[430px_1fr]">
        <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-clinic-blue">
              <ClipboardPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-clinic-navy">
                {editingId ? "Edit Patient" : "Patient Intake"}
              </h2>
              <p className="text-sm text-slate-500">Collect details and assign a daily token.</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Registered Patient Username</span>
                <input className={inputClass()} placeholder="optional: arun.pat" value={form.patientUsername ?? ""} onChange={(event) => updateField("patientUsername", event.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Full Name</span>
                <input className={inputClass()} required value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Date of Birth</span>
                <input className={inputClass()} required type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Gender</span>
                <select className={inputClass()} value={form.gender} onChange={(event) => updateField("gender", event.target.value as Gender)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Phone Number</span>
                <input className={inputClass()} required value={form.phoneNumber} onChange={(event) => updateField("phoneNumber", event.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Address</span>
                <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100" required value={form.address} onChange={(event) => updateField("address", event.target.value)} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Relationship</span>
                <input className={inputClass()} required value={form.emergencyRelationship} onChange={(event) => updateField("emergencyRelationship", event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Emergency Contact Name</span>
                <input className={inputClass()} required value={form.emergencyContactName} onChange={(event) => updateField("emergencyContactName", event.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Emergency Contact Phone Number</span>
                <input className={inputClass()} required value={form.emergencyContactPhoneNumber} onChange={(event) => updateField("emergencyContactPhoneNumber", event.target.value)} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputClass()} placeholder="Insurance Provider" value={form.insuranceProvider ?? ""} onChange={(event) => updateField("insuranceProvider", event.target.value)} />
              <input className={inputClass()} placeholder="Policy Number" value={form.policyNumber ?? ""} onChange={(event) => updateField("policyNumber", event.target.value)} />
              <input className={inputClass()} required placeholder="Reason For Visit" value={form.reasonForVisit} onChange={(event) => updateField("reasonForVisit", event.target.value)} />
              <select className={inputClass()} value={form.paymentMethod} onChange={(event) => updateField("paymentMethod", event.target.value as PaymentMethod)}>
                <option value="CASH">Cash / Pay At Clinic</option>
                <option value="UPI">UPI / QR Payment</option>
              </select>
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <IndianRupee className="h-4 w-4" aria-hidden="true" />
                </span>
                <input className={`${inputClass()} pl-9`} min="1" required type="number" value={form.amount ?? 300} onChange={(event) => updateField("amount", Number(event.target.value))} />
              </label>
              <input className={inputClass()} type="date" value={form.appointmentDate ?? ""} onChange={(event) => updateField("appointmentDate", event.target.value)} />
              <input className={inputClass()} type="time" value={form.appointmentTime ?? ""} onChange={(event) => updateField("appointmentTime", event.target.value)} />
            </div>

            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={form.billingAddressSame} onChange={(event) => updateField("billingAddressSame", event.target.checked)} />
              Billing address same as patient address
            </label>

            {!form.billingAddressSame && (
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100" required placeholder="Billing Address" value={form.billingAddress ?? ""} onChange={(event) => updateField("billingAddress", event.target.value)} />
            )}

            <div className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-clinic-blue">
              UPI QR payments require receptionist transaction ID verification before status becomes paid.
            </div>

            {message && <p className="text-sm font-semibold text-clinic-blue">{message}</p>}

            <div className="flex gap-3">
              <button disabled={isSaving} className="h-11 flex-1 rounded-xl bg-clinic-blue px-4 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-70">
                {isSaving ? "Saving..." : editingId ? "Update Patient" : "Add Patient"}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-clinic-green">
                Live Queue
              </p>
              <h2 className="text-xl font-bold text-clinic-navy">
                {activeQueue.length} active patients
              </h2>
            </div>
            <p className="text-sm text-slate-500">Signed in as {user?.username}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-3 text-left">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3">Token Number</th>
                  <th className="px-3">Patient Name</th>
                  <th className="px-3">Reason For Visit</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Estimated Wait Time</th>
                  <th className="px-3">Payment</th>
                  <th className="px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => (
                  <tr key={entry.id} className="bg-slate-50 shadow-sm">
                    <td className="rounded-l-xl px-3 py-4 text-2xl font-bold text-clinic-navy">
                      #{entry.token_number}
                    </td>
                    <td className="px-3 py-4 font-semibold">{entry.full_name}</td>
                    <td className="px-3 py-4 text-slate-600">{entry.reason_for_visit}</td>
                    <td className="px-3 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[entry.status]}`}>
                        {entry.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-4 font-semibold">{entry.estimated_wait_minutes} min</td>
                    <td className="px-3 py-4">
                      <div className="min-w-56 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStyles[entry.payment_status ?? "PENDING"]}`}>
                            {entry.payment_status ?? "PENDING"}
                          </span>
                          <span className="text-sm font-bold text-clinic-navy">
                            Rs. {entry.amount ?? 300}
                          </span>
                        </div>
                        {entry.payment_method === "UPI" && entry.payment_status !== "PAID" && (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handleGenerateQr(entry)}
                              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-50 px-3 text-xs font-bold text-clinic-blue hover:bg-blue-100"
                            >
                              <QrCode className="h-4 w-4" aria-hidden="true" />
                              Generate QR
                            </button>
                            {qrPayloads[entry.id] && (
                              <img
                                src={qrPayloads[entry.id].qrCodeDataUrl}
                                alt={`UPI QR for token ${entry.token_number}`}
                                className="h-28 w-28 rounded-lg border border-slate-200 bg-white p-1"
                              />
                            )}
                            <input
                              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-clinic-blue focus:ring-2 focus:ring-blue-100"
                              placeholder="Transaction ID"
                              value={transactionIds[entry.id] ?? ""}
                              onChange={(event) =>
                                setTransactionIds((current) => ({
                                  ...current,
                                  [entry.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmPayment(entry)}
                              className="h-9 rounded-lg bg-clinic-green px-3 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              Confirm Payment
                            </button>
                          </div>
                        )}
                        {entry.payment_method === "CASH" && entry.payment_status !== "PAID" && (
                          <div className="space-y-2">
                            <input
                              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-clinic-blue focus:ring-2 focus:ring-blue-100"
                              placeholder="Receipt / transaction ID"
                              value={transactionIds[entry.id] ?? ""}
                              onChange={(event) =>
                                setTransactionIds((current) => ({
                                  ...current,
                                  [entry.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmPayment(entry)}
                              className="h-9 rounded-lg bg-clinic-green px-3 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              Confirm Payment
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="rounded-r-xl px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button title="Call patient" onClick={() => runAction(() => callQueuePatient(token!, entry.id))} className="grid h-9 w-9 place-items-center rounded-lg bg-red-600 text-white hover:bg-red-700">
                          <PhoneCall className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button title="Complete patient" onClick={() => runAction(() => completeQueuePatient(token!, entry.id))} className="grid h-9 w-9 place-items-center rounded-lg bg-clinic-green text-white hover:bg-emerald-700">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button title="Edit patient" onClick={() => editEntry(entry)} className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-clinic-blue hover:bg-blue-100">
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button title="Remove patient" onClick={() => runAction(() => removeQueuePatient(token!, entry.id))} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queue.length && (
              <div className="grid min-h-52 place-items-center rounded-2xl bg-slate-50 text-center text-slate-500">
                <div>
                  <Activity className="mx-auto h-8 w-8 text-clinic-blue" aria-hidden="true" />
                  <p className="mt-3 font-semibold">No patients in today&apos;s queue yet.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
