import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBytes, formatPrice } from "@/lib/utils";
import type { OrderStatus } from "@/types/db";

export const dynamic = "force-dynamic";

type PurchaseRow = {
  id: string;
  download_count: number;
  last_downloaded_at: string | null;
  created_at: string;
  product: {
    id: string;
    slug: string;
    title: string;
    image_url: string | null;
    file_name: string;
    file_size_bytes: number;
    price_cents: number;
    currency: string;
  } | null;
};

type OrderRow = {
  id: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  created_at: string;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: purchases }, { data: orders }] = await Promise.all([
    supabase
      .from("purchases")
      .select(
        "id, download_count, last_downloaded_at, created_at, product:products(id, slug, title, image_url, file_name, file_size_bytes, price_cents, currency)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, status, total_cents, currency, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const purchaseRows = (purchases as unknown as PurchaseRow[] | null) ?? [];
  const orderRows = (orders as unknown as OrderRow[] | null) ?? [];

  return (
    <div className="container-page py-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Your dashboard</h1>
          <p className="muted mt-1">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        </div>
        <Link href="/products" className="btn-secondary">
          Browse products
        </Link>
      </div>

      {/* Purchased products */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Your downloads</h2>
        {purchaseRows.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-medium">No purchases yet</p>
            <p className="muted text-sm mt-1">
              After you buy a product, it will appear here for instant download.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {purchaseRows.map((row) => {
              const p = row.product;
              if (!p) return null;
              return (
                <div
                  key={row.id}
                  className="card p-4 flex gap-4 items-center"
                >
                  <div className="relative h-16 w-16 rounded-md overflow-hidden bg-gray-100 dark:bg-zinc-800 shrink-0">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-brand-100 to-brand-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${p.slug}`}
                      className="font-medium truncate hover:underline block"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs muted">
                      {p.file_name}
                      {p.file_size_bytes
                        ? ` · ${formatBytes(p.file_size_bytes)}`
                        : ""}
                    </p>
                    {row.download_count > 0 && (
                      <p className="text-xs muted mt-0.5">
                        Downloaded {row.download_count}×
                      </p>
                    )}
                  </div>
                  <a
                    href={`/api/download/${p.id}`}
                    className="btn-primary shrink-0"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Order history */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Order history</h2>
        {orderRows.length === 0 ? (
          <div className="card p-6 text-sm muted">No orders yet.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead
                className="text-left"
                style={{ background: "rgb(var(--border) / 0.25)" }}
              >
                <tr>
                  <th className="px-4 py-2">Order</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t"
                    style={{ borderColor: "rgb(var(--border))" }}
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(o.total_cents, o.currency)}
                    </td>
                    <td className="px-4 py-2 muted">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    refunded: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
