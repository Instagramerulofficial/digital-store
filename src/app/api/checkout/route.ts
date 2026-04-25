import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import type { Product } from "@/types/db";

export const runtime = "nodejs";

const Body = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(99).optional().default(1),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  try {
    const parsed = Body.parse(await request.json());

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to purchase." },
        { status: 401 },
      );
    }

    const ids = parsed.items.map((i) => i.product_id);
    const admin = createSupabaseAdminClient();
    const { data: productsData, error: prodErr } = await admin
      .from("products")
      .select("*")
      .in("id", ids)
      .eq("is_published", true);
    if (prodErr) throw prodErr;

    const products = (productsData as Product[] | null) ?? [];
    if (products.length === 0) {
      return NextResponse.json(
        { error: "Those products are unavailable." },
        { status: 400 },
      );
    }

    // Map quantity by id (clamp to 1..99).
    const qtyById = new Map<string, number>();
    for (const it of parsed.items) {
      qtyById.set(
        it.product_id,
        Math.max(1, Math.min(99, it.quantity ?? 1)),
      );
    }

    const currency = products[0].currency || "usd";
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: products.map((p) => ({
        quantity: qtyById.get(p.id) ?? 1,
        price_data: {
          currency,
          unit_amount: p.price_cents,
          product_data: {
            name: p.title,
            images: p.image_url ? [p.image_url] : undefined,
            metadata: { product_id: p.id },
          },
        },
      })),
      metadata: {
        // Only user_id here. Line items + quantities are re-read from
        // Stripe in the webhook via `listLineItems({ expand: [...] })` so
        // we never hit the 500-char metadata value limit.
        user_id: user.id,
      },
      success_url: `${env.siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/checkout/cancel`,
    });

    // Track this as a pending checkout so the agent can follow up
    // with a recovery email if it never completes. Fire-and-forget —
    // a failure here must never block the Stripe session redirect.
    void admin
      .from("abandoned_checkouts")
      .insert({
        stripe_session_id: session.id,
        user_id: user.id,
        email: user.email ?? null,
        total_cents: products.reduce(
          (sum, p) => sum + p.price_cents * (qtyById.get(p.id) ?? 1),
          0,
        ),
        currency,
        product_ids: products.map((p) => p.id),
        status: "pending",
      })
      .then((r) => {
        if (r.error) {
          console.warn("[checkout] abandoned_checkouts insert:", r.error.message);
        }
      });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    const msg =
      err instanceof z.ZodError
        ? "Invalid request body"
        : err instanceof Error
          ? err.message
          : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
