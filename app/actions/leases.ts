"use server";

import { revalidatePath } from "next/cache";
import { SESSION_EXPIRED, dbError, fail, firstIssue, formObject } from "@/lib/action-utils";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { leaseSchema, terminateSchema } from "@/lib/validation";

/**
 * Locataire + bail + première échéance en un seul appel SQL (une transaction) :
 * si une étape échoue, rien n'est écrit — pas de locataire orphelin.
 */
export async function createLeaseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = leaseSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);

  const { error } = await session.supabase.rpc("create_lease_with_tenant", {
    p_unit_id: v.unit_id,
    p_full_name: v.full_name,
    p_phone: v.phone,
    p_start_date: v.start_date,
    p_monthly_rent: v.monthly_rent,
    p_charges_amount: v.charges_amount,
    p_deposit_amount: v.deposit_amount,
    p_due_day: v.due_day,
    p_email: v.email,
    p_profession: v.profession,
    p_id_card_number: v.id_card_number,
    p_arrears_amount: v.has_arrears ? v.arrears_amount : 0,
    p_arrears_note: v.has_arrears ? v.arrears_note : null,
  });
  if (error) {
    return fail(error.code === "23505" ? "Ce lot est déjà occupé par un bail actif." : dbError(error));
  }

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message:
      v.has_arrears && v.arrears_amount > 0
        ? `Bail créé pour ${v.full_name}, avec ${new Intl.NumberFormat("fr-FR").format(v.arrears_amount)} FCFA d'impayés à recouvrer.`
        : `Bail créé pour ${v.full_name}.`,
  };
}

export async function terminateLeaseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = terminateSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);

  const { data, error } = await session.supabase
    .from("leases")
    .update({ status: "TERMINATED", end_date: parsed.data.end_date, terminated_at: new Date().toISOString() })
    .eq("id", parsed.data.lease_id)
    .eq("status", "ACTIVE")
    .select("id");
  if (error) return fail(dbError(error));
  if (!data?.length) return fail("Ce bail est déjà résilié.");

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Bail résilié. Le lot est de nouveau disponible." };
}
