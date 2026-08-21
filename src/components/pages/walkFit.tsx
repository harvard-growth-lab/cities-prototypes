/** The two pieces the walk's small-stage modes need on screen: a readout of
 *  how hard the stage is squeezing the tree, and the minimap that gives back
 *  the context "follow the path" zooms away from.
 *
 *  Both are deliberately dumb — they take geometry and draw it. What the
 *  frame should be at a given beat is walkShapes' job (wholeBox / rootBox /
 *  branchBox / fitTransform); what mode is on is the section's. */

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { TREE_SIDE_COLOR, sideHollow, type TreeSide } from "../../data/figures";
import {
  headRowH,
  headRowY,
  landingX,
  landingY,
  shapeBand,
  shapeExtent,
  type WalkShape,
} from "./walkShapes";

/* the stage the tree is authored against */
const W = 1180;

/** The smallest type on the tree, at the size it will actually RENDER: the
 *  stage is a fixed viewBox scaled to whatever width it gets, so every font
 *  size on it is multiplied by that scale. Below this the leaf labels stop
 *  being readable and a whole-tree fit is the wrong answer — which makes
 *  this floor the line the section's responsiveness keys on: a resize that
 *  crosses it wakes the small-stage switch and swaps the remembered answer
 *  onto the stage (see ConstraintNarrative). */
export const LEGIBLE_PX = 11;

/** watch the stage and report the scale its viewBox is being drawn at */
export function useStageScale(ref: RefObject<SVGSVGElement | null>) {
  const [scale, setScale] = useState(1);
  const seen = useRef(1);
  /* a LAYOUT effect: the first paint already decides whether the stage is
     tight, and measuring after paint would flash the whole tree for a frame
     before the responsive answer lands */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (!w) return;
      const k = w / W;
      /* a threshold, not a continuous read — re-rendering the whole stage on
         every pixel of a drag would cost more than it tells anyone */
      if (Math.abs(k - seen.current) > 0.02) {
        seen.current = k;
        setScale(k);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

/** how small the smallest label on this shape's tree is actually rendering,
 *  and whether that is past the point where fitting the whole tree works */
export function StageFit({
  scale,
  smallest,
  onPick,
}: {
  scale: number;
  /** the shape's smallest authored font size */
  smallest: number;
  /** offered when the whole-tree fit is on despite the squeeze — absent
   *  once a small-stage answer is already on stage, where the button would
   *  be selling the reader what they have */
  onPick?: () => void;
}) {
  const px = smallest * scale;
  const tight = px < LEGIBLE_PX;
  return (
    <div className={"nv-fitread" + (tight ? " tight" : "")}>
      {tight && onPick && (
        <button className="nv-fitread-go" onClick={onPick}>
          zoom instead
        </button>
      )}
    </div>
  );
}

/** The whole tree at a glance: one dot per card, the elbows between them, the
 *  walked route lit, and a frame showing what the stage is currently looking
 *  at. This is what makes zooming acceptable — the reader never loses the map
 *  of where they are in the diagnostic, which is the tree's other job. */
export function BranchMinimap({
  shape,
  route,
  frame,
  show,
  orientation = "vertical",
}: {
  shape: WalkShape;
  /** the walked descent — its branch, and its leaf where there is one */
  route: string[];
  /** the focus frame in tree coords, or null while the whole tree is framed */
  frame: [number, number, number, number] | null;
  show: boolean;
  orientation?: "vertical" | "sideways";
}) {
  const [bx0, bx1] = shapeBand(shape);
  const [by0, by1] = shapeExtent(shape);
  const pad = 6;
  const S = 168;
  const k = Math.min((S - pad * 2) / (bx1 - bx0), (96 - pad * 2) / (by1 - by0));
  const mx = (x: number) => pad + (x - bx0) * k;
  const my = (y: number) => pad + (y - by0) * k;
  const on = new Set(route);
  const headY = headRowY(shape) + headRowH(shape) / 2;
  const forks2 = shape.branches.some((b) => b.leaves.length > 0);

  const sideMap = (() => {
    const n = Math.max(1, shape.branches.length);
    const top = 14;
    const bottom = 82;
    const step = n > 1 ? (bottom - top) / (n - 1) : 0;
    const root: [number, number] = [22, 48];
    const headX = forks2 ? 86 : 122;
    const leafX = 146;
    const rowY = (i: number) => top + i * step;
    const headByBranch = new Map<string, [number, number]>();
    const leafById = new Map<string, [number, number]>();
    shape.branches.forEach((b, bi) => {
      const y = rowY(bi);
      headByBranch.set(b.id, [headX, y]);
      if (!forks2 || b.leaves.length === 0) return;
      const spread = Math.min(11, 4 + b.leaves.length * 1.2);
      const lstep =
        b.leaves.length > 1 ? (spread * 2) / (b.leaves.length - 1) : 0;
      b.leaves.forEach((l, li) => {
        leafById.set(l.id, [leafX, y - spread + li * lstep]);
      });
    });
    return { root, headByBranch, leafById };
  })();

  return (
    <div className={"nv-mini" + (show ? " show" : "")} aria-hidden={!show}>
      <svg viewBox={`0 0 ${S} 96`}>
        {orientation === "sideways"
          ? shape.branches.map((b) => {
              const lit = on.has(b.id);
              const c = TREE_SIDE_COLOR[b.id];
              const neg = sideHollow(b.id);
              const at = sideMap.headByBranch.get(b.id) ?? [86, 48];
              return (
                <g key={b.id} opacity={lit ? 1 : 0.32}>
                  <path
                    d={`M${sideMap.root[0]},${sideMap.root[1]} H44 V${at[1]} H${at[0]}`}
                    fill="none"
                    stroke={c}
                    strokeWidth={lit ? 1.6 : 1}
                    strokeDasharray={neg ? "3 2.2" : undefined}
                  />
                  <circle
                    cx={at[0]}
                    cy={at[1]}
                    r={lit ? 3.4 : 2.4}
                    fill={neg ? "#fff" : c}
                    stroke={c}
                    strokeWidth={neg ? 1.4 : 0}
                  />
                  {b.leaves.map((l) => {
                    const lp = sideMap.leafById.get(l.id) ?? [146, at[1]];
                    return (
                      <g key={l.id}>
                        <path
                          d={`M${at[0]},${at[1]} H132 V${lp[1]} H${lp[0]}`}
                          fill="none"
                          stroke={c}
                          strokeWidth={on.has(l.id) ? 1.6 : 0.8}
                          opacity={on.has(l.id) ? 1 : 0.6}
                        />
                        <circle
                          cx={lp[0]}
                          cy={lp[1]}
                          r={on.has(l.id) ? 3.4 : 2}
                          fill={c}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })
          : shape.branches.map((b) => {
              const lit = on.has(b.id);
              const c = TREE_SIDE_COLOR[b.id];
              /* a negative shock's branch is broken here too — the pattern
             shrinks with the map, and its head dot draws hollow */
              const neg = sideHollow(b.id);
              return (
                <g key={b.id} opacity={lit ? 1 : 0.32}>
                  <path
                    d={`M${mx(shape.rootX)},${my(28)} V${my(60)} H${mx(b.x)} V${my(headY)}`}
                    fill="none"
                    stroke={c}
                    strokeWidth={lit ? 1.6 : 1}
                    strokeDasharray={neg ? "3 2.2" : undefined}
                  />
                  <circle
                    cx={mx(b.x)}
                    cy={my(headY)}
                    r={lit ? 3.4 : 2.4}
                    fill={neg ? "#fff" : c}
                    stroke={c}
                    strokeWidth={neg ? 1.4 : 0}
                  />
                  {b.leaves.map((l) => (
                    <g key={l.id}>
                      <path
                        d={`M${mx(b.x)},${my(headY)} V${my(landingY(shape) - 26)} H${mx(l.x)} V${my(landingY(shape))}`}
                        fill="none"
                        stroke={c}
                        strokeWidth={on.has(l.id) ? 1.6 : 0.8}
                        opacity={on.has(l.id) ? 1 : 0.6}
                      />
                      <circle
                        cx={mx(l.x)}
                        cy={my(landingY(shape))}
                        r={on.has(l.id) ? 3.4 : 2}
                        fill={c}
                      />
                    </g>
                  ))}
                </g>
              );
            })}
        {/* the root */}
        <circle
          cx={orientation === "sideways" ? sideMap.root[0] : mx(shape.rootX)}
          cy={orientation === "sideways" ? sideMap.root[1] : my(28)}
          r={3}
          fill="#1a2226"
        />
        {/* where the city ended up */}
        {route.length > 0 && (
          <circle
            className="nv-mini-you"
            cx={
              orientation === "sideways"
                ? ((route.length > 1
                    ? sideMap.leafById.get(route[route.length - 1])
                    : sideMap.headByBranch.get(route[0]))?.[0] ??
                  sideMap.root[0])
                : mx(landingX(shape, route))
            }
            cy={
              orientation === "sideways"
                ? ((route.length > 1
                    ? sideMap.leafById.get(route[route.length - 1])
                    : sideMap.headByBranch.get(route[0]))?.[1] ??
                  sideMap.root[1])
                : my(landingY(shape))
            }
            r={5.5}
            fill="none"
            stroke={TREE_SIDE_COLOR[route[0] as TreeSide] ?? "#1a2226"}
          />
        )}
        {/* what the stage is looking at */}
        {frame && (
          <rect
            className="nv-mini-frame"
            x={mx(frame[0])}
            y={my(frame[1])}
            width={(frame[2] - frame[0]) * k}
            height={(frame[3] - frame[1]) * k}
            rx={3}
          />
        )}
      </svg>
    </div>
  );
}
