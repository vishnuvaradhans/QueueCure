import { ArrowLeft, ClipboardList, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

type DashboardPlaceholderProps = {
  accent: "blue" | "green";
  eyebrow: string;
  title: string;
};

export default function DashboardPlaceholder({
  accent,
  eyebrow,
  title,
}: DashboardPlaceholderProps) {
  const isBlue = accent === "blue";

  return (
    <main className="min-h-screen bg-clinic-surface px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="w-full rounded-[28px] bg-white p-8 shadow-card ring-1 ring-slate-200 sm:p-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-clinic-navy focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to login
          </Link>

          <div className="mt-10 grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
            <div
              className={`grid h-20 w-20 place-items-center rounded-3xl text-white shadow-soft ${
                isBlue
                  ? "bg-gradient-to-br from-clinic-blue to-sky-500"
                  : "bg-gradient-to-br from-clinic-green to-clinic-mint"
              }`}
            >
              {isBlue ? (
                <ClipboardList className="h-10 w-10" aria-hidden="true" />
              ) : (
                <Clock3 className="h-10 w-10" aria-hidden="true" />
              )}
            </div>
            <div>
              <p
                className={`text-sm font-bold uppercase tracking-[0.18em] ${
                  isBlue ? "text-clinic-blue" : "text-clinic-green"
                }`}
              >
                {eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-normal text-clinic-navy sm:text-5xl">
                {title}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                This is a frontend-only placeholder route for the QueueCure
                dashboard experience.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
