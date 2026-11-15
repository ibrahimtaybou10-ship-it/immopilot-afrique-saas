import type { InvoiceStatus } from "@/lib/types";

interface Props {
  status: InvoiceStatus;
  overdue?: boolean;
}

export function StatusBadge({ status, overdue = false }: Props) {
  if (status === "PAID") {
    return (
      <span className="badge badge-green">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Payé
      </span>
    );
  }
  if (overdue) {
    return (
      <span className="badge badge-red">
        <span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />
        {status === "PARTIAL" ? "Partiel · en retard" : "En retard"}
      </span>
    );
  }
  if (status === "PARTIAL") {
    return (
      <span className="badge badge-amber">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Partiel
      </span>
    );
  }
  return (
    <span className="badge badge-slate">
      <span className="size-1.5 rounded-full bg-slate-400" aria-hidden="true" />
      En attente
    </span>
  );
}
