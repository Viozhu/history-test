"use client";
// Two-step destructive action: the first press asks, the second confirms. Esc or "cancel" backs out.
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "@/lib/prefs";

interface Props {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}

export function ConfirmButton({ label, question, confirmLabel, onConfirm, className = "" }: Props) {
  const { t } = usePrefs();
  const [asking, setAsking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  useEffect(() => {
    if (asking) confirmRef.current?.focus();
    else if (wasAsking.current) triggerRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  const btn = "inline-flex min-h-10 items-center rounded-md border px-3 font-sans text-sm transition-colors";

  if (!asking) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setAsking(true)}
        className={`${btn} border-rule-soft text-ink-soft hover:border-bad hover:text-bad ${className}`}
      >
        {label}
      </button>
    );
  }
  return (
    <span
      role="group"
      aria-label={question}
      className={`inline-flex flex-wrap items-center gap-2 ${className}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") setAsking(false);
      }}
    >
      <span className="font-sans text-sm text-bad">{question}</span>
      <button
        ref={confirmRef}
        type="button"
        onClick={() => {
          wasAsking.current = false;
          onConfirm();
          setAsking(false);
        }}
        className={`${btn} border-bad bg-bad text-paper hover:opacity-90`}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={`${btn} border-rule-soft text-ink-soft hover:bg-paper-sunk`}>
        {t.cancel}
      </button>
    </span>
  );
}
