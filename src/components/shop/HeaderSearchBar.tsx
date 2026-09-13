"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { utils, write } from "xlsx";
import { BRANDS } from "@/content/brands";
import { bulkSearchProducts } from "@/actions/shop/bulk-search";

const ROW_HEIGHT = 40; // px
const CYCLE_MS = 4000;
const TRANSITION_MS = 500;
const SLIDE_COUNT = 3;

function buildInvoiceTemplateHref(): string {
  const mainSheet = utils.aoa_to_sheet([["Бренд", "Артикул", "Количество"]]);

  const rulesSheet = utils.aoa_to_sheet([["Бренд"], ...BRANDS.map((brand) => [brand])]);
  utils.sheet_add_aoa(
    rulesSheet,
    [
      ["ВАЖНО!"],
      ["1.Для корректного поиска используйте бренды из данного списка"],
      [
        "2.В артикуле товара не должны использоваться символы или пробелы. Используются только цифры и латинские буквы",
      ],
      ["3.Не оставляйте пустые строки в шаблоне поиска"],
    ],
    { origin: "D1" }
  );

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, mainSheet, "Invoice");
  utils.book_append_sheet(workbook, rulesSheet, "Правила");
  const base64 = write(workbook, { type: "base64", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

export function HeaderSearchBar({ isHome }: { isHome: boolean }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [invalidFileDialog, setInvalidFileDialog] = useState(false);
  const [, startTransition] = useTransition();

  const barRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invoiceTemplateHref = useMemo(buildInvoiceTemplateHref, []);
  const paused = focused || query !== "";

  // Drum timer -- pauses while the user is focused on or typing into the
  // search field, per confirmed behavior. Just advances through a fixed set
  // of slides (no random-sample resets needed like in the "Новое
  // поступление" rotator).
  useEffect(() => {
    if (paused) return;
    cycleTimerRef.current = setTimeout(() => setSlideIndex((i) => (i + 1) % SLIDE_COUNT), CYCLE_MS);
    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    };
  }, [paused, slideIndex]);

  useEffect(() => {
    function isFileDrag(e: DragEvent) {
      return Array.from(e.dataTransfer?.types ?? []).includes("Files");
    }
    function onDragEnter(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDraggingFile(true);
    }
    function onDragOver(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    }
    function onDragLeave(e: DragEvent) {
      if (!isFileDrag(e)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsDraggingFile(false);
    }
    function onDrop(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      // Dropped somewhere other than the search bar itself -- per spec,
      // nothing happens.
      if (!barRef.current?.contains(e.target as Node)) return;
      handleFile(file);
    }
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  function handleFile(file: File) {
    if (!/\.xlsx?$/i.test(file.name)) {
      setInvalidFileDialog(true);
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await bulkSearchProducts(formData);
      if (result && "fileError" in result) setInvalidFileDialog(true);
    });
  }

  return (
    <>
      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
      )}

      <div
        ref={barRef}
        style={{ height: ROW_HEIGHT }}
        className={`relative z-50 flex min-w-0 flex-1 overflow-hidden rounded-md border transition-colors ${
          isHome
            ? `border-white/30 bg-white/5 ${focused ? "border-white/60" : ""}`
            : `border-foreground/20 bg-transparent ${focused ? "border-foreground/50" : ""}`
        } ${isDraggingFile ? "search-bar-drop-pulse" : ""}`}
      >
        {isDraggingFile ? (
          <div className={`flex w-full items-center px-3 text-sm ${isHome ? "text-white" : ""}`}>
            Перенесите файл в данную область
          </div>
        ) : (
          <div
            className="flex w-full flex-col"
            style={{
              transform: `translateY(${-slideIndex * ROW_HEIGHT}px)`,
              transition: `transform ${TRANSITION_MS}ms ease`,
            }}
          >
            <div style={{ height: ROW_HEIGHT }} className="flex w-full shrink-0 items-center">
              <form action="/shop/search" method="GET" className="flex w-full">
                <input
                  type="search"
                  name="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Поиск по названию, артикулу или бренду"
                  className={`w-full border-0 bg-transparent px-3 py-2 text-sm outline-none ${
                    isHome ? "text-white placeholder:text-white/60" : ""
                  }`}
                />
              </form>
            </div>

            <div
              style={{ height: ROW_HEIGHT }}
              className={`flex w-full shrink-0 items-center gap-3 whitespace-nowrap px-3 text-sm ${
                isHome ? "text-white/80" : "text-foreground/60"
              }`}
            >
              <span>Массовый поиск</span>
              <a href={invoiceTemplateHref} download="Invoice.xlsx" className="underline underline-offset-4">
                Скачать шаблона
              </a>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="underline underline-offset-4"
              >
                Загрузить список
              </button>
            </div>

            <div
              style={{ height: ROW_HEIGHT }}
              className={`flex w-full shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-sm ${
                isHome ? "text-white/80" : "text-foreground/60"
              }`}
            >
              <span>Либо направляйте заявки на</span>
              <a href="mailto:info@emv.one" className="underline underline-offset-4">
                info@emv.one
              </a>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />

      {invalidFileDialog && (
        <div
          onClick={() => setInvalidFileDialog(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg bg-background p-6 text-center shadow-xl"
          >
            <p className="font-medium">Некорректный файл</p>
            <button
              type="button"
              onClick={() => setInvalidFileDialog(false)}
              className="mt-4 rounded-md bg-foreground px-6 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              ОК
            </button>
          </div>
        </div>
      )}
    </>
  );
}
