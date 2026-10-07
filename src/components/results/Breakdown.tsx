"use client";
import { usePrefs } from "@/lib/prefs";
import type { Breakdown as B } from "@/lib/types";

const L = {
  ko: { category: "구분", correct: "정답 / 문항", earned: "득점 / 배점", rate: "정답률" },
  en: { category: "Group", correct: "Correct / total", earned: "Points / possible", rate: "Accuracy" },
};

/** A ruled table of correct/total and points earned/possible, with a thin bar per row. */
export function BreakdownTable({ id, title, rows }: { id: string; title: string; rows: [string, B][] }) {
  const { prefs } = usePrefs();
  const l = L[prefs.lang];
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="border-b-2 border-rule pb-1.5 font-serif text-lg font-bold">
        {title}
      </h2>
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="border-b border-rule-soft text-left text-xs text-ink-faint">
            <th scope="col" className="py-2 pr-2 font-medium">
              {l.category}
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              {l.correct}
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              {l.earned}
            </th>
            <th scope="col" className="hidden w-1/3 py-2 font-medium sm:table-cell">
              <span className="sr-only">{l.rate}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, b]) => {
            const pct = b.possible ? Math.round((b.earned / b.possible) * 100) : 0;
            return (
              <tr key={label} className="border-b border-rule-soft">
                <th scope="row" className="py-2 pr-2 text-left font-serif font-medium">
                  {label}
                </th>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {b.correct} / {b.total}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {b.earned} / {b.possible}
                </td>
                <td className="hidden py-2 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-paper-sunk" aria-hidden>
                      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs text-ink-faint tabular-nums">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
