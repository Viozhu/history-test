"use client";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "@/lib/prefs";
import type { ImageRef } from "@/lib/types";

/** Full-screen image viewer on a native <dialog> (focus trap, Esc to close). Click the image to zoom. */
export function Lightbox({ image, onClose }: { image: ImageRef | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const { t } = usePrefs();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (image && !d.open) {
      setZoomed(false);
      d.showModal();
    } else if (!image && d.open) d.close();
  }, [image]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={image?.alt ?? t.zoom}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/85 p-0 backdrop:bg-black/60"
    >
      {image && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end gap-2 p-2">
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="rounded-md border border-white/40 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              {zoomed ? "− " : "+ "}
              {t.zoom}
            </button>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="rounded-md border border-white/40 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              {t.close} ✕
            </button>
          </div>
          <div className={`flex-1 overflow-auto ${zoomed ? "" : "flex items-center justify-center"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimized WebP crops */}
            <img
              src={image.src}
              alt={image.alt ?? ""}
              width={image.width}
              height={image.height}
              onClick={() => setZoomed((z) => !z)}
              className={`paper-img mx-auto cursor-zoom-in bg-white ${
                zoomed ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full object-contain"
              }`}
              style={zoomed ? { width: image.width * 1.25 } : undefined}
            />
          </div>
        </div>
      )}
    </dialog>
  );
}
