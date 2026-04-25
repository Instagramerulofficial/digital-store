import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/utils";
import type { OrderStatus, Product } from "@/types/db";
import AdminProductsPanel from "./AdminProductsPanel";
import AdminAnalytics, {
  type Analytics,
  type CategoryBreakdown,
  type RevenueBucket,
  type TopProduct,
} from "./AdminAnalytics";

export const dynamic = "force-dynamic";

const TIMELINE_DAYS = 30;

type OrderRow = {
  id: string;
  user_id: string | null;
  email: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  created_at: string;
};

type OrderItemRow = {
  order_id: string;
  product_id: string;
  title: string;
  unit_price_cents: number;
  quantity: number;
};

type OrderListRow = {
  id: string;
  email: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  created_at: string;
  order_items: { title: string }[] | null;
};

export default async function AdminPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [
    { count: productCount },
    { data: allOrders },
    { data: allOrderItems },
    { data: allProducts },
    { data: purchasesStats },
    { data: recentOrders },
  ] = await Promise.all([
    admin.from("products").select("*", { count: "exact", head: true }),
    admin
      .from("orders")
      .select("id, user_id, email, status, total_cents, currency, created_at"),
    admin
      .from("order_items")
      .select("order_id, product_id, title, unit_price_cents, quantity"),
    admin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false }),
    admin.from("purchases").select("download_count"),
    admin
      .from("orders")
      .select(
        "id, email, status, total_cents, currency, created_at, order_items(title)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const orders = (allOrders as OrderRow[] | null) ?? [];
  const items = (allOrderItems as OrderItemRow[] | null) ?? [];
  const productList = (allProducts as Product[] | null) ?? [];
  const orderList = (recentOrders as unknown as OrderListRow[] | null) ?? [];
  const paidOrders = orders.filter((o) => o.status === "paid");

  /* ---------------- KPIs ---------------- */
  const revenueCents = paidOrders.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const paidOrdersCount = paidOrders.length;
  const aovCents = paidOrdersCount > 0 ? Math.round(revenueCents / paidOrdersCount) : 0;
  const customers = new Set(
    paidOrders.map((o) => o.user_id ?? `guest:${o.email}`),
  ).size;
  const downloads = (purchasesStats ?? []).reduce(
    (s, r: { download_count: number }) => s + (r.download_count ?? 0),
    0,
  );
  const currency = (paidOrders[0]?.currency ?? "usd").toLowerCase();

  /* ---------------- Revenue timeline (last 30 days, UTC) ---------------- */
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const buckets = new Map<string, RevenueBucket>();
  for (let i = TIMELINE_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, revenueCents: 0, orders: 0 });
  }
  for (const o of paidOrders) {
    const key = new Date(o.created_at).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenueCents += o.total_cents ?? 0;
      bucket.orders += 1;
    }
  }
  const revenueTimeline: RevenueBucket[] = Array.from(buckets.values());

  /* ---------------- Top products ---------------- */
  // Build set of order_ids that are paid so we only count those.
  const paidOrderIds = new Set(paidOrders.map((o) => o.id));
  const productStats = new Map<
    string,
    { units: number; revenueCents: number; title: string }
  >();
  for (const it of items) {
    if (!paidOrderIds.has(it.order_id)) continue;
    const current = productStats.get(it.product_id) ?? {
      units: 0,
      revenueCents: 0,
      title: it.title,
    };
    current.units += it.quantity ?? 1;
    current.revenueCents += (it.unit_price_cents ?? 0) * (it.quantity ?? 1);
    current.title = it.title;
    productStats.set(it.product_id, current);
  }
  const topProducts: TopProduct[] = Array.from(productStats.entries())
    .map(([id, v]) => ({ id, title: v.title, units: v.units, revenueCents: v.revenueCents }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  /* ---------------- Orders by status ---------------- */
  const ordersByStatus: Record<OrderStatus, number> = {
    pending: 0,
    paid: 0,
    failed: 0,
    refunded: 0,
  };
  for (const o of orders) ordersByStatus[o.status] += 1;

  /* ---------------- Categories breakdown ---------------- */
  const productCategory = new Map<string, string>();
  for (const p of productList) {
    productCategory.set(p.id, (p.category ?? "Uncategorized").trim() || "Uncategorized");
  }
  const categoryMap = new Map<string, CategoryBreakdown>();
  for (const it of items) {
    if (!paidOrderIds.has(it.order_id)) continue;
    const cat = productCategory.get(it.product_id) ?? "Uncategorized";
    const current = categoryMap.get(cat) ?? {
      category: cat,
      units: 0,
      revenueCents: 0,
    };
    current.units += it.quantity ?? 1;
    current.revenueCents += (it.unit_price_cents ?? 0) * (it.quantity ?? 1);
    categoryMap.set(cat, current);
  }
  const byCategory: CategoryBreakdown[] = Array.from(categoryMap.values()).sort(
    (a, b) => b.revenueCents - a.revenueCents,
  );

  const analytics: Analytics = {
    kpis: {
      products: productCount ?? 0,
      paidOrders: paidOrdersCount,
      revenueCents,
      aovCents,
      customers,
      downloads,
    },
    currency,
    revenueTimeline,
    topProducts,
    ordersByStatus,
    byCategory,
  };

  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">Admin</h1>
          <p className="muted mt-1">Store analytics &amp; management.</p>
        </div>
      </div>

      {/* Analytics */}
      <AdminAnalytics data={analytics} />

      {/* Products CRUD */}
      <section className="mt-12 mb-12">
        <h2 className="text-xl font-semibold mb-4">Products</h2>
        <AdminProductsPanel products={productList} />
      </section>

      {/* Orders list */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent orders</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead
              className="text-left"
              style={{ background: "rgb(var(--border) / 0.25)" }}
            >
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {orderList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center muted">
                    No orders yet.
                  </td>
                </tr>
              )}
              {orderList.map((o) => (
                <tr
                  key={o.id}
                  className="border-t align-top"
                  style={{ borderColor: "rgb(var(--border))" }}
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    {o.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2">{o.email}</td>
                  <td className="px-4 py-2">
                    <ul className="space-y-0.5">
                      {(o.order_items ?? []).map((it, idx) => (
                        <li key={idx}>{it.title}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
                        o.status === "paid"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : o.status === "pending"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : o.status === "failed"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {formatPrice(o.total_cents, o.currency)}
                  </td>
                  <td className="px-4 py-2 muted">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
