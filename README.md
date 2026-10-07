# history-test — 한국사능력검정시험 심화 simulator

An exam-faithful, fully static web app for practicing the Korean History Proficiency Test,
advanced level (한국사능력검정시험 심화), built from the official past exams published by
국사편찬위원회 (rounds 69–79).

- **Exam mode** (`/exam/[round]`): 80-minute timer (amber < 10 min, red < 5), no feedback until
  submission, confirmation listing blank questions, auto-submit at 0, pause (marked as not
  allowed in the real exam).
- **Practice mode** (`/practice/[round]`): check each answer, correct option highlighted,
  optional shuffle.
- **Results** (`/exam/[round]/result`): red-pen grading reveal, score, grade
  (1급 ≥ 80 · 2급 70–79 · 3급 60–69 · 불합격), breakdown by points and era, review of each question.
- **Wrong-answer notebook** (`/review`) with filters and a "retry these" session, and
  **history** (`/history`) with a score trend.
- OMR answer card, keyboard shortcuts (1–5, ← →, F, G, Enter, ?), two layouts
  (one question per screen / continuous booklet), KO/EN interface labels, dark mode.

Everything is stored in `localStorage` (attempts autosave on every change). There is no backend.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static build; every round is prerendered
```

Deploy on Vercel with zero configuration (framework preset: Next.js).

## Data pipeline

The app reads `data/exams/{round}.json` and `public/exams/{round}/*.webp`, both generated from
the PDFs (question booklet 문제지 + answer key 정답표 per round) and committed to the repo.
To regenerate them you need the PDFs and macOS:

```bash
npm run data:list                      # show the round → booklet/answer-key mapping
npm run data                           # all rounds
.venv/bin/python scripts/build_data.py --rounds 77,79 --src "/path/to/pdfs"
```

By default the PDFs are read from `../Questions & awnsers` (never modified).

How it works (`scripts/build_data.py`, Python + PyMuPDF):

1. **Answer keys** are parsed into answer + points and validated: exactly 50 questions, answers
   1–5, points 1–3 summing to 100. An invalid key stops the run with a report.
2. **Booklets**: 6 rounds have a text layer; 5 (69, 73, 74, 78, 79) have their text converted to
   vector outlines, so they are OCR'd with Apple Vision (`scripts/ocr.swift`, Korean) — Tesseract
   produced unusable Korean in tests.
3. Questions are located by their `N.` headers in the two-column layout. For each question the
   stem and the five options are extracted as text; the material (사료, maps, photos) is cropped
   as a WebP image whose alt text is the extracted text; the whole question is also cropped as
   `fallbackImage`. When options can't be parsed (e.g. picture or timeline options), the app
   shows the original question image with ①–⑤ buttons.
4. The `[N점]` tag printed in the booklet is cross-checked against the answer key.
5. `reports/review-report.md` lists questions that used the fallback or look suspicious.

Editable files (rerun the pipeline after editing):

- `data/era-map.json` — era tag per question (선사·고조선 … 현대), used for the era breakdown and
  notebook filter. Empty by default; no tags are guessed.
- `data/rounds-meta.json` — exam date per round.
