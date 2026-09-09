import { useEffect } from "react";
import { JourneyIcon, OpenBookIcon } from "./icons";
import { EXPLAINERS, explainerById } from "../explainers/registry";

interface ExplainersContentProps {
  /** v-3's #explainersView: the scroll container the pages' sticky stages
   *  live in, and what scrolls back to the top on every move */
  container: HTMLElement;
  /** which explainer is open, or null for the gallery. Owned by the route
      (App) so the browser Back button and shared "#explainers/<id>" links
      land where the reader expects. */
  openId: string | null;
  onOpen: (id: string | null) => void;
  /** back to the tool (v-3's toggleExplainers) */
  onClose: () => void;
  /** the logo: back to the landing */
  onHome: () => void;
  onJourney: () => void;
}

/** The Explainers tab's content, drawn into v-3's explainers view: the same
 *  masthead the tool wears (v-3's scrolls away inside the pages, so this
 *  view needs its own), then the gallery, or one explainer in its place. */
export function ExplainersContent({
  container,
  openId,
  onOpen,
  onClose,
  onHome,
  onJourney,
}: ExplainersContentProps) {
  const explainer = explainerById(openId);

  /* every gallery <-> explainer move starts at the top, including the ones
     the Back button makes */
  useEffect(() => {
    container.scrollTo({ top: 0, behavior: "instant" });
  }, [container, openId]);

  return (
    <>
      <div className="toolbar">
        <button className="logo-btn" onClick={onHome} title="Back to start">
          <img alt="Growth Lab" src="legacy/assets/gl_logo.png" />
        </button>
        <div className="spacer"></div>
        <button className="explainers-btn active" onClick={onClose}>
          <OpenBookIcon />
          Explainers
        </button>
        <nav className="toolbar-links">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            City Diagnosis
          </a>
          {/* placeholder links, as in v-3's masthead */}
          <a href="#" onClick={(e) => e.preventDefault()}>About</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Glossary</a>
        </nav>
        <button className="btn-journey" onClick={onJourney}>
          <JourneyIcon />
          My Learning Journey
        </button>
      </div>

      {explainer ? (
        <>
          <button className="ex-back" onClick={() => onOpen(null)}>
            ← All explainers
          </button>
          <explainer.Page />
        </>
      ) : (
        <>
          <div className="ex-head">
            <OpenBookIcon fill="var(--teal)" />
            <h2>Visual Explainers</h2>
          </div>
          <div className="ex-grid">
            {EXPLAINERS.map(({ id, title, read, desc, Thumb }) => (
              <button key={id} className="ex-card" onClick={() => onOpen(id)}>
                <span className="ex-thumb">
                  <Thumb />
                </span>
                <span className="ex-title-row">
                  <span className="ex-title">{title}</span>
                  <span className="ex-read">{read}</span>
                </span>
                <p className="ex-desc">{desc}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
