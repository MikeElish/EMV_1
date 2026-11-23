"use client";

import { useState } from "react";
import { DropdownMenu } from "@/components/DropdownMenu";
import { SupplierOrderDeleteButton } from "@/components/admin/SupplierOrderDeleteButton";
import { SupplierOrderCardModal } from "@/components/admin/SupplierOrderCardModal";
import { TaskCreateModal } from "@/components/admin/TaskCreateModal";
import type { SupplierOrderRow } from "@/components/admin/SupplierOrdersTable";

export function SupplierOrderActionsMenu({
  row,
  onLogistics,
}: {
  row: SupplierOrderRow;
  onLogistics: () => void;
}) {
  const [showCard, setShowCard] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

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
              disabled={!row.purchaseId}
              className="block w-full px-3 py-2 text-left hover:bg-foreground/5 disabled:opacity-40"
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
            <button
              type="button"
              onClick={() => {
                close();
                setTaskOpen(true);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
            >
              Задача
            </button>
            <SupplierOrderDeleteButton id={row.id} variant="menu" />
          </>
        )}
      </DropdownMenu>

      {showCard && <SupplierOrderCardModal row={row} onClose={() => setShowCard(false)} />}
      {taskOpen && (
        <TaskCreateModal
          source={{
            basis: "INTERNAL",
            sourceType: "SUPPLIER_ORDER",
            sourceId: row.id,
            sourceNumber: row.buyerOrderNumber ?? row.purchaseNumber?.toString() ?? row.id,
          }}
          onClose={() => setTaskOpen(false)}
          onCreated={() => setTaskOpen(false)}
        />
      )}
    </>
  );
}
