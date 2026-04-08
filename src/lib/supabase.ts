import "server-only";

import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  const value = process.env.SUPABASE_URL;

  if (!value) {
    throw new Error("Missing SUPABASE_URL environment variable.");
  }

  return value;
}

function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return value;
}

export function getSupabaseAdmin() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
