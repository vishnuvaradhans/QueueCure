import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Clock3, LogOut, Radio, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchPatientQueue } from "../lib/api";
import { getQueueSocket } from "../lib/socket";
import type { PatientQueueState, QueueEntry } from "../types/queue";

function statusText(status?: string) {
  return status ? status.replace("_", " ") : "NOT IN QUEUE";
}

function notifyBrowser(message: string) {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification("QueueCure", { body: message });
  }
}

export default function PatientDashboardPage() {
  const { token, user, signOut } = useAuth();
  const [queueState, setQueueState] = useState<PatientQueueState>({
    queue: [],
    ownEntry: null,
    summary: {
      currentToken: null,
      patientsAhead: 0,
      estimatedWaitMinutes: 0,
      progress: 0,
      averageConsultationMinutes: 10
    },
  });
  const [notifications, setNotifications] = useState<string[]>([]);
  const waitNoticeSent = useRef(false);
  const calledNoticeSent = useRef(false);

  const visibleQueue = useMemo(
    () => queueState.queue.filter((entry) => !["COMPLETED", "CANCELLED"].includes(entry.status)),
    [queueState.queue],
  );

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    fetchPatientQueue(token).then(setQueueState).catch(() => undefined);

    const socket = getQueueSocket(token);
    socket.on(
      "queue:update",
      (payload: { queue?: QueueEntry[]; patient?: PatientQueueState | null }) => {
        if (payload.patient) {
          setQueueState(payload.patient);
          return;
        }

        if (!payload.queue) {
          return;
        }

        const ownEntry = payload.queue.find((entry) => entry.user_id === user.id) ?? null;
        const active = payload.queue.filter((entry) =>
          ["WAITING", "UPCOMING", "CALLED", "IN_PROGRESS"].includes(entry.status),
        );
        const current = active.find((entry) =>
          ["CALLED", "IN_PROGRESS"].includes(entry.status)
        ) ?? active[0] ?? null;
        const patientsAhead = ownEntry
          ? active.filter((entry) => entry.token_number < ownEntry.token_number).length
          : 0;
        const completedBefore = ownEntry
          ? payload.queue.filter((entry) =>
            entry.token_number < ownEntry.token_number &&
            ["COMPLETED", "CANCELLED"].includes(entry.status)
          ).length
          : 0;

        setQueueState({
          queue: payload.queue,
          ownEntry,
          summary: {
            currentToken: current?.token_number ?? null,
            
            patientsAhead,
            estimatedWaitMinutes: ownEntry?.estimated_wait_minutes ?? 0,
            averageConsultationMinutes: 10,
            progress: ownEntry
              ? Math.min(100, Math.round((completedBefore / Math.max(ownEntry.token_number, 1)) * 100))
              : 0,
          },
        });
      },
    );

    socket.on("queue:notification", (payload: { message: string }) => {
      setNotifications((current) => [payload.message, ...current].slice(0, 5));
      notifyBrowser(payload.message);
    });

    return () => {
      socket.off("queue:update");
      socket.off("queue:notification");
    };
  }, [token, user]);

  useEffect(() => {
    const ownEntry = queueState.ownEntry;

    if (!ownEntry) {
      return;
    }

    if (
      ownEntry.estimated_wait_minutes <= 5 &&
      ownEntry.status !== "CALLED" &&
      !waitNoticeSent.current
    ) {
      const message = "Your turn is expected within approximately 5 minutes.";
      waitNoticeSent.current = true;
      setNotifications((current) => [message, ...current].slice(0, 5));
      notifyBrowser(message);
    }

    if (ownEntry.status === "CALLED" && !calledNoticeSent.current) {
      const message = "Your token is now being called.";
      calledNoticeSent.current = true;
      setNotifications((current) => [message, ...current].slice(0, 5));
      notifyBrowser(message);
    }
  }, [queueState.ownEntry]);

  async function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  const ownEntry = queueState.ownEntry;

  return (
    <main className="min-h-screen bg-clinic-surface text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-red-600 px-5 py-3 text-center text-white shadow-soft">
              <p className="text-xs font-bold uppercase tracking-[0.22em]">Token</p>
              <p className="text-4xl font-black leading-none">
                {ownEntry ? `#${ownEntry.token_number}` : "--"}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-clinic-green">
                QueueCure Patient
              </p>
              <h1 className="text-2xl font-bold text-clinic-navy">Live Queue Tracker</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              Enable Alerts
            </button>
            <button
              type="button"
              onClick={signOut}
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
              <Clock3 className="h-6 w-6 text-clinic-blue" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-slate-500">Current token being served</p>
              <p className="mt-1 text-3xl font-black text-clinic-navy">
                {queueState.summary.currentToken ? `#${queueState.summary.currentToken}` : "--"}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
              <UserRound className="h-6 w-6 text-clinic-green" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-slate-500">Your status</p>
              <p className="mt-1 text-2xl font-black text-clinic-navy">
                {statusText(ownEntry?.status)}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
              <Radio className="h-6 w-6 text-red-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-slate-500">Patients ahead</p>
              <p className="mt-1 text-3xl font-black text-clinic-navy">
                {queueState.summary.patientsAhead}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
              <Clock3 className="h-6 w-6 text-amber-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-slate-500">Estimated waiting time</p>
              <p className="mt-1 text-3xl font-black text-clinic-navy">
                {queueState.summary.estimatedWaitMinutes} min
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-clinic-navy">Queue Progress</h2>
              <span className="text-sm font-bold text-clinic-blue">{queueState.summary.progress}%</span>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-clinic-blue to-clinic-mint transition-all duration-500"
                style={{ width: `${queueState.summary.progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <h2 className="mb-4 text-lg font-bold text-clinic-navy">Live Queue</h2>
            <div className="space-y-3">
              {visibleQueue.map((entry) => (
                <div
                  key={entry.id}
                  className={`grid gap-3 rounded-xl p-4 sm:grid-cols-[90px_1fr_auto] sm:items-center ${
                    entry.id === ownEntry?.id ? "bg-red-50 ring-2 ring-red-100" : "bg-slate-50"
                  }`}
                >
                  <p className="text-2xl font-black text-clinic-navy">#{entry.token_number}</p>
              <div>
                <p className="font-bold text-clinic-navy">{entry.full_name}</p>
                    <p className="text-sm text-slate-500">Estimated wait: {entry.estimated_wait_minutes} min</p>
              </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                    {statusText(entry.status)}
                  </span>
                </div>
              ))}
              {!visibleQueue.length && (
                <p className="rounded-xl bg-slate-50 p-6 text-center font-semibold text-slate-500">
                  No active queue entries yet.
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-clinic-navy">Notifications</h2>
            <div className="mt-4 space-y-3">
              {notifications.map((notification, index) => (
                <p key={`${notification}-${index}`} className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-clinic-blue">
                  {notification}
                </p>
              ))}
              {!notifications.length && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Queue alerts will appear here.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-clinic-navy">Your Visit</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between gap-4">
                <span className="text-slate-500">Account</span>
                <span className="font-bold text-clinic-navy">{user?.username}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-slate-500">Patient</span>
                <span className="font-bold text-clinic-navy">{ownEntry?.full_name ?? "Not linked"}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-slate-500">Payment Status</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    ownEntry?.payment_status === "PAID"
                      ? "bg-emerald-50 text-clinic-green"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {ownEntry?.payment_status === "PAID" ? "Paid" : "Pending"}
                </span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
