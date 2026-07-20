/**
 * Cross-variant journey state: learning mode + quiz answers, persisted
 * per city. The stage itself lives in the URL; this is only what the
 * user has *done*.
 *
 * Answers are stored under "<scope>:<quizId>", where the scope is the
 * variant being viewed (provided per route via <QuizScope>). Each form
 * is a separate prototype to be judged on its own, so answering a quiz
 * in one must never pre-answer the same quiz in another. Learning mode
 * stays global — it is a user preference, not progress.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { QuizAnswer } from "./content/quizzes";

const KEY = "gd-proto:boston-ma";

interface Stored {
  learningMode: boolean;
  /** Study mode: hide the charts/data and show only the quiz cards. */
  quizOnly: boolean;
  answers: Record<string, QuizAnswer>;
}

function load(): Stored {
  // Older saves predate quizOnly — merging over the defaults fills it in.
  const defaults: Stored = { learningMode: true, quizOnly: false, answers: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Stored>) };
  } catch {
    /* fresh start */
  }
  return defaults;
}

interface JourneyCtx extends Stored {
  setLearningMode: (on: boolean) => void;
  setQuizOnly: (on: boolean) => void;
  submitAnswer: (a: QuizAnswer) => void;
  /** clear stored answers — all of them, or only one variant's scope */
  resetAnswers: (scope?: string) => void;
}

const Ctx = createContext<JourneyCtx | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — session-only */
    }
  }, [state]);

  const setLearningMode = useCallback(
    (on: boolean) => setState((s) => ({ ...s, learningMode: on })),
    [],
  );
  const setQuizOnly = useCallback(
    (on: boolean) => setState((s) => ({ ...s, quizOnly: on })),
    [],
  );
  const submitAnswer = useCallback(
    (a: QuizAnswer) =>
      setState((s) => ({ ...s, answers: { ...s.answers, [a.quizId]: a } })),
    [],
  );
  const resetAnswers = useCallback(
    (scope?: string) =>
      setState((s) => ({
        ...s,
        answers: scope
          ? Object.fromEntries(
              Object.entries(s.answers).filter(([k]) => !k.startsWith(`${scope}:`)),
            )
          : {},
      })),
    [],
  );

  const value = useMemo(
    () => ({ ...state, setLearningMode, setQuizOnly, submitAnswer, resetAnswers }),
    [state, setLearningMode, setQuizOnly, submitAnswer, resetAnswers],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJourney(): JourneyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJourney outside JourneyProvider");
  return ctx;
}

/* ————— per-variant quiz scope ————— */

const ScopeCtx = createContext<string>("");

/** Wraps one variant's route so its quiz answers live in their own namespace. */
export function QuizScope({ scope, children }: { scope: string; children: ReactNode }) {
  return <ScopeCtx.Provider value={scope}>{children}</ScopeCtx.Provider>;
}

/** The active variant's answer namespace ("" outside any variant). */
export function useQuizScope(): string {
  return useContext(ScopeCtx);
}

/** Maps a quiz id to its storage key within the active variant's scope. */
export function useScopedId(): (quizId: string) => string {
  const scope = useContext(ScopeCtx);
  return useCallback((id: string) => (scope ? `${scope}:${id}` : id), [scope]);
}
