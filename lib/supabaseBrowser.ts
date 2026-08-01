"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client (anon key), used ONLY for Realtime change signals. It cannot
// read the `players` table (no anon SELECT policy), so no answers/scores leak
// client-side. All real reads go through the gated GET /api/lobby/[code].
//
// Returns null when Supabase env vars are missing, so the UI can degrade to
// polling instead of crashing.
let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
