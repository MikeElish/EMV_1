"use client";

import { useState } from "react";
import { DropdownMenu } from "@/components/DropdownMenu";
import { OrderDeleteButton } from "@/components/admin/OrderDeleteButton";
import { OrderCardModal } from "@/components/admin/OrderCardModal";
import type { OrderRow } from "@/components/admin/OrdersTable";

export function OrderActionsMenu({
  order,
  itemId,
  managerName,
  onLogistics,
  canDelete = false,
}: {
  order: OrderRow;
  itemId?: string;
  managerName: string;
  onLogistics: () => void;
  canDelete?: boolean;
}) {
  const [showCard, setShowCard] = useState(false);

  return (
    <>
      <DropdownMenu
        label="Действие"
        buttonClassName="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs transition-opacity hover:opacity-80"
      >
        {(close) => (
          <>
            <button
              type="button"
              onClick={() => {
                close();
                onLogistics();
              }}
              className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
            >
              Логистика
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                setShowCard(true);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
            >
              Карточка
            </button>
            {canDelete && (
              <OrderDeleteButton
                orderId={order.id}
                orderNumber={order.orderNumber}
                itemId={itemId}
                lines={order.items.length}
                variant="menu"
              />
            )}
          </>
        )}
      </DropdownMenu>

      {showCard && <OrderCardModal order={order} managerName={managerName} onClose={() => setShowCard(false)} />}
    </>
  );
}
