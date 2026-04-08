import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/users";
import type { PublicUser, UserRecord } from "@/lib/types";

const sessionCookieName = "masti_session";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;

function getSessionSecret() {
  return process.env.SESSION_SECRET || "dev-only-session-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, salt, 64).toString("hex");

  return {
    salt,
    passwordHash,
  };
}

export function verifyPassword(password: string, user: UserRecord) {
  const hashed = scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.passwordHash, "hex");

  if (hashed.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(hashed, stored);
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      expiresAt: Date.now() + sessionTtlMs,
    }),
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      expiresAt?: number;
    };

    if (!decoded.userId || !decoded.expiresAt || decoded.expiresAt < Date.now()) {
      return null;
    }

    return {
      userId: decoded.userId,
      expiresAt: decoded.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = readSessionToken(token);

  if (!session) {
    return null;
  }

  const user = await getUserById(session.userId);

  return user ? toPublicUser(user) : null;
}

export function getSessionCookieName() {
  return sessionCookieName;
}

export function getSessionMaxAge() {
  return Math.floor(sessionTtlMs / 1000);
}
