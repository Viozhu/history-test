"use client";
import { usePrefs } from "@/lib/prefs";
import type { Theme } from "@/lib/types";

const seg = "px-2 py-1 text-xs font-medium transition-colors";

/** KO / EN toggle for interface labels (exam content stays Korean). */
export function LangToggle() {
  const { prefs, setPrefs } = usePrefs();
  return (
    <div role="group" aria-label="Language / 언어" className="inline-flex overflow-hidden rounded-md border border-rule-soft">
      {(["ko", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={prefs.lang === l}
          onClick={() => setPrefs({ lang: l })}
          className={`${seg} ${prefs.lang === l ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-sunk"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

/** Cycles system → light → dark. */
export function ThemeToggle() {
  const { prefs, setPrefs, t } = usePrefs();
  const label = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark }[prefs.theme];
  return (
    <button
      type="button"
      onClick={() => setPrefs({ theme: NEXT[prefs.theme] })}
      aria-label={`${t.theme}: ${label}`}
      title={`${t.theme}: ${label}`}
      className="inline-flex size-8 items-center justify-center rounded-md border border-rule-soft text-sm text-ink-soft hover:bg-paper-sunk"
    >
      <span aria-hidden>{ICON[prefs.theme]}</span>
    </button>
  );
}
