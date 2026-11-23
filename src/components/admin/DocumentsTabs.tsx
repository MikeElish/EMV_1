"use client";

import { useState } from "react";
import { CrmPage } from "@/components/admin/CrmTableFrame";

const TABS = [
  { key: "main", label: "Документооборот" },
  { key: "contracts", label: "Договоры" },
  { key: "templates", label: "Шаблоны" },
  { key: "sz", label: "СЗ" },
  { key: "orders", label: "Приказы" },
  { key: "letters", label: "Письма" },
];

export function DocumentsTabs() {
  const [tab, setTab] = useState("main");
  return (
    <CrmPage>
      <h1 className="text-2xl font-bold">Документооборот</h1>
      <div className="mt-4 flex flex-wrap gap-2 border-b border-foreground/10 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === t.key ? "bg-foreground/10 text-foreground" : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6 flex h-40 items-center justify-center text-foreground/40">
        Раздел «{TABS.find((t) => t.key === tab)?.label}» в разработке
      </div>
    </CrmPage>
  );
}
