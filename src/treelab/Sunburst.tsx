/**
 * Variant 03 — the dial. The tree bent into a zoomable sunburst: every ring
 * is a depth, every arc's width is its share of the leaves below it. Click a
 * branch to re-root the dial on it (the subtree animates out to fill the
 * circle); click the center to back out one level. Leaves pin their gist to
 * the caption. Layout tweening is hand-rolled on requestAnimationFrame —
 * no chart library, just polar math.
 */

import { useEffect, useMemo, useState } from "react";
import { byId, GIST, pathTo, ringFill, ringInk, SHORT, type TNode } from "./model";

const SIZE = 520;
const C = SIZE / 2;
const R0 = 80; // center circle
const RING = 44;

interface Arc {
  a0: number; // radians clockwise from 12 o'clock
  a1: number;
  r0: number;
  r1: number;
}
type Layout = Record<string, Arc>;

/** θ clockwise from 12 o'clock → svg point */
const pt = (r: number, th: number): [number, number] => [
  C + r * Math.sin(th),
  C - r * Math.cos(th),
];

function layoutFor(focusId: string): Layout {
  const out: Layout = {};
  const place = (n: TNode, a0: number, a1: number, ring: number) => {
    out[n.id] = { a0, a1, r0: R0 + (ring - 1) * RING + 2, r1: R0 + ring * RING - 2 };
    let a = a0;
    for (const c of n.children) {
      const span = (a1 - a0) * (c.leafCount / n.leafCount);
      place(c, a, a + span, ring + 1);
      a += span;
    }
  };
  const focus = byId[focusId];
  let a = 0;
  for (const c of focus.children) {
    const span = 2 * Math.PI * (c.leafCount / focus.leafCount);
    place(c, a, a + span, 1);
    a += span;
  }
  return out;
}

function arcPath(a: Arc): string {
  const span = Math.min(a.a1 - a.a0, 2 * Math.PI - 1e-4);
  const a1 = a.a0 + span;
  const large = span > Math.PI ? 1 : 0;
  const [x0, y0] = pt(a.r1, a.a0);
  const [x1, y1] = pt(a.r1, a1);
  const [x2, y2] = pt(a.r0, a1);
  const [x3, y3] = pt(a.r0, a.a0);
  return (
    `M${x0},${y0} A${a.r1},${a.r1} 0 ${large} 1 ${x1},${y1} ` +
    `L${x2},${y2} A${a.r0},${a.r0} 0 ${large} 0 ${x3},${y3} Z`
  );
}

/** centerline path for a curved label; reversed on the lower half so the
 *  text never runs upside down (baseline nudged to stay optically centered) */
function labelPath(a: Arc): string {
  const mid = ((a.a0 + a.a1) / 2 + 2 * Math.PI) % (2 * Math.PI);
  const flip = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
  const r = (a.r0 + a.r1) / 2 + (flip ? -3.6 : 3.6);
  const span = Math.min(a.a1 - a.a0, 2 * Math.PI - 1e-4);
  const large = span > Math.PI ? 1 : 0;
  const [x0, y0] = pt(r, a.a0);
  const [x1, y1] = pt(r, a.a0 + span);
  return flip
    ? `M${x1},${y1} A${r},${r} 0 ${large} 0 ${x0},${y0}`
    : `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Anim {
  from: Layout;
  to: Layout;
  t: number;
}

/** the currently-visible geometry, for retargeting mid-flight */
function snapshot(anim: Anim): Layout {
  const e = ease(anim.t);
  const out: Layout = {};
  for (const id of new Set([...Object.keys(anim.from), ...Object.keys(anim.to)])) {
    const f = anim.from[id];
    const g = anim.to[id];
    out[id] =
      f && g
        ? {
            a0: f.a0 + (g.a0 - f.a0) * e,
            a1: f.a1 + (g.a1 - f.a1) * e,
            r0: f.r0 + (g.r0 - f.r0) * e,
            r1: f.r1 + (g.r1 - f.r1) * e,
          }
        : (g ?? f);
  }
  return out;
}

export function Sunburst() {
  const [focus, setFocus] = useState("root");
  const [hov, setHov] = useState<string | null>(null);
  const [read, setRead] = useState<string | null>(null);
  const [anim, setAnim] = useState<Anim>(() => {
    const l = layoutFor("root");
    return { from: l, to: l, t: 1 };
  });
  const reduced = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );

  const zoomTo = (id: string) => {
    if (id === focus) return;
    setFocus(id);
    setRead(null);
    setAnim((a) => ({ from: snapshot(a), to: layoutFor(id), t: reduced ? 1 : 0 }));
  };

  useEffect(() => {
    if (anim.t >= 1) return;
    const dur = 520;
    const t0 = performance.now();
    const start = anim.t;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, start + ((now - t0) / dur) * (1 - start));
      setAnim((a) => ({ ...a, t }));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim.to]);

  const e = ease(anim.t);
  const ids = [...new Set([...Object.keys(anim.from), ...Object.keys(anim.to)])].sort(
    (x, y) => byId[x].depth - byId[y].depth,
  );

  const focusNode = byId[focus];
  const capId = hov ?? read ?? focus;
  const cap = byId[capId];
  const centerLines = SHORT[focus].split(" ").reduce<string[]>((lines, w) => {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 12) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
    return lines;
  }, []);

  return (
    <div className="tl-dial">
      <div className="tl-trail tl-dial-trail" aria-label="Zoom path">
        {pathTo(focus).map((n, i) => (
          <span key={n.id} className="tl-trail-step">
            {i > 0 && <span className="tl-trail-arrow">→</span>}
            <button className="tl-trail-chip" data-side={n.side} onClick={() => zoomTo(n.id)}>
              {i === 0 ? "Whole tree" : SHORT[n.id]}
            </button>
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="tl-dial-svg"
        role="img"
        aria-label="The decision tree as a zoomable sunburst. Demand branches in blue on the rings, supply branches in gold; click a branch to zoom into its subtree."
      >
        {ids.map((id) => {
          const f = anim.from[id];
          const g = anim.to[id];
          const a: Arc =
            f && g
              ? {
                  a0: f.a0 + (g.a0 - f.a0) * e,
                  a1: f.a1 + (g.a1 - f.a1) * e,
                  r0: f.r0 + (g.r0 - f.r0) * e,
                  r1: f.r1 + (g.r1 - f.r1) * e,
                }
              : ((g ?? f) as Arc);
          const op = f && g ? 1 : g ? e : 1 - e;
          if (op <= 0.02) return null;
          const n = byId[id];
          const arcLen = (a.a1 - a.a0) * ((a.r0 + a.r1) / 2);
          const showLabel = arcLen > SHORT[id].length * 6.6 + 10;
          const isHov = hov === id;
          const isRead = read === id;
          return (
            <g key={id} opacity={op}>
              <path
                d={arcPath(a)}
                fill={ringFill(n)}
                stroke="#f4f1ea"
                strokeWidth={2}
                className="tl-dial-arc"
                style={{
                  filter: isHov ? "brightness(0.93) saturate(1.12)" : undefined,
                }}
                onMouseEnter={() => setHov(id)}
                onMouseLeave={() => setHov(null)}
                onClick={() =>
                  n.children.length ? zoomTo(id) : setRead(isRead ? null : id)
                }
              />
              {isRead && (
                <path d={arcPath(a)} fill="none" stroke="#1a1714" strokeWidth={1.4}
                  strokeDasharray="3 3" pointerEvents="none" />
              )}
              {showLabel && (
                <>
                  <path id={`tl-lp-${id}`} d={labelPath(a)} fill="none" />
                  <text className="tl-dial-label" fill={ringInk(n)} pointerEvents="none">
                    <textPath href={`#tl-lp-${id}`} startOffset="50%" textAnchor="middle">
                      {SHORT[id]}
                    </textPath>
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* the center: the focus, and the way back out */}
        <g
          className="tl-dial-center"
          style={{ cursor: focus === "root" ? "default" : "pointer" }}
          onClick={() => focusNode.parent && zoomTo(focusNode.parent)}
        >
          <circle cx={C} cy={C} r={R0 - 8} fill="#ffffff" stroke="#ddd7cb" />
          {centerLines.map((line, i) => (
            <text
              key={i}
              x={C}
              y={C - ((centerLines.length - 1) * 15) / 2 + i * 15 + (focus === "root" ? 0 : -5)}
              className="tl-dial-center-label"
            >
              {line}
            </text>
          ))}
          {focus !== "root" && (
            <text x={C} y={C + ((centerLines.length - 1) * 15) / 2 + 16} className="tl-dial-center-hint">
              ↩ back out
            </text>
          )}
        </g>
      </svg>

      <div className="tl-dial-caption" aria-live="polite">
        <b style={{ color: cap.side === "root" ? "var(--ink)" : undefined }} data-side={cap.side}>
          {SHORT[capId]}
        </b>
        <span>{GIST[capId]}</span>
        {read === capId && !hov && <em className="tl-dial-pin"> · pinned — click the slice again to release</em>}
      </div>
    </div>
  );
}
