import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieName,
  getSessionMaxAge,
  hashPassword,
} from "@/lib/auth";
import { createUser, getUserByEmail } from "@/lib/users";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use at least 8 characters for the password." },
      { status: 400 },
    );
  }

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const credentials = hashPassword(password);
  const user = await createUser({
    id: randomUUID(),
    email,
    passwordHash: credentials.passwordHash,
    salt: credentials.salt,
    createdAt: new Date().toISOString(),
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  });

  response.cookies.set({
    name: getSessionCookieName(),
    value: createSessionToken(user.id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  });

  return response;
}
