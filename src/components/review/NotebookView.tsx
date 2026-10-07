"use client";
// Wrong-answer notebook across all rounds. Questions are fetched per round from the static
// /api/exams/{round} JSON, only for rounds that appear in the notebook.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MARKERS, QuestionView } from "@/components/question/QuestionView";
import { ConfirmButton } from "@/components/site/ConfirmButton";
import { usePrefs, useStored } from "@/lib/prefs";
import { loadWrong, removeWrong, saveRetrySet } from "@/lib/storage";
import { ERAS, type Exam, type Question, type WrongEntry } from "@/lib/types";

const UNTAGGED = "untagged";

const L = {
  ko: {
    lead: "틀리거나 비워 둔 문항이 자동으로 모입니다. 다시 풀어 맞히면 정리하세요.",
    round: "회차",
    era: "시대",
    untagged: "시대 미분류",
    times: (n: number) => `${n}회 틀림`,
    removeQ: "노트에서 삭제할까요?",
    count: (n: number) => `${n}문항`,
    loading: "문항을 불러오는 중…",
    failed: "문항을 불러오지 못했습니다.",
    filtersEmpty: "조건에 맞는 문항이 없습니다.",
    goHome: "회차 목록으로",
    show: "문항 보기",
    hide: "접기",
  },
  en: {
    lead: "Wrong and blank answers collect here automatically. Remove them once you've got them.",
    round: "Round",
    era: "Era",
    untagged: "Untagged",
    times: (n: number) => `wrong ×${n}`,
    removeQ: "Remove from notebook?",
    count: (n: number) => `${n} question${n === 1 ? "" : "s"}`,
    loading: "Loading question…",
    failed: "Couldn't load this question.",
    filtersEmpty: "Nothing matches these filters.",
    goHome: "Browse rounds",
    show: "Show question",
    hide: "Hide",
  },
};

/** In-memory cache shared across visits within the tab. */
const examCache = new Map<number, Promise<Exam>>();
function fetchExam(round: number): Promise<Exam> {
  let p = examCache.get(round);
  if (!p) {
    p = fetch(`/api/exams/${round}`).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Exam>;
    });
    p.catch(() => examCache.delete(round));
    examCache.set(round, p);
  }
  return p;
}

type Loaded = Record<number, Exam | "error">;

export function NotebookView() {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const router = useRouter();
  const notebook = useStored<Record<string, WrongEntry> | null>(loadWrong, null);
  const [exams, setExams] = useState<Loaded>({});
  const [roundFilter, setRoundFilter] = useState("all");
  const [eraFilter, setEraFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(
    () => Object.values(notebook ?? {}).sort((a, b) => b.round - a.round || a.number - b.number),
    [notebook],
  );
  const rounds = useMemo(() => [...new Set(entries.map((e) => e.round))], [entries]);

  useEffect(() => {
    let alive = true;
    for (const round of rounds) {
      fetchExam(round).then(
        (exam) => alive && setExams((prev) => (prev[round] === exam ? prev : { ...prev, [round]: exam })),
        () => alive && setExams((prev) => ({ ...prev, [round]: "error" })),
      );
    }
    return () => {
      alive = false;
    };
  }, [rounds]);

  const questionOf = (e: WrongEntry): Question | null | undefined => {
    const exam = exams[e.round];
    if (exam === undefined) return undefined;
    if (exam === "error") return null;
    return exam.questions.find((q) => q.number === e.number) ?? null;
  };

  const eraOptions = useMemo(() => {
    const present = new Set<string>();
    for (const e of entries) {
      const exam = exams[e.round];
      if (!exam || exam === "error") continue;
      present.add(exam.questions.find((q) => q.number === e.number)?.era ?? UNTAGGED);
    }
    return [...ERAS.filter((era) => present.has(era)), ...(present.has(UNTAGGED) ? [UNTAGGED] : [])];
  }, [entries, exams]);
  // A filter whose option disappeared (its last entry was removed) falls back to "all".
  const activeRound = roundFilter !== "all" && rounds.includes(Number(roundFilter)) ? roundFilter : "all";
  const activeEra = eraFilter !== "all" && eraOptions.includes(eraFilter) ? eraFilter : "all";

  const filtered = entries.filter((e) => {
    if (activeRound !== "all" && e.round !== Number(activeRound)) return false;
    if (activeEra === "all") return true;
    const q = questionOf(e);
    if (!q) return false;
    return (q.era ?? UNTAGGED) === activeEra;
  });

  if (notebook === null) {
    return <div className="h-64 animate-pulse rounded bg-paper-sunk/60" aria-hidden />;
  }

  const selectCls =
    "min-h-10 w-full rounded-md border border-rule-soft bg-paper-raised px-2 font-sans text-sm text-ink sm:w-auto";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">{t.review}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{l.lead}</p>
      </header>

      {entries.length === 0 ? (
        <div className="border border-dashed border-rule-soft px-4 py-12 text-center">
          <p className="font-serif text-lg">{t.emptyNotebook}</p>
          <Link
            href="/"
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-ink px-4 font-sans text-sm font-medium hover:bg-paper-sunk"
          >
            {l.goHome}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-y border-rule py-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1 font-sans text-xs text-ink-faint">
              {l.round}
              <select value={activeRound} onChange={(e) => setRoundFilter(e.target.value)} className={selectCls}>
                <option value="all">{t.allRounds}</option>
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    {t.round(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-ink-faint">
              {l.era}
              <select value={activeEra} onChange={(e) => setEraFilter(e.target.value)} className={selectCls}>
                <option value="all">{t.allEras}</option>
                {eraOptions.map((era) => (
                  <option key={era} value={era}>
                    {era === UNTAGGED ? l.untagged : era}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between gap-3 sm:ml-auto">
              <span className="font-sans text-sm text-ink-soft tabular-nums" aria-live="polite">
                {l.count(filtered.length)}
              </span>
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => {
                  saveRetrySet(filtered.map((e) => e.id));
                  router.push("/review/retry");
                }}
                className="inline-flex min-h-11 items-center rounded-md border border-ink bg-ink px-4 font-sans text-sm font-medium text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.retryThese}
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">{l.filtersEmpty}</p>
          ) : (
            <ol className="divide-y divide-rule-soft">
              {filtered.map((e) => (
                <NotebookEntry
                  key={e.id}
                  entry={e}
                  question={questionOf(e)}
                  open={openId === e.id}
                  onToggle={() => setOpenId((cur) => (cur === e.id ? null : e.id))}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function NotebookEntry({
  entry: e,
  question: q,
  open,
  onToggle,
}: {
  entry: WrongEntry;
  /** undefined while loading, null when it couldn't be loaded. */
  question: Question | null | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const panelId = `nb-${e.id}`;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="shrink-0 pt-0.5 font-sans text-xs text-ink-faint">
            <span className="block">{t.round(e.round)}</span>
            <span className="block font-serif text-lg leading-tight font-bold text-ink tabular-nums">{e.number}.</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-[0.95rem] text-ink">
              {q === undefined ? l.loading : q === null ? l.failed : q.stem}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-ink-faint">
              {q?.era && <span className="rounded-[3px] border border-rule-soft px-1">{q.era}</span>}
              <span className="text-pen">{l.times(e.timesWrong)}</span>
              <span>
                {t.yourAnswer} {e.lastChoice ? MARKERS[e.lastChoice - 1] : t.blank}
              </span>
              <span className="underline decoration-dotted underline-offset-4">{open ? l.hide : l.show}</span>
            </span>
          </span>
        </button>
        <ConfirmButton
          label={t.mastered}
          question={l.removeQ}
          confirmLabel={t.remove}
          onConfirm={() => removeWrong(e.id)}
          className="shrink-0"
        />
      </div>
      {open && (
        <div id={panelId} className="mt-4 border-l-2 border-rule-soft pl-3 sm:pl-5">
          {q ? (
            <QuestionView question={q} selected={e.lastChoice} reveal label={t.round(e.round)} headingLevel="h3" />
          ) : (
            <p className="text-sm text-ink-soft">{q === undefined ? l.loading : l.failed}</p>
          )}
        </div>
      )}
    </li>
  );
}
