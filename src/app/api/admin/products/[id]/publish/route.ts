import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { renderProductPdf } from "@/lib/pdf/renderer";
import { slugify } from "@/lib/utils";
import { generatePostsForProduct } from "@/lib/agent/generator";
import {
  POST_CHANNELS,
  type AiGeneratedProduct,
  type Product,
} from "@/types/db";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Builds the PDF from the current version, uploads it to the private
 * Supabase bucket, records a `generated_assets` row, and flips the
 * product to `is_published = true`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  // 1. Load product + current version
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select(
      "id, slug, title, current_version_id, file_path, product_type, price_cents",
    )
    .eq("id", id)
    .maybeSingle();
  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.current_version_id) {
    return NextResponse.json(
      { error: "Product has no current version — cannot publish" },
      { status: 400 },
    );
  }
  if (!product.product_type) {
    return NextResponse.json(
      { error: "Product is missing product_type" },
      { status: 400 },
    );
  }
  if (product.price_cents <= 0) {
    return NextResponse.json(
      { error: "Set a non-zero price before publishing" },
      { status: 400 },
    );
  }

  const { data: version, error: vErr } = await admin
    .from("product_versions")
    .select("id, generated_json")
    .eq("id", product.current_version_id)
    .maybeSingle();
  if (vErr || !version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const generated = version.generated_json as AiGeneratedProduct;

  // 2. Render PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderProductPdf(generated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF rendering failed";
    console.error("[admin/publish] PDF render failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 3. Upload to storage (private bucket)
  const safeSlug = slugify(product.slug) || product.id;
  const filePath = `files/${safeSlug}.pdf`;
  const fileName = `${safeSlug}.pdf`;

  // Delete existing file at that path (we always re-generate fresh on publish)
  await admin.storage.from(env.supabaseBucket).remove([filePath]);

  const { error: upErr } = await admin.storage
    .from(env.supabaseBucket)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    console.error("[admin/publish] upload failed:", upErr);
    return NextResponse.json(
      { error: `Upload failed: ${upErr.message}` },
      { status: 500 },
    );
  }

  // 4. Record asset
  const { error: assetErr } = await admin.from("generated_assets").insert({
    product_id: product.id,
    version_id: version.id,
    kind: "pdf",
    file_path: filePath,
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    mime_type: "application/pdf",
  });
  if (assetErr) {
    console.warn("[admin/publish] asset insert warning:", assetErr.message);
  }

  // 5. Flip the product to published + patch file columns
  const { error: updErr } = await admin
    .from("products")
    .update({
      file_path: filePath,
      file_name: fileName,
      file_size_bytes: pdfBuffer.length,
      is_published: true,
    })
    .eq("id", product.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // 6. Kick off marketing-agent draft generation. We do this *after*
  // sending the success response — if OpenAI is down the publish still
  // succeeds. The drafts appear under /admin/agent on the next refresh.
  void generateAgentDraftsInBackground(product.id);

  return NextResponse.json({
    ok: true,
    file_path: filePath,
    file_size_bytes: pdfBuffer.length,
  });
}

/**
 * Fire-and-forget background job: generate draft marketing posts.
 * Errors are logged but never bubbled.
 */
async function generateAgentDraftsInBackground(productId: string) {
  try {
    if (!env.openaiApiKey) return;

    const admin = createSupabaseAdminClient();
    const { data: productData } = await admin
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();
    if (!productData) return;

    const results = await generatePostsForProduct(
      productData as Product,
      [...POST_CHANNELS],
    );
    const rows = results
      .filter((r) => r.post)
      .map((r) => ({
        product_id: productId,
        channel: r.channel,
        status: "draft" as const,
        subject: r.post!.subject,
        body: r.post!.body,
        media_url: r.post!.media_url,
      }));
    if (rows.length === 0) return;

    // Archive any prior drafts so we don't accumulate.
    await admin
      .from("agent_posts")
      .update({ status: "archived" })
      .eq("product_id", productId)
      .eq("status", "draft")
      .in("channel", rows.map((r) => r.channel));

    await admin.from("agent_posts").insert(rows);
  } catch (err) {
    console.warn("[agent] background draft generation failed:", err);
  }
}

/**
 * DELETE -> unpublish (keeps the PDF, flips the flag).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("products")
    .update({ is_published: false })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
