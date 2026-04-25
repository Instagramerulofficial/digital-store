import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import ClearCartOnMount from "./ClearCartOnMount";

export default function CheckoutSuccessPage() {
  return (
    <div className="container-page max-w-xl py-20">
      <ClearCartOnMount />
      <div className="card p-10 text-center">
        <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold">Thanks for your purchase!</h1>
        <p className="muted mt-2">
          We&apos;re processing your order. Your downloads will be available in
          your dashboard and a receipt has been emailed to you.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            Go to dashboard
          </Link>
          <Link href="/products" className="btn-secondary">
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
