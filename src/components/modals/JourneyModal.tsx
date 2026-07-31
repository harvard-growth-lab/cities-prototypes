import { useEffect } from "react";
import type { ReactNode } from "react";
import { SECTION_DEFS, cityShortName } from "../../data/content";
import type { Insight } from "../../data/content";
import { downloadInsights } from "../../lib/downloads";
import {
  CloseIcon,
  DownloadIcon,
  ExploreIcon,
  InsightIcon,
  JourneyIcon,
  QuizIcon,
} from "../icons";

function JpIcon({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <span className={"jp-ic" + (done ? " done" : "")}>
      {children}
      {done && (
        <span className="badge">
          <svg viewBox="0 0 10 8" fill="none">
            <path d="M1 4.2 3.7 6.8 9 1.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </span>
  );
}

interface JourneyModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (entryPageId: string) => void;
  visitedPages: ReadonlySet<string>;
  currentPageId: string | null;
  exploredCities: ReadonlySet<string>;
  insights: Insight[];
}

export function JourneyModal({
  open,
  onClose,
  onNavigate,
  visitedPages,
  currentPageId,
  exploredCities,
  insights,
}: JourneyModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const secStates = SECTION_DEFS.map((s) => {
    const seen = s.pages.filter((p) => visitedPages.has(p)).length;
    return {
      ...s,
      seen,
      completed: seen === s.pages.length,
      current: currentPageId !== null && s.pages.includes(currentPageId),
    };
  });

  return (
    <div
      className={"journey-overlay" + (open ? " open" : "")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="journey-window" role="dialog" aria-modal="true" aria-labelledby="journeyTitle">
        <div className="journey-head">
          <div className="jh-icon">
            <JourneyIcon size={22} fill="#255862" />
          </div>
          <div className="jh-titles">
            <h2 id="journeyTitle">My Learning Journey</h2>
          </div>
          <button className="journey-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="journey-body">
          <div className="jp-cities">
            {exploredCities.size === 0 ? (
              <span className="label">No cities explored yet</span>
            ) : (
              <>
                <span className="label">Cities explored</span>
                {[...exploredCities].map((c) => (
                  <span key={c} className="city-chip" title={c}>
                    {cityShortName(c)}
                  </span>
                ))}
              </>
            )}
          </div>

          <div className="jp-legend">
            <span className="leg">
              <ExploreIcon />
              Explore
            </span>
            <span className="leg">
              <InsightIcon />
              Your insight
            </span>
            <span className="leg">
              <QuizIcon />
              Check your understanding
            </span>
          </div>

          <div className="jp-list">
            {secStates.map((s, i) => {
              const isExports = s.name === "City Exports";
              const exploreDone = s.seen > 0;
              const insightDone = isExports && insights.length > 0;
              const quizDone = false; // quiz window not built yet
              const statusKey = s.completed ? "completed" : s.seen > 0 ? "inprogress" : "notstarted";
              const statusText = s.completed ? "Completed" : s.seen > 0 ? "In progress" : "Not started";
              return (
                <button
                  key={s.name}
                  className={"jp-row" + (s.current ? " current" : "") + (s.completed ? " completed" : "")}
                  onClick={() => onNavigate(s.entry)}
                >
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="info">
                    <span className="name">{s.name}</span>
                    <div className={"status " + statusKey}>{statusText}</div>
                  </span>
                  <span className="jp-icons">
                    <JpIcon done={exploreDone}>
                      <ExploreIcon />
                    </JpIcon>
                    <JpIcon done={insightDone}>
                      <InsightIcon />
                    </JpIcon>
                    <JpIcon done={quizDone}>
                      <QuizIcon />
                    </JpIcon>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="jp-insights">
            <div className="jp-ins-head">
              <span className="jp-title">My saved insights/notes</span>
              <button className="jp-download" onClick={() => downloadInsights(insights)}>
                <DownloadIcon />
                Download
              </button>
            </div>
            <div>
              {insights.length === 0 ? (
                <div className="jp-note-empty">
                  Nothing saved yet. When you save a response in “Put insights into action”, it will
                  be collected here.
                </div>
              ) : (
                insights.map((ins, i) => (
                  <div key={i} className="jp-note">
                    <div className="meta">
                      {cityShortName(ins.city)} ({ins.span})
                    </div>
                    <p className="text">{ins.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
