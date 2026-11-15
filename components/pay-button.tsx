"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Smartphone } from "lucide-react";
import { startRentCheckoutAction } from "@/app/actions/billing";

export function PayButton({ token, label }: { token: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    startTransition(async () => {
      const result = await startRentCheckoutAction(token);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <button type="button" className="btn btn-accent w-full py-3.5 text-base" disabled={pending} onClick={pay}>
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Smartphone className="size-5" aria-hidden="true" />}
        {label}
      </button>
      {error ? (
        <p role="alert" className="alert-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
