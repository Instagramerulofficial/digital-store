import Link from "next/link";
import { ArrowRight, Download, ShieldCheck, Zap } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductCard from "@/components/ProductCard";
import NewsletterSubscribe from "@/components/NewsletterSubscribe";
import type { Product } from "@/types/db";

export const revalidate = 30;

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: featured }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("products")
      .select("category")
      .eq("is_published", true)
      .not("category", "is", null),
  ]);

  const products = (featured as Product[] | null) ?? [];

  const categoryCounts = new Map<string, number>();
  for (const row of categoryRows ?? []) {
    const c = (row as { category: string | null }).category;
    if (!c) continue;
    categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }
  const categories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-transparent to-transparent dark:from-brand-900/20"
        />
        <div className="container-page py-20 sm:py-28">
          <div className="max-w-2xl">
            <span className="badge">Instant delivery · No subscriptions</span>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">
              Premium digital products,{" "}
              <span className="text-brand-600 dark:text-brand-400">
                delivered instantly.
              </span>
            </h1>
            <p className="mt-5 text-lg muted">
              Templates, ebooks, UI kits and more. Buy once, download forever
              from your dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary">
                Browse products <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/signup" className="btn-secondary">
                Create an account
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Feature
              icon={<Zap className="h-5 w-5" />}
              title="Instant download"
              desc="Files are delivered the moment payment is confirmed."
            />
            <Feature
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Secure & private"
              desc="Downloads are protected by signed, time-limited URLs."
            />
            <Feature
              icon={<Download className="h-5 w-5" />}
              title="Re-download anytime"
              desc="Your purchases live forever in your dashboard."
            />
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="container-page py-14">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-semibold">Latest products</h2>
          <Link
            href="/products"
            className="text-sm text-brand-700 dark:text-brand-300 hover:underline"
          >
            View all →
          </Link>
        </div>
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No products yet"
            desc="Ask the admin to upload the first product."
          />
        )}
      </section>

      {/* Categories preview */}
      {categories.length > 0 && (
        <section className="container-page py-14">
          <h2 className="text-2xl font-semibold mb-6">Browse by category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map(([name, count]) => (
              <Link
                key={name}
                href={`/products?category=${encodeURIComponent(name)}`}
                className="card p-5 text-center hover:shadow-lg hover:-translate-y-0.5 transition"
              >
                <div className="mx-auto h-10 w-10 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 flex items-center justify-center font-semibold">
                  {name[0]}
                </div>
                <p className="font-medium mt-3">{name}</p>
                <p className="text-xs muted mt-1">
                  {count} {count === 1 ? "product" : "products"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="container-page py-12">
        <div className="max-w-xl mx-auto">
          <NewsletterSubscribe source="home-hero" variant="card" />
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-20">
        <div className="card relative overflow-hidden p-10 sm:p-14 text-center">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-600 to-brand-800 opacity-[0.08] dark:opacity-[0.15]"
          />
          <h3 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to start creating?
          </h3>
          <p className="muted mt-3 max-w-xl mx-auto">
            Join thousands of makers using our premium digital products to ship
            faster and look sharper.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/products" className="btn-primary">
              Shop the store
            </Link>
            <Link href="/signup" className="btn-secondary">
              Create account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        {icon}
      </div>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="text-sm muted mt-1">{desc}</p>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="muted text-sm mt-1">{desc}</p>
    </div>
  );
}
