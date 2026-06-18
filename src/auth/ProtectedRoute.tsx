import { Navigate, useLocation } from "react-router-dom";
import { dashboardPathForRole } from "../lib/api";
import type { UserRole } from "../types/user";
import { useAuth } from "./AuthContext";
import type { ReactNode } from "react";

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

export default function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-clinic-surface px-4 text-clinic-navy">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold shadow-soft ring-1 ring-slate-200">
          Checking access...
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  return children;
}
