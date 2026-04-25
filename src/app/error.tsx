"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="muted mt-2">{error.message || "Unexpected error"}</p>
      <button onClick={reset} className="btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}
