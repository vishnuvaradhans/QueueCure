import { ShieldCheck, UserRoundCheck } from "lucide-react";
import type { DetectedUserType } from "../types/user";

type UserTypeBadgeProps = {
  role: DetectedUserType;
  hasUserId: boolean;
};

export default function UserTypeBadge({ role, hasUserId }: UserTypeBadgeProps) {
  if (!hasUserId || role === "unknown") {
    return null;
  }

  const isOfficial = role === "official";
  const Icon = isOfficial ? ShieldCheck : UserRoundCheck;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-300 ${
        isOfficial
          ? "bg-blue-50 text-clinic-blue ring-1 ring-blue-100"
          : "bg-emerald-50 text-clinic-green ring-1 ring-emerald-100"
      }`}
      aria-live="polite"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {isOfficial ? "Official User" : "Patient User"}
    </div>
  );
}
