/** The walk can mount alternate renderings of the same state — which beat is
 *  on, which route is lit — handed in from ConstraintNarrative, so the modes
 *  can never disagree with the walk about where the city is. */

import type { Ref } from "react";
import {
  PLACEHOLDER_BRANCHES,
  TREE_SIDE_COLOR,
  sideDash,
  type BranchSide,
} from "../../data/figures";
import { type WalkLeafDef, type WalkShape } from "./walkShapes";

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
  cityShort: string;
  citySide: BranchSide;
  suggLeaf: string;
  selLeaf: string;
  selSide: BranchSide;
  isDefaultPath: boolean;
  leafPickable: boolean;
  pickLeaf: (leaf: string) => void;
  setHoverLeaf: (id: string | null) => void;
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
   to spend the whole band left of the inset: generous heads, a question
   card tall enough for its three lines, and leaves that wrap onto two lines
   rather than shrinking their type. */
const S_CY = 320;
const S_ROOT = { x: 112, w: 178, h: 48 };
const S_BUS1 = 232;
const S_Q = { x: 560, w: 168, h: 62 };
/* the second fork gets the reach the first has: question card → bus → leaf
   spans about what root → bus → head does, so the two forks read alike */
const S_BUS2 = 664;
const S_LEAF = { x: 752, w: 128 };
const S_SPACING: Record<number, number> = { 1: 0, 2: 270, 3: 215, 4: 155 };
/* a leaf's vertical pitch, and its card heights plain vs wrapped */
const S_LEAF_STEP = 74;
const S_LEAF_H = 32;
const S_LEAF_H2 = 42;

/** greedy word-wrap to a character budget — the question column re-wraps
 *  its authored two lines into three rather than shrinking the type */
const wrapText = (text: string, budget: number): string[] => {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > budget && line) {
      out.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
};

/** the sideways head column, shared by the render and the route helpers */
const sideHeads = (forks2: boolean) => ({
  HX: forks2 ? 352 : 450,
  HW: forks2 ? 210 : 280,
  HH: forks2 ? 44 : 60,
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
 *  the room below), under the question, beside the landing leaf. The
 *  drawing and the camera ride both read these, so they cannot disagree. */
export const sideRests = (
  sh: WalkShape,
  citySide: string,
  suggLeaf: string,
  forks2: boolean,
): [number, number][] => {
  const { ry, ly } = sideRouteYs(sh, citySide, suggLeaf);
  const { HX, HW, HH } = sideHeads(forks2);
  return [
    [S_ROOT.x, S_CY + S_ROOT.h / 2 + 22],
    /* one fork: the head IS the landing, so the dot parks past it on the
       right, where a landing dot parks — the badge takes the room below */
    forks2 ? [HX, ry + HH / 2 + 18] : [HX + HW / 2 + 26, ry],
    [S_Q.x, ry + S_Q.h / 2 + 16],
    /* clear of the card's edge with the halo on: the dot is r7 in an r9 halo */
    [S_LEAF.x + S_LEAF.w / 2 + 26, ly],
  ];
};

/** the city's route through the sideways tree, for the camera ride: from
 *  the rest under the root, out past the card's shoulder to the bus, along
 *  its row THROUGH the head and question cards, and onto the landing card
 *  (the dot parks at the station rests, not on the path's card centres) */
export const sideRoute = (
  sh: WalkShape,
  citySide: string,
  suggLeaf: string,
  forks2: boolean,
): [number, number][] => {
  const { ry, ly } = sideRouteYs(sh, citySide, suggLeaf);
  const { HX } = sideHeads(forks2);
  const pts: [number, number][] = [
    [S_ROOT.x, S_CY + S_ROOT.h / 2 + 22],
    [S_ROOT.x + S_ROOT.w / 2 + 8, S_CY],
    [S_BUS1, S_CY],
    [S_BUS1, ry],
    [HX, ry],
  ];
  if (!forks2) return pts;
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
  const stations = sideRests(sh, p.citySide, p.suggLeaf, p.forks2);
  const atStation = Math.min(p.stationIdx, p.forks2 ? 3 : 1);
  const [tx, ty] = stations[atStation];
  /* the name takes the dot's open side: under it at the landings (and for
     the whole ride, where the dot never stops moving), beside it on the
     way down */
  const nameBelow = p.ridden
    ? true
    : p.forks2
      ? atStation >= 3
      : atStation >= 1;

  const badge = (
    at: [number, number],
    label: string,
    color: string,
    drop = 0,
  ) => {
    const w = (label.length + 2) * 7.8 + 30;
    /* centred on what it points at; clamped only at the stage's own edges
       (sideBox leaves room for it at the leaf column) */
    const cx = Math.max(w / 2 + 20, Math.min(at[0], 1156 - w / 2));
    const y = at[1] + (p.forks2 ? S_LEAF_H2 / 2 : HH / 2) + 24 + drop;
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
  const landAt = (leaf: string): [number, number] =>
    p.forks2
      ? leafPos(leaf)
      : [HX, rowY(rowOf.get(leaf as BranchSide) ?? cityRow)];
  const collide =
    Math.abs(landAt(p.selLeaf)[1] - landAt(p.suggLeaf)[1]) < 56 &&
    Math.abs(landAt(p.selLeaf)[0] - landAt(p.suggLeaf)[0]) < 240;

  return (
    <g className={on(gates.tree)}>
      {/* the walked route's glow, from the landing on */}
      <g className={on(p.landed)}>
        <path
          className="tree-home"
          stroke={TREE_SIDE_COLOR[p.citySide]}
          d={`M${S_ROOT.x + S_ROOT.w / 2 + 4},${S_CY} H${S_BUS1} V${rowY(cityRow)} H${HX - HW / 2 - 6}`}
        />
        {p.forks2 && (
          <path
            className="tree-home"
            stroke={TREE_SIDE_COLOR[p.citySide]}
            d={
              `M${HX + HW / 2 + 4},${rowY(cityRow)} H${S_Q.x - S_Q.w / 2 - 6}` +
              ` M${S_Q.x + S_Q.w / 2 + 4},${rowY(cityRow)} H${S_BUS2} V${leafPos(p.suggLeaf)[1]} H${S_LEAF.x - S_LEAF.w / 2 - 6}`
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
          </g>
        );
      })}

      {/* stems: head → sub-question */}
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
                d={`M${HX + HW / 2 + 2},${y} H${S_Q.x - S_Q.w / 2 - 4}`}
              />
            );
          })}

      {/* elbows: sub-question → leaves */}
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
                d={`M${S_Q.x + S_Q.w / 2 + 2},${rowY(bi)} H${S_BUS2} V${leafY(bi, li, b.leaves.length)} H${S_LEAF.x - S_LEAF.w / 2 - 4}`}
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
            rx={9}
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
                rx={8}
                stroke={TREE_SIDE_COLOR[b.id]}
                strokeDasharray={sideDash(b.id)}
              />
              {(b.titleLines ?? [b.title]).map((line, li, all) => (
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
              ))}
            </g>
          </g>
        );
      })}

      {/* sub-question cards, third column */}
      {p.forks2 &&
        sh.branches
          .filter((b) => b.leaves.length > 0)
          .map((b) => {
            const st = status(b.id);
            const y = rowY(rowOf.get(b.id) ?? 0);
            const lines = wrapText(
              b.question({ medPop: p.medPop, medCost: p.medCost }).join(" "),
              26,
            );
            return (
              <g key={`sq-${b.id}`} className={on(gates.fork2) + st.g}>
                <g className={"nv-card nv-q" + (st.lit ? " lit" : "")}>
                  <rect
                    x={S_Q.x - S_Q.w / 2}
                    y={y - S_Q.h / 2}
                    width={S_Q.w}
                    height={S_Q.h}
                    rx={9}
                    stroke={TREE_SIDE_COLOR[b.id]}
                  />
                  {lines.map((line, i, all) => (
                    <text
                      key={i}
                      className="nv-qq"
                      x={S_Q.x}
                      y={y - 6 + 4 - (all.length - 1) * 6.5 + i * 13}
                      textAnchor="middle"
                      fontSize={10.5}
                      fill={TREE_SIDE_COLOR[b.id]}
                    >
                      {line}
                    </text>
                  ))}
                  {b.id === p.citySide && (
                    <text
                      className={"nv-qread " + on(gates.leaf)}
                      x={S_Q.x}
                      y={y + S_Q.h / 2 - 8}
                      textAnchor="middle"
                      fill="var(--teal)"
                    >
                      read: the inset chart ↓
                    </text>
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
          const clickable = p.leafPickable && !PLACEHOLDER_BRANCHES.has(b.id);
          const picked = p.leafPickable && l.id === p.selLeaf;
          return (
            <g key={`slf-${l.id}`} className={on(gates.leaf) + st.g}>
              {/* the answer that reaches this leaf rides above its card: the
                  run in from the bus is too short to carry it, and beside
                  the card is the traveller's */}
              <text
                className="nv-elab"
                x={S_LEAF.x}
                y={y - lh / 2 - 7}
                textAnchor="middle"
                fill={TREE_SIDE_COLOR[b.id]}
              >
                {l.edge}
              </text>
              <g
                className={
                  "nv-card nv-leaf" +
                  (st.lit ? " lit" : "") +
                  (clickable ? " clickable" : "") +
                  (picked ? " picked" : "")
                }
                onMouseEnter={() => clickable && p.setHoverLeaf(l.id)}
                onMouseLeave={() => p.setHoverLeaf(null)}
                onClick={() => clickable && p.pickLeaf(l.id)}
              >
                <rect
                  x={S_LEAF.x - S_LEAF.w / 2}
                  y={y - lh / 2}
                  width={S_LEAF.w}
                  height={lh}
                  rx={8}
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

      {/* the personal badges */}
      <g className={on(p.landed)}>
        {badge(
          landAt(p.suggLeaf),
          "where we think you are",
          TREE_SIDE_COLOR[p.citySide],
        )}
        {/* only where the tree forked twice — a one-fork walk offers no
            pick, and its "selection" is the app's path through a lossy
            alias, a difference no one chose */}
        {gates.choice &&
          p.forks2 &&
          !p.isDefaultPath &&
          badge(
            landAt(p.selLeaf),
            "you selected this path",
            TREE_SIDE_COLOR[p.selSide],
            collide ? 30 : 0,
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
