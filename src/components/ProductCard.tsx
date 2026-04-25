import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types/db";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group card overflow-hidden hover:shadow-lg transition"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-zinc-800">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover group-hover:scale-[1.03] transition"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand-100 to-brand-300" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium line-clamp-1">{product.title}</h3>
          <span className="text-sm font-semibold text-brand-700 dark:text-brand-300 whitespace-nowrap">
            {formatPrice(product.price_cents, product.currency)}
          </span>
        </div>
        {product.category && (
          <p className="text-xs muted mt-1">{product.category}</p>
        )}
        <p className="text-sm muted mt-2 line-clamp-2">{product.description}</p>
      </div>
    </Link>
  );
}
