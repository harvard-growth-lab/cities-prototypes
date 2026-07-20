/**
 * The Course Companion's finale, promoted to shared: replay the active
 * variant's scoped quiz answers against the data, with a scoped reset.
 */

import { QUIZZES } from "./content/quizzes";
import { useJourney, useQuizScope, useScopedId } from "./journey";

export function QuizRecap({ title = "Your intuitions vs the data" }: { title?: string }) {
  const { answers, resetAnswers } = useJourney();
  const scope = useQuizScope();
  const scoped = useScopedId();
  const answered = QUIZZES.filter((q) => answers[scoped(q.id)] && !answers[scoped(q.id)].skipped);
  const right = answered.filter((q) => answers[scoped(q.id)].correct).length;

  return (
    <div className="viz-card">
      <h3>{title}</h3>
      <div className="subtitle">
        {answered.length === 0
          ? "No checkpoints answered this run — with learning mode on, revisit any step to try them."
          : `${right} of ${answered.length} priors survived contact with the data.`}
      </div>
      {QUIZZES.map((q) => {
        const a = answers[scoped(q.id)];
        return (
          <div
            key={q.id}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "baseline",
              padding: "7px 0",
              borderTop: "1px solid var(--hairline)",
              fontSize: 13.5,
            }}
          >
            <span style={{ minWidth: 74 }} className="note">
              stage {q.stage}
            </span>
            <span style={{ flex: 1, color: "var(--ink-2)" }}>{q.prompt}</span>
            <span
              style={{
                whiteSpace: "nowrap",
                fontWeight: 600,
                color: !a
                  ? "var(--ink-3)"
                  : a.skipped
                    ? "var(--ink-3)"
                    : a.correct
                      ? "#4cc596"
                      : "#e66767",
              }}
            >
              {!a ? "not seen" : a.skipped ? "skipped" : a.correct ? "called it" : "surprised you"}
            </span>
          </div>
        );
      })}
      <button className="quiz-skip" style={{ marginTop: 12 }} onClick={() => resetAnswers(scope)}>
        reset my answers and take the walk again
      </button>
    </div>
  );
}
