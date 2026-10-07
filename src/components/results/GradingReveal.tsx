"use client";
// The grading moment: red-pen marks land on the 50-cell answer sheet one by one,
// then the score counts up, then the grade seal is stamped. Plays once per result.
import { useEffect, useState } from "react";
import { MARKERS } from "@/components/question/QuestionView";
import { formatClock } from "@/lib/grade";
import { usePrefs } from "@/lib/prefs";
import type { AttemptResult, Question } from "@/lib/types";
import s from "./GradingReveal.module.css";

const STAGGER_MS = 36;
const DRAW_MS = 260;
const COUNT_MS = 900;
const SEAL_MS = 520;
const RECENT_MS = 60_000;

type Phase = "mark" | "count" | "seal" | "done";

/** Results whose reveal already played in this tab; revisits show the final state. */
const played = new Set<string>();

function shouldAnimate(r: AttemptResult): boolean {
  if (played.has(r.id)) return false;
  if (Date.now() - r.finishedAt > RECENT_MS) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Two slightly different hand-drawn loops and strokes, so the sheet doesn't look stamped by a machine.
const CIRCLES = [
  "M37 9 C50 12 56 24 52 35 C48 46 33 50 21 46 C9 42 4 30 9 19 C13 10 24 6 36 8 L41 12",
  "M24 8 C37 4 53 12 54 26 C55 40 41 49 27 47 C13 45 5 34 7 22 C9 13 18 7 30 7",
];
const SLASHES = ["M50 7 C42 19 30 33 11 47", "M47 5 Q33 25 14 49"];

const L = {
  ko: {
    skip: "건너뛰기",
    outOf: "100점 만점",
    sheetTitle: "답안지 채점",
    cellHint: "번호를 누르면 문항을 볼 수 있습니다.",
    limit: "제한 시간",
    cell: (n: number, mine: string, ok: boolean, answer: number) =>
      `${n}번, 내 답 ${mine}, ${ok ? "정답" : `오답, 정답 ${answer}번`}`,
    result: (score: number, grade: string) => `${score}점, ${grade}`,
  },
  en: {
    skip: "Skip",
    outOf: "out of 100",
    sheetTitle: "Graded answer sheet",
    cellHint: "Select a number to see the question.",
    limit: "limit",
    cell: (n: number, mine: string, ok: boolean, answer: number) =>
      `Question ${n}, your answer ${mine}, ${ok ? "correct" : `incorrect, answer ${answer}`}`,
    result: (score: number, grade: string) => `${score} points, ${grade}`,
  },
};

export function GradingReveal({
  result: r,
  questions,
  onOpen,
}: {
  result: AttemptResult;
  questions: Question[];
  onOpen: (n: number) => void;
}) {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const [phase, setPhase] = useState<Phase>(() => (shouldAnimate(r) ? "mark" : "done"));
  const [shown, setShown] = useState(0);
  const markMs = (questions.length - 1) * STAGGER_MS + DRAW_MS;

  useEffect(() => {
    played.add(r.id);
  }, [r.id]);

  useEffect(() => {
    if (phase === "mark") {
      const id = window.setTimeout(() => setPhase("count"), markMs);
      return () => window.clearTimeout(id);
    }
    if (phase === "count") {
      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / COUNT_MS);
        setShown(Math.round((1 - (1 - p) ** 3) * r.score));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setPhase("seal");
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    if (phase === "seal") {
      const id = window.setTimeout(() => setPhase("done"), SEAL_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase, markMs, r.score]);

  const animating = phase !== "done";
  const score = phase === "mark" ? null : phase === "count" ? shown : r.score;
  const sealed = phase === "seal" || phase === "done";
  const pass = r.grade !== "불합격";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      {/* Score + seal, like the box on a grade certificate. */}
      <section
        aria-labelledby="score-title"
        className="relative order-first border border-rule bg-paper-raised p-5 lg:order-last"
      >
        <h2 id="score-title" className="font-sans text-xs font-bold tracking-widest text-ink-faint">
          {t.score}
        </h2>
        <p className="sr-only" aria-live="polite">
          {phase === "done" ? l.result(r.score, r.grade) : ""}
        </p>
        <div aria-hidden className="mt-1 flex items-end gap-2">
          <span className="min-w-[2.2ch] font-serif text-6xl leading-none font-bold tabular-nums sm:text-7xl">
            {score ?? "··"}
          </span>
          <span className="pb-1 font-sans text-sm text-ink-faint">/ 100</span>
        </div>
        <p className="mt-1 font-sans text-xs text-ink-faint" aria-hidden>
          {l.outOf}
        </p>

        <div className="absolute top-4 right-4 size-24 sm:size-28" aria-hidden>
          {sealed ? (
            <div
              className={`${s.seal} ${phase === "seal" ? s.stamping : ""} flex size-full items-center justify-center ${
                pass ? "rounded-md border-[3px] border-seal text-seal" : "rounded-full border-[3px] border-seal text-seal"
              }`}
            >
              <div
                className={`flex size-[86%] items-center justify-center border border-seal/70 ${pass ? "rounded-sm" : "rounded-full"}`}
              >
                <span className={`font-serif font-bold ${pass ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>
                  {r.grade}
                </span>
              </div>
            </div>
          ) : (
            <div className="size-full rounded-md border border-dashed border-rule-soft" />
          )}
        </div>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-rule-soft pt-3 font-sans text-sm">
          <dt className="text-ink-faint">{t.grade}</dt>
          <dd className="font-medium">{r.grade}</dd>
          <dt className="text-ink-faint">{t.correct}</dt>
          <dd className="tabular-nums">
            {r.correctCount} / {questions.length}
          </dd>
          <dt className="text-ink-faint">{t.timeUsed}</dt>
          <dd className="tabular-nums">
            {formatClock(r.elapsedMs)}{" "}
            <span className="text-ink-faint">
              / {formatClock(r.timeLimitMs)} {l.limit}
            </span>
          </dd>
        </dl>

        {animating && (
          <button
            type="button"
            onClick={() => setPhase("done")}
            className="mt-4 inline-flex min-h-10 items-center rounded-md border border-rule-soft px-3 font-sans text-sm text-ink-soft hover:bg-paper-sunk"
          >
            {l.skip} ⏭
          </button>
        )}
      </section>

      <section aria-labelledby="sheet-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-rule pb-1.5">
          <h2 id="sheet-title" className="font-serif text-lg font-bold">
            {l.sheetTitle}
          </h2>
          <p className="font-sans text-xs text-ink-faint">{l.cellHint}</p>
        </div>
        <ol className={`mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10 ${phase === "mark" ? s.marking : ""}`}>
          {questions.map((q, i) => {
            const mine = r.answers[q.number];
            const ok = mine === q.answer;
            const v = q.number % 2;
            const style = { "--d": `${i * STAGGER_MS}ms` } as React.CSSProperties;
            return (
              <li key={q.number}>
                <button
                  type="button"
                  onClick={() => onOpen(q.number)}
                  aria-label={l.cell(q.number, mine ? `${mine}번` : t.blank, ok, q.answer)}
                  className="relative flex h-14 w-full flex-col items-center justify-center rounded-sm border border-rule-soft bg-paper-raised font-serif hover:border-ink"
                  style={style}
                >
                  <span className="absolute top-0.5 left-1 font-sans text-[10px] leading-none text-ink-faint tabular-nums">
                    {q.number}
                  </span>
                  <span className={`text-lg leading-none ${mine ? "text-ink" : "text-ink-faint"}`}>
                    {mine ? MARKERS[mine - 1] : "–"}
                  </span>
                  {!ok && (
                    <span className={`${s.late} absolute right-1 bottom-0.5 font-serif text-[11px] leading-none text-pen`}>
                      {MARKERS[q.answer - 1]}
                    </span>
                  )}
                  <svg
                    aria-hidden
                    viewBox="0 0 60 52"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 size-full text-pen"
                    style={{ transform: `rotate(${((q.number * 37) % 13) - 6}deg)` }}
                  >
                    <path
                      className={s.stroke}
                      d={ok ? CIRCLES[v] : SLASHES[v]}
                      pathLength={1}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
