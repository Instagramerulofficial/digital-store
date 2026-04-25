import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AiGeneratedProduct,
  Product,
  ProductVersion,
} from "@/types/db";
import EditProductForm from "./EditProductForm";

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const typedProduct = product as Product;

  let current: AiGeneratedProduct | null = null;
  if (typedProduct.current_version_id) {
    const { data: version } = await admin
      .from("product_versions")
      .select("*")
      .eq("id", typedProduct.current_version_id)
      .maybeSingle();
    current = (version as ProductVersion | null)?.generated_json ?? null;
  }

  const { data: versions } = await admin
    .from("product_versions")
    .select("id, version_no, notes, created_at")
    .eq("product_id", id)
    .order("version_no", { ascending: false })
    .limit(20);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 muted text-sm mb-4 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>
      <EditProductForm
        product={typedProduct}
        current={current}
        versions={(versions ?? []) as VersionSummary[]}
      />
    </div>
  );
}

export type VersionSummary = {
  id: string;
  version_no: number;
  notes: string | null;
  created_at: string;
};
