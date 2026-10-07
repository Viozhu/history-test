"use client";
// Native modal <dialog>: the browser traps focus and closes it on Esc.
// Children mount only while open; an element marked data-autofocus gets focus.
import { useEffect, useRef } from "react";

export function Modal({
  open,
  onClose,
  label,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={
        className ||
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-rule bg-paper p-0 text-ink shadow-xl backdrop:bg-black/40"
      }
    >
      {open && children}
    </dialog>
  );
}
