const RESERVED_USERNAMES = new Set(["admin", "administrator", "root"]);
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const OFFICIAL_PATTERN = /^[a-zA-Z0-9_]+\.off$/;

export function normalizeLoginUsername(input: unknown) {
  const username = String(input ?? "").trim().toLowerCase();

  if (!username) {
    throw new Error("Username is required.");
  }

  if (/\s/.test(username)) {
    throw new Error("Username cannot contain spaces.");
  }

  if (username.endsWith(".off") || username.endsWith(".pat")) {
    return username;
  }

  return `${username}.pat`;
}

export function normalizePatientRegistrationUsername(input: unknown) {
  const baseUsername = String(input ?? "").trim().toLowerCase();

  if (!baseUsername) {
    throw new Error("Username is required.");
  }

  if (/\s/.test(baseUsername)) {
    throw new Error("Username cannot contain spaces.");
  }

  if (baseUsername.includes(".") || baseUsername.endsWith(".pat") || baseUsername.endsWith(".off")) {
    throw new Error("Patient usernames must not include .pat or .off.");
  }

  if (RESERVED_USERNAMES.has(baseUsername)) {
    throw new Error("This username is reserved.");
  }

  if (!USERNAME_PATTERN.test(baseUsername)) {
    throw new Error("Username can only contain letters, numbers, and underscores.");
  }

  return `${baseUsername}.pat`;
}

export function normalizeOfficialUsername(input: unknown) {
  const username = String(input ?? "").trim().toLowerCase();
  const baseUsername = username.replace(/\.off$/, "");

  if (!username) {
    throw new Error("Username is required.");
  }

  if (/\s/.test(username)) {
    throw new Error("Username cannot contain spaces.");
  }

  if (!OFFICIAL_PATTERN.test(username)) {
    throw new Error("Official usernames must end with .off.");
  }

  if (RESERVED_USERNAMES.has(baseUsername)) {
    throw new Error("This username is reserved.");
  }

  return username;
}

export function validatePassword(input: unknown) {
  const password = String(input ?? "");

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return password;
}
