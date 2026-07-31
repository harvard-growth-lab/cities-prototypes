/**
 * Variant 06 — the reel. The seven suspects on one strip of film: the page
 * scrolls down, the reel travels sideways, one leaf per turn, in the
 * figure's left-to-right order. A small top-down drawing of the tree rides
 * above the strip as the projector's counter — the active suspect's
 * ancestry lights up, and a dot slides along the leaf track with the
 * scroll. Click a leaf on the tree (or a parked card) to spool to it.
 */

import { useMemo, useRef, useState } from "react";
import { byId, DFS, LEAVES, pathTo, SHORT, SIDE_COLOR, SIDE_LABEL, TIDY, type TNode } from "./model";
import { prefersReducedMotion } from "./useInView";
import { scrollToProgress, useScrollDrive } from "./useScrollDrive";

const SW = 960;
const SH = 198;
const PADX = 56;
const R = 6; // node radius
const TRACK_Y = 189;
const LEAF_VH = 62; // runway length per leaf

const nodeX = (id: string) => PADX + TIDY[id] * (SW - 2 * PADX);
const nodeY = (n: TNode) => 24 + n.depth * 33;

/** vertical S-curve from a parent's underside to a child's top */
function link(a: TNode, b: TNode): string {
  const x0 = nodeX(a.id);
  const y0 = nodeY(a) + R;
  const x1 = nodeX(b.id);
  const y1 = nodeY(b) - R;
  const my = (y0 + y1) / 2;
  return `M${x0},${y0} C${x0},${my} ${x1},${my} ${x1},${y1}`;
}

export function Reel() {
  const reduced = useMemo(prefersReducedMotion, []);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const beltRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<SVGGElement | null>(null);

  const runway = useScrollDrive<HTMLDivElement>((p) => {
    const last = LEAVES.length - 1;
    const t = p * last;
    const i = Math.round(t);
    if (i !== activeRef.current) {
      activeRef.current = i;
      setActive(i);
    }
    const tt = reduced ? i : t;
    const belt = beltRef.current;
    if (belt) {
      const first = belt.firstElementChild as HTMLElement | null;
      const cw = first?.offsetWidth ?? 560;
      const host = belt.parentElement!;
      belt.style.transform = `translateX(${host.clientWidth / 2 - cw / 2 - tt * (cw + 24)}px)`;
    }
    const dot = dotRef.current;
    if (dot) {
      const x0 = nodeX(LEAVES[0].id);
      const x1 = nodeX(LEAVES[last].id);
      dot.setAttribute("transform", `translate(${x0 + (tt / last) * (x1 - x0)} ${TRACK_Y})`);
    }
  });

  const jump = (i: number) => {
    if (runway.current)
      scrollToProgress(runway.current, i / (LEAVES.length - 1), !reduced);
  };

  const leaf = LEAVES[active];
  const path = pathTo(leaf.id).map((n) => n.id);
  const lit = (id: string) => path.includes(id);

  return (
    <div
      className="tl-runway tl-reel"
      ref={runway}
      style={{ height: `calc(100vh + ${(LEAVES.length - 1) * LEAF_VH}vh)` }}
    >
      <div className="tl-reel-stage">
        {/* the counter: the whole tree, top-down, ancestry lit */}
        <svg
          className="tl-reel-spine"
          viewBox={`0 0 ${SW} ${SH}`}
          role="img"
          aria-label="The tree drawn top-down. The current suspect's path from the root is lit; the dot below tracks the reel's position. Click a leaf to jump the reel to it."
        >
          {DFS.filter((n) => n.parent).map((n) => (
            <path
              key={`l-${n.id}`}
              className="tl-reel-link"
              d={link(byId[n.parent!], n)}
              fill="none"
              stroke={lit(n.id) && lit(n.parent!) ? SIDE_COLOR[n.side].base : "#ddd7cb"}
              strokeWidth={lit(n.id) && lit(n.parent!) ? 2.4 : 1.3}
            />
          ))}

          {DFS.map((n) => {
            const isLeaf = !n.children.length;
            const c = SIDE_COLOR[n.side];
            const on = lit(n.id);
            const x = nodeX(n.id);
            const y = nodeY(n);
            return (
              <g
                key={n.id}
                className={isLeaf ? "tl-reel-leaf" : undefined}
                onClick={isLeaf ? () => jump(LEAVES.indexOf(n)) : undefined}
              >
                {isLeaf && <circle cx={x} cy={y} r={16} fill="transparent" />}
                {isLeaf && n.id === leaf.id && (
                  <circle className="tl-reel-halo" cx={x} cy={y} r={R + 4.5} fill="none"
                    stroke={c.base} strokeWidth={1.4} />
                )}
                <circle
                  className="tl-reel-node"
                  cx={x}
                  cy={y}
                  r={n.id === "root" ? R + 1.5 : R}
                  fill={on ? c.base : "#ffffff"}
                  stroke={on ? c.deep : "#c6bfb2"}
                  strokeWidth={1.4}
                />
                {n.id === "root" ? (
                  <text className="tl-reel-label tl-reel-label-root" x={x} y={y - 14} textAnchor="middle">
                    {SHORT[n.id]}
                  </text>
                ) : isLeaf ? (
                  <text
                    className="tl-reel-label"
                    x={x}
                    y={y + 20}
                    textAnchor="middle"
                    fontWeight={on ? 700 : 500}
                    fill={on ? c.deep : "#6e675c"}
                  >
                    {SHORT[n.id]}
                  </text>
                ) : (
                  <text
                    className="tl-reel-label"
                    x={x + 11}
                    y={y + 3.5}
                    fontWeight={on ? 700 : 500}
                    fill={on ? c.deep : "#6e675c"}
                  >
                    {SHORT[n.id]}
                  </text>
                )}
              </g>
            );
          })}

          {/* the leaf track and its sliding counter dot */}
          <line
            x1={nodeX(LEAVES[0].id)}
            y1={TRACK_Y}
            x2={nodeX(LEAVES[LEAVES.length - 1].id)}
            y2={TRACK_Y}
            stroke="#e4dfd5"
            strokeWidth={1.5}
          />
          {LEAVES.map((n) => (
            <circle key={`t-${n.id}`} cx={nodeX(n.id)} cy={TRACK_Y} r={2.5} fill="#c6bfb2" />
          ))}
          <g ref={dotRef} transform={`translate(${nodeX(LEAVES[0].id)} ${TRACK_Y})`}>
            <circle r={5.5} fill={SIDE_COLOR[leaf.side].base} className="tl-reel-dot" />
          </g>
        </svg>

        {/* the strip */}
        <div className="tl-reel-window">
          <div className="tl-reel-belt" ref={beltRef}>
            {LEAVES.map((n, i) => (
              <article
                key={n.id}
                className={`tl-reel-card${i === active ? " on" : ""}`}
                onClick={i === active ? undefined : () => jump(i)}
              >
                <div className="tl-reel-count">
                  suspect {i + 1} of {LEAVES.length} · {SIDE_LABEL[n.side]}
                </div>
                <div className="tl-trail">
                  {pathTo(n.id).map((a, j) => (
                    <span key={a.id} className="tl-trail-step">
                      {j > 0 && <span className="tl-trail-arrow">→</span>}
                      <span className="tl-trail-chip" data-side={a.side}>
                        {SHORT[a.id]}
                      </span>
                    </span>
                  ))}
                </div>
                <h4>{n.title}</h4>
                {n.sub && <div className="tl-wall-sub">{n.sub}</div>}
                <p>{n.detail}</p>
                {n.example && (
                  <p className="tl-wall-meta">
                    <b>Case</b> {n.example}
                  </p>
                )}
                {n.tests && (
                  <p className="tl-wall-meta">
                    <b>Tests</b> {n.tests}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="tl-reel-hint" aria-live="polite">
          {active + 1} / {LEAVES.length} — scroll to advance the reel · click a leaf above to spool to it
        </div>
      </div>
    </div>
  );
}
