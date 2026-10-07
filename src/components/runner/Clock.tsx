"use client";
// Header clock. Exam: time left (amber < 10 min, red < 5 min), fires onExpire at 0 and
// announces 10/5/1 minutes left. Practice: time used.
import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/grade";
import { usePrefs } from "@/lib/prefs";
import { runnerLabels } from "./labels";

const MIN = 60_000;
const MARKS = [10, 5, 1];

export function Clock({
  elapsed,
  initialMs,
  running,
  limitMs,
  onExpire,
  onAnnounce,
}: {
  elapsed: () => number;
  initialMs: number;
  running: boolean;
  /** Countdown when set; otherwise shows time used. */
  limitMs?: number;
  onExpire?: () => void;
  onAnnounce?: (msg: string) => void;
}) {
  const { t, prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  const [ms, setMs] = useState(initialMs);
  // Marks already passed when the attempt was resumed are not announced again.
  const announced = useRef(limitMs ? MARKS.filter((m) => limitMs - initialMs <= m * MIN).length : 0);
  const cb = useRef({ onExpire, onAnnounce, L });
  useEffect(() => {
    cb.current = { onExpire, onAnnounce, L };
  });

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const v = elapsed();
      setMs(v);
      if (!limitMs) return;
      const left = limitMs - v;
      while (announced.current < MARKS.length && left <= MARKS[announced.current] * MIN) {
        if (left > 0) cb.current.onAnnounce?.(cb.current.L.minutesLeft(MARKS[announced.current]));
        announced.current += 1;
      }
      if (left <= 0) cb.current.onExpire?.();
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, elapsed, limitMs]);

  if (!limitMs) {
    return (
      <div className="flex items-baseline gap-1.5 font-sans text-ink-soft">
        <span className="text-xs">{t.timeUsed}</span>
        <span role="timer" className="text-sm font-medium tabular-nums">
          {formatClock(ms)}
        </span>
      </div>
    );
  }

  const left = Math.max(0, limitMs - ms);
  const tone = left < 5 * MIN ? "text-bad" : left < 10 * MIN ? "text-warn" : "text-ink";
  return (
    <div className={`flex items-baseline gap-1.5 font-sans ${tone}`}>
      <span className="text-xs opacity-80">{t.timeLeft}</span>
      <span role="timer" aria-live="off" className="text-base font-semibold tabular-nums sm:text-lg">
        {formatClock(left)}
      </span>
    </div>
  );
}
