import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types/db";
import ProductsFilters from "./ProductsFilters";

export const revalidate = 0;

type RawSearchParams = {
  [key: string]: string | string[] | undefined;
};

function firstValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const q = firstValue(sp.q);
  const category = firstValue(sp.category);
  const sort = firstValue(sp.sort);

  const supabase = await createSupabaseServerClient();

  let query = supabase.from("products").select("*").eq("is_published", true);

  if (q) {
    // Strip PostgREST filter-syntax specials so user input can't break `.or()`.
    const term = q.trim().replace(/[%,()"'\\]/g, " ").replace(/\s+/g, " ").trim();
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,description.ilike.%${term}%`,
      );
    }
  }
  if (category) query = query.eq("category", category);

  switch (sort) {
    case "price_asc":
      query = query.order("price_cents", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_cents", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  const products = (data as Product[] | null) ?? [];

  const { data: catData } = await supabase
    .from("products")
    .select("category")
    .eq("is_published", true)
    .not("category", "is", null);

  const categories = Array.from(
    new Set(
      ((catData ?? []) as { category: string | null }[])
        .map((r) => r.category)
        .filter((c): c is string => !!c),
    ),
  ).sort();

  return (
    <div className="container-page py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">All products</h1>
          <p className="muted mt-1">
            {products.length} {products.length === 1 ? "result" : "results"}
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div
            className="card h-[68px] animate-pulse"
            aria-hidden
          />
        }
      >
        <ProductsFilters categories={categories} />
      </Suspense>

      {error && (
        <div className="card p-6 mt-8 text-red-600 dark:text-red-400 text-sm">
          Failed to load products: {error.message}
        </div>
      )}

      {products.length === 0 && !error ? (
        <div className="card p-10 text-center mt-8">
          <p className="font-medium">No products match your filters</p>
          <p className="muted text-sm mt-1">Try clearing the search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
