"use client";
// Preferences (language, layout, theme) + interface-label translations.
// Exam content always stays in Korean; only UI labels switch.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, loadPrefs, savePrefs, subscribe } from "./storage";
import type { Prefs } from "./types";

const DICT = {
  ko: {
    appName: "한국사능력검정시험 심화",
    appShort: "한능검 심화",
    home: "홈",
    review: "오답 노트",
    history: "기록",
    rounds: "회차",
    round: (n: number) => `제${n}회`,
    startExam: "실전 모의고사",
    startPractice: "연습 모드",
    continue: "이어서 풀기",
    unfinished: "진행 중인 시험",
    best: "최고 점수",
    noAttempts: "응시 기록 없음",
    question: "문항",
    points: (n: number) => `${n}점`,
    prev: "이전",
    next: "다음",
    flag: "표시",
    unflag: "표시 해제",
    goTo: "문항 이동",
    submit: "답안 제출",
    submitConfirmTitle: "답안을 제출할까요?",
    blankWarning: (n: number) => `아직 답하지 않은 문항이 ${n}개 있습니다.`,
    cancel: "취소",
    confirmSubmit: "제출하기",
    pause: "일시정지",
    resume: "계속",
    pauseNote: "실제 시험에서는 일시정지할 수 없습니다",
    paused: "일시정지됨",
    timeLeft: "남은 시간",
    timeUsed: "소요 시간",
    answerSheet: "답안지",
    layoutSingle: "한 문항씩",
    layoutScroll: "이어서 보기",
    shuffle: "문항 섞기",
    check: "정답 확인",
    correct: "정답",
    incorrect: "오답",
    yourAnswer: "내 답",
    correctAnswer: "정답",
    score: "점수",
    grade: "등급",
    fail: "불합격",
    byPoints: "배점별",
    byEra: "시대별",
    wrongList: "틀린 문항",
    blank: "미응답",
    retry: "다시 풀기",
    retryThese: "이 문항들 다시 풀기",
    remove: "삭제",
    mastered: "완전히 익혔어요",
    sharedMaterial: (a: number, b: number) => `[${a}~${b}] 공통 자료`,
    explanation: "해설",
    showExplanation: "해설 보기",
    explClues: "단서",
    explWhyRight: "정답 풀이",
    explWhyWrong: "오답 분석",
    explPoint: "핵심 포인트",
    allRounds: "전체 회차",
    allEras: "전체 시대",
    emptyNotebook: "오답 노트가 비어 있습니다.",
    emptyHistory: "아직 응시 기록이 없습니다.",
    scoreTrend: "점수 추이",
    showOriginal: "원본 보기",
    showText: "자료 텍스트",
    close: "닫기",
    zoom: "확대",
    autoSubmitted: "시간 종료로 자동 제출되었습니다",
    shortcuts: "단축키",
    theme: "테마",
    themeSystem: "시스템",
    themeLight: "밝게",
    themeDark: "어둡게",
    ocrNote: "이 회차는 원본 PDF에서 문자 인식(OCR)으로 추출했습니다. 오류가 의심되면 원본 보기를 사용하세요.",
  },
  en: {
    appName: "Korean History Test · Advanced",
    appShort: "KHT Advanced",
    home: "Home",
    review: "Wrong answers",
    history: "History",
    rounds: "Rounds",
    round: (n: number) => `Round ${n}`,
    startExam: "Exam mode",
    startPractice: "Practice",
    continue: "Continue",
    unfinished: "Unfinished attempt",
    best: "Best",
    noAttempts: "No attempts yet",
    question: "Question",
    points: (n: number) => `${n} pt${n > 1 ? "s" : ""}`,
    prev: "Previous",
    next: "Next",
    flag: "Flag",
    unflag: "Unflag",
    goTo: "Go to question",
    submit: "Submit",
    submitConfirmTitle: "Submit your answers?",
    blankWarning: (n: number) => `${n} question${n === 1 ? " is" : "s are"} still blank.`,
    cancel: "Cancel",
    confirmSubmit: "Submit",
    pause: "Pause",
    resume: "Resume",
    pauseNote: "Not allowed in the real exam",
    paused: "Paused",
    timeLeft: "Time left",
    timeUsed: "Time used",
    answerSheet: "Answer sheet",
    layoutSingle: "One per screen",
    layoutScroll: "Continuous",
    shuffle: "Shuffle",
    check: "Check",
    correct: "Correct",
    incorrect: "Incorrect",
    yourAnswer: "Your answer",
    correctAnswer: "Answer",
    score: "Score",
    grade: "Grade",
    fail: "Fail",
    byPoints: "By points",
    byEra: "By era",
    wrongList: "Wrong questions",
    blank: "Blank",
    retry: "Retry",
    retryThese: "Retry these",
    remove: "Remove",
    mastered: "Mastered",
    sharedMaterial: (a: number, b: number) => `Shared material for questions ${a}–${b}`,
    explanation: "Explanation",
    showExplanation: "Show explanation",
    explClues: "Clues",
    explWhyRight: "Why it's right",
    explWhyWrong: "Why the others aren't the answer",
    explPoint: "Key point",
    allRounds: "All rounds",
    allEras: "All eras",
    emptyNotebook: "Your wrong-answer notebook is empty.",
    emptyHistory: "No attempts yet.",
    scoreTrend: "Score trend",
    showOriginal: "Original",
    showText: "Material text",
    close: "Close",
    zoom: "Zoom",
    autoSubmitted: "Time ran out; submitted automatically",
    shortcuts: "Shortcuts",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    ocrNote: "This round was extracted from the PDF with OCR. If something looks wrong, open the original.",
  },
};

export type Dict = (typeof DICT)["ko"];

interface PrefsCtx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  t: Dict;
  hydrated: boolean;
}

const Ctx = createContext<PrefsCtx>({
  prefs: DEFAULT_PREFS,
  setPrefs: () => {},
  t: DICT.ko,
  hydrated: false,
});

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);
  const hydrated = useHydrated();

  useEffect(() => {
    // Storage notifies on every write (autosave included); only update when prefs actually changed.
    const sync = () =>
      setState((prev) => {
        const next = loadPrefs();
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
      });
    sync();
    return subscribe(sync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", prefs.theme);
  }, [prefs.theme]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    savePrefs(p);
    setState(loadPrefs());
  }, []);

  const value = useMemo(() => ({ prefs, setPrefs, t: DICT[prefs.lang] as Dict, hydrated }), [prefs, setPrefs, hydrated]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);

const noop = () => () => {};
/** false during SSR and the first client render, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Re-render when anything in local storage changes; returns a snapshot via `get`. */
export function useStored<T>(get: () => T, fallback: T): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    const sync = () => setV(get());
    sync();
    return subscribe(sync);
    // `get` is expected to be stable per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}
