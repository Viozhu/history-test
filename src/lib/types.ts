// Shapes of the generated data (scripts/build_data.py) and of what the app stores locally.

export const ERAS = [
  "선사·고조선",
  "삼국·남북국",
  "고려",
  "조선 전기",
  "조선 후기",
  "개항기",
  "일제강점기",
  "현대",
] as const;
export type Era = (typeof ERAS)[number];

export interface ImageRef {
  src: string; // path under /public, e.g. /exams/79/q01-m.webp
  width: number;
  height: number;
  alt?: string;
}

/** Why one wrong option is wrong (data/explanations/{round}.json). */
export interface OptionNote {
  n: Choice;
  why: string;
  /** What the option actually describes, e.g. "신석기". */
  belongsTo?: string;
}

export interface ExplanationText {
  clues: string[];
  identifies: string;
  correct: string;
  /** The four wrong options, ascending. */
  options: OptionNote[];
  point: string;
}

export interface Explanation {
  ko: ExplanationText;
  en: ExplanationText;
}

/** Material printed once for a group of questions ("[47~48] 다음을 읽고 물음에 답하시오"). */
export interface SharedMaterial {
  range: [number, number];
  image: ImageRef;
  passage: string | null;
}

export interface Question {
  id: string; // "79-01"
  round: number;
  number: number; // 1–50
  points: 1 | 2 | 3;
  answer: 1 | 2 | 3 | 4 | 5;
  stem: string;
  passage: string | null; // text of the material, used as alt text / for search
  images: ImageRef[]; // material crop (사료, maps, photos) shown under the stem
  options: [string, string, string, string, string]; // "" when shown inside an image
  optionsAreImages: boolean; // options are pictures inside images[0]
  era: Era | null;
  shared?: SharedMaterial | null; // shown above the question's own material
  explanation?: Explanation; // merged from data/explanations at build time; absent if not written yet
  fallbackImage: ImageRef; // the whole question as printed
  useFallback: boolean; // parsing failed: render fallbackImage + ①–⑤ buttons
  source: "text" | "ocr";
}

export interface Exam {
  round: number;
  title: string;
  year: number | null;
  date: string | null;
  timeLimitMinutes: number;
  source: "text" | "ocr";
  totalPoints: number;
  questions: Question[];
}

export type ExamSummary = Pick<Exam, "round" | "title" | "year" | "date" | "source" | "timeLimitMinutes">;

export type Mode = "exam" | "practice";
export type Choice = 1 | 2 | 3 | 4 | 5;

/** An attempt in progress, autosaved on every change. */
export interface Attempt {
  id: string;
  round: number;
  mode: Mode;
  startedAt: number; // epoch ms
  updatedAt: number;
  /** Time spent with the page open and not paused, in ms. */
  elapsedMs: number;
  paused: boolean;
  /** answers[questionNumber] = chosen option. Missing = blank. */
  answers: Record<number, Choice>;
  flags: number[]; // question numbers
  /** Practice: question numbers whose answer has been checked (feedback shown). */
  checked: number[];
  /** Question numbers in display order (shuffled in practice when requested). */
  order: number[];
  current: number; // index into order
}

export type Grade = "1급" | "2급" | "3급" | "불합격";

export interface Breakdown {
  correct: number;
  total: number;
  earned: number;
  possible: number;
}

/** A finished attempt, kept in history. */
export interface AttemptResult {
  id: string;
  round: number;
  mode: Mode;
  startedAt: number;
  finishedAt: number;
  elapsedMs: number;
  timeLimitMs: number;
  answers: Record<number, Choice>;
  score: number;
  grade: Grade;
  correctCount: number;
  byPoints: Record<"1" | "2" | "3", Breakdown>;
  byEra: Partial<Record<Era, Breakdown>>;
  wrong: number[]; // question numbers answered wrong or left blank
  autoSubmitted: boolean;
}

/** An entry in the wrong-answer notebook. */
export interface WrongEntry {
  id: string; // question id "79-01"
  round: number;
  number: number;
  lastChoice: Choice | null;
  timesWrong: number;
  addedAt: number;
  lastWrongAt: number;
}

export type Lang = "ko" | "en";
export type LayoutMode = "single" | "scroll";
export type Theme = "system" | "light" | "dark";

export interface Prefs {
  lang: Lang;
  layout: LayoutMode;
  theme: Theme;
  shufflePractice: boolean;
}
