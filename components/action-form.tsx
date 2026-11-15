"use client";

import { useActionState, useTransition, type FormEvent, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { ActionResult } from "@/lib/types";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

interface Props {
  action: FormAction;
  submitLabel: string;
  children: ReactNode;
  className?: string;
  submitClassName?: string;
}

/**
 * Formulaire relié à une Server Action : état d'attente, erreur et confirmation affichés en ligne.
 * La soumission passe par une transition explicite pour conserver la saisie en cas d'erreur.
 */
export function ActionForm({ action, submitLabel, children, className = "space-y-4", submitClassName = "btn btn-primary w-full" }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className={className}>
      {children}
      {state && !state.ok ? (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p role="status" className="alert-success">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={submitClassName}>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
        {submitLabel}
      </button>
    </form>
  );
}
