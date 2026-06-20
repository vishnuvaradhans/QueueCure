import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LoaderCircle, UserPlus } from "lucide-react";
import BrandMark from "../components/BrandMark";
import PasswordInput from "../components/PasswordInput";
import { registerPatient } from "../lib/api";

const RESERVED_USERNAMES = new Set(["admin", "administrator", "root"]);

function validateUsername(username: string) {
  const normalized = username.trim().toLowerCase();

  if (!normalized) {
    return "Username is required.";
  }

  if (/\s/.test(normalized)) {
    return "Username cannot contain spaces.";
  }

  if (normalized.includes(".") || normalized.endsWith(".pat") || normalized.endsWith(".off")) {
    return "Patient usernames must not include .pat or .off.";
  }

  if (RESERVED_USERNAMES.has(normalized)) {
    return "This username is reserved.";
  }

  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    return "Username can only contain letters, numbers, and underscores.";
  }

  return "";
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("Male");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const usernameError = useMemo(() => validateUsername(username), [username]);
  const storedUsername = username.trim() ? `${username.trim().toLowerCase()}.pat` : "username.pat";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (usernameError) {
      setMessage(usernameError);
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!fullName.trim() || !dateOfBirth || !phoneNumber.trim() || !address.trim()) {
      setMessage("Full name, DOB, phone number, and address are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await registerPatient(username, password, confirmPassword, {
        fullName,
        dateOfBirth,
        gender,
        phoneNumber,
        address,
      });
      navigate("/", {
        replace: true,
        state: { registrationMessage: "Patient account created. Please log in." },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,142,219,0.16),_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f7fbfd_48%,_#eefcf7_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <section className="w-full animate-floatIn rounded-[28px] bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-10">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-clinic-navy focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to login
          </Link>

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <BrandMark />
              <div className="mt-8 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
                <UserPlus className="h-8 w-8 text-clinic-green" aria-hidden="true" />
                <p className="mt-4 text-sm font-semibold text-clinic-green">
                  Your username will automatically be stored as username.pat
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  Current preview:{" "}
                  <span className="font-bold text-clinic-navy">{storedUsername}</span>
                </p>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Username
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="arun"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                  autoComplete="username"
                />
              </label>

              {username && usernameError && (
                <p className="text-sm font-semibold text-clinic-red" aria-live="polite">
                  {usernameError}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Full Name
                  </span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Date of Birth
                  </span>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition duration-200 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Gender
                  </span>
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition duration-200 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Phone Number
                  </span>
                  <input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Address
                  </span>
                  <textarea
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition duration-200 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <PasswordInput
                value={password}
                visible={passwordVisible}
                label="Password"
                placeholder="Create a password"
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                onToggle={() => setPasswordVisible((current) => !current)}
              />

              <PasswordInput
                value={confirmPassword}
                visible={confirmPasswordVisible}
                label="Confirm Password"
                placeholder="Confirm your password"
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                onToggle={() => setConfirmPasswordVisible((current) => !current)}
              />

              {message && (
                <p className="text-sm font-semibold text-clinic-red" aria-live="polite">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-clinic-green to-clinic-mint px-5 text-base font-bold text-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:translate-y-0"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    Creating account
                  </>
                ) : (
                  "Create Patient Account"
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
