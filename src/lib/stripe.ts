import Stripe from "stripe";
import { env } from "@/lib/env";

let _stripe: Stripe | null = null;
let _consistencyChecked = false;

export type StripeKeyMode = "test" | "live" | "unknown";

/**
 * Returns the mode (`test` / `live` / `unknown`) implied by a Stripe key
 * (secret or publishable) by inspecting its prefix.
 */
export function detectStripeKeyMode(key: string): StripeKeyMode {
  if (!key) return "unknown";
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_")) return "live";
  // sk_*_<id>_... restricted keys also start with sk_test/sk_live, covered above.
  return "unknown";
}

/**
 * Returns the active Stripe environment based on the secret key.
 */
export function getStripeMode(): StripeKeyMode {
  return detectStripeKeyMode(env.stripeSecret);
}

/**
 * Sanity-check the Stripe key configuration. Verifies that:
 *   - secret + publishable are both `test` or both `live` (no mixing)
 *   - the webhook secret prefix is recognisable
 *   - in `NODE_ENV=production` we are not running against test keys
 *   - in `NODE_ENV=development` we are not running against live keys
 *
 * This is non-fatal: on misconfiguration it returns { ok: false, ... } so
 * callers can decide whether to log, throw, or refuse to start.
 */
export function assertStripeKeysConsistent():
  | { ok: true; mode: StripeKeyMode }
  | { ok: false; reason: string; mode: StripeKeyMode } {
  const secretMode = detectStripeKeyMode(env.stripeSecret);
  const pubMode = detectStripeKeyMode(env.stripePublishable);

  if (secretMode === "unknown") {
    return {
      ok: false,
      mode: secretMode,
      reason:
        "STRIPE_SECRET_KEY is missing or has an unrecognised prefix (expected sk_test_/sk_live_).",
    };
  }
  if (pubMode !== "unknown" && pubMode !== secretMode) {
    return {
      ok: false,
      mode: secretMode,
      reason: `Stripe key mode mismatch: STRIPE_SECRET_KEY is "${secretMode}" but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is "${pubMode}". They must both be test or both live.`,
    };
  }
  if (env.stripeWebhookSecret && !env.stripeWebhookSecret.startsWith("whsec_")) {
    return {
      ok: false,
      mode: secretMode,
      reason: "STRIPE_WEBHOOK_SECRET is set but does not start with 'whsec_'.",
    };
  }
  if (process.env.NODE_ENV === "production" && secretMode === "test") {
    return {
      ok: false,
      mode: secretMode,
      reason:
        "Running in NODE_ENV=production with Stripe TEST keys. Set sk_live_/pk_live_/whsec_ for the live endpoint before going live.",
    };
  }
  if (process.env.NODE_ENV === "development" && secretMode === "live") {
    return {
      ok: false,
      mode: secretMode,
      reason:
        "Running in NODE_ENV=development with Stripe LIVE keys. This is almost certainly a misconfiguration.",
    };
  }
  return { ok: true, mode: secretMode };
}

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!env.stripeSecret) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to .env.local.");
  }

  if (!_consistencyChecked) {
    _consistencyChecked = true;
    const check = assertStripeKeysConsistent();
    if (!check.ok) {
      console.warn(`[stripe] ${check.reason}`);
    } else {
      console.log(`[stripe] initialised in ${check.mode} mode`);
    }
  }

  _stripe = new Stripe(env.stripeSecret, {
    // Pin an API version so the webhook payload shape is stable.
    // Cast is used so this file stays compatible across Stripe SDK updates.
    apiVersion: "2024-12-18.acacia" as Stripe.StripeConfig["apiVersion"],
    typescript: true,
  });
  return _stripe;
}
