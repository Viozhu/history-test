"use client";
import { useState } from "react";
import { usePrefs } from "@/lib/prefs";
import { runnerLabels } from "./labels";
import { Modal } from "./Modal";

const primary = "inline-flex min-h-10 items-center rounded-md border border-ink bg-ink px-4 text-sm font-medium text-paper";
const secondary = "inline-flex min-h-10 items-center rounded-md border border-rule-soft px-4 text-sm hover:bg-paper-sunk";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 font-sans">
      <h2 className="mb-3 border-b border-rule pb-2 text-base font-bold">{title}</h2>
      {children}
    </div>
  );
}

export function SubmitDialog({
  open,
  onClose,
  blanks,
  onJump,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  blanks: number[];
  onJump: (key: number) => void;
  onConfirm: () => void;
}) {
  const { t, prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  return (
    <Modal open={open} onClose={onClose} label={t.submitConfirmTitle}>
      <Frame title={t.submitConfirmTitle}>
        {blanks.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-warn">{t.blankWarning(blanks.length)}</p>
            <p className="mt-3 mb-1.5 text-xs text-ink-faint">{L.blankList}</p>
            <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {blanks.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => onJump(k)}
                    aria-label={`${t.goTo}: ${k}번`}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-omr text-sm font-bold text-omr tabular-nums hover:bg-omr-soft"
                  >
                    {k}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondary} data-autofocus>
            {t.cancel}
          </button>
          <button type="button" onClick={onConfirm} className={primary}>
            {t.confirmSubmit}
          </button>
        </div>
      </Frame>
    </Modal>
  );
}

export function GoToDialog({
  open,
  onClose,
  max,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  max: number;
  onGo: (n: number) => void;
}) {
  const { t } = usePrefs();
  return (
    <Modal open={open} onClose={onClose} label={t.goTo}>
      <GoToForm max={max} onGo={onGo} onClose={onClose} />
    </Modal>
  );
}

function GoToForm({ max, onGo, onClose }: { max: number; onGo: (n: number) => void; onClose: () => void }) {
  const { t, prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= max;
  return (
    <Frame title={t.goTo}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onGo(n);
        }}
      >
        <label className="block text-sm">
          <span className="mb-1.5 block text-ink-soft">{L.goToHint(max)}</span>
          <input
            data-autofocus
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={value !== "" && !valid}
            className="min-h-11 w-full rounded-md border border-rule bg-paper-raised px-3 text-lg tabular-nums"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondary}>
            {t.cancel}
          </button>
          <button type="submit" disabled={!valid} className={`${primary} disabled:opacity-40`}>
            {L.go}
          </button>
        </div>
      </form>
    </Frame>
  );
}

export function RestartDialog({
  open,
  onClose,
  shuffle,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** Practice only: initial value of the shuffle checkbox. */
  shuffle?: boolean;
  onConfirm: (shuffle?: boolean) => void;
}) {
  const { prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  return (
    <Modal open={open} onClose={onClose} label={L.restartTitle}>
      <RestartForm shuffle={shuffle} onClose={onClose} onConfirm={onConfirm} />
    </Modal>
  );
}

function RestartForm({
  shuffle,
  onClose,
  onConfirm,
}: {
  shuffle?: boolean;
  onClose: () => void;
  onConfirm: (shuffle?: boolean) => void;
}) {
  const { t, prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  const [mix, setMix] = useState(shuffle);
  return (
    <Frame title={L.restartTitle}>
      <p className="text-sm text-ink-soft">{L.restartBody}</p>
      {mix !== undefined && (
        <label className="mt-3 flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={mix} onChange={(e) => setMix(e.target.checked)} className="size-4" />
          {t.shuffle}
        </label>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondary} data-autofocus>
          {t.cancel}
        </button>
        <button type="button" onClick={() => onConfirm(mix)} className="inline-flex min-h-10 items-center rounded-md border border-bad bg-bad px-4 text-sm font-medium text-paper">
          {L.restartConfirm}
        </button>
      </div>
    </Frame>
  );
}

export function ShortcutsDialog({ open, onClose, practice }: { open: boolean; onClose: () => void; practice: boolean }) {
  const { t, prefs } = usePrefs();
  const L = runnerLabels(prefs.lang);
  const rows = practice ? L.keys : L.keys.filter(([k]) => k !== "Enter");
  return (
    <Modal open={open} onClose={onClose} label={t.shortcuts}>
      <Frame title={t.shortcuts}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, d]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded border border-rule-soft bg-paper-raised px-1.5 py-0.5 font-sans text-xs">{k}</kbd>
              </dt>
              <dd className="text-ink-soft">{d}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={secondary} data-autofocus>
            {t.close}
          </button>
        </div>
      </Frame>
    </Modal>
  );
}
