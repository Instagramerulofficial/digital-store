"use client";

import Link from "next/link";
import {
  ShoppingCart,
  User,
  LogOut,
  LayoutDashboard,
  Shield,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function Navbar() {
  const { items } = useCart();
  const count = items.reduce((n, i) => n + i.quantity, 0);

  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Theme state from <html>.
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setEmail(user?.email ?? null);
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();
        setIsAdmin(!!prof?.is_admin);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("ds-theme", next);
    } catch {}
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b surface" style={{ borderColor: "rgb(var(--border))" }}>
      <div className="container-page flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            D
          </span>
          <span>Digital Store</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/products" className="btn-ghost">Products</Link>
          {email && (
            <Link href="/dashboard" className="btn-ghost">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className="btn-ghost">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="btn-ghost"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <Link href="/cart" className="btn-ghost relative" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[10px] min-w-5 h-5 px-1 rounded-full inline-flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>

          {email ? (
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-sm muted max-w-[180px] truncate">{email}</span>
              <button onClick={signOut} className="btn-ghost" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary hidden sm:inline-flex">
              <User className="h-4 w-4" /> Sign in
            </Link>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden btn-ghost"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t surface" style={{ borderColor: "rgb(var(--border))" }}>
          <nav className="container-page py-3 flex flex-col">
            <Link href="/products" className="btn-ghost justify-start" onClick={() => setOpen(false)}>
              Products
            </Link>
            {email && (
              <Link href="/dashboard" className="btn-ghost justify-start" onClick={() => setOpen(false)}>
                Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="btn-ghost justify-start" onClick={() => setOpen(false)}>
                Admin
              </Link>
            )}
            {email ? (
              <button onClick={signOut} className="btn-ghost justify-start">
                Sign out
              </button>
            ) : (
              <Link href="/login" className="btn-ghost justify-start" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
