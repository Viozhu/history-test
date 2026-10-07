import type { Attempt, AttemptResult, Breakdown, Choice, Era, Exam, Grade, Mode } from "./types";

export const TIME_LIMIT_MS = 80 * 60 * 1000;

export function gradeFor(score: number): Grade {
  if (score >= 80) return "1급";
  if (score >= 70) return "2급";
  if (score >= 60) return "3급";
  return "불합격";
}

const empty = (): Breakdown => ({ correct: 0, total: 0, earned: 0, possible: 0 });

export function scoreAttempt(
  exam: Exam,
  answers: Record<number, Choice>,
  meta: { id: string; mode: Mode; startedAt: number; elapsedMs: number; autoSubmitted?: boolean },
): AttemptResult {
  const byPoints: AttemptResult["byPoints"] = { "1": empty(), "2": empty(), "3": empty() };
  const byEra: Partial<Record<Era, Breakdown>> = {};
  const wrong: number[] = [];
  let score = 0;
  let correctCount = 0;
  for (const q of exam.questions) {
    const ok = answers[q.number] === q.answer;
    const buckets = [byPoints[String(q.points) as "1" | "2" | "3"]];
    if (q.era) buckets.push((byEra[q.era] ??= empty()));
    for (const b of buckets) {
      b.total += 1;
      b.possible += q.points;
      if (ok) {
        b.correct += 1;
        b.earned += q.points;
      }
    }
    if (ok) {
      score += q.points;
      correctCount += 1;
    } else {
      wrong.push(q.number);
    }
  }
  return {
    id: meta.id,
    round: exam.round,
    mode: meta.mode,
    startedAt: meta.startedAt,
    finishedAt: Date.now(),
    elapsedMs: meta.mode === "exam" ? Math.min(meta.elapsedMs, TIME_LIMIT_MS) : meta.elapsedMs,
    timeLimitMs: TIME_LIMIT_MS,
    answers,
    score,
    grade: gradeFor(score),
    correctCount,
    byPoints,
    byEra,
    wrong,
    autoSubmitted: meta.autoSubmitted ?? false,
  };
}

export function blankNumbers(exam: Exam, attempt: Pick<Attempt, "answers">): number[] {
  return exam.questions.filter((q) => !attempt.answers[q.number]).map((q) => q.number);
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
