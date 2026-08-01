import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client (service role). It BYPASSES row-level security, so it must
// only ever be imported from route handlers / server code, never from a
// "use client" file. The service-role key is not a NEXT_PUBLIC_ var, so it is
// never bundled for the browser.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
