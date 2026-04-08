import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import type { UserRecord } from "@/lib/types";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  created_at: string;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at,
  };
}

export async function getUserById(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, password_hash, salt, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapUser(data as UserRow) : null;
}

export async function getUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, password_hash, salt, created_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapUser(data as UserRow) : null;
}

export async function createUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: input.id,
      email: input.email,
      password_hash: input.passwordHash,
      salt: input.salt,
      created_at: input.createdAt,
    })
    .select("id, email, password_hash, salt, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapUser(data as UserRow);
}
