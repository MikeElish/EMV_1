"use client";

import { useState } from "react";
import type { OrderDocumentCategory } from "@prisma/client";
import { ORDER_DOCUMENT_CATEGORY_LABELS } from "@/lib/validators/orders";
import { cancelOrderAsStaff } from "@/actions/admin/orders";
import { OrderDocumentsModal } from "@/components/admin/OrderDocumentsModal";
import { DropdownMenu } from "@/components/DropdownMenu";

const DOCUMENT_CATEGORIES = Object.keys(
  ORDER_DOCUMENT_CATEGORY_LABELS
) as OrderDocumentCategory[];

export function OrderFilesMenu({ orderId }: { orderId: string }) {
  const [modalCategory, setModalCategory] = useState<OrderDocumentCategory | null>(null);

  function handleCancel(close: () => void) {
    close();
    if (confirm("Отменить этот заказ?")) {
      cancelOrderAsStaff(orderId);
    }
  }

  return (
    <>
      <DropdownMenu
        label="Файлы"
        buttonClassName="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs transition-opacity hover:opacity-80"
      >
        {(close) => (
          <>
            {DOCUMENT_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setModalCategory(category);
                  close();
                }}
                className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
              >
                {ORDER_DOCUMENT_CATEGORY_LABELS[category]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleCancel(close)}
              className="block w-full px-3 py-2 text-left text-red-600 hover:bg-foreground/5"
            >
              Отмена
            </button>
          </>
        )}
      </DropdownMenu>

      {modalCategory && (
        <OrderDocumentsModal
          orderId={orderId}
          category={modalCategory}
          onClose={() => setModalCategory(null)}
        />
      )}
    </>
  );
}
