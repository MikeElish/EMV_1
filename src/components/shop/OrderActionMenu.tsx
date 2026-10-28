"use client";

import { useState } from "react";
import type { OrderDocumentCategory } from "@prisma/client";
import { ORDER_DOCUMENT_CATEGORY_LABELS } from "@/lib/validators/orders";
import { cancelMyOrder, cancelMyOrderItem } from "@/actions/shop/orders";
import { DropdownMenu } from "@/components/DropdownMenu";
import { Modal } from "@/components/Modal";
import { ClaimModal } from "@/components/shop/ClaimModal";

const DOCUMENT_CATEGORIES = Object.keys(
  ORDER_DOCUMENT_CATEGORY_LABELS
) as OrderDocumentCategory[];

export type LatestDocs = Record<
  OrderDocumentCategory,
  { fileUrl: string; fileName: string } | null
>;

export function OrderActionMenu({
  orderId,
  orderItemId,
  itemsCount,
  itemCancelled,
  latestDocs,
  claim,
}: {
  orderId: string;
  orderItemId: string;
  itemsCount: number;
  itemCancelled: boolean;
  latestDocs: LatestDocs;
  /** Shipped lines: «Возврат / рекламация» for the quantity not claimed yet, and the claims so far. */
  claim?: { name: string; left: number; existing: { number: number; status: string }[] };
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  async function cancelWholeOrder() {
    setConfirmOpen(false);
    setError(null);
    const result = await cancelMyOrder(orderId);
    if (!result.ok) setError(result.error);
  }

  async function cancelThisItem() {
    setConfirmOpen(false);
    setError(null);
    const result = await cancelMyOrderItem(orderItemId);
    if (!result.ok) setError(result.error);
  }

  function handleCancelClick(close: () => void) {
    close();
    if (itemsCount > 1) {
      setConfirmOpen(true);
    } else {
      void cancelWholeOrder();
    }
  }

  return (
    <div>
      <DropdownMenu
        label="Действие"
        buttonClassName="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs transition-opacity hover:opacity-80"
      >
        {(close) => (
          <>
            {DOCUMENT_CATEGORIES.map((category) => {
              const doc = latestDocs[category];
              return (
                <a
                  key={category}
                  href={doc?.fileUrl}
                  download={doc?.fileName}
                  onClick={(e) => {
                    if (!doc) e.preventDefault();
                    close();
                  }}
                  className={`block w-full px-3 py-2 text-left ${
                    doc ? "hover:bg-foreground/5" : "cursor-not-allowed text-foreground/30"
                  }`}
                >
                  {ORDER_DOCUMENT_CATEGORY_LABELS[category]}
                  {!doc && " (нет файла)"}
                </a>
              );
            })}
            {claim && claim.left > 0 && (
              <button
                type="button"
                onClick={() => {
                  close();
                  setClaiming(true);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
              >
                Возврат / рекламация
              </button>
            )}
            {!itemCancelled && (
              <button
                type="button"
                onClick={() => handleCancelClick(close)}
                className="block w-full px-3 py-2 text-left text-red-600 hover:bg-foreground/5"
              >
                Отмена
              </button>
            )}
          </>
        )}
      </DropdownMenu>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {claim?.existing.map((c) => (
        <p key={c.number} className="mt-1 whitespace-nowrap text-xs text-foreground/60">
          Заявка № {c.number}: {c.status}
        </p>
      ))}
      {claiming && claim && (
        <ClaimModal orderItemId={orderItemId} name={claim.name} maxQuantity={claim.left} onClose={() => setClaiming(false)} />
      )}

      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)} maxWidthClassName="max-w-sm">
          <h2 className="text-lg font-bold">Подтвердите отмену</h2>
          <p className="mt-2 text-sm text-foreground/60">
            В заказе несколько позиций. Отменить только эту позицию или весь заказ?
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => void cancelThisItem()}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            >
              Эта позиция
            </button>
            <button
              type="button"
              onClick={() => void cancelWholeOrder()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Весь заказ
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
