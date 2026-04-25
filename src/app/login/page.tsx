import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="container-page max-w-md py-16">
      <Suspense
        fallback={<div className="card h-[340px] animate-pulse" aria-hidden />}
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
