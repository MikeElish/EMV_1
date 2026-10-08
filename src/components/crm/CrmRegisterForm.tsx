"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerCustomer } from "@/actions/shop/auth";
import { digitsFromPhoneInput, formatRuPhone } from "@/lib/phone";
import { PERSONAL_DATA_CONSENT_URL } from "@/lib/legal-docs";

const fieldClass =
  "w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60";

/** Регистрация покупателя -- signed in right away, then as after «Войти». */
export function CrmRegisterForm({ customerNext }: { customerNext?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (k: string) => String(form.get(k) ?? "");
    if (value("password") !== value("password2")) {
      setError("Пароли не совпадают");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await registerCustomer({
      lastName: value("lastName"),
      firstName: value("firstName"),
      phone,
      email: value("email"),
      password: value("password"),
      personalDataConsent: form.get("consent") === "on",
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Signed in: the shop asks for the e-mail code, then everything works as usual.
    router.push(customerNext ?? "/shop");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <input name="lastName" placeholder="Фамилия" required autoFocus autoComplete="family-name" className={fieldClass} />
      <input name="firstName" placeholder="Имя" required autoComplete="given-name" className={fieldClass} />
      <input
        name="phone"
        placeholder="Телефон"
        required
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => {
          const digits = digitsFromPhoneInput(e.target.value);
          setPhone(digits ? formatRuPhone(digits) : "");
        }}
        className={fieldClass}
      />
      <input name="email" type="email" placeholder="Email (будет логином)" required autoComplete="email" className={fieldClass} />
      <input name="password" type="password" placeholder="Пароль (не короче 6 символов)" required minLength={6} autoComplete="new-password" className={fieldClass} />
      <input name="password2" type="password" placeholder="Повторите пароль" required minLength={6} autoComplete="new-password" className={fieldClass} />
      <label className="flex items-start gap-2 text-left text-xs leading-relaxed text-white/70">
        <input name="consent" type="checkbox" required className="mt-0.5" />
        <span>
          Даю{" "}
          <a href={PERSONAL_DATA_CONSENT_URL} target="_blank" rel="noopener" className="text-white underline underline-offset-2">
            согласие на обработку персональных данных
          </a>
        </span>
      </label>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {submitting ? "Регистрируем..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
