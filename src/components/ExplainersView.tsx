import { useEffect, useRef } from "react";
import { OpenBookIcon } from "./icons";
import { EXPLAINERS, explainerById } from "../explainers/registry";

interface ExplainersViewProps {
  open: boolean;
  /** which explainer is open, or null for the gallery. Owned by the route
      (App) rather than this component, so the browser Back button and
      shared "#explainers/<id>" links land where the reader expects. */
  openId: string | null;
  onOpen: (id: string | null) => void;
}

/** The Explainers tab: a gallery of cards, each opening its explainer IN
 *  PLACE of the grid — same scroll container, which the scrolly pages'
 *  sticky stages and step tracking rely on. */
export function ExplainersView({ open, openId, onOpen }: ExplainersViewProps) {
  const viewRef = useRef<HTMLDivElement | null>(null);
  const explainer = explainerById(openId);

  /* every gallery <-> explainer move starts at the top, including the ones
     the Back button makes */
  useEffect(() => {
    viewRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [openId]);

  return (
    <div ref={viewRef} className={"explainers-view" + (open ? " open" : "")}>
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
    </div>
  );
}
