import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Supabase client for Client Components.
 * Uses the anon key + reads/writes auth cookies via the browser.
 *
 * The instance is memoized per browser tab so we don't create a fresh
 * client (with its own auth listener / fetch state) on every call.
 * On the server we always return a new instance because there is no
 * persistent state to share across requests.
 *
 * If the `NEXT_PUBLIC_SUPABASE_*` variables are missing we throw a
 * clear, actionable error. A common cause is editing `.env.local`
 * without restarting `npm run dev` — Next.js only inlines
 * `NEXT_PUBLIC_*` variables into the client bundle at boot.
 */
let browserClient: SupabaseClient | null = null;

function assertEnv(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase client env is missing in src/lib/supabase/client.ts. " +
        "Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "are set in .env.local, then RESTART `npm run dev` " +
        "(NEXT_PUBLIC_* vars are only read at boot).",
    );
  }
}

export function createSupabaseBrowserClient(): SupabaseClient {
  assertEnv();
  if (typeof window === "undefined") {
    return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  if (!browserClient) {
    browserClient = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return browserClient;
}
