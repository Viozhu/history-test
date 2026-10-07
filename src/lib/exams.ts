// Server-only access to the generated exam data. Runs at build time (static generation).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Exam, ExamSummary } from "./types";

const DIR = path.join(process.cwd(), "data", "exams");

export function getExamIndex(): ExamSummary[] {
  const list = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8")) as ExamSummary[];
  return list.sort((a, b) => b.round - a.round);
}

export function getExam(round: number | string): Exam | null {
  const file = path.join(DIR, `${Number(round)}.json`);
  if (!/^\d+$/.test(String(round)) || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Exam;
}

export function roundParams(): { round: string }[] {
  return getExamIndex().map((e) => ({ round: String(e.round) }));
}
