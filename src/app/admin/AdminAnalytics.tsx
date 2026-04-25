import {
  Package,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Users,
  Download as DownloadIcon,
  Tags,
  BarChart3,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { OrderStatus } from "@/types/db";

/* -------------------------------------------------------------
 * Data shapes produced by the admin page
 * ------------------------------------------------------------- */
export type AnalyticsKpis = {
  products: number;
  paidOrders: number;
  revenueCents: number;
  aovCents: number;
  customers: number;
  downloads: number;
};

export type RevenueBucket = {
  /** YYYY-MM-DD (UTC) */
  date: string;
  revenueCents: number;
  orders: number;
};

export type TopProduct = {
  id: string;
  title: string;
  units: number;
  revenueCents: number;
};

export type CategoryBreakdown = {
  category: string;
  units: number;
  revenueCents: number;
};

export type Analytics = {
  kpis: AnalyticsKpis;
  currency: string;
  revenueTimeline: RevenueBucket[];
  topProducts: TopProduct[];
  ordersByStatus: Record<OrderStatus, number>;
  byCategory: CategoryBreakdown[];
};

/* -------------------------------------------------------------
 * Main
 * ------------------------------------------------------------- */
export default function AdminAnalytics({ data }: { data: Analytics }) {
  const { kpis, currency, revenueTimeline, topProducts, ordersByStatus, byCategory } =
    data;

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          label="Products"
          value={String(kpis.products)}
        />
        <KpiCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Paid orders"
          value={String(kpis.paidOrders)}
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Revenue"
          value={formatPrice(kpis.revenueCents, currency)}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg order value"
          value={formatPrice(kpis.aovCents, currency)}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Customers"
          value={String(kpis.customers)}
        />
        <KpiCard
          icon={<DownloadIcon className="h-5 w-5" />}
          label="Downloads"
          value={String(kpis.downloads)}
        />
      </div>

      {/* Revenue chart (2/3) + orders by status (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueTimeline} currency={currency} />
        </div>
        <OrdersByStatusCard counts={ordersByStatus} />
      </div>

      {/* Top products + categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProductsCard items={topProducts} currency={currency} />
        <CategoriesCard items={byCategory} currency={currency} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
 * KPI card
 * ------------------------------------------------------------- */
function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide muted">{label}</span>
        <span className="text-brand-600 dark:text-brand-400">{icon}</span>
      </div>
      <p className="text-2xl font-semibold mt-2 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------
 * Revenue chart - pure SVG, 30 daily bars
 * ------------------------------------------------------------- */
function RevenueChart({
  data,
  currency,
}: {
  data: RevenueBucket[];
  currency: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.revenueCents));
  const total = data.reduce((s, d) => s + d.revenueCents, 0);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          <h3 className="font-semibold">Revenue — last 30 days</h3>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{formatPrice(total, currency)}</p>
          <p className="text-xs muted">
            {totalOrders} {totalOrders === 1 ? "order" : "orders"}
          </p>
        </div>
      </div>

      <div className="flex items-end gap-1 h-40">
        {data.map((d) => {
          const pct = (d.revenueCents / max) * 100;
          const hasData = d.revenueCents > 0;
          return (
            <div
              key={d.date}
              className="flex-1 group relative rounded-t transition-colors"
              style={{
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
              }}
              title={`${d.date} — ${formatPrice(d.revenueCents, currency)} • ${d.orders} ${
                d.orders === 1 ? "order" : "orders"
              }`}
            >
              <div
                className={
                  hasData
                    ? "w-full rounded-t bg-brand-500/80 hover:bg-brand-600 transition-colors"
                    : "w-full rounded-t"
                }
                style={{
                  height: hasData ? `${Math.max(pct, 2)}%` : "2px",
                  background: hasData ? undefined : "rgb(var(--border))",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs muted mt-2">
        <span>{data[0]?.date}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
 * Orders by status
 * ------------------------------------------------------------- */
const STATUS_META: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  paid: {
    label: "Paid",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  pending: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  failed: {
    label: "Failed",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  refunded: {
    label: "Refunded",
    className:
      "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

function OrdersByStatusCard({ counts }: { counts: Record<OrderStatus, number> }) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const statuses: OrderStatus[] = ["paid", "pending", "failed", "refunded"];

  return (
    <div className="card p-5 h-full">
      <h3 className="font-semibold mb-4">Orders by status</h3>
      {total === 0 ? (
        <p className="text-sm muted">No orders yet.</p>
      ) : (
        <ul className="space-y-3">
          {statuses.map((s) => {
            const n = counts[s] ?? 0;
            const pct = total > 0 ? (n / total) * 100 : 0;
            const meta = STATUS_META[s];
            return (
              <li key={s}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                  <span className="font-medium">{n}</span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgb(var(--border))" }}
                >
                  <div
                    className="h-full bg-brand-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------
 * Top products
 * ------------------------------------------------------------- */
function TopProductsCard({
  items,
  currency,
}: {
  items: TopProduct[];
  currency: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.revenueCents));

  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4">Top products</h3>
      {items.length === 0 ? (
        <p className="text-sm muted">No sales yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p, idx) => {
            const pct = (p.revenueCents / max) * 100;
            return (
              <li key={p.id}>
                <div className="flex items-center justify-between text-sm mb-1 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 text-[10px] font-semibold">
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium">{p.title}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold">
                      {formatPrice(p.revenueCents, currency)}
                    </div>
                    <div className="text-xs muted">
                      {p.units} {p.units === 1 ? "unit" : "units"}
                    </div>
                  </div>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgb(var(--border))" }}
                >
                  <div
                    className="h-full bg-brand-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------
 * Categories
 * ------------------------------------------------------------- */
function CategoriesCard({
  items,
  currency,
}: {
  items: CategoryBreakdown[];
  currency: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Tags className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <h3 className="font-semibold">Revenue by category</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm muted">No category data yet.</p>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left muted">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Units</th>
                <th className="pb-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.category}
                  className="border-t"
                  style={{ borderColor: "rgb(var(--border))" }}
                >
                  <td className="py-2">{c.category}</td>
                  <td className="py-2 text-right">{c.units}</td>
                  <td className="py-2 text-right font-medium">
                    {formatPrice(c.revenueCents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
