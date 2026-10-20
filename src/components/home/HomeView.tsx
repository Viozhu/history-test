"use client";
// Home: an unfinished attempt (if any) and the table of contents of available rounds.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Modal } from "@/components/runner/Modal";
import { GradeBadge } from "@/components/site/GradeBadge";
import { formatClock, TIME_LIMIT_MS } from "@/lib/grade";
import { usePrefs, useStored } from "@/lib/prefs";
import { clearAllData, listActiveAttempts, loadHistory } from "@/lib/storage";
import type { Attempt, AttemptResult, ExamSummary } from "@/lib/types";

const L = {
  ko: {
    lead: "국사편찬위원회 기출 문제를 실제 시험처럼 80분 동안 풀어 보세요.",
    answered: (n: number) => `${n}/50 문항 답함`,
    exam: "실전",
    practice: "연습",
    yearOnly: (y: number) => `${y}년 시행`,
    noDate: "시행일 미상",
    points: "점",
    contents: "목차",
    clearAll: "내 기록 모두 지우기",
    clearAllTitle: "모든 기록을 지울까요?",
    clearAllBody: "응시 기록, 오답 노트, 풀고 있던 시험이 모두 삭제됩니다. 되돌릴 수 없습니다.",
    clearAllOk: "모두 지우기",
  },
  en: {
    lead: "Sit real past papers under the 80-minute exam conditions.",
    answered: (n: number) => `${n}/50 answered`,
    exam: "Exam",
    practice: "Practice",
    yearOnly: (y: number) => `${y}`,
    noDate: "Date unknown",
    points: "pts",
    contents: "Contents",
    clearAll: "Delete all my history",
    clearAllTitle: "Delete all your history?",
    clearAllBody: "Your attempt records, wrong-answer notebook and unfinished exams will be deleted. This can't be undone.",
    clearAllOk: "Delete everything",
  },
};

export function HomeView({ rounds }: { rounds: ExamSummary[] }) {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const active = useStored<Attempt[] | null>(listActiveAttempts, null);
  const history = useStored<AttemptResult[] | null>(loadHistory, null);

  // Same ordering as storage.bestResult, computed once over the whole history.
  const best = useMemo(() => {
    const out = new Map<number, AttemptResult>();
    for (const r of history ?? []) {
      if (r.mode !== "exam") continue;
      const cur = out.get(r.round);
      if (!cur || r.score > cur.score || (r.score === cur.score && r.finishedAt < cur.finishedAt)) out.set(r.round, r);
    }
    return out;
  }, [history]);

  const current = active?.[0];

  return (
    <div className="space-y-10">
      <section aria-labelledby="home-title">
        <h1 id="home-title" className="font-serif text-2xl font-bold sm:text-3xl">
          {t.appName}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{l.lead}</p>
      </section>

      {current && <ContinueCard attempt={current} rounds={rounds} />}

      <section aria-labelledby="rounds-title">
        <div className="flex items-baseline justify-between border-b-2 border-rule pb-1.5">
          <h2 id="rounds-title" className="font-serif text-xl font-bold">
            {l.contents} <span className="font-sans text-sm font-normal text-ink-faint">· {t.rounds}</span>
          </h2>
          <span className="font-sans text-xs text-ink-faint tabular-nums">{rounds.length}</span>
        </div>
        <ol className="divide-y divide-rule-soft">
          {rounds.map((r) => {
            const b = best.get(r.round);
            const when = r.date ?? (r.year ? l.yearOnly(r.year) : l.noDate);
            return (
              <li key={r.round} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="w-14 shrink-0 font-serif text-3xl leading-none font-bold tabular-nums text-ink sm:w-16 sm:text-4xl"
                  >
                    {r.round}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-base leading-snug font-bold sm:text-lg">
                      {r.title}
                      {r.source === "ocr" && (
                        <abbr
                          title={t.ocrNote}
                          className="ml-2 inline-block cursor-help rounded-[3px] border border-rule-soft px-1 align-middle font-sans text-[10px] font-medium tracking-wider text-ink-faint no-underline"
                        >
                          OCR
                          <span className="sr-only">: {t.ocrNote}</span>
                        </abbr>
                      )}
                    </h3>
                    <p className="mt-0.5 font-sans text-xs text-ink-faint">{when}</p>
                    <p className="mt-2 flex min-h-6 items-center gap-2 font-sans text-sm">
                      {history === null ? (
                        <span className="inline-block h-4 w-28 animate-pulse rounded bg-paper-sunk" aria-hidden />
                      ) : b ? (
                        <>
                          <span className="text-ink-faint">{t.best}</span>
                          <span className="font-serif text-lg font-bold tabular-nums">{b.score}</span>
                          <span className="text-ink-faint">{l.points}</span>
                          <GradeBadge grade={b.grade} />
                        </>
                      ) : (
                        <span className="text-ink-faint">{t.noAttempts}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Link
                    href={`/exam/${r.round}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink bg-ink px-4 font-sans text-sm font-medium text-paper hover:opacity-90"
                  >
                    {t.startExam}
                  </Link>
                  <Link
                    href={`/practice/${r.round}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink px-4 font-sans text-sm font-medium text-ink hover:bg-paper-sunk"
                  >
                    {t.startPractice}
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {(history?.length || active?.length) ? <ClearAllButton /> : null}
    </div>
  );
}

function ClearAllButton() {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const [open, setOpen] = useState(false);
  const btn = "inline-flex min-h-10 items-center rounded-md border px-4 font-sans text-sm";

  return (
    <div className="flex justify-end border-t border-rule-soft pt-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btn} border-rule-soft text-ink-soft transition-colors hover:border-bad hover:text-bad`}
      >
        {l.clearAll}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={l.clearAllTitle}>
        <div className="p-5 font-sans">
          <h2 className="mb-3 border-b border-rule pb-2 text-base font-bold">{l.clearAllTitle}</h2>
          <p className="text-sm text-ink-soft">{l.clearAllBody}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={`${btn} border-rule-soft hover:bg-paper-sunk`} data-autofocus>
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                clearAllData();
                setOpen(false);
              }}
              className={`${btn} border-bad bg-bad font-medium text-paper hover:opacity-90`}
            >
              {l.clearAllOk}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ContinueCard({ attempt: a, rounds }: { attempt: Attempt; rounds: ExamSummary[] }) {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const title = rounds.find((r) => r.round === a.round)?.title ?? t.round(a.round);
  const answered = Object.keys(a.answers).length;
  const href = `/${a.mode === "exam" ? "exam" : "practice"}/${a.round}`;

  return (
    <section
      aria-labelledby="continue-title"
      className="relative border border-rule bg-paper-raised p-4 shadow-[4px_4px_0_var(--rule-soft)] sm:p-5"
    >
      <p id="continue-title" className="font-sans text-xs font-bold tracking-widest text-pen">
        {t.unfinished}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg font-bold">
            {title}
            <span className="ml-2 align-middle font-sans text-xs font-medium text-ink-faint">
              [{a.mode === "exam" ? l.exam : l.practice}]
            </span>
          </h2>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm text-ink-soft">
            <div>
              <dt className="sr-only">{t.answerSheet}</dt>
              <dd className="tabular-nums">{l.answered(answered)}</dd>
            </div>
            {a.mode === "exam" && (
              <div className="flex gap-1">
                <dt>{t.timeLeft}</dt>
                <dd className="font-medium tabular-nums">{formatClock(TIME_LIMIT_MS - a.elapsedMs)}</dd>
              </div>
            )}
          </dl>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 items-center rounded-md border border-ink bg-ink px-5 font-sans text-sm font-medium text-paper hover:opacity-90"
        >
          {t.continue} →
        </Link>
      </div>
    </section>
  );
}
