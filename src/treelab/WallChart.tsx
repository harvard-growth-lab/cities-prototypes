/**
 * Variant 01 — the wall chart. The whole of Figure 27 at once, drawn as a
 * left-to-right tidy tree of pills. Hover traces a node's ancestry in its
 * side color and reads its case in the fixed panel on the right; click pins
 * the selection so the pointer is free. Click the paper to unpin.
 */

import { useMemo, useState } from "react";
import { byId, DFS, LEAVES, pathTo, SHORT, SIDE_COLOR, type TNode } from "./model";

const W = 760;
const PILL_W = 112;
const PILL_H = 38;
const ROW_H = 58;
const TOP = 44;
const COL_GAP = (W - 30 - PILL_W) / 4;

const COL_NAMES = ["the question", "which side", "the syndrome", "the suspects", "the reach"];

/** labels too long for one line inside a pill wrap to two */
const WRAP: Record<string, [string, string]> = {
  root: ["The growth", "question"],
  existing: ["Existing", "industries"],
  horizontal: ["Horizontal", "inputs"],
  inputs: ["Production", "inputs"],
};

interface Placed {
  n: TNode;
  x: number; // left edge of pill
  y: number; // vertical center
}

function layout(): Placed[] {
  const y: Record<string, number> = {};
  LEAVES.forEach((leaf, i) => {
    y[leaf.id] = TOP + i * ROW_H;
  });
  // parents at the mean of their children, computed bottom-up (DFS reversed)
  [...DFS].reverse().forEach((n) => {
    if (n.children.length)
      y[n.id] = n.children.reduce((s, c) => s + y[c.id], 0) / n.children.length;
  });
  return DFS.map((n) => ({ n, x: 15 + n.depth * COL_GAP, y: y[n.id] }));
}

export function WallChart() {
  const placed = useMemo(layout, []);
  const H = TOP + (LEAVES.length - 1) * ROW_H + PILL_H;
  const at = useMemo(() => {
    const m: Record<string, Placed> = {};
    placed.forEach((p) => (m[p.n.id] = p));
    return m;
  }, [placed]);

  const [pin, setPin] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const activeId = hov ?? pin ?? "root";
  const active = byId[activeId];
  const path = pathTo(activeId).map((n) => n.id);
  const idle = activeId === "root" && !pin && !hov;

  const onPath = (id: string) => path.includes(id);
  const col = (n: TNode) => SIDE_COLOR[n.side];

  return (
    <div className="tl-wall">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Figure 27 drawn as a left-to-right tree. Hover or click a node to read its case in the panel alongside."
        onClick={() => setPin(null)}
      >
        {/* column captions */}
        {COL_NAMES.map((name, i) => (
          <text key={name} x={15 + i * COL_GAP + PILL_W / 2} y={16} className="tl-wall-col">
            {name}
          </text>
        ))}

        {/* links */}
        {placed
          .filter((p) => p.n.parent)
          .map((p) => {
            const a = at[p.n.parent!];
            const x0 = a.x + PILL_W;
            const x1 = p.x;
            const mid = (x0 + x1) / 2;
            const lit = onPath(p.n.id) && onPath(p.n.parent!);
            return (
              <path
                key={`l-${p.n.id}`}
                d={`M${x0},${a.y} C${mid},${a.y} ${mid},${p.y} ${x1},${p.y}`}
                fill="none"
                stroke={lit ? col(p.n).base : "#d8d4cc"}
                strokeWidth={lit ? 2 : 1.2}
                opacity={idle || lit ? 1 : 0.55}
                style={{ transition: "stroke 0.18s, opacity 0.18s" }}
              />
            );
          })}

        {/* pills */}
        {placed.map((p) => {
          const lit = onPath(p.n.id);
          const c = col(p.n);
          return (
            <g
              key={p.n.id}
              transform={`translate(${p.x}, ${p.y - PILL_H / 2})`}
              className="tl-wall-pill"
              opacity={idle || lit ? 1 : 0.5}
              onMouseEnter={() => setHov(p.n.id)}
              onMouseLeave={() => setHov(null)}
              onClick={(e) => {
                e.stopPropagation();
                setPin(p.n.id === pin ? null : p.n.id);
              }}
            >
              <rect
                width={PILL_W}
                height={PILL_H}
                rx={9}
                fill={lit ? "#ffffff" : "#fdfcf9"}
                stroke={lit ? c.base : "#ddd7cb"}
                strokeWidth={lit ? 1.6 : 1}
              />
              {pin === p.n.id && (
                <rect x={-3} y={-3} width={PILL_W + 6} height={PILL_H + 6} rx={12}
                  fill="none" stroke={c.base} strokeWidth={1} strokeDasharray="3 3" />
              )}
              <circle cx={12} cy={PILL_H / 2} r={3.5} fill={lit ? c.base : "#c6bfb2"} />
              {(WRAP[p.n.id] ?? [SHORT[p.n.id]]).map((line, i, lines) => (
                <text
                  key={i}
                  x={21}
                  y={PILL_H / 2 + 3.5 + (i - (lines.length - 1) / 2) * 11.5}
                  className="tl-wall-label"
                  fill={lit ? c.deep : "#4f4a42"}
                  fontWeight={lit ? 600 : 450}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      {/* the reading panel */}
      <aside className="tl-wall-panel" aria-live="polite">
        <div className="tl-side-chip" data-side={active.side}>
          {active.side === "root"
            ? "the root"
            : active.side === "demand"
              ? "firms' side"
              : "residents' side"}
        </div>
        <h4>{active.title}</h4>
        {active.sub && <div className="tl-wall-sub">{active.sub}</div>}
        <p>{active.detail}</p>
        {active.example && (
          <p className="tl-wall-meta">
            <b>Case</b> {active.example}
          </p>
        )}
        {active.tests && (
          <p className="tl-wall-meta">
            <b>Tests</b> {active.tests}
          </p>
        )}
        <div className="tl-wall-hint">
          {pin ? "pinned — click the paper to release" : "hover to trace · click to pin"}
        </div>
      </aside>
    </div>
  );
}
