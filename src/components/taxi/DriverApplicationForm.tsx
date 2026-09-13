"use client";

import { useState, type FormEvent } from "react";
import { submitDriverApplication } from "@/actions/taxi/driver-application";

export function DriverApplicationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const experienceRaw = String(formData.get("drivingExperienceYears") ?? "").trim();

    const result = await submitDriverApplication({
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      drivingExperienceYears: experienceRaw ? Number(experienceRaw) : undefined,
      previousDriverExperience: formData.get("previousDriverExperience") === "yes",
      // the checkbox is `required`, so the browser blocks submission unless checked
      consent: true,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-foreground/10 p-6 text-center">
        <p className="font-medium">Спасибо! Заявка отправлена.</p>
        <p className="mt-2 text-sm text-foreground/60">
          Мы свяжемся с вами в ближайшее время.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="text-sm text-foreground/60">
          Имя *
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>
      <div>
        <label htmlFor="phone" className="text-sm text-foreground/60">
          Телефон *
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          placeholder="+7"
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>
      <div>
        <label
          htmlFor="drivingExperienceYears"
          className="text-sm text-foreground/60"
        >
          Водительский стаж (лет)
        </label>
        <input
          id="drivingExperienceYears"
          name="drivingExperienceYears"
          type="number"
          min={0}
          max={80}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>
      <div>
        <span className="text-sm text-foreground/60">
          Ранее работали водителем?
        </span>
        <div className="mt-1 flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="previousDriverExperience" value="yes" />
            Да
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="previousDriverExperience"
              value="no"
              defaultChecked
            />
            Нет
          </label>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-foreground/60">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        Нажимая на кнопку, вы соглашаетесь на обработку своих персональных
        данных, а также с пользовательским соглашением
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Отправляем..." : "Отправить"}
      </button>
    </form>
  );
}
