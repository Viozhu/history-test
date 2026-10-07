"use client";
// Results for one round. The attempt comes from the URL hash (/exam/79/result#<id>); without a
// usable hash we fall back to the latest exam-mode result for the round, then the latest practice one.
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { MARKERS } from "@/components/question/QuestionView";
import { usePrefs, useStored } from "@/lib/prefs";
import { loadHistory } from "@/lib/storage";
import { ERAS, type AttemptResult, type Exam, type Mode } from "@/lib/types";
import { BreakdownTable } from "./Breakdown";
import { GradingReveal } from "./GradingReveal";
import { QuestionDialog } from "./QuestionDialog";

const L = {
  ko: {
    title: "채점 결과",
    exam: "실전",
    practice: "연습",
    none: "이 회차의 응시 기록이 없습니다.",
    noneHint: "실전 모의고사를 풀면 여기에서 채점 결과를 볼 수 있습니다.",
    points: (n: number) => `${n}점 문항`,
    allCorrect: "틀린 문항이 없습니다.",
    count: (n: number) => `${n}문항`,
    retryExam: "실전 다시 응시",
    goNotebook: "오답 노트로",
    finished: "제출",
  },
  en: {
    title: "Results",
    exam: "Exam",
    practice: "Practice",
    none: "No attempts for this round yet.",
    noneHint: "Finish an exam-mode attempt to see its results here.",
    points: (n: number) => `${n}-point questions`,
    allCorrect: "No wrong answers.",
    count: (n: number) => `${n}`,
    retryExam: "Retake exam",
    goNotebook: "Wrong-answer notebook",
    finished: "Submitted",
  },
};

const subscribeHash = (fn: () => void) => {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
};
const readHash = () => decodeURIComponent(window.location.hash.slice(1));

function pickResult(history: AttemptResult[], round: number, hash: string): AttemptResult | null {
  const byId = hash ? history.find((r) => r.id === hash && r.round === round) : undefined;
  if (byId) return byId;
  const latest = (mode: Mode) =>
    history.filter((r) => r.round === round && r.mode === mode).sort((a, b) => b.finishedAt - a.finishedAt)[0];
  return latest("exam") ?? latest("practice") ?? null;
}

export function ResultView({ exam }: { exam: Exam }) {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const history = useStored<AttemptResult[] | null>(loadHistory, null);
  const [open, setOpen] = useState<number | null>(null);

  const btn = "inline-flex min-h-11 items-center justify-center rounded-md border px-4 font-sans text-sm font-medium";
  const primary = `${btn} border-ink bg-ink text-paper hover:opacity-90`;
  const secondary = `${btn} border-ink text-ink hover:bg-paper-sunk`;

  if (history === null) {
    // Prerendered shell: the heading paints before hydration; results come from storage after.
    return (
      <div className="space-y-10">
        <header>
          <p className="font-sans text-xs tracking-widest text-ink-faint">{exam.title}</p>
          <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">
            {t.round(exam.round)} {l.title}
          </h1>
        </header>
        <div className="h-96 animate-pulse rounded bg-paper-sunk/60" aria-hidden />
      </div>
    );
  }

  const r = pickResult(history, exam.round, hash);

  if (!r) {
    return (
      <section aria-labelledby="result-title" className="py-10 text-center">
        <p className="font-sans text-sm text-ink-faint">{exam.title}</p>
        <h1 id="result-title" className="mt-2 font-serif text-2xl font-bold">
          {l.none}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{l.noneHint}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/exam/${exam.round}`} className={primary}>
            {t.startExam}
          </Link>
          <Link href={`/practice/${exam.round}`} className={secondary}>
            {t.startPractice}
          </Link>
        </div>
      </section>
    );
  }

  const fmt = new Intl.DateTimeFormat(prefs.lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const eraRows = ERAS.flatMap((e) => (r.byEra[e] ? [[e, r.byEra[e]] as const] : []));
  const byNumber = new Map(exam.questions.map((q) => [q.number, q]));

  return (
    <div className="space-y-10">
      <header>
        <p className="font-sans text-xs tracking-widest text-ink-faint">
          {exam.title}
          <span className="ml-2 rounded-[3px] border border-rule-soft px-1 py-px">
            {r.mode === "exam" ? l.exam : l.practice}
          </span>
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">
          {t.round(exam.round)} {l.title}
        </h1>
        <p className="mt-1 font-sans text-xs text-ink-faint">
          {l.finished} · <time dateTime={new Date(r.finishedAt).toISOString()}>{fmt.format(r.finishedAt)}</time>
        </p>
        {r.autoSubmitted && (
          <p role="note" className="mt-3 inline-block border-l-4 border-warn bg-warn-soft px-3 py-2 font-sans text-sm text-ink">
            {t.autoSubmitted}
          </p>
        )}
      </header>

      <GradingReveal key={r.id} result={r} questions={exam.questions} onOpen={setOpen} />

      <div className="grid gap-10 lg:grid-cols-2">
        <BreakdownTable
          id="by-points"
          title={t.byPoints}
          rows={(["1", "2", "3"] as const).filter((p) => r.byPoints[p].total > 0).map((p) => [l.points(Number(p)), r.byPoints[p]])}
        />
        {eraRows.length > 0 && <BreakdownTable id="by-era" title={t.byEra} rows={eraRows.map(([e, b]) => [e, b])} />}
      </div>

      <section aria-labelledby="wrong-title">
        <div className="flex items-baseline justify-between border-b-2 border-rule pb-1.5">
          <h2 id="wrong-title" className="font-serif text-lg font-bold">
            {t.wrongList}
          </h2>
          <span className="font-sans text-xs text-ink-faint tabular-nums">{l.count(r.wrong.length)}</span>
        </div>
        {r.wrong.length === 0 ? (
          <p className="py-4 text-sm text-ink-soft">{l.allCorrect}</p>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {r.wrong.map((n) => {
              const q = byNumber.get(n);
              const mine = r.answers[n];
              return (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => setOpen(n)}
                    className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left hover:bg-paper-sunk/60"
                  >
                    <span className="w-8 shrink-0 text-right font-serif font-bold tabular-nums">{n}.</span>
                    <span className="min-w-0 flex-1 truncate font-serif text-sm text-ink-soft">{q?.stem}</span>
                    <span className="shrink-0 font-sans text-xs whitespace-nowrap">
                      {mine ? (
                        <span className="text-bad">{MARKERS[mine - 1]}</span>
                      ) : (
                        <span className="rounded-[3px] border border-rule-soft px-1 text-ink-faint">{t.blank}</span>
                      )}
                      <span className="mx-1 text-ink-faint">→</span>
                      <span className="text-ok">{q ? MARKERS[q.answer - 1] : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav aria-label={l.title} className="flex flex-wrap gap-2 border-t border-rule pt-6">
        <Link href={`/exam/${exam.round}`} className={primary}>
          {l.retryExam}
        </Link>
        <Link href={`/practice/${exam.round}`} className={secondary}>
          {t.startPractice}
        </Link>
        <Link href="/review" className={secondary}>
          {l.goNotebook}
        </Link>
      </nav>

      <QuestionDialog exam={exam} result={r} number={open} onChange={setOpen} />
    </div>
  );
}
