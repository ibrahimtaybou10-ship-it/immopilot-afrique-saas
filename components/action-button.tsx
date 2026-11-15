"use client";

import { useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

interface Props {
  /** Server Action déjà liée à ses arguments (ex. deleteUnitAction.bind(null, id)). */
  action: () => Promise<ActionResult>;
  /** Texte de confirmation affiché avant exécution (actions destructrices). */
  confirm?: string;
  className?: string;
  title?: string;
  children: ReactNode;
}

export function ActionButton({ action, confirm, className = "btn btn-secondary", title, children }: Props) {
  const [pending, startTransition] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const result = await action();
      if (result?.ok) toast.success(result.message ?? "Opération effectuée");
      else if (result) toast.error(result.error);
    });
  }

  return (
    <button type="button" className={className} title={title} disabled={pending} onClick={run}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
