import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="border-t surface"
      style={{ borderColor: "rgb(var(--border))" }}
    >
      <div className="container-page py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm muted">
        <p>© {new Date().getFullYear()} Digital Store. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/products" className="hover:underline">Products</Link>
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <span>Built with Next.js 15 · Supabase · Stripe</span>
        </div>
      </div>
    </footer>
  );
}
