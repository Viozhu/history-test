"use client";
// Renders one question the way it is printed in the booklet: numbered header, stem,
// material (사료/maps/photos as zoomable crops) and the five options.
import { useState } from "react";
import { usePrefs } from "@/lib/prefs";
import type { Choice, ImageRef, Question } from "@/lib/types";
import { Lightbox } from "./Lightbox";

export const MARKERS = ["①", "②", "③", "④", "⑤"] as const;
const CHOICES: Choice[] = [1, 2, 3, 4, 5];

export interface QuestionViewProps {
  question: Question;
  /** The option currently chosen (null = blank). */
  selected: Choice | null;
  /** Called with the clicked option; clicking the selected option again passes null. Omit for read-only. */
  onSelect?: (choice: Choice | null) => void;
  /** When set, show the correct answer and mark `selected` right/wrong. */
  reveal?: boolean;
  /** Shown before the number, e.g. the round in mixed review sessions. */
  label?: string;
  /** Heading level for the question header (default h2). */
  headingLevel?: "h2" | "h3";
  /** Load images eagerly with high priority (the question on screen, usually the LCP). */
  priority?: boolean;
  className?: string;
}

export function QuestionView({
  question: q,
  selected,
  onSelect,
  reveal = false,
  label,
  headingLevel = "h2",
  priority = false,
  className = "",
}: QuestionViewProps) {
  const { t } = usePrefs();
  const [zoom, setZoom] = useState<ImageRef | null>(null);
  const [original, setOriginal] = useState(false);
  const showOriginal = q.useFallback || original;
  const Heading = headingLevel;
  const compactOptions = showOriginal || q.optionsAreImages;

  return (
    <article className={`font-serif text-ink ${className}`} aria-labelledby={`q-${q.id}-title`}>
      <header className="flex items-start gap-3 border-b border-rule pb-2">
        <Heading id={`q-${q.id}-title`} className="flex-1 text-[1.05rem] leading-relaxed sm:text-lg">
          {label && <span className="mr-2 font-sans text-xs font-medium text-ink-faint">{label}</span>}
          <span className="mr-1.5 font-bold tabular-nums" style={{ fontFamily: "'Times New Roman', var(--font-serif)" }}>
            {q.number}.
          </span>
          {showOriginal ? <span className="sr-only">{q.stem}</span> : <span>{q.stem}</span>}
        </Heading>
        <span className="shrink-0 pt-1 font-sans text-sm text-ink-soft" aria-label={t.points(q.points)}>
          [{q.points}점]
        </span>
      </header>

      <div className="mt-3 space-y-3">
        {showOriginal ? (
          <Figure image={q.fallbackImage} onZoom={setZoom} priority={priority} />
        ) : (
          q.images.map((img) => <Figure key={img.src} image={img} onZoom={setZoom} priority={priority} />)
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-ink-faint">
          {!q.useFallback && (
            <button
              type="button"
              onClick={() => setOriginal((o) => !o)}
              aria-pressed={original}
              className="underline decoration-dotted underline-offset-4 hover:text-ink"
            >
              {t.showOriginal}
            </button>
          )}
          {q.passage && !showOriginal && (
            <details className="w-full">
              <summary className="cursor-pointer underline decoration-dotted underline-offset-4 hover:text-ink">
                {t.showText}
              </summary>
              <p className="mt-2 whitespace-pre-line rounded border border-rule-soft bg-paper-raised p-3 font-serif text-sm leading-relaxed text-ink-soft">
                {q.passage}
              </p>
            </details>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-label={`${q.number}번 선택지`}
        className={compactOptions ? "mt-4 grid grid-cols-5 gap-2" : "mt-4 space-y-1.5"}
      >
        {CHOICES.map((c) => (
          <OptionButton
            key={c}
            choice={c}
            text={compactOptions ? "" : q.options[c - 1]}
            selected={selected === c}
            correct={reveal && q.answer === c}
            wrong={reveal && selected === c && q.answer !== c}
            disabled={!onSelect}
            onClick={() => onSelect?.(selected === c ? null : c)}
          />
        ))}
      </div>

      <Lightbox image={zoom} onClose={() => setZoom(null)} />
    </article>
  );
}

function Figure({ image, onZoom, priority }: { image: ImageRef; onZoom: (i: ImageRef) => void; priority: boolean }) {
  const { t } = usePrefs();
  return (
    <button
      type="button"
      onClick={() => onZoom(image)}
      className="group relative mx-auto block w-full max-w-xl cursor-zoom-in overflow-hidden rounded-sm bg-white"
      aria-label={`${t.zoom}: ${image.alt ?? ""}`.slice(0, 160)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimized WebP crops with intrinsic size */}
      <img
        src={image.src}
        alt={image.alt ?? ""}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="paper-img h-auto w-full"
      />
      <span
        aria-hidden
        className="absolute right-2 bottom-2 rounded bg-ink/70 px-1.5 py-0.5 font-sans text-[11px] text-paper opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        ⤢ {t.zoom}
      </span>
    </button>
  );
}

function OptionButton({
  choice,
  text,
  selected,
  correct,
  wrong,
  disabled,
  onClick,
}: {
  choice: Choice;
  text: string;
  selected: boolean;
  correct: boolean;
  wrong: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = usePrefs();
  const state = correct
    ? "border-ok bg-ok-soft"
    : wrong
      ? "border-bad bg-bad-soft"
      : selected
        ? "border-ink bg-paper-sunk"
        : "border-transparent hover:border-rule-soft hover:bg-paper-raised";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-keyshortcuts={String(choice)}
      data-choice={choice}
      className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-[0.98rem] leading-relaxed transition-colors disabled:cursor-default sm:text-base ${state} ${
        text ? "" : "justify-center"
      }`}
    >
      <span
        aria-hidden
        className={`mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.95rem] leading-none ${
          selected ? "bg-ink text-paper" : "text-ink"
        }`}
      >
        {selected ? choice : MARKERS[choice - 1]}
      </span>
      {text && <span className="flex-1">{text}</span>}
      <span className="sr-only">
        {text ? "" : `${choice}번`}
        {correct ? ` (${t.correctAnswer})` : ""}
        {wrong ? ` (${t.yourAnswer}, ${t.incorrect})` : ""}
      </span>
      {(correct || wrong) && (
        <span aria-hidden className={`shrink-0 font-sans text-xs font-bold ${correct ? "text-ok" : "text-bad"}`}>
          {correct ? "○" : "✕"}
        </span>
      )}
    </button>
  );
}
