/** The walk can mount alternate renderings of the same state — which beat is
 *  on, which route is lit — handed in from ConstraintNarrative, so the modes
 *  can never disagree with the walk about where the city is. */

import type { Ref } from "react";
import {
  TREE_SIDE_COLOR,
  quadName,
  sideDash,
  type BranchSide,
} from "../../data/figures";
import { QuadMark, QuadMetrics, nameWidth } from "./quadIcons";
import {
  branchForks,
  hasLeaves,
  isHeadEnding,
  type WalkLeafDef,
  type WalkShape,
} from "./walkShapes";

/** what every alternate drawing needs to know about the walk right now */
export interface WalkViewProps {
  /** the camera ride owns the dot: no station transform, no transition */
  ridden?: boolean;
  /** where the ride writes the dot's transform */
  dotRef?: Ref<SVGGElement>;
  sh: WalkShape;
  /** the beats, resolved to booleans so this file needs no beat constants */
  gates: {
    tree: boolean;
    fork1: boolean;
    fork2: boolean;
    leaf: boolean;
    choice: boolean;
  };
  /** the landing beat has been reached (badges, rings) */
  landed: boolean;
  /** which tree station the traveller is at: 0 root … 3 leaf */
  stationIdx: number;
  forks2: boolean;
  /** whether the WALKED branch forks again — false where it stops at its head */
  cityForks: boolean;
  cityShort: string;
  citySide: BranchSide;
  suggLeaf: string;
  status: (id: string) => { g: string; lit: boolean };
  medPop: string;
  medCost: string;
}

const on = (b: boolean) => "nv-fade" + (b ? " on" : "");

/** the root question, split at its em dash for two-line cards */
const splitQ = (q: string): string[] => {
  const i = q.indexOf(" — ");
  return i > 0 ? [q.slice(0, i), q.slice(i + 3)] : [q];
};

/* ====================================================================== */
/* 07 — the sideways tree: depth runs across, siblings stack down the     */
/* stage, and the instrument keeps its inset in the not-yet-walked space  */
/* ====================================================================== */

/* the columns, left to right; rows spread around the stage's middle. Sized
   to spend the whole band left of the inset: generous heads, and leaves that
   wrap onto two lines rather than shrinking their type. The third column
   used to hold a question card per branch — those came off the tree (Sept
   2026 revision, to reduce clutter), so S_Q is now only where the stem out
   of a head hands over to the elbow into its leaves. The head column sits
   halfway between the root and the leaves, so both forks get the same run
   and each bus is halfway along its own gap. */
const S_CY = 320;
const S_ROOT = { x: 112, w: 178, h: 48 };
const S_BUS1 = 270;
const S_Q = { x: 592 };
const S_BUS2 = 618;
const S_LEAF = { x: 752, w: 128 };
const S_SPACING: Record<number, number> = { 1: 0, 2: 270, 3: 215, 4: 155 };
/* a leaf's vertical pitch, and its card heights plain vs wrapped */
const S_LEAF_STEP = 74;
const S_LEAF_H = 32;
const S_LEAF_H2 = 42;

/** the sideways head column, shared by the render and the route helpers */
const sideHeads = (forks2: boolean) => ({
  HX: forks2 ? 444 : 450,
  HW: forks2 ? 210 : 280,
  /* room for the city type and its two dials */
  HH: forks2 ? 50 : 66,
});

/** the sideways tree's landmarks in stage coords — its columns and the
 *  spread of its rows — for anything that has to map the sideways stage
 *  onto another drawing (the minimap's schematic, which is not to scale) */
export const sideGeometry = (sh: WalkShape, forks2: boolean) => {
  const n = sh.branches.length;
  const spacing = S_SPACING[n] ?? 155;
  return {
    rootX: S_ROOT.x,
    headX: sideHeads(forks2).HX,
    leafX: S_LEAF.x,
    cy: S_CY,
    half: ((n - 1) / 2) * spacing,
  };
};

/** the row and (where there is one) leaf-y the city's route runs through */
const sideRouteYs = (
  sh: WalkShape,
  citySide: string,
  suggLeaf: string,
): { ry: number; ly: number } => {
  const n = sh.branches.length;
  const spacing = S_SPACING[n] ?? 155;
  const bi = Math.max(
    0,
    sh.branches.findIndex((b) => b.id === citySide),
  );
  const ry = S_CY + (bi - (n - 1) / 2) * spacing;
  const b = sh.branches[bi];
  const li = Math.max(
    0,
    b.leaves.findIndex((l) => l.id === suggLeaf),
  );
  const ly = b.leaves.length
    ? ry + (li - (b.leaves.length - 1) / 2) * S_LEAF_STEP
    : ry;
  return { ry, ly };
};

/** Where the walking dot RESTS at each sideways station — under the root,
 *  under the head (right of it in a one-fork shape, where the badge takes
 *  the room below), under the second fork's hand-over, beside the landing
 *  leaf. The
 *  drawing and the camera ride both read these, so they cannot disagree. */
export const sideRests = (
  sh: WalkShape,
  citySide: string,
  suggLeaf: string,
): [number, number][] => {
  const { ry, ly } = sideRouteYs(sh, citySide, suggLeaf);
  const { HX, HW, HH } = sideHeads(hasLeaves(sh));
  /* where the branch stops at its head — every branch of a one-fork tree, or
     the positive demand shock on the forked one — the head IS the landing,
     so the dot parks past it on the right, where a landing dot parks (the
     badge takes the room below), and the later stations hold there */
  if (!branchForks(sh, citySide)) {
    const head: [number, number] = [HX + HW / 2 + 26, ry];
    return [[S_ROOT.x, S_CY + S_ROOT.h / 2 + 22], head, head, head];
  }
  return [
    [S_ROOT.x, S_CY + S_ROOT.h / 2 + 22],
    [HX, ry + HH / 2 + 18],
    [S_Q.x, ry + 18],
    /* clear of the card's edge with the halo on: the dot is r7 in an r9 halo */
    [S_LEAF.x + S_LEAF.w / 2 + 26, ly],
  ];
};

/** the city's route through the sideways tree, for the camera ride: from
 *  the rest under the root, out past the card's shoulder to the bus, along
 *  its row THROUGH the head card, and onto the landing card
 *  (the dot parks at the station rests, not on the path's card centres) */
export const sideRoute = (
  sh: WalkShape,
  citySide: string,
  suggLeaf: string,
): [number, number][] => {
  const { ry, ly } = sideRouteYs(sh, citySide, suggLeaf);
  const { HX } = sideHeads(hasLeaves(sh));
  const pts: [number, number][] = [
    [S_ROOT.x, S_CY + S_ROOT.h / 2 + 22],
    [S_ROOT.x + S_ROOT.w / 2 + 8, S_CY],
    [S_BUS1, S_CY],
    [S_BUS1, ry],
    [HX, ry],
  ];
  /* a branch that stops at its head ends the route there */
  if (!branchForks(sh, citySide)) return pts;
  pts.push([S_Q.x, ry], [S_BUS2, ry], [S_BUS2, ly], [S_LEAF.x, ly]);
  return pts;
};

/** the sideways tree's own extents, for the ride's closing whole-tree fit */
export const sideBox = (
  sh: WalkShape,
  forks2: boolean,
): [number, number, number, number] => {
  const n = sh.branches.length;
  const spacing = S_SPACING[n] ?? 155;
  const half = ((n - 1) / 2) * spacing;
  const { HX, HW, HH } = sideHeads(forks2);
  const maxL = Math.max(0, ...sh.branches.map((b) => b.leaves.length));
  const spread = forks2
    ? ((maxL - 1) / 2) * S_LEAF_STEP + S_LEAF_H2 / 2
    : HH / 2;
  /* the landing's badge is centred under its leaf and wider than the leaf
     card — the box reaches past the column to keep it in the frame (half of
     the "where we think you are" pill, sized as badge() sizes it) */
  const badgeHalf = (("where we think you are".length + 2) * 7.8 + 30) / 2;
  return [
    S_ROOT.x - S_ROOT.w / 2 - 14,
    S_CY - half - spread - 28,
    (forks2
      ? S_LEAF.x + Math.max(S_LEAF.w / 2, badgeHalf)
      : /* the one-fork landing dot parks right of the head */
        HX + HW / 2 + 36) + 14,
    S_CY + half + spread + 64,
  ];
};

/** a long single-line leaf title breaks at its middle-most space, so the
 *  narrow column wraps instead of shrinking the type */
const sideLeafLines = (l: WalkLeafDef): string[] => {
  const joined = l.lines.join(" ");
  if (l.lines.length > 1) return l.lines;
  if (joined.length <= 12) return [joined];
  const words = joined.split(" ");
  if (words.length === 1) return [joined];
  let best = 0;
  let bd = Infinity;
  let acc = 0;
  const half = joined.length / 2;
  words.slice(0, -1).forEach((w, i) => {
    acc += w.length + (i ? 1 : 0);
    const d = Math.abs(acc - half);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return [words.slice(0, best + 1).join(" "), words.slice(best + 1).join(" ")];
};

export function SidewaysTree(p: WalkViewProps) {
  const { sh, gates, status } = p;
  const n = sh.branches.length;
  const spacing = S_SPACING[n] ?? 150;
  const rowY = (i: number) => S_CY + (i - (n - 1) / 2) * spacing;
  const rowOf = new Map(sh.branches.map((b, i) => [b.id, i]));
  /* a one-fork structure has no question or leaf column, so its heads grow
     and slide toward the stage's middle */
  const { HX, HW, HH } = sideHeads(p.forks2);
  const leafY = (bi: number, li: number, k: number) =>
    rowY(bi) + (li - (k - 1) / 2) * S_LEAF_STEP;
  const leafPos = (id: string): [number, number] => {
    for (let bi = 0; bi < n; bi++) {
      const ls = sh.branches[bi].leaves;
      const li = ls.findIndex((l) => l.id === id);
      if (li >= 0) return [S_LEAF.x, leafY(bi, li, ls.length)];
    }
    return [S_LEAF.x, S_CY];
  };
  const cityRow = rowOf.get(p.citySide) ?? 0;

  /* the traveller's rests come from the shared table, so the camera ride
     parks the dot exactly where the walk would */
  const stations = sideRests(sh, p.citySide, p.suggLeaf);
  const atStation = Math.min(p.stationIdx, p.cityForks ? 3 : 1);
  const [tx, ty] = stations[atStation];
  /* the name takes the dot's open side: under it at the landings (and for
     the whole ride, where the dot never stops moving), beside it on the
     way down */
  const nameBelow = p.ridden
    ? true
    : p.cityForks
      ? atStation >= 3
      : atStation >= 1;

  const badge = (
    at: [number, number],
    label: string,
    color: string,
    drop = 0,
    /** the ending is a head card, not a leaf — hang under its height */
    head = false,
  ) => {
    const w = (label.length + 2) * 7.8 + 30;
    /* centred on what it points at; clamped only at the stage's own edges
       (sideBox leaves room for it at the leaf column) */
    const cx = Math.max(w / 2 + 20, Math.min(at[0], 1156 - w / 2));
    const y = at[1] + (head ? HH / 2 : S_LEAF_H2 / 2) + 24 + drop;
    return (
      <g className="jz-youare">
        <rect
          x={cx - w / 2}
          y={y - 13}
          width={w}
          height={26}
          rx={13}
          fill={color}
        />
        <text x={cx} y={y} textAnchor="middle" dy="0.34em">
          ↑ {label}
        </text>
      </g>
    );
  };
  /* a head ending — every landing on a one-fork tree, or a forking tree's
     branch that stops at its head — lands on the head card itself */
  const atHead = (id: string) => isHeadEnding(sh, id);
  const landAt = (id: string): [number, number] =>
    atHead(id)
      ? [HX, rowY(rowOf.get(id as BranchSide) ?? cityRow)]
      : leafPos(id);
  return (
    <g className={on(gates.tree)}>
      {/* the walked route's glow, from the landing on */}
      <g className={on(p.landed)}>
        <path
          className="tree-home"
          stroke={TREE_SIDE_COLOR[p.citySide]}
          d={`M${S_ROOT.x + S_ROOT.w / 2 + 4},${S_CY} H${S_BUS1} V${rowY(cityRow)} H${HX - HW / 2 - 6}`}
        />
        {p.cityForks && (
          <path
            className="tree-home"
            stroke={TREE_SIDE_COLOR[p.citySide]}
            d={
              `M${HX + HW / 2 + 4},${rowY(cityRow)} H${S_BUS2} V${leafPos(p.suggLeaf)[1]} H${S_LEAF.x - S_LEAF.w / 2 - 6}`
            }
          />
        )}
      </g>

      {/* edges: root → heads, with the answer riding the horizontal run */}
      {sh.branches.map((b, bi) => {
        const st = status(b.id);
        const neg = sideDash(b.id) != null;
        return (
          <g key={`sre-${b.id}`} className={on(gates.fork1) + st.g}>
            <path
              className={
                "nv-edge" +
                (neg ? " neg" : "") +
                (gates.fork1 ? " on" : "") +
                (st.lit ? " lit" : "")
              }
              stroke={TREE_SIDE_COLOR[b.id]}
              pathLength={neg ? undefined : 1}
              d={`M${S_ROOT.x + S_ROOT.w / 2 + 2},${S_CY} H${S_BUS1} V${rowY(bi)} H${HX - HW / 2 - 4}`}
            />
            {/* the answer rides the run into the head — trailing off to
                the left, except on a row so close to the root's that it
                would cross the root card, where it sits above the head */}
            {!quadName(b.id) && (
              <text
                className="nv-elab"
                x={Math.abs(rowY(bi) - S_CY) < 60 ? HX : S_BUS1 - 8}
                y={
                  Math.abs(rowY(bi) - S_CY) < 60
                    ? rowY(bi) - HH / 2 - 8
                    : rowY(bi) - 8
                }
                textAnchor={Math.abs(rowY(bi) - S_CY) < 60 ? "middle" : "end"}
                fill={TREE_SIDE_COLOR[b.id]}
              >
                {b.edge}
              </text>
            )}
          </g>
        );
      })}

      {/* stems: head → the second fork's hand-over */}
      {p.forks2 &&
        sh.branches
          .filter((b) => b.leaves.length > 0)
          .map((b) => {
            const st = status(b.id);
            const y = rowY(rowOf.get(b.id) ?? 0);
            return (
              <path
                key={`sst-${b.id}`}
                className={
                  "nv-edge" +
                  (gates.fork2 ? " on" : "") +
                  (st.lit ? " lit" : "") +
                  st.g
                }
                stroke={TREE_SIDE_COLOR[b.id]}
                pathLength={1}
                d={`M${HX + HW / 2 + 2},${y} H${S_Q.x}`}
              />
            );
          })}

      {/* elbows: the hand-over → leaves */}
      {p.forks2 &&
        sh.branches.flatMap((b, bi) =>
          b.leaves.map((l, li) => {
            const st = status(l.id);
            return (
              <path
                key={`sle-${l.id}`}
                className={
                  "nv-edge" +
                  (gates.leaf ? " on" : "") +
                  (st.lit ? " lit" : "") +
                  st.g
                }
                stroke={TREE_SIDE_COLOR[b.id]}
                pathLength={1}
                d={`M${S_Q.x},${rowY(bi)} H${S_BUS2} V${leafY(bi, li, b.leaves.length)} H${S_LEAF.x - S_LEAF.w / 2 - 4}`}
              />
            );
          }),
        )}

      {/* the root card, first column */}
      <g className={on(gates.tree) + status("root").g}>
        <text
          className="nv-captitle"
          x={S_ROOT.x}
          y={S_CY - S_ROOT.h / 2 - 16}
          textAnchor="middle"
        >
          {`ASKED OF ${p.cityShort.toUpperCase()}`}
        </text>
        <g className="nv-card nv-q">
          <rect
            x={S_ROOT.x - S_ROOT.w / 2}
            y={S_CY - S_ROOT.h / 2}
            width={S_ROOT.w}
            height={S_ROOT.h}
            rx={6}
            stroke="#8a867e"
          />
          {splitQ(sh.rootQuestion).map((line, i, all) => (
            <text
              key={i}
              className="nv-qq"
              x={S_ROOT.x}
              y={S_CY + 4.5 - (all.length - 1) * 7 + i * 14}
              textAnchor="middle"
              fill="var(--ink)"
            >
              {line}
            </text>
          ))}
        </g>
      </g>

      {/* branch heads, second column */}
      {sh.branches.map((b, bi) => {
        const st = status(b.id);
        return (
          <g key={`shd-${b.id}`} className={on(gates.fork1) + st.g}>
            <g className={"nv-card" + (st.lit ? " lit" : "")}>
              <rect
                x={HX - HW / 2}
                y={rowY(bi) - HH / 2}
                width={HW}
                height={HH}
                rx={6}
                stroke={TREE_SIDE_COLOR[b.id]}
                strokeDasharray={sideDash(b.id)}
              />
              {quadName(b.id) ? (
                /* the landing's mark, the city type and its two dials as
                   stat-chip icons — the upright tree's head, sideways */
                <>
                  {(() => {
                    const fs = Math.min(sh.headSize ?? 17.5, 16.5);
                    const mark = fs * 1.3;
                    const gap = 6;
                    const w = mark + gap + nameWidth(quadName(b.id)!, fs);
                    const x0 = HX - w / 2;
                    return (
                      <>
                        <QuadMark
                          side={b.id}
                          x={x0}
                          y={rowY(bi) - 4 - mark * 0.78}
                          size={mark}
                          color={TREE_SIDE_COLOR[b.id]}
                        />
                        <text
                          x={x0 + mark + gap}
                          y={rowY(bi) - 4}
                          textAnchor="start"
                          fontSize={fs}
                          fill={TREE_SIDE_COLOR[b.id]}
                        >
                          {quadName(b.id)}
                        </text>
                      </>
                    );
                  })()}
                  <QuadMetrics side={b.id} x={HX} y={rowY(bi) + 13} />
                </>
              ) : (
                (b.titleLines ?? [b.title]).map((line, li, all) => (
                  <text
                    key={li}
                    x={HX}
                    y={rowY(bi) + 5 - (all.length - 1) * 9 + li * 18}
                    textAnchor="middle"
                    fontSize={Math.min(sh.headSize ?? 17.5, 16.5)}
                    fill={TREE_SIDE_COLOR[b.id]}
                  >
                    {line}
                  </text>
                ))
              )}
            </g>
          </g>
        );
      })}

      {/* leaves, last column */}
      {sh.branches.flatMap((b, bi) =>
        b.leaves.map((l, li) => {
          const st = status(l.id);
          const y = leafY(bi, li, b.leaves.length);
          const lines = sideLeafLines(l);
          const lh = lines.length > 1 ? S_LEAF_H2 : S_LEAF_H;
          return (
            <g key={`slf-${l.id}`} className={on(gates.leaf) + st.g}>
              <g className={"nv-card nv-leaf" + (st.lit ? " lit" : "")}>
                <rect
                  x={S_LEAF.x - S_LEAF.w / 2}
                  y={y - lh / 2}
                  width={S_LEAF.w}
                  height={lh}
                  rx={6}
                  stroke={TREE_SIDE_COLOR[b.id]}
                />
                {lines.map((line, i, all) => (
                  <text
                    key={i}
                    x={S_LEAF.x}
                    y={y + 4.5 - (all.length - 1) * 7.5 + i * 15}
                    textAnchor="middle"
                    fontSize={13}
                    fill={TREE_SIDE_COLOR[b.id]}
                  >
                    {line}
                  </text>
                ))}
              </g>
            </g>
          );
        }),
      )}

      {/* the personal badge: the data-driven read. The tree never marks a
          pick — that is the sandbox's job. */}
      <g className={on(p.landed)}>
        {badge(
          landAt(p.suggLeaf),
          "where we think you are",
          TREE_SIDE_COLOR[p.citySide],
          0,
          atHead(p.suggLeaf),
        )}
      </g>

      {/* the traveller, walking left to right — or carried by the ride */}
      <g
        ref={p.dotRef}
        className="jz-placedot nv-traveler"
        style={
          p.ridden
            ? undefined
            : {
                transform: `translate(${tx}px, ${ty}px)`,
                transition: "transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)",
              }
        }
      >
        <circle className="halo" r={9} />
        <circle className="core" r={7} />
        <text
          className="nv-travname on nv-fade"
          x={nameBelow ? 0 : 13}
          y={nameBelow ? 20 : 4}
          textAnchor={nameBelow ? "middle" : "start"}
        >
          {p.cityShort}
        </text>
      </g>
    </g>
  );
}
