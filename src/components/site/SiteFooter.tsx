"use client";
import { usePrefs } from "@/lib/prefs";

const L = {
  ko: {
    source: "문제 출처: 국사편찬위원회 한국사능력검정시험 기출 문제",
    note: "비공식 학습용 모의고사입니다. 기록은 이 브라우저에만 저장됩니다.",
  },
  en: {
    source: "Questions: past papers of the Korean History Proficiency Test (National Institute of Korean History)",
    note: "Unofficial study tool. Your records stay in this browser only.",
  },
};

export function SiteFooter() {
  const { prefs } = usePrefs();
  const l = L[prefs.lang];
  return (
    <footer className="mt-16 border-t border-rule-soft">
      <div className="mx-auto w-full max-w-5xl space-y-1 px-4 py-6 font-sans text-xs text-ink-faint">
        <p>{l.source}</p>
        <p>{l.note}</p>
      </div>
    </footer>
  );
}
