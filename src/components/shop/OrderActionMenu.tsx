"use client";

import { useState } from "react";
import type { OrderDocumentCategory } from "@prisma/client";
import { ORDER_DOCUMENT_CATEGORY_LABELS } from "@/lib/validators/orders";
import { cancelMyOrder } from "@/actions/shop/orders";
import { DropdownMenu } from "@/components/DropdownMenu";

const DOCUMENT_CATEGORIES = Object.keys(
  ORDER_DOCUMENT_CATEGORY_LABELS
) as OrderDocumentCategory[];

export type LatestDocs = Record<
  OrderDocumentCategory,
  { fileUrl: string; fileName: string } | null
>;

export function OrderActionMenu({
  orderId,
  latestDocs,
}: {
  orderId: string;
  latestDocs: LatestDocs;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(close: () => void) {
    close();
    setError(null);
    const result = await cancelMyOrder(orderId);
    if (!result.ok) setError(result.error);
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

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
