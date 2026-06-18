import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPlaceholder from "./pages/DashboardPlaceholder";
import RegisterPage from "./pages/RegisterPage";
import OfficialDashboardPage from "./pages/OfficialDashboardPage";
import PatientDashboardPage from "./pages/PatientDashboardPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/official-dashboard"
          element={
            <ProtectedRoute allowedRoles={["OFFICIAL"]}>
              <OfficialDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-dashboard"
          element={
            <ProtectedRoute allowedRoles={["PATIENT"]}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <DashboardPlaceholder
                accent="blue"
                eyebrow="Admin Workspace"
                title="User Management Foundation"
              />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
