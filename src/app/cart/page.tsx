"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/Toaster";

export default function CartPage() {
  const { items, remove, updateQuantity, subtotalCents, currency, clear } =
    useCart();
  const [loading, setLoading] = useState(false);

  async function checkout() {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id: i.id,
            quantity: i.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      if (json.url) window.location.href = json.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast(msg, "error");
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-semibold">Your cart</h1>

      {items.length === 0 ? (
        <div className="card p-10 mt-6 text-center">
          <p className="font-medium">Your cart is empty</p>
          <p className="muted text-sm mt-1">
            Nothing here yet —{" "}
            <Link
              href="/products"
              className="text-brand-700 dark:text-brand-300 hover:underline"
            >
              browse products
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div
            className="lg:col-span-2 card divide-y"
            style={{ borderColor: "rgb(var(--border))" }}
          >
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4">
                <Link
                  href={`/products/${item.slug}`}
                  className="relative h-16 w-16 rounded-md overflow-hidden bg-gray-100 dark:bg-zinc-800 shrink-0"
                >
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-brand-100 to-brand-300" />
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-medium truncate block hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm muted">
                    {formatPrice(item.price_cents, item.currency)} each
                  </p>
                </div>

                <div
                  className="inline-flex items-center rounded-lg border overflow-hidden"
                  style={{ borderColor: "rgb(var(--border))" }}
                >
                  <button
                    className="px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-sm tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    className="px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="w-24 text-right font-semibold">
                  {formatPrice(
                    item.price_cents * item.quantity,
                    item.currency,
                  )}
                </div>

                <button
                  onClick={() => remove(item.id)}
                  className="btn-ghost"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <aside className="card p-5 h-fit">
            <h2 className="font-semibold">Order summary</h2>
            <div className="flex justify-between mt-4 text-sm">
              <span className="muted">Subtotal</span>
              <span>{formatPrice(subtotalCents, currency)}</span>
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="muted">Taxes</span>
              <span className="muted">Calculated at checkout</span>
            </div>
            <hr className="my-4" style={{ borderColor: "rgb(var(--border))" }} />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(subtotalCents, currency)}</span>
            </div>

            <button
              onClick={checkout}
              disabled={loading}
              className="btn-primary w-full mt-5"
            >
              {loading ? (
                <>
                  <span className="spinner" /> Redirecting…
                </>
              ) : (
                "Checkout"
              )}
            </button>
            <button onClick={clear} className="btn-ghost w-full mt-2">
              Clear cart
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
