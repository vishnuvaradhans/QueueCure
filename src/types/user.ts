export type UserRole = "PATIENT" | "OFFICIAL" | "ADMIN";
export type DetectedUserType = "official" | "patient" | "unknown";

export type AuthUser = {
  id: number;
  username: string;
  role: UserRole;
  createdAt: string;
};

export function detectUserType(userId: string): DetectedUserType {
  const normalizedId = userId.trim().toLowerCase();

  if (normalizedId.endsWith(".off")) {
    return "official";
  }

  if (normalizedId.endsWith(".pat")) {
    return "patient";
  }

  return "unknown";
}
