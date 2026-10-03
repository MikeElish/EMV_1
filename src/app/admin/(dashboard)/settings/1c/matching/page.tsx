import Link from "next/link";
import { getMatchingOverview } from "@/actions/admin/onec-sync";
import { OneCMatchingBoard } from "@/components/admin/OneCMatchingBoard";

export default async function OneCMatchingPage() {
  return (
    <div>
      <Link href="/admin/settings/1c" className="text-sm text-foreground/60 underline underline-offset-4">
        ← Доступ к 1С
      </Link>
      <div className="mt-4">
        <OneCMatchingBoard overview={await getMatchingOverview()} />
      </div>
    </div>
  );
}
