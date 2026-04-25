import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertProductsBucketIsPrivate } from "@/lib/supabase/storage";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed-URL TTL in seconds.
 *
 * Kept intentionally short (5 min). The browser follows the 302
 * redirect immediately, so the URL only needs to survive the redirect
 * + the start of the actual file transfer. A short TTL drastically
 * narrows the "share the link with a friend" abuse window without
 * affecting any legitimate flow:
 *
 *   - Email links point at THIS endpoint (not at the signed URL),
 *     so the buyer always gets a fresh URL the moment they click.
 *   - Re-downloading from the dashboard generates a new URL every
 *     time as well.
 */
const SIGNED_URL_TTL = 5 * 60;

/**
 * Soft cap on per-purchase downloads. Acts as a tripwire against
 * credential / link sharing rather than as a hard quota for honest
 * users. Tunable via NEXT env in the future if needed.
 */
const MAX_DOWNLOADS_PER_PURCHASE = 100;

/**
 * Secure file download.
 *
 * Pipeline:
 *   1. Defense-in-depth: confirm the products bucket is still
 *      configured as PRIVATE (refuses to serve otherwise).
 *   2. Require an authenticated user (Supabase SSR cookies).
 *   3. Confirm a `purchases` row exists for (user_id, product_id) —
 *      this row is only ever inserted by the Stripe webhook after a
 *      verified `checkout.session.completed` event.
 *   4. Reject if the per-purchase download cap has been reached.
 *   5. Mint a short-lived signed URL via the service-role admin
 *      client (the only code path with READ access to file_path).
 *   6. Bump the download counter + append a row to the `downloads`
 *      audit table.
 *   7. Redirect the browser to the signed URL.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  // 1. Bucket privacy guard
  const privacy = await assertProductsBucketIsPrivate();
  if (!privacy.ok) {
    console.error("[download] BUCKET MISCONFIGURED:", privacy.reason);
    return NextResponse.json(
      { error: "Downloads are temporarily unavailable." },
      { status: 503 },
    );
  }

  // 2. Auth
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to download." },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();

  // 3. Paid-order verification (purchases row = proof of paid grant)
  const { data: grant, error: grantErr } = await admin
    .from("purchases")
    .select("id, download_count")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
  if (grantErr) {
    console.error("[download] grant lookup failed:", grantErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!grant) {
    return NextResponse.json(
      { error: "You don't own this product." },
      { status: 403 },
    );
  }

  // 4. Soft per-purchase cap
  if (grant.download_count >= MAX_DOWNLOADS_PER_PURCHASE) {
    console.warn(
      `[download] cap hit user=${user.id} product=${productId} count=${grant.download_count}`,
    );
    return NextResponse.json(
      {
        error:
          "Download limit reached for this product. Please contact support.",
      },
      { status: 429 },
    );
  }

  // 5. Look up the storage path. Must use the service-role admin
  // client because column-level SELECT on `file_path` is revoked
  // from anon + authenticated (see migration 0004).
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, file_path, file_name")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.file_path || product.file_path === "pending") {
    console.error(
      `[download] product ${productId} has no file_path uploaded yet`,
    );
    return NextResponse.json(
      { error: "This product is not ready for download yet." },
      { status: 503 },
    );
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(env.supabaseBucket)
    .createSignedUrl(product.file_path, SIGNED_URL_TTL, {
      download: product.file_name,
    });
  if (signErr || !signed) {
    console.error("[download] signing failed:", signErr);
    return NextResponse.json(
      { error: "Could not create download link." },
      { status: 500 },
    );
  }

  // 6. Audit + counter bump (best-effort — never block the redirect)
  const hdrs = request.headers;
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;

  await Promise.allSettled([
    admin
      .from("purchases")
      .update({
        download_count: grant.download_count + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq("id", grant.id),
    admin.from("downloads").insert({
      user_id: user.id,
      product_id: productId,
      purchase_id: grant.id,
      ip,
      user_agent: hdrs.get("user-agent"),
    }),
  ]);

  return NextResponse.redirect(signed.signedUrl);
}
