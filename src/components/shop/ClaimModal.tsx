"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { createClaim } from "@/actions/shop/claims";
import { CLAIM_REASONS, MAX_CLAIM_PHOTOS } from "@/lib/validators/claims";

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";
/** Server actions take up to 20 MB in all. */
const MAX_TOTAL = 18 * 1024 * 1024;

/** «Возврат / рекламация» of a shipped line in «Мои заказы». */
export function ClaimModal({
  orderItemId,
  name,
  maxQuantity,
  onClose,
}: {
  orderItemId: string;
  name: string;
  maxQuantity: number;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (photos.length > MAX_CLAIM_PHOTOS) return setError(`Не больше ${MAX_CLAIM_PHOTOS} фото`);
    if (photos.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) return setError("Фото вместе больше 18 МБ — уменьшите их или выберите меньше");
    form.set("orderItemId", orderItemId);
    setError(null);
    startTransition(async () => {
      const r = await createClaim(form);
      if (!r.ok) setError(r.error);
      else setDone(r.number);
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-bold">Возврат / рекламация</h2>
      <p className="mt-1 text-sm text-foreground/60">{name}</p>
      {done ? (
        <>
          <p className="mt-4 text-sm text-green-600">
            Заявка № {done} принята. Мы рассмотрим её и напишем на e-mail; статус виден здесь, в «Мои заказы».
          </p>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
              Закрыть
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-foreground/60">Причина *</label>
              <select name="reason" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Выберите
                </option>
                {CLAIM_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground/60">Количество *</label>
              <input name="quantity" type="number" min={1} max={maxQuantity} defaultValue={maxQuantity} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-sm text-foreground/60">Что случилось *</label>
            <textarea
              name="description"
              required
              minLength={5}
              rows={4}
              placeholder="Опишите дефект или причину возврата; для брака — когда и на какой технике установлен"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm text-foreground/60">Фото (до {MAX_CLAIM_PHOTOS})</label>
            <input name="photos" type="file" accept="image/*" multiple className="mt-2 block w-full text-sm" />
          </div>
          <p className="text-xs text-foreground/50">
            Обмен и возврат — по условиям счёта: товар без следов установки и эксплуатации; брак — в течение гарантийного срока.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
              Отмена
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              {pending ? "Отправляем..." : "Отправить заявку"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
