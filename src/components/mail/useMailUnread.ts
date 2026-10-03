"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getMailUnread } from "@/actions/mail/mail";
import type { UnreadCounts } from "@/lib/mail/unread";

const POLL_MS = 60 * 1000;

// One store for the sidebar and the mail tabs, so they show the same numbers
// from a single request.
let counts: UnreadCounts | null = null;
let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Re-reads the counters now (after reading, moving or deleting letters). */
export function refreshMailUnread(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = getMailUnread()
    .then((result) => {
      const next = result.configured && result.ok ? result.counts : null;
      if (JSON.stringify(next) !== JSON.stringify(counts)) {
        counts = next;
        emit();
      }
    })
    .catch(() => {})
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refreshMailUnread();
    timer = setInterval(() => {
      if (document.visibilityState === "visible") refreshMailUnread();
    }, POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useMailUnread(): UnreadCounts | null {
  return useSyncExternalStore(subscribe, () => counts, () => null);
}

/** Re-reads the counters whenever `key` changes (e.g. the current page). */
export function useRefreshMailUnreadOn(key: unknown) {
  useEffect(() => {
    refreshMailUnread();
  }, [key]);
}
