import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, IdCard, LoaderCircle } from "lucide-react";
import BrandMark from "./BrandMark";
import PasswordInput from "./PasswordInput";
import UserTypeBadge from "./UserTypeBadge";
import { useAuth } from "../auth/AuthContext";
import { dashboardPathForRole } from "../lib/api";
import { detectUserType } from "../types/user";

export default function LoginCard() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const detectedUserType = useMemo(() => detectUserType(userId), [userId]);
  const hasUserId = userId.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setErrorMessage("");

    if (!hasUserId || !password) {
      setErrorMessage("Username and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await signIn(userId, password);
      navigate(dashboardPathForRole(user.role));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-[1040px] animate-floatIn overflow-hidden rounded-[28px] bg-white shadow-card ring-1 ring-slate-200/70">
      <div className="grid min-h-[620px] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative hidden overflow-hidden bg-clinic-surface lg:block">
          <img
            src="/clinic-hero.jpg"
            alt="Stethoscope on a clinical desk"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/75 via-sky-100/70 to-emerald-100/75" />
          <div className="absolute left-8 right-8 top-8 rounded-2xl bg-white/78 p-5 shadow-soft backdrop-blur-md ring-1 ring-white/70">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clinic-blue">
              Digital token care
            </p>
            <p className="mt-3 text-2xl font-bold leading-tight text-clinic-navy">
              Real-time clinic queues for staff and patients.
            </p>
          </div>
          <div className="absolute bottom-10 left-10 right-10">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
              <div className="h-full w-2/3 origin-left animate-pulseLine rounded-full bg-gradient-to-r from-clinic-blue to-clinic-mint" />
            </div>
          </div>
        </div>

        <div className="flex items-center px-6 py-8 sm:px-10 lg:px-12">
          <div className="w-full">
            <BrandMark />

            <div className="mt-8 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200 sm:p-5 lg:hidden">
              <img
                src="/clinic-hero.jpg"
                alt="Stethoscope on a clinical desk"
                className="h-36 w-full rounded-xl object-cover"
              />
            </div>

            <form className="mt-9 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  User ID
                </span>
                <div className="group relative">
                  <IdCard
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-clinic-blue"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="reception1.off or vishnu123.pat"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                    autoComplete="username"
                  />
                </div>
              </label>

              <div className="min-h-9">
                <UserTypeBadge role={detectedUserType} hasUserId={hasUserId} />
                {hasSubmitted && errorMessage && (
                  <p className="text-sm font-semibold text-clinic-red" aria-live="polite">
                    {errorMessage}
                  </p>
                )}
              </div>

              <PasswordInput
                value={password}
                visible={passwordVisible}
                onChange={(event) => setPassword(event.target.value)}
                onToggle={() => setPasswordVisible((current) => !current)}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-clinic-blue to-clinic-mint px-5 text-base font-bold text-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:translate-y-0"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    Signing in
                  </>
                ) : (
                  <>
                    Login
                    <ArrowRight
                      className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
              <p className="text-center text-sm text-slate-600">
                Don&apos;t have an account?{" "}
                <Link
                  to="/register"
                  className="font-bold text-clinic-blue transition hover:text-clinic-green"
                >
                  Create Patient Account
                </Link>
              </p>
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200 sm:grid-cols-2">
                <p className="text-slate-600">
                  <span className="block font-bold text-clinic-green">
                    Patient Example:
                  </span>
                  arun.pat
                </p>
                <p className="text-slate-600">
                  <span className="block font-bold text-clinic-blue">
                    Official Example:
                  </span>
                  doctor1.off
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
