import { redirect } from "next/navigation";

/** Фонды moved to Финансы. */
export default function OldFundsPage() {
  redirect("/admin/finance/funds");
}
