"use client";
// The shared test runner for exam, practice and wrong-answer retry sessions.
// One Attempt object is the single source of truth for answers, flags, checks and the
// current question; the question view and the OMR card both read and write it.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionView } from "@/components/question/QuestionView";
import { LangToggle, ThemeToggle } from "@/components/site/PrefsControls";
import { recordWrong, removeWrong } from "@/lib/storage";
import { TIME_LIMIT_MS } from "@/lib/grade";
import { usePrefs } from "@/lib/prefs";
import type { Attempt, Choice, Question } from "@/lib/types";
import { Clock } from "./Clock";
import { GoToDialog, RestartDialog, ShortcutsDialog, SubmitDialog } from "./dialogs";
import { prefersReducedMotion, useElapsed, usePageVisible, useShortcuts } from "./hooks";
import { runnerLabels } from "./labels";
import { Modal } from "./Modal";
import { OmrCard } from "./OmrCard";

export type RunnerKind = "exam" | "practice" | "retry";

export interface RunnerProps {
  kind: RunnerKind;
  title: string;
  /** Show the OCR accuracy note. */
  ocr?: boolean;
  /** Questions by attempt key (question number; position in retry sessions). */
  questions: Record<number, Question>;
  initial: Attempt;
  /** Autosave target; omitted for in-memory sessions. */
  persist?: (a: Attempt) => void;
  /** Exam submit (auto = time ran out) or practice/retry finish. */
  onFinish: (a: Attempt, auto: boolean) => void;
  /** Discard and start again; `shuffle` overrides the saved preference for practice. */
  onRestart?: (shuffle?: boolean) => void;
  /** Label shown before the question number (retry: the round). */
  labelFor?: (q: Question) => string;
  /** Accessible row name in the answer sheet. */
  describe?: (key: number) => string;
}

type DialogName = "submit" | "goto" | "restart" | "keys" | "sheet" | null;

export function Runner({
  kind,
  title,
  ocr,
  questions,
  initial,
  persist,
  onFinish,
  onRestart,
  labelFor,
  describe,
}: RunnerProps) {
  const { t, prefs, setPrefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  const isExam = kind === "exam";
  const layout = prefs.layout;

  const [a, setA] = useState<Attempt>(initial);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [showOcr, setShowOcr] = useState(!!ocr);
  const [removed, setRemoved] = useState<string[]>([]);

  const visible = usePageVisible();
  // Exam time keeps running in a background tab, as in the real exam; only the pause button stops it.
  const running = (visible || isExam) && !submitted && !(isExam && a.paused);
  const elapsed = useElapsed(running, initial.elapsedMs);

  const order = a.order;
  const total = order.length;
  const index = Math.min(Math.max(a.current, 0), total - 1);
  const currentKey = order[index];
  const sheetKeys = useMemo(() => [...order].sort((x, y) => x - y), [order]);
  const checked = useMemo(() => new Set(a.checked), [a.checked]);
  const answeredCount = order.filter((k) => a.answers[k]).length;
  const marks = useMemo(() => {
    if (isExam) return undefined;
    const m: Record<number, "ok" | "bad"> = {};
    for (const k of a.checked) m[k] = a.answers[k] === questions[k]?.answer ? "ok" : "bad";
    return m;
  }, [isExam, a.checked, a.answers, questions]);
  const allChecked = !isExam && a.checked.length === total;

  // ---- autosave --------------------------------------------------------------
  const finished = useRef(false);
  const latest = useRef(a);
  useEffect(() => {
    latest.current = a;
  });
  const save = useCallback(
    (snap?: Attempt) => {
      if (finished.current || !persist) return;
      persist({ ...(snap ?? latest.current), elapsedMs: elapsed() });
    },
    [persist, elapsed],
  );

  useEffect(() => save(a), [a, save]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => save(), 5000);
    return () => window.clearInterval(id);
  }, [running, save]);

  useEffect(() => {
    const flush = () => save();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush(); // client-side navigation away from the runner
    };
  }, [save]);

  // ---- navigation --------------------------------------------------------------
  const mainRef = useRef<HTMLElement>(null);
  const observeFrom = useRef(0);

  const scrollToKey = useCallback((key: number, smooth: boolean) => {
    const el = document.getElementById(`item-${key}`);
    if (!el) return;
    observeFrom.current = Date.now() + (smooth ? 900 : 150);
    el.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto", block: "start" });
  }, []);

  const goIndex = useCallback(
    (i: number) => {
      const next = Math.min(Math.max(i, 0), total - 1);
      setA((p) => (p.current === next ? p : { ...p, current: next }));
      if (layout === "scroll") scrollToKey(order[next], true);
      else mainRef.current?.scrollIntoView({ block: "start" });
    },
    [total, layout, order, scrollToKey],
  );
  const goKey = useCallback((key: number) => goIndex(order.indexOf(key)), [goIndex, order]);

  // Scroll layout: start at the current question, then follow the reader.
  const startKey = useRef(currentKey);
  useEffect(() => {
    startKey.current = currentKey;
  });
  useEffect(() => {
    if (layout !== "scroll" || a.paused) return;
    scrollToKey(startKey.current, false);
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < observeFrom.current) return;
        const hit = entries.find((e) => e.isIntersecting);
        if (!hit) return;
        const key = Number((hit.target as HTMLElement).dataset.key);
        setA((p) => {
          const i = p.order.indexOf(key);
          return i < 0 || i === p.current ? p : { ...p, current: i };
        });
      },
      { rootMargin: "-25% 0px -70% 0px" },
    );
    document.querySelectorAll<HTMLElement>("[data-runner-item]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [layout, a.paused, scrollToKey]);

  // ---- actions -------------------------------------------------------------------
  const select = useCallback(
    (key: number, choice: Choice | null) => {
      setA((p) => {
        if (!isExam && p.checked.includes(key)) return p;
        if (isExam && p.paused) return p; // no answering while the exam is paused
        const answers = { ...p.answers };
        if (choice) answers[key] = choice;
        else delete answers[key];
        const i = p.order.indexOf(key);
        return { ...p, answers, current: i < 0 ? p.current : i };
      });
    },
    [isExam],
  );

  const toggleFlag = useCallback((key: number) => {
    setA((p) => ({ ...p, flags: p.flags.includes(key) ? p.flags.filter((f) => f !== key) : [...p.flags, key] }));
  }, []);

  const check = useCallback(
    (key: number) => {
      const q = questions[key];
      const choice = a.answers[key];
      if (isExam || !q || !choice || checked.has(key)) return;
      const ok = choice === q.answer;
      if (!ok) recordWrong(q.round, q.number, choice);
      setA((p) => ({ ...p, checked: [...p.checked, key] }));
      setMessage(`${q.number}번: ${ok ? t.correct : `${t.incorrect}. ${t.correctAnswer} ${q.answer}`}`);
    },
    [questions, a.answers, isExam, checked, t],
  );

  const finish = (auto: boolean) => {
    if (finished.current) return;
    const snap = { ...latest.current, elapsedMs: elapsed() };
    finished.current = true;
    setSubmitted(true);
    setDialog(null);
    onFinish(snap, auto);
  };

  const restart = useCallback(
    (shuffle?: boolean) => {
      finished.current = true;
      onRestart?.(shuffle);
    },
    [onRestart],
  );

  const setPaused = (paused: boolean) => setA((p) => ({ ...p, paused }));

  const toggleShuffle = () => {
    const next = !prefs.shufflePractice;
    setPrefs({ shufflePractice: next });
    // Nothing done yet: apply right away instead of waiting for a restart.
    if (a.checked.length === 0 && Object.keys(a.answers).length === 0 && a.flags.length === 0) restart(next);
  };

  // ---- keyboard ----------------------------------------------------------------
  useShortcuts(
    (e) => {
      if (e.key === "?") {
        setDialog("keys");
        return true;
      }
      if (/^[1-5]$/.test(e.key)) {
        const c = Number(e.key) as Choice;
        const key = keyOf(e.target) ?? currentKey;
        select(key, a.answers[key] === c ? null : c);
        return true;
      }
      if (e.key === "ArrowRight") {
        goIndex(index + 1);
        return true;
      }
      if (e.key === "ArrowLeft") {
        goIndex(index - 1);
        return true;
      }
      if (e.code === "KeyF") {
        toggleFlag(currentKey);
        return true;
      }
      if (e.code === "KeyG") {
        setDialog("goto");
        return true;
      }
      if (e.key === "Enter" && !isExam) {
        const target = e.target as HTMLElement;
        // Let buttons and links handle their own Enter, except the option buttons.
        if (target.closest("a, summary, button:not([data-choice])")) return false;
        const key = keyOf(target) ?? currentKey;
        if (!checked.has(key)) check(key);
        else if (index < total - 1) goIndex(index + 1);
        else if (allChecked) finish(false);
        else goIndex(order.findIndex((k) => !checked.has(k)));
        return true;
      }
      return false;
    },
    !submitted && !(isExam && a.paused),
  );

  // Desktop answer sheet: keep the current row visible inside the sticky sidebar.
  useEffect(() => {
    const box = document.querySelector<HTMLElement>("[data-sheet-scroll]");
    const row = box?.querySelector<HTMLElement>(`[data-row="${currentKey}"]`);
    if (!box || !row || box.offsetParent === null) return;
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2;
    }
  }, [currentKey]);

  const rootRef = useHeaderVar();

  // ---- rendering -----------------------------------------------------------------
  const renderItem = (key: number, single: boolean) => {
    const q = questions[key];
    if (!q) return null;
    const isChecked = checked.has(key);
    const ok = isChecked && a.answers[key] === q.answer;
    const flagged = a.flags.includes(key);
    const pos = order.indexOf(key);
    return (
      <section
        key={key}
        id={`item-${key}`}
        data-key={key}
        data-runner-item
        className={`scroll-mt-[calc(var(--runner-header,7rem)+0.75rem)] ${single ? "" : "border-b border-rule-soft pb-8 last:border-b-0"}`}
      >
        <QuestionView
          question={q}
          selected={a.answers[key] ?? null}
          onSelect={isChecked ? undefined : (c) => select(key, c)}
          reveal={isChecked}
          label={labelFor?.(q)}
          priority={single || key === currentKey}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 font-sans text-sm">
          <button
            type="button"
            onClick={() => toggleFlag(key)}
            aria-pressed={flagged}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 ${
              flagged ? "border-seal bg-bad-soft text-seal" : "border-rule-soft text-ink-soft hover:bg-paper-sunk"
            }`}
          >
            <span aria-hidden>{flagged ? "▶" : "▷"}</span>
            {flagged ? t.unflag : t.flag}
          </button>
          {!isExam && !isChecked && (
            <button
              type="button"
              onClick={() => check(key)}
              disabled={!a.answers[key]}
              aria-keyshortcuts="Enter"
              className="inline-flex min-h-10 items-center rounded-md border border-ink bg-ink px-4 font-medium text-paper disabled:cursor-not-allowed disabled:border-rule-soft disabled:bg-transparent disabled:text-ink-faint"
            >
              {t.check}
            </button>
          )}
          {isChecked && (
            <span
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-bold ${
                ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"
              }`}
            >
              <span aria-hidden>{ok ? "○" : "✕"}</span>
              {ok ? t.correct : t.incorrect}
              {!ok && (
                <span className="font-normal">
                  · {t.correctAnswer} {q.answer}
                </span>
              )}
            </span>
          )}
          {kind === "retry" &&
            ok &&
            (removed.includes(q.id) ? (
              <span className="text-ink-faint">{L.removedFromNotebook}</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  removeWrong(q.id);
                  setRemoved((r) => [...r, q.id]);
                }}
                className="inline-flex min-h-10 items-center rounded-md border border-rule-soft px-3 text-ink-soft hover:bg-paper-sunk"
              >
                {L.removeFromNotebook}
              </button>
            ))}
          {!single && isChecked && pos < total - 1 && (
            <button
              type="button"
              onClick={() => goIndex(pos + 1)}
              className="ml-auto inline-flex min-h-10 items-center rounded-md border border-ink px-4 font-medium"
            >
              {t.next} →
            </button>
          )}
        </div>
      </section>
    );
  };

  const finishButton = (cls = "") =>
    allChecked && (
      <button
        type="button"
        onClick={() => finish(false)}
        className={`inline-flex min-h-10 items-center rounded-md border border-ink bg-ink px-4 font-sans text-sm font-medium text-paper ${cls}`}
      >
        {L.finish}
      </button>
    );

  const btn = "inline-flex min-h-10 items-center gap-1 rounded-md border border-rule-soft px-2.5 text-xs text-ink-soft hover:bg-paper-sunk sm:text-sm";
  const segBtn = (on: boolean) =>
    `min-h-10 px-2.5 text-xs sm:text-sm ${on ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-sunk"}`;

  return (
    <div className="flex min-h-dvh flex-col bg-paper" ref={rootRef}>
      <header data-runner-header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href={kind === "retry" ? "/review" : "/"}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-paper-sunk"
              aria-label={kind === "retry" ? L.backToNotebook : L.home}
            >
              <span aria-hidden>←</span>
            </Link>
            <h1 className="min-w-0 truncate font-serif text-sm font-bold sm:text-base">{title}</h1>
            <span
              className={`shrink-0 rounded-sm border px-1.5 py-px font-sans text-[11px] font-medium ${
                isExam ? "border-seal text-seal" : "border-rule-soft text-ink-soft"
              }`}
            >
              {isExam ? L.examBadge : kind === "practice" ? L.practiceBadge : t.retry}
            </span>
          </div>
          {kind !== "retry" && (
            <Clock
              elapsed={elapsed}
              initialMs={initial.elapsedMs}
              running={running}
              limitMs={isExam ? TIME_LIMIT_MS : undefined}
              onExpire={isExam ? () => finish(true) : undefined}
              onAnnounce={setMessage}
            />
          )}
          <div className="flex w-full flex-wrap items-center gap-1.5 lg:w-auto">
            {isExam && (
              <button
                type="button"
                onClick={() => setPaused(true)}
                disabled={a.paused}
                title={t.pauseNote}
                className={btn}
              >
                <span aria-hidden>❚❚</span>
                {t.pause}
                <span className="rounded-sm bg-warn-soft px-1 text-[10px] text-warn">{L.notInReal}</span>
              </button>
            )}
            <div role="group" aria-label={`${t.layoutSingle} / ${t.layoutScroll}`} className="inline-flex overflow-hidden rounded-md border border-rule-soft">
              <button type="button" aria-pressed={layout === "single"} onClick={() => setPrefs({ layout: "single" })} className={segBtn(layout === "single")}>
                {t.layoutSingle}
              </button>
              <button type="button" aria-pressed={layout === "scroll"} onClick={() => setPrefs({ layout: "scroll" })} className={segBtn(layout === "scroll")}>
                {t.layoutScroll}
              </button>
            </div>
            {kind === "practice" && (
              <button type="button" aria-pressed={prefs.shufflePractice} onClick={toggleShuffle} title={L.shuffleHint} className={`${btn} ${prefs.shufflePractice ? "border-ink text-ink" : ""}`}>
                <span aria-hidden>⇄</span>
                {t.shuffle}
              </button>
            )}
            {onRestart && (
              <button type="button" onClick={() => setDialog("restart")} className={btn}>
                <span aria-hidden>↺</span>
                {L.restart}
              </button>
            )}
            <button type="button" onClick={() => setDialog("keys")} aria-label={t.shortcuts} title={t.shortcuts} className={`${btn} hidden sm:inline-flex`}>
              ?
            </button>
            <LangToggle />
            <ThemeToggle />
            {isExam ? (
              <button
                type="button"
                onClick={() => setDialog("submit")}
                className="ml-auto inline-flex min-h-10 items-center rounded-md border border-ink bg-ink px-3 text-sm font-medium text-paper"
              >
                {t.submit}
              </button>
            ) : (
              finishButton("ml-auto")
            )}
          </div>
        </div>
        {showOcr && (
          <div className="border-t border-rule-soft bg-paper-raised">
            <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-1.5 text-xs text-ink-faint">
              <span className="flex-1">{t.ocrNote}</span>
              <button type="button" onClick={() => setShowOcr(false)} className="shrink-0 underline underline-offset-2 hover:text-ink">
                {L.dismiss}
              </button>
            </p>
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-10 lg:pb-10">
        <main id="main" ref={mainRef} className="min-w-0 scroll-mt-[calc(var(--runner-header,7rem)+0.75rem)]">
          {submitted ? (
            <p className="py-24 text-center font-sans text-ink-soft" role="status">
              {L.submitting}
            </p>
          ) : isExam && a.paused ? (
            <div className="flex flex-col items-center gap-4 rounded-md border border-rule-soft bg-paper-raised px-6 py-20 text-center font-sans">
              <p className="text-xl font-bold">{t.paused}</p>
              <p className="max-w-sm text-sm text-warn">{t.pauseNote}</p>
              <button
                type="button"
                autoFocus
                onClick={() => setPaused(false)}
                className="inline-flex min-h-11 items-center rounded-md border border-ink bg-ink px-6 font-medium text-paper"
              >
                {t.resume}
              </button>
            </div>
          ) : layout === "single" ? (
            <>
              {renderItem(currentKey, true)}
              <nav aria-label={t.goTo} className="mt-6 flex items-center gap-2 border-t border-rule pt-4 font-sans text-sm">
                <button
                  type="button"
                  onClick={() => goIndex(index - 1)}
                  disabled={index === 0}
                  aria-keyshortcuts="ArrowLeft"
                  className="inline-flex min-h-11 items-center rounded-md border border-rule-soft px-4 hover:bg-paper-sunk disabled:opacity-40"
                >
                  ← {t.prev}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog("goto")}
                  aria-label={`${t.goTo} (${L.position(index + 1, total)})`}
                  aria-keyshortcuts="G"
                  className="mx-auto inline-flex min-h-11 items-center rounded-md px-3 tabular-nums text-ink-soft hover:bg-paper-sunk"
                >
                  {L.position(index + 1, total)}
                </button>
                {index < total - 1 ? (
                  <button
                    type="button"
                    onClick={() => goIndex(index + 1)}
                    aria-keyshortcuts="ArrowRight"
                    className={`inline-flex min-h-11 items-center rounded-md border px-4 ${
                      checked.has(currentKey) ? "border-ink bg-ink text-paper" : "border-rule-soft hover:bg-paper-sunk"
                    }`}
                  >
                    {t.next} →
                  </button>
                ) : isExam ? (
                  <button
                    type="button"
                    onClick={() => setDialog("submit")}
                    className="inline-flex min-h-11 items-center rounded-md border border-ink bg-ink px-4 text-paper"
                  >
                    {t.submit}
                  </button>
                ) : (
                  finishButton() || <span className="min-w-20" />
                )}
              </nav>
            </>
          ) : (
            <div className="space-y-8">
              {order.map((k) => renderItem(k, false))}
              <div className="flex justify-end border-t border-rule pt-4">
                {isExam ? (
                  <button
                    type="button"
                    onClick={() => setDialog("submit")}
                    className="inline-flex min-h-11 items-center rounded-md border border-ink bg-ink px-5 font-sans text-sm text-paper"
                  >
                    {t.submit}
                  </button>
                ) : (
                  finishButton()
                )}
              </div>
            </div>
          )}
          {allChecked && !submitted && (
            <p role="status" className="mt-6 font-sans text-sm text-ink-soft">
              {L.allChecked}
            </p>
          )}
          <p className="mt-8 hidden font-sans text-xs text-ink-faint sm:block">
            <span className="font-medium">{t.shortcuts}:</span> {L.keysLine}
            {!isExam && L.keysLinePractice}
          </p>
        </main>

        <aside aria-label={t.answerSheet} className="hidden lg:block">
          <div className="sticky top-[calc(var(--runner-header,7rem)+1rem)] max-h-[calc(100dvh-var(--runner-header,7rem)-2rem)] overflow-y-auto pb-2" data-sheet-scroll>
            <OmrCard
              keys={sheetKeys}
              answers={a.answers}
              flags={a.flags}
              current={currentKey}
              marks={marks}
              describe={describe}
              onPick={select}
              onJump={goKey}
            />
          </div>
        </aside>
      </div>

      {/* Phone/tablet: the answer sheet lives in a bottom sheet. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 px-4 py-2 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2 font-sans text-sm">
          <button
            type="button"
            onClick={() => setDialog("sheet")}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border-2 border-omr bg-omr-soft font-bold text-omr"
          >
            {t.answerSheet}
            <span className="font-medium tabular-nums">{L.progress(answeredCount, total)}</span>
            {!isExam && <span className="text-xs font-normal">· {L.checkedCount(a.checked.length, total)}</span>}
          </button>
        </div>
      </div>

      <Modal
        open={dialog === "sheet"}
        onClose={() => setDialog(null)}
        label={t.answerSheet}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-xl border-t border-rule bg-paper p-0 text-ink backdrop:bg-black/40"
      >
        <SheetBody current={currentKey}>
          <div className="flex items-center justify-between px-4 py-2 font-sans">
            <span className="text-sm font-bold text-omr">{t.answerSheet}</span>
            <button
              type="button"
              data-autofocus
              onClick={() => setDialog(null)}
              className="inline-flex min-h-10 items-center rounded-md border border-rule-soft px-3 text-sm"
            >
              {t.close}
            </button>
          </div>
          <div className="px-4 pb-6">
            <OmrCard
              keys={sheetKeys}
              answers={a.answers}
              flags={a.flags}
              current={currentKey}
              marks={marks}
              describe={describe}
              onPick={select}
              onJump={goKey}
            />
          </div>
        </SheetBody>
      </Modal>

      {isExam && (
        <SubmitDialog
          open={dialog === "submit"}
          onClose={() => setDialog(null)}
          blanks={sheetKeys.filter((k) => !a.answers[k])}
          onJump={(k) => {
            setDialog(null);
            goKey(k);
          }}
          onConfirm={() => finish(false)}
        />
      )}
      <GoToDialog
        open={dialog === "goto"}
        onClose={() => setDialog(null)}
        max={total}
        onGo={(k) => {
          setDialog(null);
          goKey(k);
        }}
      />
      {onRestart && (
        <RestartDialog
          open={dialog === "restart"}
          onClose={() => setDialog(null)}
          shuffle={kind === "practice" ? prefs.shufflePractice : undefined}
          onConfirm={(shuffle) => {
            setDialog(null);
            if (shuffle !== undefined && shuffle !== prefs.shufflePractice) setPrefs({ shufflePractice: shuffle });
            restart(shuffle);
          }}
        />
      )}
      <ShortcutsDialog open={dialog === "keys"} onClose={() => setDialog(null)} practice={!isExam} />

      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </div>
  );
}

/** Keeps the current answer-sheet row in view when the bottom sheet opens. */
function SheetBody({ current, children }: { current: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector(`[data-row="${current}"]`)?.scrollIntoView({ block: "center" });
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="max-h-[85dvh] overflow-y-auto">
      {children}
    </div>
  );
}

/** Publishes the sticky header height as --runner-header for sticky/scroll offsets. */
function useHeaderVar() {
  return useCallback((root: HTMLDivElement | null) => {
    if (!root) return;
    const header = root.querySelector<HTMLElement>("[data-runner-header]");
    if (!header) return;
    const set = () => root.style.setProperty("--runner-header", `${header.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
}

/** The question (data-key) containing a focused element, in either layout. */
function keyOf(target: EventTarget | null): number | null {
  const item = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-runner-item]") : null;
  return item?.dataset.key ? Number(item.dataset.key) : null;
}
