"use client";

import { useActionState, useEffect, useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

interface Props {
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  description?: string;
  action: FormAction;
  submitLabel?: string;
  size?: "md" | "lg";
  children: ReactNode;
}

/** Bouton + fenêtre modale (<dialog> natif) contenant un formulaire relié à une Server Action. */
export function ModalForm({
  trigger,
  triggerClassName = "btn btn-primary",
  title,
  description,
  action,
  submitLabel = "Enregistrer",
  size = "md",
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Enregistré");
      formRef.current?.reset();
      dialogRef.current?.close();
    }
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => dialogRef.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={dialogRef}
        className={`modal ${size === "lg" ? "modal-lg" : ""}`}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <form ref={formRef} onSubmit={onSubmit}>
          <header className="modal-head">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm -mr-2"
              aria-label="Fermer"
              onClick={() => dialogRef.current?.close()}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div className="modal-body">
            {children}
            {state && !state.ok ? (
              <p role="alert" className="alert-error">
                {state.error}
              </p>
            ) : null}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={() => dialogRef.current?.close()}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {submitLabel}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
