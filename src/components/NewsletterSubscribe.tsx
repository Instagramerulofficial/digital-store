"use client";

import { useState } from "react";
import { Loader2, Mail, Check } from "lucide-react";
import { toast } from "@/components/Toaster";

export default function NewsletterSubscribe({
  source = "home-hero",
  variant = "inline",
}: {
  source?: string;
  variant?: "inline" | "card";
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast("Please enter a valid email", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error ?? "Could not subscribe", "error");
        return;
      }
      setDone(true);
      toast("You're in — check your inbox for future updates", "success");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "card") {
    return (
      <div className="card p-6">
        <div
          className="inline-flex items-center justify-center h-10 w-10 rounded-xl mb-3 text-white"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
        >
          <Mail className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-lg">Get notified of new drops</h3>
        <p className="muted text-sm mt-1">
          One email when we ship a new AI-generated product. No spam, easy
          unsubscribe.
        </p>
        <FormBody
          email={email}
          setEmail={setEmail}
          busy={busy}
          done={done}
          onSubmit={onSubmit}
          className="mt-4"
        />
      </div>
    );
  }

  return (
    <FormBody
      email={email}
      setEmail={setEmail}
      busy={busy}
      done={done}
      onSubmit={onSubmit}
    />
  );
}

function FormBody({
  email,
  setEmail,
  busy,
  done,
  onSubmit,
  className = "",
}: {
  email: string;
  setEmail: (v: string) => void;
  busy: boolean;
  done: boolean;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
}) {
  if (done) {
    return (
      <div
        className={`flex items-center gap-2 text-sm ${className}`}
        style={{ color: "rgb(21 128 61)" }}
      >
        <Check className="h-4 w-4" />
        You&apos;re subscribed. Talk soon.
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <input
        type="email"
        placeholder="you@company.com"
        className="input flex-1"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy}
        className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Subscribe
      </button>
    </form>
  );
}
