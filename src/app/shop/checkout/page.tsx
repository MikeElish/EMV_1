"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { createOrder } from "@/actions/shop/checkout";
import { getMyProfile } from "@/actions/shop/settings";
import { formatRub, formatRubPrecise } from "@/lib/money";
import { RU_CITIES } from "@/content/ru-cities";
import { DELLIN_TERMINALS } from "@/content/dellin-terminals";
import { SuggestField } from "@/components/SuggestField";
import {
  DeliveryMethodSelect,
  DELIVERY_LABELS,
  type DeliveryMethod,
} from "@/components/shop/DeliveryMethodSelect";

// Remembers delivery + contact info from the shopper's last completed order
// on this browser, so the next checkout starts pre-filled instead of blank.
const CHECKOUT_INFO_KEY = "emv-shop-checkout-info";

type SavedCheckoutInfo = {
  deliveryMethod: DeliveryMethod | null;
  settlement: string;
  street: string;
  house: string;
  apartment: string;
  terminal: string;
  customerName: string;
  phoneDigits: string;
  customerEmail: string;
};

// Maps the account's stored Prisma DeliveryMethod enum (uppercase) to this
// page's own lowercase string union.
const DELIVERY_METHOD_FROM_ACCOUNT: Record<string, DeliveryMethod> = {
  ADDRESS: "address",
  TERMINAL: "terminal",
  PICKUP: "pickup",
};

// Phone mask: typing 0-6 or 9 starts/extends the significant number; typing
// 7, 8, or anything non-numeric is treated as the (already implied) "+7 ("
// trunk prefix and doesn't get inserted -- covers "9...", "89...", "79...",
// "+79..." all normalizing to the same "+7 (XXX) XXX-XX-XX".
function digitsFromPhoneInput(raw: string): string {
  const allDigits = raw.replace(/\D/g, "");
  if (!allDigits) return "";
  const normalized =
    allDigits[0] === "7" || allDigits[0] === "8" ? allDigits.slice(1) : allDigits;
  return normalized.slice(0, 10);
}

function formatRuPhone(digits: string): string {
  let out = "+7 (" + digits.slice(0, 3);
  if (digits.length >= 3) out += ")";
  if (digits.length > 3) out += " " + digits.slice(3, 6);
  if (digits.length > 6) out += "-" + digits.slice(6, 8);
  if (digits.length > 8) out += "-" + digits.slice(8, 10);
  return out;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null);
  const [settlement, setSettlement] = useState("");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [apartment, setApartment] = useState("");
  const [terminal, setTerminal] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");

  const ndsAmount = Math.round(totalAmount * 0.22);

  useEffect(() => {
    let cancelled = false;

    let saved: Partial<SavedCheckoutInfo> = {};
    try {
      const raw = localStorage.getItem(CHECKOUT_INFO_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      // ignore malformed/unavailable storage
    }

    if (saved.customerName) setCustomerName(saved.customerName);
    if (saved.phoneDigits) {
      setPhoneDigits(saved.phoneDigits);
      setPhoneTouched(true);
    }
    if (saved.customerEmail) setCustomerEmail(saved.customerEmail);

    // A signed-in customer's saved delivery defaults (from "Настройки") take
    // priority over this browser's last-order memory; fall back to the
    // latter only when the account has no defaults saved.
    getMyProfile().then((profile) => {
      if (cancelled) return;
      const accountMethod = profile?.deliveryMethod
        ? DELIVERY_METHOD_FROM_ACCOUNT[profile.deliveryMethod]
        : null;
      if (accountMethod) {
        setDeliveryMethod(accountMethod);
        setSettlement(profile?.settlement ?? "");
        setStreet(profile?.street ?? "");
        setHouse(profile?.house ?? "");
        setApartment(profile?.apartment ?? "");
        setTerminal(profile?.terminal ?? "");
        return;
      }
      if (saved.deliveryMethod) setDeliveryMethod(saved.deliveryMethod);
      if (saved.settlement) setSettlement(saved.settlement);
      if (saved.street) setStreet(saved.street);
      if (saved.house) setHouse(saved.house);
      if (saved.apartment) setApartment(saved.apartment);
      if (saved.terminal) setTerminal(saved.terminal);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw.length === 0) {
      setPhoneDigits("");
      setPhoneTouched(false);
      return;
    }
    setPhoneTouched(true);
    setPhoneDigits(digitsFromPhoneInput(raw));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!deliveryMethod) {
      setError("Выберите способ доставки");
      return;
    }
    if (phoneDigits.length !== 10) {
      setError("Введите номер телефона полностью");
      return;
    }

    const deliveryNoteLines = [`Способ доставки: ${DELIVERY_LABELS[deliveryMethod]}`];
    if (deliveryMethod === "address") {
      if (settlement.trim()) deliveryNoteLines.push(`Населённый пункт: ${settlement.trim()}`);
      if (street.trim()) deliveryNoteLines.push(`Улица: ${street.trim()}`);
      if (house.trim()) deliveryNoteLines.push(`Дом: ${house.trim()}`);
      if (apartment.trim()) deliveryNoteLines.push(`Офис/квартира: ${apartment.trim()}`);
    }
    if (deliveryMethod === "terminal") {
      if (terminal.trim()) deliveryNoteLines.push(`Терминал: ${terminal.trim()}`);
    }

    setSubmitting(true);
    const result = await createOrder({
      customerName,
      customerPhone: formatRuPhone(phoneDigits),
      customerEmail,
      deliveryNote: deliveryNoteLines.join("\n"),
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    try {
      const toSave: SavedCheckoutInfo = {
        deliveryMethod,
        settlement,
        street,
        house,
        apartment,
        terminal,
        customerName,
        phoneDigits,
        customerEmail,
      };
      localStorage.setItem(CHECKOUT_INFO_KEY, JSON.stringify(toSave));
    } catch {
      // ignore storage write failures (private mode, quota, etc.)
    }

    clear();
    // Order numbers contain a literal "/" (ДДММГГ/N); /shop/order/[...orderNumber]
    // is a catch-all route so this naturally lands as two segments.
    router.push(`/shop/order/${result.orderNumber}`);
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Корзина пуста</h1>
        <Link
          href="/shop"
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          Перейти в каталог
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-bold">Оформление заказа</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Ваш заказ</h2>
          <div className="mt-3 rounded-lg border border-foreground/10 p-4 text-sm">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between py-1">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatRub(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-foreground/10 pt-2 font-semibold">
              <span>Итого</span>
              <span>{formatRub(totalAmount)}</span>
            </div>
            <div className="flex justify-between pt-1 text-foreground/50">
              <span>в т.ч. НДС 22%</span>
              <span>{formatRubPrecise(ndsAmount)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <h2 className="text-lg font-semibold">Дополнительная информация</h2>

          <div className="mt-3 rounded-lg border border-foreground/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Информация по доставке</span>
              <DeliveryMethodSelect value={deliveryMethod} onChange={setDeliveryMethod} />
            </div>

            {(deliveryMethod === "address" || deliveryMethod === "terminal") && (
              <p className="mt-4 border-t border-foreground/10 pt-4 text-sm text-foreground/50">
                Доставка осуществляется силами транспортной компании «Деловые
                линии»
              </p>
            )}

            {deliveryMethod === "terminal" && (
              <div className="mt-3 flex items-center gap-3">
                <label className="w-32 shrink-0 text-sm text-foreground/60">
                  Выберите терминал
                </label>
                <SuggestField
                  value={terminal}
                  onChange={setTerminal}
                  allOptions={DELLIN_TERMINALS}
                  placeholder="Начните вводить адрес терминала"
                />
              </div>
            )}

            {deliveryMethod === "address" && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="w-32 shrink-0 text-sm text-foreground/60">
                    Адрес доставки
                  </label>
                  <SuggestField
                    value={settlement}
                    onChange={setSettlement}
                    allOptions={RU_CITIES}
                    placeholder="Начните вводить населённый пункт"
                  />
                </div>

                {settlement.trim() && (
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label htmlFor="street" className="text-sm text-foreground/60">
                        Улица
                      </label>
                      <input
                        id="street"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                      />
                    </div>
                    <div className="w-24">
                      <label htmlFor="house" className="text-sm text-foreground/60">
                        Дом
                      </label>
                      <input
                        id="house"
                        value={house}
                        onChange={(e) => setHouse(e.target.value)}
                        className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                      />
                    </div>
                    <div className="w-32">
                      <label htmlFor="apartment" className="text-sm text-foreground/60">
                        Офис/квартира
                      </label>
                      <input
                        id="apartment"
                        value={apartment}
                        onChange={(e) => setApartment(e.target.value)}
                        className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-foreground/10 p-4">
            <span className="text-sm font-medium">Контактная информация</span>

            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="customerName" className="text-sm text-foreground/60">
                  Имя/Фамилия *
                </label>
                <input
                  id="customerName"
                  required
                  minLength={2}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                />
              </div>
              <div>
                <label htmlFor="customerPhone" className="text-sm text-foreground/60">
                  Телефон *
                </label>
                <input
                  id="customerPhone"
                  type="tel"
                  inputMode="numeric"
                  required
                  value={phoneTouched ? formatRuPhone(phoneDigits) : ""}
                  onChange={handlePhoneChange}
                  placeholder="+7 (___) ___-__-__"
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                />
              </div>
              <div>
                <label htmlFor="customerEmail" className="text-sm text-foreground/60">
                  E-mail *
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                />
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-md bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Оформляем..." : "Подтвердить заказ"}
          </button>
          <p className="mt-3 text-center text-xs text-foreground/40">
            Онлайн-оплата появится на следующем этапе — пока заказ передаётся
            менеджеру для подтверждения.
          </p>
        </form>
      </div>
    </section>
  );
}
