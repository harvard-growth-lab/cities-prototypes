/**
 * Learning-mode machinery: QuizCard (choice / slider) and QuizGate — a
 * wrapper that blurs its children until the stage's quiz is answered or
 * skipped. With learning mode off, the gate is a no-op.
 *
 * Answers are read and written through the active variant's quiz scope
 * (see journey.tsx): the same quiz posed by two prototypes is two
 * independent questions.
 */

import { useState, type ReactNode } from "react";
import type { ChoiceQuiz, Quiz, SliderQuiz } from "./content/quizzes";
import { useJourney, useScopedId } from "./journey";

export function ChoiceQuizCard({ quiz }: { quiz: ChoiceQuiz }) {
  const { answers, submitAnswer } = useJourney();
  const scoped = useScopedId();
  const sid = scoped(quiz.id);
  const a = answers[sid];
  const picked = a && !a.skipped ? (a.guess as number) : null;
  const answered = !!a;

  return (
    <div className="quiz-card">
      <div className="quiz-tag">Check your intuition</div>
      <div className="prompt">{quiz.prompt}</div>
      <div className="quiz-options">
        {quiz.options.map((opt, i) => {
          let cls = "quiz-option";
          if (answered) {
            if (i === quiz.correctIndex) cls += " correct";
            else if (i === picked) cls += " wrong";
          } else if (i === picked) cls += " picked";
          return (
            <button
              key={opt}
              className={cls}
              disabled={answered}
              onClick={() =>
                submitAnswer({ quizId: sid, guess: i, correct: i === quiz.correctIndex })
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && !a.skipped && (
        <div className="quiz-reveal">
          <span className={`verdict-word ${a.correct ? "good" : "bad"}`}>
            {a.correct ? "Right." : "Not quite."}
          </span>{" "}
          {quiz.reveal}
        </div>
      )}
      {!answered && <SkipButton quizId={quiz.id} />}
    </div>
  );
}

export function SliderQuizCard({ quiz }: { quiz: SliderQuiz }) {
  const { answers, submitAnswer } = useJourney();
  const scoped = useScopedId();
  const sid = scoped(quiz.id);
  const a = answers[sid];
  const answered = !!a;
  const [value, setValue] = useState(Math.round((quiz.min + quiz.max) / 2));

  return (
    <div className="quiz-card">
      <div className="quiz-tag">Check your intuition</div>
      <div className="prompt">{quiz.prompt}</div>
      <div className="quiz-slider">
        <input
          type="range"
          min={quiz.min}
          max={quiz.max}
          value={answered && !a.skipped ? (a.guess as number) : value}
          disabled={answered}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <span className="readout">
          {answered && !a.skipped ? (a.guess as number) : value}
          {quiz.unit}
        </span>
      </div>
      {!answered && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
          <button
            className="btn gold"
            onClick={() =>
              submitAnswer({
                quizId: sid,
                guess: value,
                correct: Math.abs(value - quiz.answer) <= quiz.tolerance,
              })
            }
          >
            Lock it in
          </button>
          <SkipButton quizId={quiz.id} />
        </div>
      )}
      {answered && !a.skipped && (
        <div className="quiz-reveal">
          <span className={`verdict-word ${a.correct ? "good" : "bad"}`}>
            {a.correct ? "Close enough." : `You said ${a.guess}${quiz.unit} — it's ${quiz.answer}${quiz.unit}.`}
          </span>{" "}
          {quiz.reveal}
        </div>
      )}
    </div>
  );
}

export function SkipButton({ quizId }: { quizId: string }) {
  const { submitAnswer } = useJourney();
  const scoped = useScopedId();
  return (
    <button
      className="quiz-skip"
      onClick={() => submitAnswer({ quizId: scoped(quizId), guess: -1, correct: false, skipped: true })}
    >
      skip — just show me the data
    </button>
  );
}

export function QuizCard({ quiz }: { quiz: Quiz }) {
  if (quiz.kind === "choice") return <ChoiceQuizCard quiz={quiz} />;
  if (quiz.kind === "slider") return <SliderQuizCard quiz={quiz} />;
  return null; // instrument quizzes are composed with their widget (see proto/InstrumentCards)
}

/**
 * The quiz card alone — for layouts that place the card away from the gated
 * content (the full-bleed map steps put it inside the narrative card while
 * QuizGate blurs the map elsewhere in the section).
 */
export function QuizCardSlot({ quiz }: { quiz: Quiz | undefined }) {
  if (!quiz) return null;
  return <QuizCard quiz={quiz} />;
}

/**
 * Gate: with learning mode on and the quiz unanswered, children render
 * blurred behind the quiz card. Answer or skip to open. Instrument quizzes
 * pass their composed card via `card` (QuizCard can't know the widget);
 * `hideCard` suppresses the card here when the caller renders it elsewhere
 * (see QuizCardSlot).
 */
export function QuizGate({
  quiz,
  children,
  card,
  hideCard = false,
}: {
  quiz: Quiz | undefined;
  children: ReactNode;
  card?: ReactNode;
  hideCard?: boolean;
}) {
  const { learningMode, answers } = useJourney();
  const scoped = useScopedId();
  const gated = !!quiz && learningMode && !answers[scoped(quiz.id)];

  return (
    <>
      {quiz && !hideCard && (card ?? <QuizCard quiz={quiz} />)}
      <div className={`gated ${gated ? "" : "open"}`}>
        <div className="gated-content">{children}</div>
      </div>
    </>
  );
}
