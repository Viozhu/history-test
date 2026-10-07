"use client";
// One question in review mode inside a native modal <dialog> (focus is contained by the
// browser, Esc closes), with prev/next navigation through the wrong answers.
import { useEffect, useRef } from "react";
import { MARKERS, QuestionView } from "@/components/question/QuestionView";
import { usePrefs } from "@/lib/prefs";
import type { AttemptResult, Exam } from "@/lib/types";

const L = {
  ko: { prevWrong: "이전 오답", nextWrong: "다음 오답", title: (n: number) => `${n}번 문항` },
  en: { prevWrong: "Previous wrong", nextWrong: "Next wrong", title: (n: number) => `Question ${n}` },
};

export function QuestionDialog({
  exam,
  result,
  number,
  onChange,
}: {
  exam: Exam;
  result: AttemptResult;
  /** Question shown, or null when closed. */
  number: number | null;
  onChange: (n: number | null) => void;
}) {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (number != null && !d.open) d.showModal();
    if (number == null && d.open) d.close();
    bodyRef.current?.scrollTo({ top: 0 });
  }, [number]);

  const q = number == null ? null : exam.questions.find((x) => x.number === number);
  const wrong = [...result.wrong].sort((a, b) => a - b);
  const prev = number == null ? undefined : wrong.filter((n) => n < number).at(-1);
  const next = number == null ? undefined : wrong.find((n) => n > number);
  const mine = number == null ? undefined : result.answers[number];

  const navBtn =
    "inline-flex min-h-10 items-center rounded-md border border-rule-soft px-3 font-sans text-sm text-ink hover:bg-paper-sunk disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <dialog
      ref={ref}
      aria-labelledby="qd-title"
      onClose={() => onChange(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto open:flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl flex-col rounded-md border border-rule bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/50"
    >
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
        <h2 id="qd-title" className="font-serif text-base font-bold">
          {t.round(exam.round)} · {number != null && l.title(number)}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="inline-flex size-10 items-center justify-center rounded-md text-xl text-ink-soft hover:bg-paper-sunk"
          aria-label={t.close}
        >
          <span aria-hidden>×</span>
        </button>
      </header>

      <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-4">
        {q && (
          <>
            <p className="mb-4 flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm">
              <span>
                <span className="text-ink-faint">{t.yourAnswer}</span>{" "}
                <strong className={mine === q.answer ? "text-ok" : "text-bad"}>
                  {mine ? MARKERS[mine - 1] : t.blank}
                </strong>
              </span>
              <span>
                <span className="text-ink-faint">{t.correctAnswer}</span>{" "}
                <strong className="text-ok">{MARKERS[q.answer - 1]}</strong>
              </span>
            </p>
            <QuestionView question={q} selected={mine ?? null} reveal headingLevel="h3" />
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-rule-soft px-4 py-2">
        <button type="button" disabled={prev == null} onClick={() => prev != null && onChange(prev)} className={navBtn}>
          ← {l.prevWrong}
        </button>
        <button type="button" disabled={next == null} onClick={() => next != null && onChange(next)} className={navBtn}>
          {l.nextWrong} →
        </button>
      </footer>
    </dialog>
  );
}
