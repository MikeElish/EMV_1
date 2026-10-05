"use client";

import { useEffect, useRef } from "react";

// Esc closes what is on top: windows, menus and notices register here while
// open, and one key press reaches only the most recently opened of them --
// a window opened over another window closes alone.

type Entry = { onEscape: () => void };
const stack: Entry[] = [];
let listening = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.preventDefault();
  top.onEscape();
}

/** While `active`, Esc calls `onEscape` -- if nothing opened later is still open. */
export function useEscape(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const entry: Entry = { onEscape: () => handler.current() };
    stack.push(entry);
    if (!listening) {
      document.addEventListener("keydown", onKeyDown);
      listening = true;
    }
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
