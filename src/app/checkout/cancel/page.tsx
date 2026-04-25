import Link from "next/link";
import { XCircle } from "lucide-react";

export default function CheckoutCancelPage() {
  return (
    <div className="container-page max-w-xl py-20">
      <div className="card p-10 text-center">
        <XCircle className="h-14 w-14 mx-auto text-red-500" />
        <h1 className="mt-4 text-2xl font-semibold">Checkout canceled</h1>
        <p className="muted mt-2">
          No worries — your cart is still here. You can continue when ready.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/cart" className="btn-primary">
            Return to cart
          </Link>
          <Link href="/products" className="btn-secondary">
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
