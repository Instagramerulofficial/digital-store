import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * Defense-in-depth check: assert at runtime that the storage bucket
 * holding product files is PRIVATE. The whole `/api/download` flow
 * assumes signed URLs against a private bucket; if the bucket gets
 * accidentally flipped to public (a single Supabase Studio toggle),
 * every product file becomes downloadable by anyone who knows the
 * path — and `file_path` was previously leaked through the products
 * REST endpoint.
 *
 * Cached in-process for 5 minutes so we don't hammer the storage API
 * on every download click.
 */
type CacheEntry = { ok: true; expiresAt: number } | { ok: false; reason: string };

let cache: CacheEntry | null = null;
const TTL_MS = 5 * 60 * 1000;

export type BucketPrivacyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function assertProductsBucketIsPrivate(): Promise<BucketPrivacyResult> {
  const now = Date.now();
  if (cache && "ok" in cache && cache.ok && cache.expiresAt > now) {
    return { ok: true };
  }
  // Negative results are NOT cached — we want every request to surface the
  // misconfiguration in logs until it's fixed.

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.getBucket(env.supabaseBucket);

  if (error || !data) {
    return {
      ok: false,
      reason: `Bucket "${env.supabaseBucket}" not reachable: ${error?.message ?? "missing"}`,
    };
  }
  if (data.public) {
    return {
      ok: false,
      reason: `Bucket "${env.supabaseBucket}" is PUBLIC. Set Public = OFF in Supabase Storage.`,
    };
  }

  cache = { ok: true, expiresAt: now + TTL_MS };
  return { ok: true };
}

/** Test-only helper to clear the cached privacy decision. */
export function __resetBucketPrivacyCacheForTests() {
  cache = null;
}
