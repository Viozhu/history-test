"use client";
// The answer sheet (답안지): rows of ①–⑤ bubbles printed in OMR pink, filled in sign-pen ink.
// It reads and writes the same attempt state as the question view.
import { MARKERS } from "@/components/question/QuestionView";
import { usePrefs } from "@/lib/prefs";
import type { Choice } from "@/lib/types";
import { runnerLabels } from "./labels";
import styles from "./OmrCard.module.css";

const CHOICES: Choice[] = [1, 2, 3, 4, 5];

export interface OmrCardProps {
  /** Row keys in sheet order. */
  keys: number[];
  answers: Record<number, Choice>;
  flags: number[];
  current: number;
  /** Practice/retry: rows already checked, with their outcome. */
  marks?: Record<number, "ok" | "bad">;
  /** Accessible name of a row, e.g. "3번" (default) or "1. 제79회 12번". */
  describe?: (key: number) => string;
  onPick: (key: number, choice: Choice | null) => void;
  onJump: (key: number) => void;
}

export function OmrCard({ keys, answers, flags, current, marks, describe, onPick, onJump }: OmrCardProps) {
  const { t, prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  const flagged = new Set(flags);
  const answered = keys.filter((k) => answers[k]).length;
  const name = describe ?? ((k: number) => `${k}번`);
  const hasMarks = !!marks && Object.keys(marks).length > 0;

  return (
    <div className="overflow-hidden rounded-md border-2 border-omr bg-paper-raised font-sans text-omr">
      <div className="flex items-baseline justify-between border-b-2 border-omr bg-omr-soft px-3 py-1.5">
        <span className="text-sm font-bold tracking-[0.3em]">{t.answerSheet}</span>
        <span className="text-xs font-medium tabular-nums">{L.progress(answered, keys.length)}</span>
      </div>
      <div
        className="grid border-b border-omr text-center text-[10px] font-medium tracking-widest"
        style={{ gridTemplateColumns: hasMarks ? "2.75rem 1fr 1.25rem" : "2.75rem 1fr" }}
        aria-hidden
      >
        <span className="border-r border-omr py-0.5">문번</span>
        <span className="py-0.5">답 란</span>
        {hasMarks && <span className="border-l border-omr py-0.5" />}
      </div>
      <ol className="m-0 list-none p-0">
        {keys.map((k, i) => {
          const isCurrent = k === current;
          const mark = marks?.[k];
          const locked = !!mark;
          const blockEnd = (i + 1) % 5 === 0 && i < keys.length - 1;
          return (
            <li
              key={k}
              data-row={k}
              className={`grid items-center ${blockEnd ? "border-b border-omr" : "border-b border-omr/25 last:border-b-0"} ${
                isCurrent ? "bg-omr-soft" : ""
              }`}
              style={{ gridTemplateColumns: hasMarks ? "2.75rem 1fr 1.25rem" : "2.75rem 1fr" }}
            >
              <button
                type="button"
                onClick={() => onJump(k)}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`${t.goTo}: ${name(k)}${flagged.has(k) ? ` (${L.flagged})` : ""}`}
                className={`relative flex h-10 items-center justify-center self-stretch border-r border-omr text-sm font-bold tabular-nums lg:h-7 lg:text-xs ${
                  isCurrent ? "bg-omr text-paper" : "hover:bg-omr-soft"
                }`}
              >
                {flagged.has(k) && (
                  <span className="absolute top-1/2 left-1 -translate-y-1/2">
                    <span aria-hidden className={styles.flag} />
                  </span>
                )}
                {k}
              </button>
              <div className="flex items-center justify-around px-1">
                {CHOICES.map((c) => {
                  const on = answers[k] === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={`${name(k)} ${MARKERS[c - 1]}`}
                      aria-pressed={on}
                      onClick={() => {
                        if (!locked) onPick(k, on ? null : c);
                        onJump(k);
                      }}
                      className={`flex h-10 w-10 items-center justify-center rounded-md lg:h-7 lg:w-8 ${
                        locked ? "cursor-default" : "hover:bg-omr-soft"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="relative inline-flex h-[1.3rem] w-[0.95rem] items-center justify-center rounded-full border border-omr text-[0.62rem] leading-none font-semibold lg:h-[1.15rem] lg:w-[0.85rem]"
                      >
                        {c}
                        {on && <span className={styles.fill} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {hasMarks && (
                <span
                  className={`text-center text-xs font-bold ${mark === "ok" ? "text-ok" : "text-bad"}`}
                  aria-label={mark ? (mark === "ok" ? t.correct : t.incorrect) : undefined}
                  role={mark ? "img" : undefined}
                >
                  {mark === "ok" ? "○" : mark === "bad" ? "✕" : ""}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
