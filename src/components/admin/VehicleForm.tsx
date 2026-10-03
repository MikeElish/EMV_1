"use client";

import { useState, type FormEvent } from "react";
import type { ActionResult } from "@/actions/admin/vehicles";
import { VehicleDocumentsModal } from "@/components/admin/VehicleDocumentsModal";
import { LICENSE_PLATE_HINT, LICENSE_PLATE_PATTERN } from "@/lib/validators/taxi-fleet";

export type VehicleFormInitial = {
  brand?: string;
  model?: string;
  licensePlate?: string;
  vin?: string;
  color?: string;
  year?: number;
  ptsNumber?: string;
  ptsIssueDate?: string;
  stsNumber?: string;
  stsIssueDate?: string;
};

const inputClassName =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

export function VehicleForm({
  initial,
  onSubmit,
  onSuccess,
  vehicleId,
  vehicleName,
}: {
  initial?: VehicleFormInitial;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  onSuccess?: () => void;
  /** Only set when editing an existing vehicle -- shows the "Файлы" button. */
  vehicleId?: string;
  vehicleName?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await onSubmit(formData);

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
          <label htmlFor="brand" className="text-sm text-foreground/60">
            Марка
          </label>
          <input id="brand" name="brand" required defaultValue={initial?.brand} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="model" className="text-sm text-foreground/60">
            Модель
          </label>
          <input id="model" name="model" required defaultValue={initial?.model} className={inputClassName} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="licensePlate" className="text-sm text-foreground/60">
            Гос.номер
          </label>
          <input
            id="licensePlate"
            name="licensePlate"
            required
            placeholder="A123BC77"
            maxLength={9}
            pattern={LICENSE_PLATE_PATTERN}
            title={LICENSE_PLATE_HINT}
            autoComplete="off"
            defaultValue={initial?.licensePlate}
            onInput={(e) => {
              const input = e.currentTarget;
              const upper = input.value.toUpperCase();
              if (upper !== input.value) {
                const caret = input.selectionStart;
                input.value = upper;
                input.setSelectionRange(caret, caret);
              }
            }}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="vin" className="text-sm text-foreground/60">
            VIN-номер
          </label>
          <input id="vin" name="vin" required defaultValue={initial?.vin} className={inputClassName} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="color" className="text-sm text-foreground/60">
            Цвет
          </label>
          <input id="color" name="color" required defaultValue={initial?.color} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="year" className="text-sm text-foreground/60">
            Год выпуска
          </label>
          <input
            id="year"
            name="year"
            type="number"
            required
            defaultValue={initial?.year}
            className={inputClassName}
          />
        </div>
      </div>

      <fieldset className="rounded-md border border-foreground/10 p-3">
        <legend className="px-1 text-sm text-foreground/60">ПТС</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ptsNumber" className="text-sm text-foreground/60">
              Номер
            </label>
            <input
              id="ptsNumber"
              name="ptsNumber"
              required
              defaultValue={initial?.ptsNumber}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="ptsIssueDate" className="text-sm text-foreground/60">
              Дата выдачи
            </label>
            <input
              id="ptsIssueDate"
              name="ptsIssueDate"
              type="date"
              required
              defaultValue={initial?.ptsIssueDate}
              className={inputClassName}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-foreground/10 p-3">
        <legend className="px-1 text-sm text-foreground/60">СТС</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="stsNumber" className="text-sm text-foreground/60">
              Номер
            </label>
            <input
              id="stsNumber"
              name="stsNumber"
              required
              defaultValue={initial?.stsNumber}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="stsIssueDate" className="text-sm text-foreground/60">
              Дата выдачи
            </label>
            <input
              id="stsIssueDate"
              name="stsIssueDate"
              type="date"
              required
              defaultValue={initial?.stsIssueDate}
              className={inputClassName}
            />
          </div>
        </div>
      </fieldset>

      {!vehicleId && (
        <div>
          <label htmlFor="documents" className="text-sm text-foreground/60">
            Документы
          </label>
          <input
            id="documents"
            name="documents"
            type="file"
            multiple
            className="mt-1 w-full text-sm text-foreground/70"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Сохраняем..." : "Сохранить"}
        </button>
        {vehicleId && (
          <button
            type="button"
            onClick={() => setDocumentsOpen(true)}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Файлы
          </button>
        )}
      </div>

      {vehicleId && documentsOpen && (
        <VehicleDocumentsModal
          vehicleId={vehicleId}
          vehicleName={vehicleName ?? ""}
          onClose={() => setDocumentsOpen(false)}
        />
      )}
    </form>
  );
}
