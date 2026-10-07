"use client";
// "Retry these" session for the wrong-answer notebook: a practice-style run over questions
// from several rounds. Kept in memory; the notebook itself is updated as you go.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useHydrated, usePrefs } from "@/lib/prefs";
import { loadRetrySet, newId } from "@/lib/storage";
import type { Attempt, Exam, Question } from "@/lib/types";
import { runnerLabels } from "./labels";
import { RunnerSkeleton } from "./RoundRunner";
import { Runner } from "./Runner";

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; questions: Question[] };

function parseId(id: string): { round: number; number: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(id);
  return m ? { round: Number(m[1]), number: Number(m[2]) } : null;
}

async function loadQuestions(ids: string[]): Promise<Question[]> {
  const refs = ids.map(parseId).filter((r): r is { round: number; number: number } => r !== null);
  const rounds = [...new Set(refs.map((r) => r.round))];
  const exams = new Map<number, Exam>();
  await Promise.all(
    rounds.map(async (round) => {
      const res = await fetch(`/api/exams/${round}`);
      if (res.ok) exams.set(round, (await res.json()) as Exam);
    }),
  );
  if (rounds.length > 0 && exams.size === 0) throw new Error("no rounds loaded");
  return refs.flatMap((r) => exams.get(r.round)?.questions.find((q) => q.number === r.number) ?? []);
}

function newSession(count: number): Attempt {
  const now = Date.now();
  return {
    id: newId(),
    round: 0,
    mode: "practice",
    startedAt: now,
    updatedAt: now,
    elapsedMs: 0,
    paused: false,
    answers: {},
    flags: [],
    checked: [],
    order: Array.from({ length: count }, (_, i) => i + 1),
    current: 0,
  };
}

export function RetrySession() {
  const hydrated = useHydrated();
  const { t } = usePrefs();
  if (!hydrated) return <RunnerSkeleton title={t.retryThese} />;
  return <Loaded />;
}

function Loaded() {
  const { t, prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  const [ids] = useState(loadRetrySet);
  const [load, setLoad] = useState<Load>(() => (ids.length ? { status: "loading" } : { status: "ready", questions: [] }));
  const [session, setSession] = useState<Attempt | null>(null);
  const [done, setDone] = useState<{ ok: number; total: number } | null>(null);

  useEffect(() => {
    if (!ids.length) return;
    let live = true;
    loadQuestions(ids)
      .then((questions) => {
        if (!live) return;
        setLoad({ status: "ready", questions });
        setSession(newSession(questions.length));
      })
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [ids]);

  const byKey = useMemo(() => {
    const map: Record<number, Question> = {};
    if (load.status === "ready") load.questions.forEach((q, i) => (map[i + 1] = q));
    return map;
  }, [load]);

  if (load.status === "loading") return <RunnerSkeleton title={L.retryTitle} />;

  if (load.status === "error" || load.questions.length === 0 || !session) {
    return (
      <Notice
        title={L.retryTitle}
        text={load.status === "error" ? L.loadFailed : L.retryEmpty}
        link={L.backToNotebook}
      />
    );
  }

  if (done) {
    return (
      <Notice title={L.retryDone} text={L.retryScore(done.ok, done.total)} link={L.backToNotebook}>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setSession(newSession(load.questions.length));
          }}
          className="inline-flex min-h-11 items-center rounded-md border border-rule-soft px-5 text-sm hover:bg-paper-sunk"
        >
          {L.again}
        </button>
      </Notice>
    );
  }

  return (
    <Runner
      key={session.id}
      kind="retry"
      title={L.retryTitle}
      questions={byKey}
      initial={session}
      labelFor={(q) => t.round(q.round)}
      describe={(k) => `${k}. ${t.round(byKey[k].round)} ${byKey[k].number}번`}
      onFinish={(a) =>
        setDone({ ok: a.order.filter((k) => a.answers[k] === byKey[k].answer).length, total: a.order.length })
      }
    />
  );
}

function Notice({
  title,
  text,
  link,
  children,
}: {
  title: string;
  text: string;
  link: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center font-sans">
      <h1 className="font-serif text-xl font-bold">{title}</h1>
      <p role="status" className="text-ink-soft">
        {text}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/review"
          className="inline-flex min-h-11 items-center rounded-md border border-ink bg-ink px-5 text-sm font-medium text-paper"
        >
          {link}
        </Link>
        {children}
      </div>
    </main>
  );
}
