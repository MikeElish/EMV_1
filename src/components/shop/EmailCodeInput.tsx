"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { EMAIL_CODE_LENGTH } from "@/lib/email-verification-shared";

/**
 * Six one-digit boxes. Typing advances to the next box, Backspace goes back,
 * pasting a whole code fills every box. `onComplete` fires once all six
 * digits are in; any edit after that calls `onEdit` (to clear an error).
 */
export function EmailCodeInput({
  onComplete,
  onEdit,
  invalid = false,
  disabled = false,
  autoFocus = false,
}: {
  onComplete: (code: string) => void;
  onEdit?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(EMAIL_CODE_LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function update(next: string[], focusIndex: number) {
    setDigits(next);
    onEdit?.();
    refs.current[Math.min(focusIndex, EMAIL_CODE_LENGTH - 1)]?.focus();
    if (next.every((d) => d !== "")) onComplete(next.join(""));
  }

  function fillFrom(index: number, text: string) {
    const incoming = text.replace(/\D/g, "").split("");
    if (incoming.length === 0) return;
    const next = [...digits];
    let i = index;
    for (const d of incoming) {
      if (i >= EMAIL_CODE_LENGTH) break;
      next[i++] = d;
    }
    update(next, i);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      update(next, index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < EMAIL_CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData("text"));
  }

  const border = invalid
    ? "border-red-500 bg-red-500/10 text-red-600 ring-2 ring-red-500/30"
    : "border-foreground/20 focus:border-foreground/60";

  return (
    <div className="flex gap-2" role="group" aria-label="Код подтверждения">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Цифра ${index + 1}`}
          aria-invalid={invalid}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            if (value.length > 1) {
              fillFrom(index, value);
              return;
            }
            const next = [...digits];
            next[index] = value;
            update(next, value ? index + 1 : index);
          }}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={`h-12 w-10 rounded-md border bg-transparent text-center text-xl font-semibold outline-none transition-colors disabled:opacity-50 ${border}`}
        />
      ))}
    </div>
  );
}
