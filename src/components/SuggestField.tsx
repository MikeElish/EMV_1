"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useOutsideClose } from "@/lib/use-outside-close";

export function SuggestField({
  value,
  onChange,
  allOptions,
  placeholder,
  panelPositioning = "absolute",
}: {
  value: string;
  onChange: (v: string) => void;
  allOptions: string[];
  placeholder: string;
  /** "fixed" escapes an ancestor `overflow-x-auto` (e.g. a table wrapper),
   * which would otherwise clip an `absolute` panel -- same fix as DropdownMenu. */
  panelPositioning?: "absolute" | "fixed";
}) {
  const [open, setOpen] = useState(false);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const wrapperRef = useOutsideClose(open, () => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((c) => c.toLowerCase().includes(q));
  }, [value, allOptions]);

  function openPanel() {
    if (panelPositioning === "fixed" && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setFixedPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
  }

  // "fixed" must take the panel out of flow immediately, even before it has
  // ever been opened -- otherwise, before fixedPos is first computed, the
  // panel renders unpositioned (static) and inflates its parent (e.g. a
  // table <th>) by up to max-h-64, since overflow/opacity alone don't
  // remove an element from normal document flow.
  const panelStyle: CSSProperties | undefined =
    panelPositioning === "fixed"
      ? fixedPos
        ? { position: "fixed", top: fixedPos.top, left: fixedPos.left, width: fixedPos.width }
        : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
      : undefined;

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          openPanel();
        }}
        onFocus={openPanel}
        onKeyDown={(e) => {
          if (e.key === "Enter" && options.length > 0) {
            e.preventDefault();
            onChange(options[0]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
      />
      <div
        role="listbox"
        style={panelStyle}
        className={`scroll-transparent z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-foreground/10 shadow-lg transition-all duration-150 ${
          panelPositioning === "absolute"
            ? "absolute left-0 top-full bg-transparent backdrop-blur-sm"
            : "bg-background"
        } ${open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
      >
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-foreground/40">Не найдено</p>
        ) : (
          options.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={value === c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10 ${
                value === c ? "font-semibold" : ""
              }`}
            >
              {c}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
