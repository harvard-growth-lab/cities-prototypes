import { useRef, useState } from "react";
import { OpenBookIcon } from "./icons";
import { TreePage } from "../explainers/tree/TreePage";

/** Card thumbnail for the diagnostic-tree explainer: the page's own hero
 *  glyph (root → two sides → four leaves, in its branch colors), scaled up
 *  on GL paper with the two fork rules as faint furniture. */
function TreeGlyphThumb() {
  return (
    <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Abstract diagnostic tree">
      <rect width="400" height="320" fill="#f7f5f0" />
      {/* faint pizza-chart crosshair, echoing the page's opening instrument */}
      <g stroke="#e3ded4" strokeWidth="1.5" strokeDasharray="4 5">
        <path d="M 200 24 V 296" />
        <path d="M 36 160 H 364" />
      </g>
      <g transform="translate(80, 82) scale(1)">
        <g fill="none" strokeWidth={3} strokeLinecap="round">
          <path d="M 120 22 L 120 36 L 60 36 L 60 52" stroke="#3d7ab8" />
          <path d="M 120 22 L 120 36 L 180 36 L 180 52" stroke="#c98500" />
          <path d="M 60 66 L 60 82 L 24 82 L 24 100" stroke="#7059ad" />
          <path d="M 60 66 L 60 82 L 96 82 L 96 100" stroke="#3d7ab8" />
          <path d="M 180 66 L 180 82 L 144 82 L 144 100" stroke="#8a5a00" />
          <path d="M 180 66 L 180 82 L 216 82 L 216 100" stroke="#199e70" />
        </g>
        <circle cx={120} cy={16} r={8} fill="#ffffff" stroke="#a89f91" strokeWidth={1.8} strokeDasharray="3.5 3" />
        <circle cx={60} cy={59} r={7.5} fill="#3d7ab8" fillOpacity={0.85} />
        <circle cx={180} cy={59} r={7.5} fill="#c98500" fillOpacity={0.85} />
        <circle cx={24} cy={106} r={7} fill="#7059ad" fillOpacity={0.8} />
        <circle cx={96} cy={106} r={7} fill="#3d7ab8" fillOpacity={0.8} />
        <circle cx={144} cy={106} r={7} fill="#8a5a00" fillOpacity={0.8} />
        <circle cx={216} cy={106} r={7} fill="#199e70" fillOpacity={0.8} />
      </g>
    </svg>
  );
}

/** The Explainers tab: a gallery of explainer cards. One explainer so far —
 *  the diagnostic-tree scrolly ported from the cities-explainer prototype —
 *  which opens IN PLACE of the gallery (same scroll container, which the
 *  scrolly's sticky stage and step tracking rely on), with a floating pill
 *  to come back. */
export function ExplainersView({ open }: { open: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);

  const navigate = (id: string | null) => {
    setOpenId(id);
    viewRef.current?.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <div ref={viewRef} className={"explainers-view" + (open ? " open" : "")}>
      {openId === "diagnostic-tree" ? (
        <>
          <button className="ex-back" onClick={() => navigate(null)}>
            ← All explainers
          </button>
          <TreePage />
        </>
      ) : (
        <>
          <div className="ex-head">
            <OpenBookIcon fill="var(--teal)" />
            <h2>Visual Explainers</h2>
          </div>
          <div className="ex-grid">
            <button className="ex-card" onClick={() => navigate("diagnostic-tree")}>
              <span className="ex-thumb">
                <TreeGlyphThumb />
              </span>
              <span className="ex-title-row">
                <span className="ex-title">How to Read the Diagnostic Tree</span>
                <span className="ex-read">4min read</span>
              </span>
              <p className="ex-desc">
                Two dials — people and pay — two questions, and four diagnoses. How every US
                city over 100k sorts down the tree, one fork at a time.
              </p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
