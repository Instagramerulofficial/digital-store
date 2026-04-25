import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendOrderReceiptEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook.
 * - Verifies the signature with STRIPE_WEBHOOK_SECRET.
 * - Idempotent: checks stripe_session_id before inserting.
 * - On `checkout.session.completed`:
 *     1. creates `orders` + `order_items`
 *     2. grants `purchases` (one row per product)
 *     3. sends the receipt email with signed download links
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  if (!env.stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: STRIPE_WEBHOOK_SECRET not set" },
      { status: 500 },
    );
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      env.stripeWebhookSecret,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bad signature";
    console.error("[webhook] invalid signature:", msg);
    return NextResponse.json({ error: `Bad signature: ${msg}` }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] handler error:", err);
    const msg = err instanceof Error ? err.message : "Handler error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const admin = createSupabaseAdminClient();
  const stripe = getStripe();

  // Idempotency
  const { data: existing } = await admin
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) {
    console.log(`[webhook] order already exists for session ${session.id}`);
    return;
  }

  const userId = session.metadata?.user_id || null;
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    (userId ? await lookupEmail(userId) : null) ||
    "unknown@example.com";

  // Fetch authoritative line items from Stripe (no 500-char metadata limit).
  // The implicit Product created from `price_data.product_data` carries our
  // product_id in its metadata; expand so we can read it here.
  const li = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const parsedItems: { product_id: string; quantity: number }[] = [];
  for (const item of li.data) {
    const price = item.price;
    const product = price?.product;
    if (!product || typeof product === "string" || "deleted" in product) {
      continue;
    }
    const pid = product.metadata?.product_id;
    if (!pid) continue;
    parsedItems.push({
      product_id: pid,
      quantity: Math.max(1, item.quantity ?? 1),
    });
  }

  if (parsedItems.length === 0) {
    throw new Error("No line items could be resolved for this session");
  }

  const productIds = parsedItems.map((i) => i.product_id);
  const { data: products, error: prodErr } = await admin
    .from("products")
    .select("*")
    .in("id", productIds);
  if (prodErr) throw prodErr;
  if (!products || products.length === 0) throw new Error("Products not found");

  const byId = new Map(products.map((p) => [p.id, p]));
  const lineItems = parsedItems
    .map((it) => ({ ...it, product: byId.get(it.product_id) }))
    .filter((it): it is typeof it & { product: NonNullable<typeof it.product> } =>
      Boolean(it.product),
    );

  if (lineItems.length === 0) {
    throw new Error("No matching products found for this session");
  }

  // Prefer Stripe's authoritative amount_total (includes discounts etc.).
  const totalCents =
    session.amount_total ??
    lineItems.reduce(
      (s, it) => s + it.product.price_cents * it.quantity,
      0,
    );
  const currency = (
    session.currency ??
    lineItems[0]?.product?.currency ??
    "usd"
  ).toLowerCase();

  // 1) order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      email,
      status: "paid",
      total_cents: totalCents,
      currency,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
    })
    .select()
    .single();
  if (orderErr) throw orderErr;

  // 1b) Mark the matching abandoned_checkouts row as completed so the
  // recovery cron stops considering it.
  await admin
    .from("abandoned_checkouts")
    .update({ status: "completed" })
    .eq("stripe_session_id", session.id);

  // 2) order items
  const { error: itemsErr } = await admin.from("order_items").insert(
    lineItems.map((it) => ({
      order_id: order.id,
      product_id: it.product.id,
      title: it.product.title,
      unit_price_cents: it.product.price_cents,
      quantity: it.quantity,
    })),
  );
  if (itemsErr) throw itemsErr;

  // 3) purchases (access grants) - one per product, idempotent via unique key
  if (userId) {
    await admin.from("purchases").upsert(
      lineItems.map((it) => ({
        user_id: userId,
        product_id: it.product.id,
        order_id: order.id,
      })),
      { onConflict: "user_id,product_id" },
    );
  }

  // 4) receipt email with secure download links
  const downloads = lineItems.map((it) => ({
    title: it.product.title,
    url: `${env.siteUrl}/api/download/${it.product.id}`,
  }));
  await sendOrderReceiptEmail({
    to: email,
    orderId: order.id,
    totalCents,
    currency,
    downloads,
  });

  console.log(
    `[webhook] order ${order.id} created for ${email} (${lineItems.length} items)`,
  );
}

async function lookupEmail(userId: string): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    return (data?.email as string | undefined) ?? null;
  } catch {
    return null;
  }
}
