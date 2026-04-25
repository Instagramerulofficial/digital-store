"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem } from "@/types/db";
import { toast } from "@/components/Toaster";

type CartContextType = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clear: () => void;
  subtotalCents: number;
  currency: string;
  count: number;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "digital-store:cart:v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const add = useCallback<CartContextType["add"]>((item, qty = 1) => {
    const safeQty = Math.max(1, Math.floor(qty));
    setItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        toast(`Updated "${item.title}" quantity`, "success");
        return prev.map((p) =>
          p.id === item.id ? { ...p, quantity: p.quantity + safeQty } : p,
        );
      }
      toast(`Added "${item.title}" to cart`, "success");
      return [...prev, { ...item, quantity: safeQty }];
    });
  }, []);

  const remove = useCallback<CartContextType["remove"]>((id) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateQuantity = useCallback<CartContextType["updateQuantity"]>(
    (id, qty) => {
      const safe = Math.max(1, Math.floor(qty));
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, quantity: safe } : p)),
      );
    },
    [],
  );

  const clear = useCallback(() => setItems([]), []);

  const subtotalCents = useMemo(
    () => items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0),
    [items],
  );

  const count = useMemo(
    () => items.reduce((n, i) => n + i.quantity, 0),
    [items],
  );

  const currency = items[0]?.currency ?? "usd";

  const value: CartContextType = {
    items,
    add,
    remove,
    updateQuantity,
    clear,
    subtotalCents,
    currency,
    count,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
