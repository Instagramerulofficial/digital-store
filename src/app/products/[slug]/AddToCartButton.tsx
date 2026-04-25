"use client";

import { ShoppingCart, Check } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/types/db";

export default function AddToCartButton({ product }: { product: Product }) {
  const { add, items } = useCart();
  const inCart = items.some((i) => i.id === product.id);

  return (
    <>
      <button
        onClick={() =>
          add({
            id: product.id,
            slug: product.slug,
            title: product.title,
            price_cents: product.price_cents,
            currency: product.currency,
            image_url: product.image_url,
          })
        }
        className="btn-primary"
      >
        {inCart ? (
          <>
            <Check className="h-4 w-4" /> Add another
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" /> Add to cart
          </>
        )}
      </button>
      <Link href="/cart" className="btn-secondary">
        View cart
      </Link>
    </>
  );
}
