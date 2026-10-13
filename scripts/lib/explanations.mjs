// Validation of generated explanations (data/explanations/{round}.json) against the exam's
// answer key. Pure functions; used by check_explanations.mjs and its tests.

export const ERAS = ["선사·고조선", "삼국·남북국", "고려", "조선 전기", "조선 후기", "개항기", "일제강점기", "현대"];

const filled = (s) => typeof s === "string" && s.trim() !== "";

function checkText(where, x, answer, errs) {
  if (!x || typeof x !== "object") return errs.push(`${where}: missing`);
  if (!Array.isArray(x.clues) || x.clues.length < 1 || x.clues.length > 6 || !x.clues.every(filled))
    errs.push(`${where}: clues must have 1–6 non-empty strings`);
  for (const k of ["identifies", "correct", "point"]) if (!filled(x[k])) errs.push(`${where}: ${k} is empty`);
  const want = [1, 2, 3, 4, 5].filter((n) => n !== answer);
  const got = Array.isArray(x.options) ? x.options.map((o) => o?.n) : [];
  if (JSON.stringify(got) !== JSON.stringify(want)) errs.push(`${where}: options must be [${want}] (got [${got}])`);
  for (const o of Array.isArray(x.options) ? x.options : []) {
    if (!filled(o?.why)) errs.push(`${where}: option ${o?.n} why is empty`);
    if (o?.belongsTo !== undefined && !filled(o.belongsTo)) errs.push(`${where}: option ${o.n} belongsTo is empty`);
  }
}

/** Returns error messages for one round file; [] when valid. A voided question (answer null)
 * needs a note for all five options. */
export function validateRound(exam, file, { partial = false } = {}) {
  const errs = [];
  const r = exam.round;
  if (file.round !== r) errs.push(`round ${file.round} does not match ${r}`);
  const qs = file.questions ?? {};
  const byNumber = new Map(exam.questions.map((q) => [String(q.number), q]));
  for (const key of Object.keys(qs)) if (!byNumber.has(key)) errs.push(`${r} q${key}: not in exam`);
  for (const [key, q] of byNumber) {
    const e = qs[key];
    if (!e) {
      if (!partial) errs.push(`${r} q${key}: missing`);
      continue;
    }
    if (!ERAS.includes(e.era)) errs.push(`${r} q${key}: unknown era '${e.era}'`);
    for (const lang of ["ko", "en"]) checkText(`${r} q${key} ${lang}`, e[lang], q.answer, errs);
  }
  return errs;
}
