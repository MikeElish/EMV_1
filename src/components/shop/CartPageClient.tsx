"use client";

import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { formatRub } from "@/lib/money";
import { NewArrivalsRotator, type RotatorDirection } from "@/components/shop/NewArrivalsRotator";

export function CartPageClient({ directions }: { directions: RotatorDirection[] }) {
  const { items, setQuantity, removeItem, totalAmount } = useCart();

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
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">Корзина</h1>

      <ul className="mt-8 divide-y divide-foreground/10">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 py-4">
            <div className="flex-1">
              <Link
                href={`/shop/product/${item.slug}`}
                className="font-medium hover:underline"
              >
                {item.name}
              </Link>
              <p className="text-sm text-foreground/50">
                {formatRub(item.price)} · арт. {item.sku}
              </p>
            </div>

            <div className="flex items-center rounded-md border border-foreground/20">
              <button
                type="button"
                onClick={() => setQuantity(item.productId, item.quantity - 1)}
                className="px-3 py-1 text-foreground/60 hover:text-foreground"
                aria-label="Уменьшить количество"
              >
                −
              </button>
              <span className="w-8 text-center text-sm">{item.quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(item.productId, item.quantity + 1)}
                className="px-3 py-1 text-foreground/60 hover:text-foreground"
                aria-label="Увеличить количество"
              >
                +
              </button>
            </div>

            <p className="w-24 text-right font-medium">
              {formatRub(item.price * item.quantity)}
            </p>

            <button
              type="button"
              onClick={() => removeItem(item.productId)}
              className="text-foreground/40 hover:text-foreground"
              aria-label="Удалить товар"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-between border-t border-foreground/10 pt-6">
        <span className="text-lg font-semibold">Итого</span>
        <span className="text-lg font-semibold">{formatRub(totalAmount)}</span>
      </div>

      <Link
        href="/shop/checkout"
        className="mt-6 block w-full rounded-md bg-foreground px-6 py-3 text-center font-medium text-background transition-opacity hover:opacity-90"
      >
        Оформить заказ
      </Link>

      <div className="mt-16">
        <NewArrivalsRotator directions={directions} />
      </div>
    </section>
  );
}
