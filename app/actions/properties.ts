"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SESSION_EXPIRED, dbError, fail, firstIssue, formObject } from "@/lib/action-utils";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { isUuid, propertySchema, unitSchema } from "@/lib/validation";

// Chaque écriture tient en UN appel SQL : la fonction appelée résout l'agence du compte,
// applique la RLS et le plafond de lots de l'offre, et s'exécute dans une seule transaction.

export async function createPropertyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = propertySchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);

  const { error } = await session.supabase.rpc("create_property_with_units", {
    p_name: v.name,
    p_property_type: v.property_type,
    p_address: v.address,
    p_city: v.city,
    p_units_count: v.units_count,
    p_unit_type: v.unit_type,
    p_base_rent: v.base_rent,
    p_charges_amount: v.charges_amount,
  });
  if (error) return fail(dbError(error));

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: `« ${v.name} » ajouté avec ${v.units_count} lot${v.units_count > 1 ? "s" : ""}.`,
  };
}

export async function createUnitAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = unitSchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);

  const { error } = await session.supabase.rpc("create_unit", {
    p_property_id: v.property_id,
    p_unit_number: v.unit_number,
    p_unit_type: v.unit_type,
    p_base_rent: v.base_rent,
    p_charges_amount: v.charges_amount,
  });
  if (error) return fail(dbError(error));

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Lot « ${v.unit_number} » ajouté.` };
}

export async function deleteUnitAction(unitId: string): Promise<ActionResult> {
  if (!isUuid(unitId)) return fail("Lot invalide.");
  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);

  // La contrainte de clé étrangère refuse la suppression d'un lot qui a porté un bail.
  const { data, error } = await session.supabase.from("units").delete().eq("id", unitId).select("id");
  if (error) {
    return fail(
      error.code === "23503" ? "Ce lot a un historique de baux : il ne peut pas être supprimé." : dbError(error),
    );
  }
  if (!data?.length) return fail("Lot introuvable.");

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Lot supprimé." };
}

export async function deletePropertyAction(propertyId: string): Promise<ActionResult> {
  if (!isUuid(propertyId)) return fail("Bien invalide.");
  const session = await getSession();
  if (!session) return fail(SESSION_EXPIRED);
  const { supabase } = session;

  // Garde-fou : supprimer un bien effacerait en cascade ses baux et tout l'historique des loyers.
  const { count } = await supabase
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  if ((count ?? 0) > 0) {
    return fail("Ce bien a un historique de baux et de loyers : il ne peut pas être supprimé.");
  }

  const { error } = await supabase.from("properties").delete().eq("id", propertyId);
  if (error) return fail(dbError(error));

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/properties");
}
