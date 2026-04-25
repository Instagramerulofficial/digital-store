import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBytes, formatPrice } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";
import AddToCartButton from "./AddToCartButton";
import type { Product } from "@/types/db";

export const revalidate = 30;

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) notFound();
  const product = data as Product;

  // Related products: same category, excluding the current one.
  let related: Product[] = [];
  if (product.category) {
    const { data: rel } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .eq("category", product.category)
      .neq("id", product.id)
      .limit(3);
    related = (rel as Product[] | null) ?? [];
  }
  if (related.length === 0) {
    const { data: rel } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .neq("id", product.id)
      .order("created_at", { ascending: false })
      .limit(3);
    related = (rel as Product[] | null) ?? [];
  }

  return (
    <div className="container-page py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="card overflow-hidden">
          <div className="relative aspect-[4/3] bg-gray-100 dark:bg-zinc-800">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.title}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-brand-100 to-brand-300" />
            )}
          </div>
        </div>

        <div>
          {product.category && (
            <span className="badge">{product.category}</span>
          )}
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3">
            {product.title}
          </h1>
          <p className="mt-2 text-2xl font-semibold text-brand-700 dark:text-brand-300">
            {formatPrice(product.price_cents, product.currency)}
          </p>

          <div className="mt-6 muted whitespace-pre-wrap leading-relaxed">
            {product.description}
          </div>

          <div className="mt-6 text-sm muted space-y-0.5">
            <div>
              <strong className="text-inherit">File:</strong> {product.file_name}
            </div>
            {product.file_size_bytes > 0 && (
              <div>
                <strong className="text-inherit">Size:</strong>{" "}
                {formatBytes(product.file_size_bytes)}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <AddToCartButton product={product} />
          </div>

          <p className="text-xs muted mt-6">
            Instant download after purchase · Access anytime from your dashboard.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-semibold">You may also like</h2>
            <Link
              href="/products"
              className="text-sm text-brand-700 dark:text-brand-300 hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
