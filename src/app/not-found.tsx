import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <p className="text-sm muted">404</p>
      <h1 className="text-5xl font-bold mt-2">Page not found</h1>
      <p className="mt-3 muted">
        We couldn&apos;t find what you were looking for.
      </p>
      <Link href="/" className="btn-primary mt-6 inline-flex">
        Go home
      </Link>
    </div>
  );
}
