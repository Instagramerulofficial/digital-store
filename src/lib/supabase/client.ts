"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Supabase client for Client Components.
 * Uses the anon key + reads/writes auth cookies via the browser.
 *
 * If the `NEXT_PUBLIC_SUPABASE_*` variables are missing we throw a
 * clear, actionable error. A common cause is editing `.env.local`
 * without restarting `npm run dev` — Next.js only inlines
 * `NEXT_PUBLIC_*` variables into the client bundle at boot.
 */
export function createSupabaseBrowserClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase client env is missing. Check that NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local, then " +
        "RESTART `npm run dev` (NEXT_PUBLIC_* vars are only read at boot).",
    );
  }
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
