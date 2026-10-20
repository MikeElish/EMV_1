"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useOutsideClose } from "@/lib/use-outside-close";

export type SearchSelectOption = { value: string; label: string; /** Also searched, shown in grey. */ hint?: string };

const MAX_SHOWN = 200;

/**
 * A select with text search: type to narrow the list, pick with a click or
 * ↑/↓ + Enter. Only listed values can be chosen; leaving the field without a
 * pick keeps the previous choice.
 */
export function SearchSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = "Начните вводить для поиска",
  emptyLabel,
  className = "",
}: {
  id?: string;
  /** Posts the value with the form (hidden input). */
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  /** A «nothing chosen» entry at the top of the list, e.g. «— не выбран —». */
  emptyLabel?: string;
  className?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  function close() {
    setOpen(false);
    setQuery("");
  }
  // Also Esc: only the list closes, not the window the field sits in.
  const wrapperRef = useOutsideClose(open, close);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
      : options;
    // Starts-with first: «bos» → BOSCH before «Brembo Bosco».
    if (q) found.sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)));
    return found;
  }, [options, query]);
  const items: SearchSelectOption[] = [
    ...(emptyLabel && !query.trim() ? [{ value: "", label: emptyLabel }] : []),
    ...matches.slice(0, MAX_SHOWN),
  ];

  function pick(option: SearchSelectOption) {
    onChange(option.value);
    close();
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function move(step: number) {
    if (!open) setOpen(true);
    const next = Math.max(0, Math.min(items.length - 1, active + step));
    setActive(next);
    listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? query : selected?.label ?? ""}
        placeholder={open ? selected?.label || placeholder : emptyLabel ?? placeholder}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (items[active]) pick(items[active]);
          } else if (e.key === "Tab") {
            close();
          }
        }}
        className="w-full rounded-md border border-foreground/20 bg-transparent py-2 pl-3 pr-8 outline-none focus:border-foreground/50"
      />
      <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground/40">
        ▾
      </span>
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-foreground/15 bg-background py-1 text-sm shadow-lg"
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-foreground/40">Ничего не найдено</li>
          ) : (
            items.map((o, i) => (
              <li
                key={o.value || "__empty"}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${i === active ? "bg-foreground/10" : ""} ${
                  o.value === value ? "font-medium" : ""
                } ${o.value === "" ? "text-foreground/50" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-foreground/40">{o.hint}</span>}
              </li>
            ))
          )}
          {matches.length > MAX_SHOWN && (
            <li className="px-3 py-1.5 text-xs text-foreground/40">
              Показаны первые {MAX_SHOWN} из {matches.length} — уточните поиск
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
