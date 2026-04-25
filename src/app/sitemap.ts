import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Re-build the sitemap at most once per hour. We read from Supabase, so
// this also keeps load on the DB low. We use a fresh anon client here
// (no cookies) so the route can be statically generated + ISR'd.
export const revalidate = 3600;

type SitemapProduct = {
  slug: string;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      return staticEntries;
    }
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(1000);

    const products = (data ?? []) as SitemapProduct[];
    productEntries = products
      .filter((p): p is SitemapProduct & { slug: string } => Boolean(p.slug))
      .map((p) => ({
        url: `${base}/products/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch (err) {
    // Never break the sitemap build because Supabase is unreachable.
    console.error("[sitemap] product fetch failed:", err);
  }

  return [...staticEntries, ...productEntries];
}
