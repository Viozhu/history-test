// Server-only access to the generated exam data. Runs at build time (static generation).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Exam, ExamSummary, Explanation } from "./types";

const DIR = path.join(process.cwd(), "data", "exams");

export function getExamIndex(): ExamSummary[] {
  const list = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8")) as ExamSummary[];
  return list.sort((a, b) => b.round - a.round);
}

const EXPLANATIONS = path.join(process.cwd(), "data", "explanations");

/** Generated explanations for a round, keyed by question number ("1"–"50"). */
function readExplanations(round: number): Record<string, Partial<Explanation>> {
  const file = path.join(EXPLANATIONS, `${round}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { questions?: Record<string, Partial<Explanation>> })?.questions ?? {};
  } catch (err) {
    throw new Error(`Invalid explanations file ${file}: ${(err as Error).message}`);
  }
}

/** `explanations: false` leaves them out (exam mode never reveals, so the page needn't ship them). */
export function getExam(round: number | string, { explanations = true } = {}): Exam | null {
  const file = path.join(DIR, `${Number(round)}.json`);
  if (!/^\d+$/.test(String(round)) || !fs.existsSync(file)) return null;
  const exam = JSON.parse(fs.readFileSync(file, "utf8")) as Exam;
  if (!explanations) return exam;
  const byNumber = readExplanations(exam.round);
  for (const q of exam.questions) {
    const e = byNumber[String(q.number)];
    if (e?.ko && e.en) q.explanation = { ko: e.ko, en: e.en };
  }
  return exam;
}

export function roundParams(): { round: string }[] {
  return getExamIndex().map((e) => ({ round: String(e.round) }));
}
