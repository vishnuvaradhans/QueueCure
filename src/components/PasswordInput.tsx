import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import type { ChangeEvent } from "react";

type PasswordInputProps = {
  value: string;
  visible: boolean;
  label?: string;
  placeholder?: string;
  autoComplete?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggle: () => void;
};

export default function PasswordInput({
  value,
  visible,
  label = "Password",
  placeholder = "Enter your password",
  autoComplete = "current-password",
  onChange,
  onToggle,
}: PasswordInputProps) {
  const Icon = visible ? EyeOff : Eye;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <div className="group relative">
        <LockKeyhole
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-clinic-blue"
          aria-hidden="true"
        />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-14 text-base text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition duration-200 hover:bg-slate-100 hover:text-clinic-navy focus:outline-none focus:ring-4 focus:ring-blue-100"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </label>
  );
}
