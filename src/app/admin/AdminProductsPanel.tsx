"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, Pencil, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/Toaster";
import type { Product } from "@/types/db";

export default function AdminProductsPanel({
  products,
}: {
  products: Product[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  function openNew() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setShowForm(true);
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setLoading(true);
    const res = await fetch(`/api/admin/products?id=${id}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j.error ?? "Delete failed", "error");
      return;
    }
    toast("Product deleted", "success");
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="muted text-sm">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/admin/generate"
            className="btn-primary inline-flex items-center gap-1"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
          >
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Link>
          <Link
            href="/admin/agent"
            className="btn-ghost inline-flex items-center gap-1"
          >
            <Bot className="h-4 w-4" /> Marketing agent
          </Link>
          <button onClick={openNew} className="btn-ghost inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> Upload manually
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead
            className="text-left"
            style={{ background: "rgb(var(--border) / 0.25)" }}
          >
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Published</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center muted">
                  No products yet. Click &quot;New product&quot; to add one.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr
                key={p.id}
                className="border-t"
                style={{ borderColor: "rgb(var(--border))" }}
              >
                <td className="px-4 py-2">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs muted font-mono">{p.slug}</div>
                </td>
                <td className="px-4 py-2">{p.category ?? "—"}</td>
                <td className="px-4 py-2">
                  {formatPrice(p.price_cents, p.currency)}
                </td>
                <td className="px-4 py-2">
                  {p.is_published ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      live
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      draft
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {p.product_type ? (
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="btn-ghost"
                      title="Open AI editor"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Link>
                  ) : null}
                  <button
                    onClick={() => openEdit(p)}
                    className="btn-ghost"
                    title="Quick edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    disabled={loading}
                    className="btn-ghost text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductForm
          editing={editing}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductForm({
  editing,
  onClose,
  onSuccess,
}: {
  editing: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    try {
      let res: Response;
      if (editing) {
        const body = {
          id: editing.id,
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          category: String(form.get("category") ?? ""),
          image_url: String(form.get("image_url") ?? ""),
          price_cents: Math.round(
            parseFloat(String(form.get("price") ?? "0")) * 100,
          ),
          is_published: form.get("is_published") === "on",
        };
        res = await fetch("/api/admin/products", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/admin/products", {
          method: "POST",
          body: form,
        });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast(editing ? "Product updated" : "Product created", "success");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="card w-full max-w-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {editing ? "Edit product" : "New product"}
          </h3>
          <button type="button" onClick={onClose} className="btn-ghost">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="label">Title</label>
          <input
            name="title"
            required
            defaultValue={editing?.title ?? ""}
            className="input"
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            name="description"
            rows={5}
            defaultValue={editing?.description ?? ""}
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Price (USD)</label>
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={
                editing ? (editing.price_cents / 100).toFixed(2) : ""
              }
              className="input"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <input
              name="category"
              defaultValue={editing?.category ?? ""}
              className="input"
              placeholder="Templates"
            />
          </div>
        </div>

        <div>
          <label className="label">Cover image URL</label>
          <input
            name="image_url"
            type="url"
            defaultValue={editing?.image_url ?? ""}
            className="input"
            placeholder="https://..."
          />
        </div>

        {!editing && (
          <div>
            <label className="label">Digital file</label>
            <input
              name="file"
              type="file"
              required
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-600 file:text-white hover:file:bg-brand-700"
            />
            <p className="text-xs muted mt-1">
              Stored privately in Supabase Storage. Delivered via signed URLs.
            </p>
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={editing ? editing.is_published : true}
            className="h-4 w-4"
          />
          Published
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <span className="spinner" /> Saving…
              </>
            ) : editing ? (
              "Save changes"
            ) : (
              "Create product"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
