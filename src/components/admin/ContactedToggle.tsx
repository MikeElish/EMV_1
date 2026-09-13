"use client";

import { useTransition } from "react";
import { markDriverApplicationContacted } from "@/actions/admin/driver-applications";

export function ContactedToggle({
  applicationId,
  contacted,
}: {
  applicationId: string;
  contacted: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markDriverApplicationContacted(applicationId, !contacted);
        })
      }
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        contacted
          ? "bg-green-600/10 text-green-700 dark:text-green-500"
          : "bg-foreground/10 text-foreground/50"
      }`}
    >
      {contacted ? "Связались" : "Новая"}
    </button>
  );
}
