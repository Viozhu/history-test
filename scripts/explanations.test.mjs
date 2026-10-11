import test from "node:test";
import assert from "node:assert/strict";
import { validateRound } from "./lib/explanations.mjs";

const exam = {
  round: 99,
  questions: [
    { number: 1, answer: 2 },
    { number: 2, answer: 5 },
  ],
};

const text = (answer) => ({
  clues: ["뗀석기", "주먹도끼"],
  identifies: "구석기 시대",
  correct: "구석기인은 막집에 살았다.",
  options: [1, 2, 3, 4, 5].filter((n) => n !== answer).map((n) => ({ n, why: `${n}번 설명`, belongsTo: "신석기" })),
  point: "뗀석기 = 구석기",
});
const entry = (answer) => ({ era: "선사·고조선", ko: text(answer), en: text(answer) });
const full = () => ({ round: 99, questions: { 1: entry(2), 2: entry(5) } });

test("accepts a complete valid file", () => {
  assert.deepEqual(validateRound(exam, full()), []);
});

test("requires every question unless partial", () => {
  const f = full();
  delete f.questions[2];
  assert.match(validateRound(exam, f).join("\n"), /q2: missing/);
  assert.deepEqual(validateRound(exam, f, { partial: true }), []);
});

test("rejects options that include the answer", () => {
  const f = full();
  f.questions[1].ko.options[0] = { n: 2, why: "x" };
  assert.match(validateRound(exam, f).join("\n"), /q1 ko: options must be \[1,3,4,5\]/);
});

test("rejects unknown era, empty strings, bad clue count, missing language", () => {
  const f = full();
  f.questions[1].era = "중세";
  f.questions[1].ko.point = " ";
  f.questions[1].ko.clues = [];
  delete f.questions[2].en;
  const errs = validateRound(exam, f).join("\n");
  assert.match(errs, /q1: unknown era/);
  assert.match(errs, /q1 ko: point is empty/);
  assert.match(errs, /q1 ko: clues must have 1–6/);
  assert.match(errs, /q2 en: missing/);
});

test("rejects round mismatch and unknown question numbers", () => {
  const f = full();
  f.round = 98;
  f.questions[7] = entry(1);
  const errs = validateRound(exam, f).join("\n");
  assert.match(errs, /round 98 does not match 99/);
  assert.match(errs, /q7: not in exam/);
});
