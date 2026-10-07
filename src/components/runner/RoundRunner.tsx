"use client";
// Exam and practice sessions for one round: resumes the saved attempt (or starts one),
// autosaves it, and grades it on submit.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { scoreAttempt } from "@/lib/grade";
import { useHydrated } from "@/lib/prefs";
import { addResult, clearAttempt, loadAttempt, loadPrefs, newId, recordWrong, saveAttempt } from "@/lib/storage";
import type { Attempt, Exam, Mode, Question } from "@/lib/types";
import { QuestionView } from "@/components/question/QuestionView";
import { Runner } from "./Runner";

function shuffled(list: number[]): number[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function newAttempt(exam: Exam, mode: Mode, shuffle: boolean): Attempt {
  const numbers = exam.questions.map((q) => q.number).sort((x, y) => x - y);
  const now = Date.now();
  return {
    id: newId(),
    round: exam.round,
    mode,
    startedAt: now,
    updatedAt: now,
    elapsedMs: 0,
    paused: false,
    answers: {},
    flags: [],
    checked: [],
    order: mode === "practice" && shuffle ? shuffled(numbers) : numbers,
    current: 0,
  };
}

/** The saved attempt if it still matches this round's questions, otherwise a new one. */
function resumeOrStart(exam: Exam, mode: Mode): Attempt {
  const saved = loadAttempt(mode, exam.round);
  const numbers = new Set(exam.questions.map((q) => q.number));
  if (
    saved &&
    saved.order.length === numbers.size &&
    saved.order.every((n) => numbers.has(n)) &&
    (mode === "practice" || saved.order.every((n, i) => i === 0 || n > saved.order[i - 1]))
  ) {
    return { ...saved, current: Math.min(Math.max(saved.current, 0), saved.order.length - 1) };
  }
  return newAttempt(exam, mode, loadPrefs().shufflePractice);
}

export function RoundRunner({ exam, mode }: { exam: Exam; mode: Mode }) {
  const hydrated = useHydrated();
  // Storage exists only in the browser: render a stable skeleton until hydrated.
  // Showing question 1 for real (most sessions start there) lets the page paint its main
  // content before hydration instead of a placeholder.
  if (!hydrated) return <RunnerSkeleton title={exam.title} first={exam.questions[0]} />;
  return <Loaded exam={exam} mode={mode} />;
}

function Loaded({ exam, mode }: { exam: Exam; mode: Mode }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<Attempt>(() => resumeOrStart(exam, mode));
  const questions = useMemo(() => {
    const map: Record<number, Question> = {};
    for (const q of exam.questions) map[q.number] = q;
    return map;
  }, [exam]);

  const finish = (a: Attempt, auto: boolean) => {
    const result = scoreAttempt(exam, a.answers, {
      id: newId(),
      mode,
      startedAt: a.startedAt,
      elapsedMs: a.elapsedMs,
      autoSubmitted: auto,
    });
    addResult(result);
    // Practice already recorded each wrong answer when it was checked.
    if (mode === "exam") for (const n of result.wrong) recordWrong(exam.round, n, a.answers[n] ?? null);
    clearAttempt(mode, exam.round);
    router.push(`/exam/${exam.round}/result#${result.id}`);
  };

  const restart = (shuffle?: boolean) => {
    clearAttempt(mode, exam.round);
    const next = newAttempt(exam, mode, shuffle ?? loadPrefs().shufflePractice);
    saveAttempt(next);
    setAttempt(next);
  };

  return (
    <Runner
      key={attempt.id}
      kind={mode}
      title={exam.title}
      ocr={exam.source === "ocr"}
      questions={questions}
      initial={attempt}
      persist={saveAttempt}
      onFinish={finish}
      onRestart={restart}
    />
  );
}

export function RunnerSkeleton({ title, first }: { title: string; first?: Question }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper" aria-busy="true">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 lg:px-4">
          <span className="ml-12 truncate font-serif text-sm font-bold sm:text-base">{title}</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-10">
        {first ? (
          <QuestionView question={first} selected={null} priority />
        ) : (
          <div className="space-y-3">
            <div className="h-6 w-3/4 rounded bg-paper-sunk" />
            <div className="h-48 rounded bg-paper-sunk" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded bg-paper-sunk/70" />
            ))}
          </div>
        )}
        <div className="hidden h-[32rem] rounded-md border-2 border-omr-soft lg:block" />
      </div>
    </div>
  );
}
