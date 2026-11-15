"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import type { ReceiptData } from "@/lib/receipt";

interface Props {
  data: ReceiptData;
  className?: string;
  label?: string;
}

export function ReceiptButton({ data, className = "btn btn-secondary btn-sm", label = "Quittance PDF" }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const { downloadReceipt } = await import("@/lib/receipt");
      await downloadReceipt(data);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={download} disabled={busy} title="Télécharger la quittance en PDF">
      {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
      {failed ? "Échec, réessayer" : label}
    </button>
  );
}
