"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ConfirmButton } from "@/components/site/ConfirmButton";
import { GradeBadge } from "@/components/site/GradeBadge";
import { formatClock } from "@/lib/grade";
import { usePrefs, useStored } from "@/lib/prefs";
import { clearHistory, loadHistory } from "@/lib/storage";
import type { AttemptResult } from "@/lib/types";
import { ScoreChart } from "./ScoreChart";

const L = {
  ko: {
    lead: "끝까지 제출한 시험이 모두 기록됩니다. 기록은 이 브라우저에만 저장됩니다.",
    exam: "실전",
    practice: "연습",
    attempts: "응시 목록",
    clear: "기록 모두 지우기",
    clearQ: "모든 응시 기록을 지울까요? 되돌릴 수 없습니다.",
    clearOk: "지우기",
    view: "결과 보기",
    points: "점",
    goHome: "회차 목록으로",
    auto: "자동 제출",
  },
  en: {
    lead: "Every submitted attempt is listed here. Records are kept in this browser only.",
    exam: "Exam",
    practice: "Practice",
    attempts: "Attempts",
    clear: "Clear history",
    clearQ: "Delete every record? This can't be undone.",
    clearOk: "Delete",
    view: "View results",
    points: "pts",
    goHome: "Browse rounds",
    auto: "Auto-submitted",
  },
};

export function HistoryView() {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const history = useStored<AttemptResult[] | null>(loadHistory, null);
  const sorted = useMemo(() => [...(history ?? [])].sort((a, b) => b.finishedAt - a.finishedAt), [history]);

  if (history === null) {
    return <div className="h-64 animate-pulse rounded bg-paper-sunk/60" aria-hidden />;
  }

  const fmt = new Intl.DateTimeFormat(prefs.lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">{t.history}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{l.lead}</p>
      </header>

      {sorted.length === 0 ? (
        <div className="border border-dashed border-rule-soft px-4 py-12 text-center">
          <p className="font-serif text-lg">{t.emptyHistory}</p>
          <Link
            href="/"
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-ink px-4 font-sans text-sm font-medium hover:bg-paper-sunk"
          >
            {l.goHome}
          </Link>
        </div>
      ) : (
        <>
          <ScoreChart results={sorted} />

          <section aria-labelledby="attempts-title">
            <div className="flex items-baseline justify-between border-b-2 border-rule pb-1.5">
              <h2 id="attempts-title" className="font-serif text-lg font-bold">
                {l.attempts}
              </h2>
              <span className="font-sans text-xs text-ink-faint tabular-nums">{sorted.length}</span>
            </div>
            <ol className="divide-y divide-rule-soft">
              {sorted.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/exam/${r.round}/result#${encodeURIComponent(r.id)}`}
                    className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-paper-sunk/60 sm:grid-cols-[11rem_1fr_auto_auto]"
                  >
                    <span className="col-span-2 font-sans text-xs text-ink-faint sm:col-span-1">
                      <time dateTime={new Date(r.finishedAt).toISOString()}>{fmt.format(r.finishedAt)}</time>
                    </span>
                    <span className="font-serif font-bold">
                      {t.round(r.round)}
                      <span className="ml-2 rounded-[3px] border border-rule-soft px-1 py-px align-middle font-sans text-[11px] font-normal text-ink-soft">
                        {r.mode === "exam" ? l.exam : l.practice}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 justify-self-end">
                      <span className="font-serif text-lg font-bold tabular-nums">{r.score}</span>
                      <span className="font-sans text-xs text-ink-faint">{l.points}</span>
                      <GradeBadge grade={r.grade} />
                    </span>
                    <span className="col-span-2 font-sans text-xs text-ink-faint tabular-nums sm:col-span-1 sm:text-right">
                      {t.timeUsed} {formatClock(r.elapsedMs)}
                      {r.autoSubmitted && <span className="ml-2 text-warn">{l.auto}</span>}
                      <span className="sr-only">, {l.view}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <div className="border-t border-rule pt-6">
            <ConfirmButton label={l.clear} question={l.clearQ} confirmLabel={l.clearOk} onConfirm={clearHistory} />
          </div>
        </>
      )}
    </div>
  );
}
