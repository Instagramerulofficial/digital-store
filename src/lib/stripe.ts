import Stripe from "stripe";
import { env } from "@/lib/env";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!env.stripeSecret) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to .env.local.");
  }
  _stripe = new Stripe(env.stripeSecret, {
    // Pin an API version so the webhook payload shape is stable.
    // Cast is used so this file stays compatible across Stripe SDK updates.
    apiVersion: "2024-12-18.acacia" as Stripe.StripeConfig["apiVersion"],
    typescript: true,
  });
  return _stripe;
}
