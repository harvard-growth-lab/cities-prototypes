/**
 * Variant 05 — the descent. Scroll is depth: a sticky frame holds the wall
 * chart while a tall runway behind it maps scroll to a camera dive down one
 * route from the root to a leaf. Each step frames the current fork and asks
 * its question in the card; the dashed trail ahead is the committed course.
 * Click any pill (or a branch chip) to set course through it; the rail on
 * the right jumps between depths.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  byId,
  descendantIds,
  DFS,
  FORK_QUESTION,
  LEAVES,
  pathTo,
  SHORT,
  SIDE_COLOR,
  SIDE_LABEL,
  type TNode,
} from "./model";
import { prefersReducedMotion } from "./useInView";
import { scrollToProgress, useScrollDrive } from "./useScrollDrive";

const W = 960;
const PILL_W = 148;
const PILL_H = 46;
const ROW_H = 82;
const TOP = 34;
const COL_GAP = (W - 36 - PILL_W) / 4;
const H = TOP + (LEAVES.length - 1) * ROW_H + PILL_H / 2 + 26;
const STEP_VH = 85; // runway length per depth step

const WRAP: Record<string, [string, string]> = {
  root: ["The growth", "question"],
  existing: ["Existing", "industries"],
};

interface Placed {
  n: TNode;
  x: number; // left edge of pill
  y: number; // vertical center
}

const PLACED: Placed[] = (() => {
  const y: Record<string, number> = {};
  LEAVES.forEach((leaf, i) => (y[leaf.id] = TOP + i * ROW_H));
  [...DFS].reverse().forEach((n) => {
    if (n.children.length)
      y[n.id] = n.children.reduce((s, c) => s + y[c.id], 0) / n.children.length;
  });
  return DFS.map((n) => ({ n, x: 18 + n.depth * COL_GAP, y: y[n.id] }));
})();
const AT: Record<string, Placed> = Object.fromEntries(PLACED.map((p) => [p.n.id, p]));

interface View {
  cx: number;
  cy: number;
  k: number;
}

/** the camera frame for a step: the node plus its children, padded.
 *  The root step is the establishing shot — the whole chart, no crop. */
function viewFor(id: string): View {
  if (id === "root") return { cx: W / 2, cy: H / 2, k: 1 };
  const pts = [AT[id], ...byId[id].children.map((c) => AT[c.id])];
  const x0 = Math.min(...pts.map((p) => p.x)) - 40;
  const x1 = Math.max(...pts.map((p) => p.x + PILL_W)) + 40;
  const y0 = Math.min(...pts.map((p) => p.y)) - PILL_H / 2 - 56;
  const y1 = Math.max(...pts.map((p) => p.y)) + PILL_H / 2 + 56;
  const k = Math.max(1, Math.min(2.5, W / (x1 - x0), H / (y1 - y0)));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k };
}

const tfm = (v: View) =>
  `translate(${W / 2 - v.k * v.cx} ${H / 2 - v.k * v.cy}) scale(${v.k})`;
const INITIAL_TFM = tfm(viewFor("root"));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** default course below a node: keep taking the first (upper) branch */
function descend(id: string): string[] {
  const out: string[] = [];
  let n = byId[id];
  while (n.children.length) {
    n = n.children[0];
    out.push(n.id);
  }
  return out;
}

export function Descent() {
  const reduced = useMemo(prefersReducedMotion, []);
  const [route, setRoute] = useState<string[]>(() => ["root", ...descend("root")]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const gRef = useRef<SVGGElement | null>(null);

  const views = useMemo(() => route.map(viewFor), [route]);
  const viewsRef = useRef(views);
  viewsRef.current = views;

  const runway = useScrollDrive<HTMLDivElement>((p) => {
    const vs = viewsRef.current;
    const last = vs.length - 1;
    const t = p * last;
    const i = Math.round(t);
    if (i !== activeRef.current) {
      activeRef.current = i;
      setActive(i);
    }
    const g = gRef.current;
    if (!g) return;
    let v: View;
    if (reduced) v = vs[i];
    else {
      const lo = Math.min(last, Math.floor(t));
      const hi = Math.min(last, lo + 1);
      const f = smooth(t - lo);
      const a = vs[lo];
      const b = vs[hi];
      v = {
        cx: a.cx + (b.cx - a.cx) * f,
        cy: a.cy + (b.cy - a.cy) * f,
        k: a.k + (b.k - a.k) * f,
      };
    }
    g.setAttribute("transform", tfm(v));
  });

  // after a reroute changes the runway's height, park the reader on the
  // step they were deciding (the pending index) before the next frame reads p
  const pending = useRef<number | null>(null);
  useEffect(() => {
    if (pending.current === null) return;
    const step = pending.current;
    pending.current = null;
    if (runway.current)
      scrollToProgress(runway.current, step / (route.length - 1), !reduced);
  }, [route, runway, reduced]);

  /** navigate to any node: same route → scroll there; new branch → reroute */
  const goTo = (id: string) => {
    const full = [...pathTo(id).map((n) => n.id), ...descend(id)];
    const same = full.length === route.length && full.every((v, i) => v === route[i]);
    if (same) {
      if (runway.current)
        scrollToProgress(runway.current, byId[id].depth / (route.length - 1), !reduced);
    } else {
      pending.current = byId[id].depth;
      setRoute(full);
    }
  };

  const step = Math.min(active, route.length - 1);
  const focus = byId[route[step]];
  const isLeaf = !focus.children.length;
  const routeIdx: Record<string, number> = {};
  route.forEach((id, i) => (routeIdx[id] = i));
  const inSubtree = useMemo(() => new Set(descendantIds(focus.id)), [focus.id]);

  const nodeOpacity = (id: string): number => {
    if (byId[id].parent === focus.id) return 1; // the live choices
    const ri = routeIdx[id];
    if (ri !== undefined) return ri <= step ? 1 : 0.8; // trail + course ahead
    if (inSubtree.has(id)) return 0.5; // context below the fork
    return 0.12; // branches ruled out (for now)
  };

  return (
    <div
      className="tl-runway tl-descent"
      ref={runway}
      style={{ height: `calc(100vh + ${(route.length - 1) * STEP_VH}vh)` }}
    >
      <div className="tl-descent-stage">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="The decision tree in a fixed frame. Scrolling descends one fork per step; the camera dives into the chosen branch while the rest of the tree fades back."
        >
          <g ref={gRef} transform={INITIAL_TFM}>
            {PLACED.filter((p) => p.n.parent).map((p) => {
              const a = AT[p.n.parent!];
              const x0 = a.x + PILL_W;
              const mid = (x0 + p.x) / 2;
              const c = SIDE_COLOR[p.n.side];
              const onRoute =
                routeIdx[p.n.id] !== undefined && routeIdx[p.n.parent!] !== undefined;
              const walked = onRoute && routeIdx[p.n.id]! <= step;
              return (
                <path
                  key={`l-${p.n.id}`}
                  className="tl-descent-link"
                  d={`M${x0},${a.y} C${mid},${a.y} ${mid},${p.y} ${p.x},${p.y}`}
                  fill="none"
                  stroke={onRoute ? c.base : "#d8d4cc"}
                  strokeWidth={walked ? 2.6 : onRoute ? 1.8 : 1.2}
                  strokeDasharray={onRoute && !walked ? "5 5" : undefined}
                  opacity={walked ? 1 : onRoute ? 0.6 : Math.max(0.1, nodeOpacity(p.n.id) * 0.9)}
                />
              );
            })}

            {PLACED.map((p) => {
              const op = nodeOpacity(p.n.id);
              const isFocus = p.n.id === focus.id;
              const onRoute = routeIdx[p.n.id] !== undefined;
              const ahead = onRoute && routeIdx[p.n.id]! > step;
              const choice = p.n.parent === focus.id;
              const clickable = op > 0.4 && !isFocus;
              const c = SIDE_COLOR[p.n.side];
              return (
                <g
                  key={p.n.id}
                  className="tl-descent-pill"
                  transform={`translate(${p.x}, ${p.y - PILL_H / 2})`}
                  opacity={op}
                  style={{ cursor: clickable ? "pointer" : "default" }}
                  onClick={clickable ? () => goTo(p.n.id) : undefined}
                >
                  <rect
                    width={PILL_W}
                    height={PILL_H}
                    rx={10}
                    fill={isFocus ? "#ffffff" : "#fdfcf9"}
                    stroke={isFocus || onRoute || choice ? c.base : "#ddd7cb"}
                    strokeWidth={isFocus ? 2 : onRoute || choice ? 1.3 : 1}
                    strokeDasharray={ahead ? "4 4" : undefined}
                  />
                  <circle
                    cx={13}
                    cy={PILL_H / 2}
                    r={4}
                    fill={onRoute || choice ? c.base : "#c6bfb2"}
                  />
                  {(WRAP[p.n.id] ?? [SHORT[p.n.id]]).map((line, i, lines) => (
                    <text
                      key={i}
                      x={24}
                      y={PILL_H / 2 + 4.5 + (i - (lines.length - 1) / 2) * 13}
                      fontSize={13.5}
                      fontWeight={isFocus ? 700 : 500}
                      fill={onRoute || choice ? c.deep : "#4f4a42"}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
          </g>
        </svg>

        {/* the card: the fork's question, or the leaf's case */}
        <div className="tl-descent-card" aria-live="polite">
          <div className="tl-descent-card-top">
            <span className="tl-side-chip" data-side={focus.side}>
              {SIDE_LABEL[focus.side]}
            </span>
            <span className="tl-descent-depth">
              depth {step} of {route.length - 1}
            </span>
          </div>
          <h4>{focus.title}</h4>
          {isLeaf ? (
            <>
              <p>{focus.detail}</p>
              {focus.example && (
                <p className="tl-wall-meta">
                  <b>Case</b> {focus.example}
                </p>
              )}
              {focus.tests && (
                <p className="tl-wall-meta">
                  <b>Tests</b> {focus.tests}
                </p>
              )}
              <div className="tl-descent-hint">
                end of the branch — scroll back up, or take another route on the rail
              </div>
            </>
          ) : (
            <>
              <p className="tl-descent-q">{FORK_QUESTION[focus.id]}</p>
              <div className="tl-descent-choices">
                {focus.children.map((c) => (
                  <button
                    key={c.id}
                    className={`tl-descent-choice${route[step + 1] === c.id ? " on" : ""}`}
                    data-side={c.side}
                    onClick={() => goTo(c.id)}
                  >
                    {SHORT[c.id]}
                  </button>
                ))}
              </div>
              <div className="tl-descent-hint">
                scroll to descend
                {focus.children.length > 1 ? " · click a branch to change course" : ""}
              </div>
            </>
          )}
        </div>

        {/* the rail: one stop per depth on the current route */}
        <div className="tl-descent-rail" role="group" aria-label="Jump to a depth">
          {route.map((id, i) => (
            <button
              key={id}
              className={i === step ? "on" : undefined}
              aria-label={`Depth ${i}: ${SHORT[id]}`}
              onClick={() => goTo(id)}
            >
              <span>{SHORT[id]}</span>
              <span className="rdot" style={{ background: i <= step ? SIDE_COLOR[byId[id].side].base : undefined }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
