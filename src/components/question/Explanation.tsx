"use client";
// Explanation (해설) of a revealed question: clues in the material, why the keyed answer is
// right, why each other option is wrong (the user's pick marked), and a takeaway. For a voided
// question (answer null) `correct` explains the annulment and all five options are listed.
import { usePrefs } from "@/lib/prefs";
import type { Choice, Explanation as ExplanationData } from "@/lib/types";
import { MARKERS } from "./QuestionView";

export function Explanation({
  explanation,
  answer,
  mine,
  collapsed = false,
  headingLevel,
}: {
  explanation: ExplanationData;
  answer: Choice | null;
  /** The user's choice (null = blank): tagged "your answer". */
  mine: Choice | null;
  /** Wrap in a closed <details> (notebook list). */
  collapsed?: boolean;
  headingLevel: "h3" | "h4";
}) {
  const { prefs, t } = usePrefs();
  const x = explanation[prefs.lang];
  if (!x) return null;
  const Heading = headingLevel;
  const label = "mb-1.5 text-xs font-bold tracking-wide text-ink-soft";
  const mineTag = <span className="shrink-0 text-xs font-bold text-bad">◀ {t.yourAnswer}</span>;

  const body = (
    <div className="space-y-4 font-sans text-sm leading-relaxed text-ink">
      <div>
        <p className={label}>🔎 {t.explClues}</p>
        <ul className="flex flex-wrap gap-1.5">
          {x.clues.map((c) => (
            <li key={c} className="rounded-[3px] border border-rule-soft bg-paper-raised px-1.5 py-0.5 font-serif">
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          → <strong className="font-serif">{x.identifies}</strong>
        </p>
      </div>

      <div>
        <p className={label}>✅ {t.explWhyRight}</p>
        <p className="flex items-start gap-2">
          <span className="font-bold text-ok">{answer ? MARKERS[answer - 1] : "–"}</span>
          <span className="flex-1 font-serif">{x.correct}</span>
          {answer && mine === answer && <span className="shrink-0 text-xs font-bold text-ok">◀ {t.yourAnswer}</span>}
        </p>
      </div>

      <div>
        <p className={label}>{answer === null ? `🔍 ${t.explAllOptions}` : `❌ ${t.explWhyWrong}`}</p>
        <ul className="space-y-1">
          {x.options.map((o) => {
            const isMine = o.n === mine;
            // Voided question: the user's pick was credited, so it is not marked as wrong.
            const mineStyle = answer === null ? "border-rule-soft bg-paper-sunk" : "border-bad bg-bad-soft";
            return (
              <li
                key={o.n}
                className={`flex items-start gap-2 rounded-md border px-2 py-1 ${isMine ? mineStyle : "border-transparent"}`}
              >
                <span className="text-ink-soft">{MARKERS[o.n - 1]}</span>
                <span className="flex-1 font-serif">{o.why}</span>
                {o.belongsTo && (
                  <span className="shrink-0 rounded-[3px] border border-rule-soft px-1 text-xs text-ink-faint">
                    {o.belongsTo}
                  </span>
                )}
                {isMine && (answer === null ? <span className="shrink-0 text-xs font-bold text-ok">◀ {t.yourAnswer}</span> : mineTag)}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className={label}>💡 {t.explPoint}</p>
        <p className="rounded-md bg-paper-sunk px-3 py-2 font-serif">{x.point}</p>
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <details className="mt-5 rounded-md border border-rule-soft px-3 py-2">
        <summary className="cursor-pointer font-sans text-sm font-medium text-ink underline decoration-dotted underline-offset-4">
          {t.showExplanation}
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }
  return (
    <section className="mt-5 border-t border-rule pt-4" aria-label={t.explanation}>
      <Heading className="mb-3 font-serif text-base font-bold">{t.explanation}</Heading>
      {body}
    </section>
  );
}
