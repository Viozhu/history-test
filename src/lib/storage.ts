"use client";
// localStorage persistence. Every access is wrapped so the app keeps working
// (in memory only) when storage is unavailable: private mode, blocked site data, SSR.
import type { Attempt, AttemptResult, Choice, Mode, Prefs, WrongEntry } from "./types";

const NS = "khs:v1";
const KEYS = {
  attempt: (mode: Mode, round: number) => `${NS}:attempt:${mode}:${round}`,
  history: `${NS}:history`,
  wrong: `${NS}:wrong`,
  prefs: `${NS}:prefs`,
  retry: `${NS}:retry`,
};

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  // The in-memory copy is always the newest: it also covers setItem failing (quota, old
  // Safari private mode) while getItem still returns the previous value.
  let raw: string | null = memory.get(key) ?? null;
  if (raw == null) {
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
  }
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // quota exceeded or storage blocked: keep the in-memory copy
  }
  listeners.forEach((fn) => fn());
}

function remove(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn());
}

/** Subscribe to any change made through this module (and other tabs). */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    // Another tab wrote: drop our in-memory copy so reads see its value.
    if (!e.key) memory.clear();
    else memory.delete(e.key);
    if (!e.key || e.key.startsWith(NS)) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- attempts in progress -------------------------------------------------

export const loadAttempt = (mode: Mode, round: number) => read<Attempt | null>(KEYS.attempt(mode, round), null);
export const saveAttempt = (a: Attempt) => write(KEYS.attempt(a.mode, a.round), { ...a, updatedAt: Date.now() });
export const clearAttempt = (mode: Mode, round: number) => remove(KEYS.attempt(mode, round));

/** All unfinished attempts, most recent first (for the home "Continue" card). */
export function listActiveAttempts(): Attempt[] {
  const out: Attempt[] = [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) keys.push(window.localStorage.key(i) ?? "");
  } catch {
    // storage unavailable: only the in-memory copies exist
  }
  keys.push(...[...memory.keys()].filter((k) => !keys.includes(k)));
  for (const k of keys) {
    if (k.startsWith(`${NS}:attempt:`)) {
      const a = read<Attempt | null>(k, null);
      if (a) out.push(a);
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---- history ----------------------------------------------------------------

export const loadHistory = () => read<AttemptResult[]>(KEYS.history, []);
export function addResult(r: AttemptResult): void {
  write(KEYS.history, [...loadHistory().filter((x) => x.id !== r.id), r]);
}
export const getResult = (id: string) => loadHistory().find((r) => r.id === id) ?? null;
export function latestResult(round: number, mode: Mode = "exam"): AttemptResult | null {
  const list = loadHistory().filter((r) => r.round === round && r.mode === mode);
  return list.sort((a, b) => b.finishedAt - a.finishedAt)[0] ?? null;
}
export function bestResult(round: number): AttemptResult | null {
  const list = loadHistory().filter((r) => r.round === round && r.mode === "exam");
  return list.sort((a, b) => b.score - a.score || a.finishedAt - b.finishedAt)[0] ?? null;
}
export const clearHistory = () => remove(KEYS.history);

// ---- wrong-answer notebook ----------------------------------------------------

export const loadWrong = () => read<Record<string, WrongEntry>>(KEYS.wrong, {});

export function recordWrong(round: number, number: number, choice: Choice | null): void {
  const all = loadWrong();
  const id = `${round}-${String(number).padStart(2, "0")}`;
  const now = Date.now();
  const prev = all[id];
  all[id] = {
    id,
    round,
    number,
    lastChoice: choice,
    timesWrong: (prev?.timesWrong ?? 0) + 1,
    addedAt: prev?.addedAt ?? now,
    lastWrongAt: now,
  };
  write(KEYS.wrong, all);
}

export function removeWrong(id: string): void {
  const all = loadWrong();
  delete all[id];
  write(KEYS.wrong, all);
}

/** Question ids for the notebook's "retry these" session. */
export const saveRetrySet = (ids: string[]) => write(KEYS.retry, ids);
export const loadRetrySet = () => read<string[]>(KEYS.retry, []);

// ---- preferences -------------------------------------------------------------

export const DEFAULT_PREFS: Prefs = { lang: "ko", layout: "single", theme: "system", shufflePractice: false };
export const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...read<Partial<Prefs>>(KEYS.prefs, {}) });
export const savePrefs = (p: Partial<Prefs>) => write(KEYS.prefs, { ...loadPrefs(), ...p });
