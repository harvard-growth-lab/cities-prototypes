import { useState } from "react";
import { INTRO_QUESTIONS, INTRO_SEGMENTS } from "../../data/content";
import type { IntroQuestion } from "../../data/content";

function IntroSlide({
  q,
  cityShort,
  showTitle,
}: {
  q: IntroQuestion;
  cityShort: string;
  showTitle: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const correctIdx = q.options.findIndex((o) => o.correct);
  const isRight = picked === correctIdx;

  return (
    <div className="intro-slide" id={q.slideId}>
      <div className="intro-card">
        {showTitle && (
          <p className="intro-title">
            Intro to {cityShort} with {INTRO_SEGMENTS} Questions!
          </p>
        )}
        <div className="intro-progress">
          {Array.from({ length: INTRO_SEGMENTS }, (_, i) => (
            <span key={i} className={"seg" + (i < q.progress ? " fill" : "")}></span>
          ))}
        </div>
        <h2 className="intro-q">{q.question}</h2>
        <div className={"intro-opts" + (done ? " done" : "")}>
          {q.options.map((opt, i) => (
            <button
              key={i}
              className={done ? (i === correctIdx ? "correct" : i === picked ? "wrong" : "") : ""}
              onClick={() => {
                if (!done) setPicked(i);
              }}
            >
              <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
              {opt.text}
            </button>
          ))}
        </div>
        <p className={"intro-fb" + (done ? (isRight ? " ok" : " no") : "")}>
          {done ? (isRight ? q.feedbackCorrect : q.feedbackWrong) : ""}
        </p>
      </div>
    </div>
  );
}

interface IntroQuizProps {
  cityShort: string;
  /** advancing past the last question scrolls on to the City Overview */
  onFinish: () => void;
}

export function IntroQuiz({ cityShort, onFinish }: IntroQuizProps) {
  const [idx, setIdx] = useState(0);
  const last = INTRO_QUESTIONS.length - 1;

  const slide = (d: number) => {
    if (d > 0 && idx === last) {
      onFinish();
      return;
    }
    setIdx((i) => Math.min(last, Math.max(0, i + d)));
  };

  return (
    <section className="page intro-page" id="page-intro-q1">
      <button
        className="intro-nav prev"
        onClick={() => slide(-1)}
        aria-label="Previous question"
        style={{ visibility: idx === 0 ? "hidden" : "visible" }}
      >
        <svg viewBox="0 0 10 16" fill="none">
          <path
            d="M8 1.5 1.5 8 8 14.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button className="intro-nav next" onClick={() => slide(1)} aria-label="Next">
        <svg viewBox="0 0 10 16" fill="none">
          <path
            d="M2 1.5 8.5 8 2 14.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="intro-viewport">
        <div className="intro-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {INTRO_QUESTIONS.map((q, i) => (
            <IntroSlide key={i} q={q} cityShort={cityShort} showTitle={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
