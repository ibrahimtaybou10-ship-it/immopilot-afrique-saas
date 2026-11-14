import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: "Unauthorized Cron Trigger" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const periodLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 5).toISOString().slice(0, 10);

  const { data: activeLeases, error } = await supabase
    .from("leases")
    .select("*")
    .in("status", ["active", "ACTIVE"]);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const rows = (activeLeases || []).map((lease) => ({
    agency_id: lease.agency_id,
    lease_id: lease.id,
    period_label: periodLabel,
    due_date: dueDate,
    expected_amount: lease.monthly_rent,
    paid_amount: 0,
    status: "UNPAID",
  }));

  const { data: inserted, error: upsertErr } = await supabase
    .from("rent_payments")
    .upsert(rows, { onConflict: "lease_id,period_label", ignoreDuplicates: true })
    .select("id");

  if (upsertErr) return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ success: true, invoices_created: inserted?.length || 0 });
}
