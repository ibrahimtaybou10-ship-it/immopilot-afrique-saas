"use client";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { triggerRentReminderAction } from "@/app/actions/notifications";

export function SendSmsReminderButton({ payment }: { payment: any }) {
  const [loading, setLoading] = useState(false);
  async function handleRemind() {
    setLoading(true);
    const res = await triggerRentReminderAction({
      tenantPhone: payment.phone || "+2250708441920",
      tenantName: payment.tenant_name,
      amount: Number(payment.expected_amount) - Number(payment.paid_amount || 0),
      dueDate: payment.due_date,
      periodLabel: payment.period_label,
    });
    setLoading(false);
    if (res.success) toast.success(`SMS de relance envoyé à ${payment.tenant_name}`);
    else toast.error("Échec de l'envoi du SMS");
  }
  return (
    <button onClick={handleRemind} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs font-semibold hover:bg-amber-100 disabled:opacity-60">
      <MessageSquare className="w-3.5 h-3.5" /> {loading ? "Envoi..." : "Relancer par SMS"}
    </button>
  );
}
