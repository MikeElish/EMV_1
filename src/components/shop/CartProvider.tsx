"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: string;
  slug: string;
  sku: string;
  name: string;
  price: number; // kopecks, snapshot at time of adding
  quantity: number;
  /** A product with several supplier offers: the one picked (its own line). */
  offerId?: string;
  /** Shown in the cart next to the name, e.g. «Аналог, 7 дн.». */
  offerLabel?: string;
};

/** One cart line = one product + offer. */
export function cartKey(item: { productId: string; offerId?: string }) {
  return item.offerId ? `${item.productId}:${item.offerId}` : item.productId;
}

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  totalQuantity: number;
  totalAmount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "emv-shop-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore malformed/unavailable storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage write failures (private mode, quota, etc.)
    }
  }, [items, hydrated]);

  function addItem(item: Omit<CartItem, "quantity">, quantity: number) {
    setItems((prev) => {
      const key = cartKey(item);
      const existing = prev.find((i) => cartKey(i) === key);
      if (existing) {
        return prev.map((i) => (cartKey(i) === key ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { ...item, quantity }];
    });
  }

  function setQuantity(key: string, quantity: number) {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => cartKey(i) !== key)
        : prev.map((i) => (cartKey(i) === key ? { ...i, quantity } : i))
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => cartKey(i) !== key));
  }

  function clear() {
    setItems([]);
  }

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        setQuantity,
        removeItem,
        clear,
        totalQuantity,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
