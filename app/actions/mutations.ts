"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { data: member } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase.from("properties").insert({
    agency_id: member?.agency_id,
    name: String(formData.get("name")),
    category: String(formData.get("category")),
    address: String(formData.get("address")),
    total_units: Number(formData.get("total_units") || 1),
    monthly_revenue: Number(formData.get("monthly_revenue") || 0),
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/properties");
  return { success: true };
}

export async function createTenantAndLease(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { data: member } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .single();

  const agencyId = member?.agency_id;
  const { data: tenant, error: tErr } = await supabase
    .from("lease_tenants")
    .insert({
      agency_id: agencyId,
      full_name: String(formData.get("full_name")),
      phone: String(formData.get("phone")),
      employer: String(formData.get("employer") || "Particulier"),
    })
    .select("id")
    .single();

  if (tErr || !tenant) return { success: false, error: tErr?.message || "Erreur locataire" };

  const { error: lErr } = await supabase.from("leases").insert({
    agency_id: agencyId,
    property_id: String(formData.get("property_id")),
    unit_id: String(formData.get("unit_id")),
    tenant_id: tenant.id,
    start_date: String(formData.get("start_date")),
    monthly_rent: Number(formData.get("monthly_rent")),
    deposit_amount: Number(formData.get("deposit_amount")),
    status: "ACTIVE",
  });

  if (lErr) return { success: false, error: lErr.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tenants");
  return { success: true };
}
