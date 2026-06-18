import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { findUserById, publicUser, type UserRecord, type UserRole } from "./db";

const JWT_SECRET = process.env.JWT_SECRET ?? "queuecure-dev-secret-change-me";
const TOKEN_TTL = "8h";
const SALT_ROUNDS = 12;

export type AuthenticatedRequest = Request & {
  user?: UserRecord;
};

type TokenPayload = {
  sub: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function issueToken(user: UserRecord) {
  return jwt.sign({ sub: String(user.id) }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function authenticate(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const header = request.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    response.status(401).json({ message: "Authentication is required." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    const user = findUserById(Number(payload.sub));

    if (!user) {
      response.status(401).json({ message: "Invalid authentication token." });
      return;
    }

    request.user = user;
    next();
  } catch {
    response.status(401).json({ message: "Invalid authentication token." });
  }
}

export function requireRoles(roles: UserRole[]) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({ message: "You do not have permission for this action." });
      return;
    }

    next();
  };
}

export function authResponse(user: UserRecord) {
  return {
    token: issueToken(user),
    user: publicUser(user),
  };
}
