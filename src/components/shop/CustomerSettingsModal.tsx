"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { SuggestField } from "@/components/SuggestField";
import { DeliveryMethodSelect, type DeliveryMethod } from "@/components/shop/DeliveryMethodSelect";
import { RU_CITIES } from "@/content/ru-cities";
import { DELLIN_TERMINALS } from "@/content/dellin-terminals";
import { getMyProfile, updateMyProfile } from "@/actions/shop/settings";
import type { DELIVERY_METHOD_VALUES } from "@/lib/validators/customer-settings";

type AccountDeliveryMethod = (typeof DELIVERY_METHOD_VALUES)[number];

const DELIVERY_METHOD_FROM_ACCOUNT: Record<string, DeliveryMethod> = {
  ADDRESS: "address",
  TERMINAL: "terminal",
  PICKUP: "pickup",
};
const DELIVERY_METHOD_TO_ACCOUNT: Record<DeliveryMethod, AccountDeliveryMethod> = {
  address: "ADDRESS",
  terminal: "TERMINAL",
  pickup: "PICKUP",
};

export function CustomerSettingsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null);
  const [settlement, setSettlement] = useState("");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [apartment, setApartment] = useState("");
  const [terminal, setTerminal] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMyProfile().then((profile) => {
      if (cancelled) return;
      setLoading(false);
      if (!profile) return;
      setLastName(profile.lastName ?? "");
      setFirstName(profile.firstName ?? "");
      setEmail(profile.email ?? "");
      setCompanyName(profile.companyName);
      setDeliveryMethod(
        profile.deliveryMethod ? DELIVERY_METHOD_FROM_ACCOUNT[profile.deliveryMethod] : null
      );
      setSettlement(profile.settlement ?? "");
      setStreet(profile.street ?? "");
      setHouse(profile.house ?? "");
      setApartment(profile.apartment ?? "");
      setTerminal(profile.terminal ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const result = await updateMyProfile({
      lastName: lastName || undefined,
      firstName: firstName || undefined,
      email,
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined,
      deliveryMethod: deliveryMethod ? DELIVERY_METHOD_TO_ACCOUNT[deliveryMethod] : undefined,
      settlement: settlement || undefined,
      street: street || undefined,
      house: house || undefined,
      apartment: apartment || undefined,
      terminal: terminal || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSuccess(true);
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-xl font-bold">Настройки</h2>

      {loading ? (
        <p className="mt-4 text-sm text-foreground/50">Загрузка...</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-lastName" className="text-sm text-foreground/60">
                Фамилия
              </label>
              <input
                id="settings-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
              />
            </div>
            <div>
              <label htmlFor="settings-firstName" className="text-sm text-foreground/60">
                Имя
              </label>
              <input
                id="settings-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-email" className="text-sm text-foreground/60">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
            />
          </div>

          <div>
            <label className="text-sm text-foreground/60">Компания</label>
            <p className="mt-1 rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm text-foreground/60">
              {companyName ?? "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-currentPassword" className="text-sm text-foreground/60">
                Текущий пароль
              </label>
              <input
                id="settings-currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
              />
            </div>
            <div>
              <label htmlFor="settings-newPassword" className="text-sm text-foreground/60">
                Новый пароль
              </label>
              <input
                id="settings-newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
              />
            </div>
          </div>

          <div className="rounded-lg border border-foreground/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Тип доставки</span>
              <DeliveryMethodSelect value={deliveryMethod} onChange={setDeliveryMethod} />
            </div>

            {deliveryMethod === "terminal" && (
              <div className="mt-3 flex items-center gap-3">
                <label className="w-32 shrink-0 text-sm text-foreground/60">Терминал</label>
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
                    Населённый пункт
                  </label>
                  <SuggestField
                    value={settlement}
                    onChange={setSettlement}
                    allOptions={RU_CITIES}
                    placeholder="Начните вводить населённый пункт"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label htmlFor="settings-street" className="text-sm text-foreground/60">
                      Улица
                    </label>
                    <input
                      id="settings-street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                    />
                  </div>
                  <div className="w-24">
                    <label htmlFor="settings-house" className="text-sm text-foreground/60">
                      Дом
                    </label>
                    <input
                      id="settings-house"
                      value={house}
                      onChange={(e) => setHouse(e.target.value)}
                      className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                    />
                  </div>
                  <div className="w-32">
                    <label htmlFor="settings-apartment" className="text-sm text-foreground/60">
                      Офис/квартира
                    </label>
                    <input
                      id="settings-apartment"
                      value={apartment}
                      onChange={(e) => setApartment(e.target.value)}
                      className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Сохранено</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Сохраняем..." : "Сохранить"}
          </button>
        </form>
      )}
    </Modal>
  );
}
