"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

function subscribeVisibility(fn: () => void) {
  document.addEventListener("visibilitychange", fn);
  return () => document.removeEventListener("visibilitychange", fn);
}

/** true while the tab is in the foreground. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

/**
 * Accrues elapsed time only while `running`. Returns a stable getter so callers
 * can read the exact value at save time without re-rendering every tick.
 */
export function useElapsed(running: boolean, initialMs: number): () => number {
  const base = useRef(initialMs);
  const since = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    since.current = Date.now();
    return () => {
      if (since.current != null) base.current += Date.now() - since.current;
      since.current = null;
    };
  }, [running]);

  return useCallback(() => base.current + (since.current == null ? 0 : Date.now() - since.current), []);
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Global single-key shortcuts. Skipped while typing, while any dialog is open,
 * and when Ctrl/Meta/Alt (or Shift, except for "?") is held.
 * The handler returns true when it consumed the key.
 */
export function useShortcuts(handler: (e: KeyboardEvent) => boolean, enabled: boolean): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.shiftKey && e.key !== "?") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("dialog[open]")) return;
      if (ref.current(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
