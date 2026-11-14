"use server";
import { sendRentReminder } from "@/app/services/notifications";

export async function triggerRentReminderAction(payload: {
  tenantPhone: string;
  tenantName: string;
  amount: number;
  dueDate: string;
  periodLabel?: string;
}) {
  return await sendRentReminder(
    payload.tenantPhone,
    payload.tenantName,
    payload.amount,
    payload.dueDate,
    payload.periodLabel
  );
}
