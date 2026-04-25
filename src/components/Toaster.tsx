"use client";

import { useCallback, useEffect, useState } from "react";

type Toast = { id: number; msg: string; kind: "info" | "error" | "success" };

type GlobalWithToast = typeof globalThis & {
  __toast?: (msg: string, kind?: Toast["kind"]) => void;
};

/**
 * Minimal global toast system.
 * Use `toast(msg, kind)` from anywhere (client-side only).
 */
export function toast(msg: string, kind: Toast["kind"] = "info") {
  if (typeof window === "undefined") return;
  (window as GlobalWithToast).__toast?.(msg, kind);
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    (window as GlobalWithToast).__toast = push;
    return () => {
      (window as GlobalWithToast).__toast = undefined;
    };
  }, [push]);

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={
            "px-4 py-2.5 rounded-lg shadow-lg text-sm text-white max-w-sm " +
            (t.kind === "error"
              ? "bg-red-600"
              : t.kind === "success"
                ? "bg-emerald-600"
                : "bg-zinc-900 dark:bg-zinc-700")
          }
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
