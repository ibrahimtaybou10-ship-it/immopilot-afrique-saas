"use server";

import { revalidatePath } from "next/cache";
import { dbError, fail, firstIssue, formObject } from "@/lib/action-utils";
import { getAgencyContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";
import { agencySchema } from "@/lib/validation";

export async function updateAgencyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = agencySchema.safeParse(formObject(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { supabase, agency, role } = await getAgencyContext();
  if (role !== "OWNER" && role !== "ADMIN") return fail("Seul un administrateur peut modifier ces informations.");

  const { data, error } = await supabase.from("agencies").update(parsed.data).eq("id", agency.id).select("id");
  if (error) return fail(dbError(error));
  if (!data?.length) return fail("Action non autorisée.");

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Paramètres enregistrés." };
}
