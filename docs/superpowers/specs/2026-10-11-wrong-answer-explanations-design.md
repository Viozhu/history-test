# Wrong-answer explanations — design

Date: 2026-10-11 · Status: approved in chat, pending spec review

## Goal

When a question is answered wrong (or checked in practice), show a detailed explanation of
*why*: which clues in the material identify the topic, why the correct option fits, why each
of the other four options is wrong, with the user's own choice highlighted, and a takeaway.

## Decisions

| Topic | Decision |
|---|---|
| Source | Pre-generated, static JSON committed to the repo. No runtime AI, no API key, app stays fully static. |
| Language | Korean and English; the existing KO/EN preference picks one. English keeps key Korean terms with a gloss, e.g. "주먹도끼 (hand axe)". |
| Depth | Full breakdown: clues → identified topic → why the answer is right → why each wrong option is wrong (and what it actually belongs to) → key point. |
| Placement | Results review dialog, wrong-answer notebook, practice mode after "check", notebook retry session after answering. |
| Generator | One-time run of Claude Code subagents in a session (not a repeatable pipeline step). |
| Era tags | The same run also fills `data/era-map.json` (one of the 8 `ERAS`). |

## 1. Data

New directory `data/explanations/`, one file per round: `data/explanations/{round}.json`.
Kept separate from `data/exams/` because `scripts/build_data.py` regenerates exam files and
would overwrite anything stored there.

```jsonc
{
  "round": 79,
  "questions": {
    "1": {
      "era": "선사·고조선",
      "ko": {
        "clues": ["뗀석기", "주먹도끼", "공주 석장리", "웅기 굴포리"],
        "identifies": "구석기 시대",
        "correct": "구석기인은 이동 생활을 하며 동굴이나 강가의 막집에 살았다.",
        "options": [
          { "n": 1, "why": "가락바퀴로 실을 뽑은 것은 신석기 시대이다.", "belongsTo": "신석기" },
          { "n": 3, "why": "청동 방울은 청동기 시대의 의례 도구이다.", "belongsTo": "청동기" },
          { "n": 4, "why": "고인돌은 청동기 시대 지배층의 무덤이다.", "belongsTo": "청동기" },
          { "n": 5, "why": "빗살무늬 토기는 신석기 시대 토기이다.", "belongsTo": "신석기" }
        ],
        "point": "뗀석기·막집·이동 = 구석기 / 간석기·토기·정착 = 신석기"
      },
      "en": { "...": "same shape, English text" }
    }
  }
}
```

Types (`src/lib/types.ts`):

```ts
export interface OptionNote { n: Choice; why: string; belongsTo?: string }
export interface ExplanationText {
  clues: string[];       // 1–6 short clue phrases found in the material
  identifies: string;    // what the clues point to (era, person, event, institution…)
  correct: string;       // why the correct option is right
  options: OptionNote[]; // exactly the 4 wrong options, ascending n, none equal to answer
  point: string;         // one-line takeaway / contrast to remember
}
export interface Explanation { ko: ExplanationText; en: ExplanationText }
// Question gains: explanation?: Explanation
```

Loading: `src/lib/exams.ts#getExam` reads `data/explanations/{round}.json` if present and sets
`question.explanation` on each question. Missing file or entry → field absent. Because the
notebook loads questions through `/api/exams/[round]` (which uses `getExam`), it receives the
explanations with no extra work. Expected size ≈ 60–80 KB per round.

Era: `era` values are written into `data/era-map.json` (`{"79": {"1": "선사·고조선", …}}`), then
`npm run data` is rerun (OCR results are cached in `.cache/ocr`) so `era` lands in
`data/exams/{round}.json` the documented way. `era` in the explanation file is the record the
agents produce; era-map.json is derived from it.

## 2. Generation (one-time)

Input per question: the full original question image `public/exams/{round}/qNN.webp`
(`fallbackImage`), the answer number and points from `data/exams/{round}.json`, and the
parsed options text as a hint only. The image is authoritative because OCR text has errors
(e.g. "펜석기" for 뗀석기). For `optionsAreImages` / `useFallback` questions, options are
described from the image by number.

Rules given to each agent:
- The answer key is the truth. Never contradict it; if the agent believes the key is wrong,
  it still explains the keyed answer and records the question number in its report.
- Explain only what the material and options support; no invented quotes or dates.
- Korean in the style of 한능검 해설 (concise, exam terminology); English is a faithful
  translation with key terms kept in Korean plus gloss.

Process:
1. **Pilot**: round 79, questions 1–10. User reviews quality and tone before continuing.
2. **Fan-out**: remaining questions in parallel batches of ~25 questions (2 per round),
   each agent writing a partial file `data/explanations/.parts/{round}-{a|b}.json`;
   a merge step writes the final per-round file.
3. **Validate**: `node scripts/check_explanations.mjs` — for every round: 50 entries; `era`
   ∈ ERAS; `ko` and `en` both present; `clues` 1–6 non-empty; `options` has exactly the 4
   numbers ≠ answer, ascending; no empty strings. Exits non-zero with a report. Failures are
   regenerated.
4. **Spot-check**: a separate verifier agent reviews a random sample (≥ 3 per round) against
   the images for factual errors; flagged questions are regenerated.

## 3. UI

New `src/components/question/Explanation.tsx`:
- Props: `explanation: Explanation`, `answer: Choice`, `mine: Choice | null`.
- Picks `ko`/`en` from `usePrefs()`.
- Sections: 🔎 Clues (chips) → "identifies" line; ✅ answer marker + `correct`; ❌ list of
  wrong options with marker, `why`, `belongsTo` badge; the user's choice gets a "◀ 내 답 /
  Your answer" tag and emphasis; 💡 `point`.
- Labels added to the KO/EN label tables, matching existing patterns.

Integration: `QuestionView` renders `<Explanation>` below the options when `reveal` is true
and `question.explanation` exists. This covers the results dialog (`QuestionDialog`), practice
after check (`Runner`, `reveal={isChecked}`), and the notebook. The retry session must be
confirmed to render through the same path during implementation; if not, it passes `reveal`
after answering. In the notebook the explanation is wrapped in a collapsed `<details>` so the
list stays scannable (QuestionView gets a `collapseExplanation` prop).

Error handling: no explanation → nothing rendered; layout identical to today.

## 4. Testing

No test framework exists in the repo; verification is:
- `node scripts/check_explanations.mjs` passes for all 11 rounds.
- `npm run lint` and `npm run build` pass.
- Browser check (Playwright) of all four placements, KO and EN, light and dark, including
  a blank answer (no "your answer" tag) and an image-option question.

## Out of scope

Live AI follow-ups, explanations for future rounds via a pipeline step, editing UI.
