import { redirect } from "next/navigation";

export default function FinancePage() {
  redirect("/admin/finance/payment-requests");
}
