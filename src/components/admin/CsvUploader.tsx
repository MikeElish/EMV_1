"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  analyzeImportFile,
  commitImportRows,
  type ImportSummary,
} from "@/actions/admin/import";
import type { AnalyzedRow, DuplicateGroup } from "@/lib/validators/csv";

type Stage = "idle" | "duplicates" | "stockReview";

export function CsvUploader() {
  const formRef = useRef<HTMLFormElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Row-level parse errors from the analyze step, carried through to the
  // final summary regardless of which review stages run in between.
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);

  // -- Duplicate-SKU review --
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [singleRowsPending, setSingleRowsPending] = useState<AnalyzedRow[]>([]);
  const [dupSelection, setDupSelection] = useState<Record<string, number>>({});
  const [invalidDupSkus, setInvalidDupSkus] = useState<Set<string>>(new Set());
  const [dupDialog, setDupDialog] = useState<string | null>(null);

  // -- Stock-decrease review --
  const [stockRows, setStockRows] = useState<AnalyzedRow[]>([]);
  const [allFinalRows, setAllFinalRows] = useState<AnalyzedRow[]>([]);
  const [stockDecision, setStockDecision] = useState<Record<number, "accept" | "reject">>({});
  const [invalidStockRows, setInvalidStockRows] = useState<Set<number>>(new Set());
  const [stockDialog, setStockDialog] = useState<string | null>(null);

  function resetAll() {
    setStage("idle");
    setResult(null);
    setFileError(null);
    setParseErrors([]);
    setDuplicateGroups([]);
    setSingleRowsPending([]);
    setDupSelection({});
    setInvalidDupSkus(new Set());
    setDupDialog(null);
    setStockRows([]);
    setAllFinalRows([]);
    setStockDecision({});
    setInvalidStockRows(new Set());
    setStockDialog(null);
    formRef.current?.reset();
  }

  function stockDecreaseRows(rows: AnalyzedRow[]): AnalyzedRow[] {
    return rows.filter((r) => r.currentStock !== null && r.currentStock > r.stock);
  }

  function proceedToStockCheck(rows: AnalyzedRow[]) {
    const decreases = stockDecreaseRows(rows);
    if (decreases.length > 0) {
      setStockRows(decreases);
      setAllFinalRows(rows);
      setStockDecision({});
      setInvalidStockRows(new Set());
      setStockDialog(null);
      setStage("stockReview");
    } else {
      void commit(rows);
    }
  }

  async function commit(rows: AnalyzedRow[]) {
    setSubmitting(true);
    const summary = await commitImportRows(rows);
    setSubmitting(false);
    setResult({ ...summary, errors: [...parseErrors, ...summary.errors] });
    setStage("idle");
    setDuplicateGroups([]);
    setSingleRowsPending([]);
    setStockRows([]);
    setAllFinalRows([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);
    setFileError(null);

    const formData = new FormData(event.currentTarget);
    const analysis = await analyzeImportFile(formData);
    setSubmitting(false);

    if ("fileError" in analysis) {
      setFileError(analysis.fileError);
      return;
    }

    setParseErrors(analysis.errors);

    if (analysis.duplicateGroups.length > 0) {
      setDuplicateGroups(analysis.duplicateGroups);
      setSingleRowsPending(analysis.singleRows);
      setDupSelection({});
      setInvalidDupSkus(new Set());
      setDupDialog(null);
      setStage("duplicates");
    } else {
      proceedToStockCheck(analysis.singleRows);
    }
  }

  function toggleDupSelection(sku: string, rowNumber: number) {
    setDupSelection((prev) => {
      const next = { ...prev };
      if (next[sku] === rowNumber) delete next[sku];
      else next[sku] = rowNumber;
      return next;
    });
    setInvalidDupSkus((prev) => {
      if (!prev.has(sku)) return prev;
      const next = new Set(prev);
      next.delete(sku);
      return next;
    });
  }

  function handleDupAccept() {
    const missing = duplicateGroups.filter((g) => dupSelection[g.sku] === undefined);
    if (missing.length > 0) {
      setInvalidDupSkus(new Set(missing.map((g) => g.sku)));
      setDupDialog("Не выбрана строка для загрузки. Загрузка остановлена");
      return;
    }
    setDupDialog(null);
    const chosen = duplicateGroups.map(
      (g) => g.rows.find((r) => r.rowNumber === dupSelection[g.sku])!
    );
    const finalRows = [...singleRowsPending, ...chosen];
    setDuplicateGroups([]);
    setSingleRowsPending([]);
    proceedToStockCheck(finalRows);
  }

  function handleStockAccept() {
    const missing = stockRows.filter((r) => stockDecision[r.rowNumber] === undefined);
    if (missing.length > 0) {
      setInvalidStockRows(new Set(missing.map((r) => r.rowNumber)));
      setStockDialog("Не согласовано изменение количества. Загрузка остановлена");
      return;
    }
    setStockDialog(null);
    const rejected = new Set(
      stockRows.filter((r) => stockDecision[r.rowNumber] === "reject").map((r) => r.rowNumber)
    );
    const finalRows = allFinalRows.filter((r) => !rejected.has(r.rowNumber));
    void commit(finalRows);
  }

  function setStockRowDecision(rowNumber: number, decision: "accept" | "reject") {
    setStockDecision((prev) => ({ ...prev, [rowNumber]: decision }));
    setInvalidStockRows((prev) => {
      if (!prev.has(rowNumber)) return prev;
      const next = new Set(prev);
      next.delete(rowNumber);
      return next;
    });
  }

  return (
    <div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={stage !== "idle"}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={submitting || stage !== "idle"}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Загружаем..." : "Загрузить"}
        </button>
      </form>

      {fileError && <p className="mt-4 text-sm text-red-600">{fileError}</p>}

      {stage === "duplicates" && (
        <div className="mt-6 rounded-lg border border-foreground/10 p-4">
          <h2 className="font-semibold">Повторяющиеся товары</h2>
          <p className="mt-1 text-sm text-foreground/60">
            В файле встречаются одинаковые артикулы. Отметьте галочкой, какую
            строку загружать для каждого артикула.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-foreground/50">
                  <th className="py-2 pr-2" />
                  <th className="py-2 pr-4">Бренд</th>
                  <th className="py-2 pr-4">Наименование товара</th>
                  <th className="py-2 pr-4">Артикул товара</th>
                  <th className="py-2 pr-4">Количество в наличии</th>
                  <th className="py-2 pr-4">Цена товара</th>
                </tr>
              </thead>
              <tbody>
                {duplicateGroups.map((group) =>
                  group.rows.map((row) => {
                    const selectedInGroup = dupSelection[group.sku];
                    const isSelected = selectedInGroup === row.rowNumber;
                    const isDisabled = selectedInGroup !== undefined && !isSelected;
                    const isInvalid = invalidDupSkus.has(group.sku);
                    return (
                      <tr
                        key={row.rowNumber}
                        className={`border-b border-foreground/10 ${isDisabled ? "opacity-40" : ""} ${
                          isInvalid ? "text-red-600" : ""
                        }`}
                      >
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => toggleDupSelection(group.sku, row.rowNumber)}
                          />
                        </td>
                        <td className="py-2 pr-4">{row.brand}</td>
                        <td className="py-2 pr-4">{row.name}</td>
                        <td className="py-2 pr-4">{row.sku}</td>
                        <td className="py-2 pr-4">{row.stock}</td>
                        <td className="py-2 pr-4">{row.price} ₽</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-opacity hover:opacity-90"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDupAccept}
              disabled={submitting}
              className="rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Принять
            </button>
          </div>

          {dupDialog && <p className="mt-3 text-sm font-medium text-red-600">{dupDialog}</p>}
        </div>
      )}

      {stage === "stockReview" && (
        <div className="mt-6 rounded-lg border border-foreground/10 p-4">
          <h2 className="font-semibold">Уменьшение количества товара</h2>
          <p className="mt-1 text-sm text-foreground/60">
            У этих позиций количество по файлу меньше, чем уже в системе.
            Подтвердите изменение для каждой строки.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-foreground/50">
                  <th className="py-2 pr-4">Бренд</th>
                  <th className="py-2 pr-4">Наименование товара</th>
                  <th className="py-2 pr-4">Артикул товара</th>
                  <th className="py-2 pr-4">Количество в наличии</th>
                  <th className="py-2 pr-4">Цена товара</th>
                  <th className="py-2 pr-4">Решение</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row) => {
                  const isInvalid = invalidStockRows.has(row.rowNumber);
                  return (
                    <tr
                      key={row.rowNumber}
                      className={`border-b border-foreground/10 ${isInvalid ? "text-red-600" : ""}`}
                    >
                      <td className="py-2 pr-4">{row.brand}</td>
                      <td className="py-2 pr-4">{row.name}</td>
                      <td className="py-2 pr-4">{row.sku}</td>
                      <td className="py-2 pr-4">
                        <span className="text-green-600">{row.currentStock}</span>
                        {" → "}
                        <span className="text-red-600">{row.stock}</span>
                      </td>
                      <td className="py-2 pr-4">{row.price} ₽</td>
                      <td className="py-2 pr-4">
                        <select
                          value={stockDecision[row.rowNumber] ?? ""}
                          onChange={(e) =>
                            setStockRowDecision(
                              row.rowNumber,
                              e.target.value as "accept" | "reject"
                            )
                          }
                          className="rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-sm"
                        >
                          <option value="" disabled>
                            — выбрать —
                          </option>
                          <option value="accept">Принять</option>
                          <option value="reject">Не принять</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-opacity hover:opacity-90"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleStockAccept}
              disabled={submitting}
              className="rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Принять
            </button>
          </div>

          {stockDialog && <p className="mt-3 text-sm font-medium text-red-600">{stockDialog}</p>}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-lg border border-foreground/10 p-4 text-sm">
          <p>
            Создано: <strong>{result.created}</strong> · Обновлено:{" "}
            <strong>{result.updated}</strong> · Ошибок:{" "}
            <strong>{result.errors.length}</strong>
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-red-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  Строка {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
