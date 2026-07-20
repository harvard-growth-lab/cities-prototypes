/**
 * Instrument quiz cards — the two hands-on checks, styled and graded exactly
 * like the choice quizzes: same `.quiz-card` chrome, same journey store, same
 * skip, same reveal, same scorecard row. The widget replaces the option list.
 *
 *   • DragDotQuizCard  — drag the metro onto the people × pay plane, lock it
 *     in; correct = your wedge is Boston's wedge.
 *   • TreeWalkQuizCard — walk the diagnostic tree; reaching a leaf commits;
 *     correct = the data's own walk (root → supply → amenities).
 */

import { useEffect, useRef, useState } from "react";
import type { InstrumentQuiz } from "./content/quizzes";
import { useJourney, useScopedId } from "./journey";
import { SkipButton } from "./QuizBits";
import { DragDot } from "./DragDot";
import { TreeWalk } from "./TreeWalk";
import { boston } from "./data/boston";
import { MEDIANS } from "./data/metros";
import { verdictAt, msaVerdict } from "./data/derive";

function Reveal({ correct, right, wrong, reveal }: { correct: boolean; right: string; wrong: string; reveal: string }) {
  return (
    <div className="quiz-reveal">
      <span className={`verdict-word ${correct ? "good" : "bad"}`}>{correct ? right : wrong}</span> {reveal}
    </div>
  );
}

export function DragDotQuizCard({ quiz }: { quiz: InstrumentQuiz }) {
  const { answers, submitAnswer } = useJourney();
  const scoped = useScopedId();
  const sid = scoped(quiz.id);
  const a = answers[sid];
  const answered = !!a;
  // Start ON the benchmark crosshair — a neutral opening position that takes
  // no side until the user drags it somewhere.
  const [pt, setPt] = useState({ x: MEDIANS.popCagr, y: MEDIANS.wageCagr });

  return (
    <div className="quiz-card">
      <div className="quiz-tag">Check your intuition · drag the dot</div>
      <div className="prompt">{quiz.prompt}</div>
      {/* Skipping means "just show me the data": reveal Boston's true position
          (and drop the untouched guess dot) instead of freezing the neutral
          drag state, which read as the skip doing nothing at all. */}
      <DragDot pt={pt} onChange={setPt} locked={answered} showTruth={answered} hideGuess={answered && a.skipped} />
      {!answered && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
          <button
            className="btn gold"
            onClick={() =>
              submitAnswer({
                quizId: sid,
                guess: [Number(pt.x.toFixed(2)), Number(pt.y.toFixed(2))],
                correct: verdictAt(pt.x, pt.y).wedge === msaVerdict(boston).wedge,
              })
            }
          >
            Lock it in
          </button>
          <SkipButton quizId={quiz.id} />
        </div>
      )}
      {answered && !a.skipped && (
        <Reveal correct={a.correct} right="Right slice." wrong="Different slice than you thought." reveal={quiz.reveal} />
      )}
      {answered && a.skipped && (
        <div className="quiz-reveal">
          <span className="verdict-word">Skipped.</span> {quiz.reveal}
        </div>
      )}
    </div>
  );
}

export function TreeWalkQuizCard({ quiz }: { quiz: InstrumentQuiz }) {
  const { answers, submitAnswer } = useJourney();
  const scoped = useScopedId();
  const sid = scoped(quiz.id);
  const a = answers[sid];
  const answered = !!a;

  // Remount the walk when an answer DISAPPEARS (a reset): the widget's
  // internal path would otherwise still sit at the completed leaf and its
  // completion effect would instantly re-submit the cleared answer. Answering
  // itself must NOT remount — the finished walk stays on display.
  const [walkKey, setWalkKey] = useState(0);
  const prevAnswered = useRef(answered);
  useEffect(() => {
    if (prevAnswered.current && !answered) setWalkKey((k) => k + 1);
    prevAnswered.current = answered;
  }, [answered]);

  return (
    <div className="quiz-card">
      <div className="quiz-tag">Check your intuition · walk the tree</div>
      <div className="prompt">{quiz.prompt}</div>
      <TreeWalk
        key={walkKey}
        onComplete={(correct) => {
          // Answers are write-once; "walk it again" stays a free replay.
          if (!answers[sid]) submitAnswer({ quizId: sid, guess: correct ? 1 : 0, correct });
        }}
      />
      {!answered && <SkipButton quizId={quiz.id} />}
      {answered && !a.skipped && (
        <Reveal correct={a.correct} right="Same walk the data takes." wrong="The data walks the other way." reveal={quiz.reveal} />
      )}
    </div>
  );
}
