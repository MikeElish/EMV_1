"use client";

import { useState, type FormEvent } from "react";
import type { BrandInput } from "@/lib/validators/brand";
import type { ActionResult } from "@/actions/admin/brands";

export function BrandForm({
  initial,
  onSubmit,
  onSuccess,
}: {
  initial?: BrandInput;
  onSubmit: (input: BrandInput) => Promise<ActionResult>;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await onSubmit({
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      isActive: formData.get("isActive") === "on",
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
      <div>
        <label htmlFor="name" className="text-sm text-foreground/60">
          Название
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
        <label htmlFor="slug" className="text-sm text-foreground/60">
          Slug (латиницей, для URL)
        </label>
        <input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9-]+"
          defaultValue={initial?.slug}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="h-4 w-4"
        />
        Активен на сайте
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
