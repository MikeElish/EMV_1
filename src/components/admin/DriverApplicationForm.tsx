"use client";

import { useState, type FormEvent } from "react";
import type { AdminDriverApplicationInput } from "@/lib/validators/admin-driver-application";
import type { ActionResult } from "@/actions/admin/driver-applications";

export function DriverApplicationForm({
  initial,
  onSubmit,
  onSuccess,
}: {
  initial?: Partial<AdminDriverApplicationInput>;
  onSubmit: (input: AdminDriverApplicationInput) => Promise<ActionResult>;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const experienceRaw = String(formData.get("drivingExperienceYears") ?? "");

    const result = await onSubmit({
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      drivingExperienceYears: experienceRaw ? Number(experienceRaw) : undefined,
      previousDriverExperience: formData.get("previousDriverExperience") === "on",
      status: (String(formData.get("status") ?? "") || "NEW") as AdminDriverApplicationInput["status"],
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="text-sm text-foreground/60">
            Имя
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={initial?.name}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="phone" className="text-sm text-foreground/60">
            Телефон
          </label>
          <input
            id="phone"
            name="phone"
            required
            defaultValue={initial?.phone}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="drivingExperienceYears" className="text-sm text-foreground/60">
            Стаж, лет
          </label>
          <input
            id="drivingExperienceYears"
            name="drivingExperienceYears"
            type="number"
            min={0}
            defaultValue={initial?.drivingExperienceYears ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="status" className="text-sm text-foreground/60">
            Статус
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "NEW"}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          >
            <option value="NEW">Новая</option>
            <option value="CONTACTED">Связались</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="previousDriverExperience"
          defaultChecked={initial?.previousDriverExperience ?? false}
        />
        Ранее работал водителем
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
