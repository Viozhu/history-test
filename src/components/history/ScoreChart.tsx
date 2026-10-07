"use client";
// Score trend as a hand-built SVG line chart (no chart library). Exam-mode attempts are joined
// by a line; practice attempts are drawn as hollow, unconnected points. A visually hidden table
// carries the same data for screen readers.
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "@/lib/prefs";
import type { AttemptResult } from "@/lib/types";

const H = 240;
const M = { top: 14, right: 40, bottom: 30, left: 32 };
const LINES = [
  { score: 80, label: "1급" },
  { score: 70, label: "2급" },
  { score: 60, label: "3급" },
];

const L = {
  ko: {
    exam: "실전",
    practice: "연습",
    legendExam: "실전 모의고사 (선으로 연결)",
    legendPractice: "연습 모드 (속이 빈 점)",
    summary: (n: number, last: number | null, best: number | null) =>
      n === 0 ? "아직 실전 응시 기록이 없습니다." : `실전 ${n}회 응시, 최근 ${last}점, 최고 ${best}점.`,
    point: (round: number, mode: string, date: string, score: number, grade: string) =>
      `제${round}회 ${mode} · ${date} · ${score}점 (${grade})`,
    date: "날짜",
    round: "회차",
    mode: "모드",
    score: "점수",
    grade: "등급",
  },
  en: {
    exam: "Exam",
    practice: "Practice",
    legendExam: "Exam mode (joined by a line)",
    legendPractice: "Practice (hollow points)",
    summary: (n: number, last: number | null, best: number | null) =>
      n === 0 ? "No exam-mode attempts yet." : `${n} exam-mode attempt${n === 1 ? "" : "s"}, latest ${last}, best ${best}.`,
    point: (round: number, mode: string, date: string, score: number, grade: string) =>
      `Round ${round} ${mode} · ${date} · ${score} (${grade})`,
    date: "Date",
    round: "Round",
    mode: "Mode",
    score: "Score",
    grade: "Grade",
  },
};

export function ScoreChart({ results }: { results: AttemptResult[] }) {
  const { prefs, t } = usePrefs();
  const l = L[prefs.lang];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = [...results].sort((a, b) => a.finishedAt - b.finishedAt);
  const exams = data.filter((r) => r.mode === "exam");
  const n = data.length;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (s: number) => M.top + (1 - s / 100) * plotH;

  const locale = prefs.lang === "ko" ? "ko-KR" : "en-US";
  const short = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" });
  const long = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 52))));
  const modeName = (r: AttemptResult) => (r.mode === "exam" ? l.exam : l.practice);

  const examPath = data
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.mode === "exam")
    .map(({ r, i }, k) => `${k ? "L" : "M"}${x(i).toFixed(1)} ${y(r.score).toFixed(1)}`)
    .join(" ");

  const summary = l.summary(exams.length, exams.at(-1)?.score ?? null, exams.length ? Math.max(...exams.map((r) => r.score)) : null);
  const activeR = active != null ? data[active] : null;

  return (
    <section aria-labelledby="trend-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-rule pb-1.5">
        <h2 id="trend-title" className="font-serif text-lg font-bold">
          {t.scoreTrend}
        </h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-ink-soft">
          <li className="flex items-center gap-1.5">
            <svg width="22" height="10" aria-hidden>
              <line x1="1" y1="5" x2="21" y2="5" stroke="currentColor" strokeWidth="1.5" className="text-ink" />
              <circle cx="11" cy="5" r="3.5" className="fill-ink" />
            </svg>
            {l.legendExam}
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="12" height="10" aria-hidden>
              <circle cx="6" cy="5" r="3.5" className="fill-paper stroke-ink-soft" strokeWidth="1.5" />
            </svg>
            {l.legendPractice}
          </li>
        </ul>
      </div>

      <div ref={wrapRef} className="relative mt-3 w-full">
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-labelledby="trend-title trend-desc"
          className="block max-w-full font-sans"
          onPointerLeave={() => setActive(null)}
        >
          <desc id="trend-desc">{summary}</desc>

          {[0, 20, 40, 60, 80, 100].map((s) => (
            <g key={s}>
              <line x1={M.left} x2={width - M.right} y1={y(s)} y2={y(s)} className="stroke-rule-soft" strokeWidth={s === 0 ? 1 : 0.5} />
              <text x={M.left - 6} y={y(s)} dy="0.32em" textAnchor="end" className="fill-ink-faint text-[10px] tabular-nums">
                {s}
              </text>
            </g>
          ))}

          {LINES.map((g) => (
            <g key={g.score}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(g.score)}
                y2={y(g.score)}
                className="stroke-seal"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.7}
              />
              <text x={width - M.right + 6} y={y(g.score)} dy="0.32em" className="fill-seal font-serif text-[11px] font-bold">
                {g.label}
              </text>
            </g>
          ))}

          {data.map((r, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={r.id} x={x(i)} y={H - 10} textAnchor="middle" className="fill-ink-faint text-[10px] tabular-nums">
                {short.format(r.finishedAt)}
              </text>
            ) : null,
          )}

          {examPath && <path d={examPath} fill="none" className="stroke-ink" strokeWidth={1.75} strokeLinejoin="round" />}

          {data.map((r, i) => (
            <g key={r.id} onPointerEnter={() => setActive(i)} onClick={() => setActive(i)}>
              <circle cx={x(i)} cy={y(r.score)} r={12} fill="transparent" />
              <circle
                cx={x(i)}
                cy={y(r.score)}
                r={active === i ? 5.5 : 4}
                strokeWidth={1.75}
                className={r.mode === "exam" ? "fill-ink stroke-ink" : "fill-paper stroke-ink-soft"}
              >
                <title>{l.point(r.round, modeName(r), long.format(r.finishedAt), r.score, r.grade)}</title>
              </circle>
            </g>
          ))}
        </svg>

        {activeR && active != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-rule bg-paper-raised px-2 py-1 font-sans text-xs whitespace-nowrap text-ink shadow"
            style={{
              left: Math.min(Math.max(x(active), 90), width - 90),
              top: y(activeR.score) - 10,
            }}
          >
            {l.point(activeR.round, modeName(activeR), long.format(activeR.finishedAt), activeR.score, activeR.grade)}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>
          {t.scoreTrend}: {summary}
        </caption>
        <thead>
          <tr>
            <th scope="col">{l.date}</th>
            <th scope="col">{l.round}</th>
            <th scope="col">{l.mode}</th>
            <th scope="col">{l.score}</th>
            <th scope="col">{l.grade}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <td>{long.format(r.finishedAt)}</td>
              <td>{t.round(r.round)}</td>
              <td>{modeName(r)}</td>
              <td>{r.score}</td>
              <td>{r.grade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
