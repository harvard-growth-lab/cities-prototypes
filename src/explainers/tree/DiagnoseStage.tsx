import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { radiusFor } from "./radius";
import {
  FIELD_DOTS,
  METRO_DOTS,
  POP_MED,
  WAGE_MED,
  HOME_GATE,
  POP_MAX,
  METRO_POP_MAX,
  N_CITIES,
  DEMAND_N,
  SUPPLY_N,
  LOCAL_N,
  REGIONAL_N,
  ABOVE_N,
  BELOW_N,
  sPct,
  type FieldDot,
  type MetroDot,
  type LeafKey,
} from "./data";

/**
 * The one sticky stage of "#/tree" — the GENERAL explainer of the forking
 * logic, adapted from the walk page's stage but with no walked city.
 *
 * The cities FLOW AS THE NARRATIVE SORTS THEM (user-set): each fork pours
 * the dots it just answered, rather than saving one cascade for the end —
 * `scene.flow` carries how far each side has travelled ('park' → 'side' →
 * 'leaf'), so the demand cohort can already sit in its leaf piles while
 * the supply cohort still waits under Supply. Two phases:
 *
 *   'wage'    the full-bleed population vs wages chart, assembled one element per beat
 *             (x axis + label → y axis → the field of cities lands → the
 *             median crosshair → quadrant pairs → all four lit).
 *   'tree'    the chart PARKS as a small card in the top-left corner — the
 *             field waits there until the root fork is answered — while the
 *             tree draws fork by fork across the bottom, in title-only
 *             nodes with a pile under each answered node. The freed top-right
 *             hosts the INSTRUMENT PANEL (scene.inst) — the secondary
 *             visualizations live ON the stage now, not in the narrative
 *             column. The panel is a SLOT that changes instruments between
 *             branches, and the swap is deliberately loud (user-set: the
 *             old cross-fade read as the same chart): its border, accent
 *             bar, title, header line ("for the Supply fork · supply-side
 *             cities") and y-axis all wear the branch's color, and at the
 *             hand-off beat the outgoing chart RETRACTS (axes:false,
 *             dots:false leaves a re-titled empty slot) before the new one
 *             is built a beat at a time — frame + its new vertical axis,
 *             then its own field, then the lens.
 *
 * The pour happens on the beat that answers a fork: root answered → the
 * whole field leaves the parked card for the two side piles; demand fork
 * answered → the demand pile splits into its leaves; gate answered → the
 * supply pile does. `recap` dims both top cards for the closing beat, so
 * the finished tree owns it.
 *
 * Design rules (user-set, unchanged): elements DRAW rather than fade;
 * once the tree exists it never leaves the stage. The tree reads as the
 * fork-logic diagram: DASHED boxes are QUESTIONS naming their instrument,
 * SOLID tinted capsules are ANSWERS, fork edges carry yes/no answer labels
 * halo-punched onto the elbow runs, and YES branches LEFT on both forks.
 * Dot PAINT (fill/opacity) leads GEOMETRY so recolors read in place before
 * dots fly. TWO REAL GRAINS (boston/data.ts): the field is every US
 * city ≥100k at place grain — each row carrying its own MSA's reading, so
 * the demand sub-fork is a real lookup — while the MSA instrument plots
 * every real metro; the median crosshair is the US-MSA medians
 * ("typical MSA"), the benchmark the live tool reads places against
 * (the housing instrument's gate alone reads the all-US-places median,
 * HOME_GATE — see boston/data.ts).
 * Hovering any dot names its city, its two dial readings, and its MSA.
 */

/** how far one side's cities have travelled down the tree */
export type Flow = "park" | "side" | "leaf";

export interface DiagScene {
  layout: "wage" | "tree";
  /** paint for the 'wage' phase only — in the tree phase the dots take
      their color from how far they have flowed (side, then leaf) */
  color?: "plain" | "side" | "demand" | "supply";
  /** which chart axes have drawn so far in the 'wage' layout (default both) */
  axes?: "x" | "xy";
  /** the field of city dots (default true; the axis beats hold them back) */
  dots?: boolean;
  medians?: boolean;
  /** quadrant-pair highlights; 'quad-all' lights BOTH pairs (the fully
      classified plane, the beat before the chart parks) */
  lens?: "quad-demand" | "quad-supply" | "quad-all" | null;
  /** which parts of the tree have drawn (forks step by step) */
  tree?: {
    root?: boolean;
    sides?: boolean;
    demandQ?: boolean;
    demandLeaves?: boolean;
    supplyQ?: boolean;
    supplyLeaves?: boolean;
  };
  /** The on-stage instrument panel (tree phase). The panel is a SLOT that
      changes instruments between branches, so a new chart is built in it
      the same way the main plane was — `axes:false, dots:false` shows the
      re-titled empty slot (the hand-off beat), then the axes draw, then
      its own field lands, then the lens. */
  /** `grain` applies to the 'wage' instrument only: it opens on 'city' —
      the very plane the reader just read, at reading size — and then each
      city gives way to its own MSA ('msa'), which is what makes it obvious
      that this is the same chart one level up, not a new one. */
  inst?: {
    kind: "wage" | "home";
    grain?: "city" | "msa";
    axes?: boolean;
    dots?: boolean;
    lens?: boolean;
  } | null;
  /** hot side of the drawn tree — the other side dims */
  focus?: "demand" | "supply" | null;
  /** how far each side's cities have flowed — they move on the beat that
      answers their fork, so a pour is always something the copy just said */
  flow?: { demand?: Flow; supply?: Flow };
  /** closing beat: dim the parked card + instrument so the tree owns it */
  recap?: boolean;
  pills?: string[];
  caption?: string;
}

const W = 640;
const H = 656;
const M = { l: 62, r: 20, t: 24, b: 64 };
const PLOT_B = H - M.b;

/* ————— scales (robust percentile domains, medians always included) ————— */

function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi
    ? sorted[lo]
    : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function dom(vals: number[], must: number[]): [number, number] {
  const s = [...vals].sort((a, b) => a - b);
  let lo = quantile(s, 0.02);
  let hi = quantile(s, 0.98);
  for (const m of must) {
    lo = Math.min(lo, m);
    hi = Math.max(hi, m);
  }
  const pad = (hi - lo) * 0.07;
  return [Math.floor((lo - pad) * 10) / 10, Math.ceil((hi + pad) * 10) / 10];
}
/* the pop/wage domains cover BOTH grains (the city field on the main and
   parked charts, the metro field on the MSA instrument), so the two planes
   share honest, comparable scales */
const XD = dom(
  [...FIELD_DOTS.map((d) => d.x), ...METRO_DOTS.map((m) => m.x)],
  [POP_MED],
);
const YW = dom(
  [...FIELD_DOTS.map((d) => d.wage), ...METRO_DOTS.map((m) => m.wage)],
  [WAGE_MED],
);
const YH = dom(
  FIELD_DOTS.map((d) => d.home),
  [HOME_GATE],
);

const scale = (v: number, [lo, hi]: [number, number], a: number, b: number) => {
  const t = (v - lo) / (hi - lo);
  return a + Math.max(0.004, Math.min(0.996, t)) * (b - a);
};
const px = (x: number) => scale(x, XD, M.l, W - M.r);
const pyW = (y: number) => scale(y, YW, PLOT_B, M.t);

function niceStep(span: number): number {
  const raw = span / 7;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * mag) return m * mag;
  return 10 * mag;
}
function ticks(d: [number, number]): number[] {
  const step = niceStep(d[1] - d[0]);
  const out: number[] = [];
  for (let t = Math.ceil(d[0] / step) * step; t <= d[1] + 1e-9; t += step)
    out.push(Math.round(t * 100) / 100);
  return out;
}
const XT = ticks(XD);
const YWT = ticks(YW);

/* ————— colors ————— */

const SIDE_C = { demand: "#3d7ab8", supply: "#c98500" } as const;
const HALF_C = { above: "#8a5a00", below: "#199e70" } as const;
/** the MSA-wide leaf gets its own violet so the two demand leaves read apart */
const REGIONAL_C = "#7059ad";
const GHOST = "#8b877e";
const FIELD_BLUE = "#1a5a8e";
const LEAF_C: Record<LeafKey, string> = {
  local: SIDE_C.demand,
  regional: REGIONAL_C,
  housing: HALF_C.above,
  amen: HALF_C.below,
};

/** paper-colored halo so labels stay legible over dots */
const HALO = {
  stroke: "#faf8f3",
  strokeWidth: 3,
  style: { paintOrder: "stroke" },
} as const;
const CARD_STROKE = "#e0d9ca";

/* ————— the parked field (tree phase): the chart, shrunk to a corner card ————— */

/* The two reference cards are kept as small as legibility allows: every
   pixel they give up goes to the tree, which now has to hold piles under
   both the side row AND the leaf row. */
const PARK = { x: 28, y: 30, w: 214, h: 168 } as const;
const PK = {
  l: PARK.x + 18,
  r: PARK.x + PARK.w - 10,
  t: PARK.y + 20,
  b: PARK.y + PARK.h - 24,
} as const;
const pxm = (x: number) => scale(x, XD, PK.l, PK.r);
const pym = (y: number) => scale(y, YW, PK.b, PK.t);

/* ————— the instrument panel (tree phase, top-right) ————— */

/* wider and shorter than before: the scatter keeps its area while the tree
   gets the vertical room back. Trimmed a notch further and kept anchored to
   the RIGHT edge (user-set: the panel crowded the tree, which now also sits
   16px left of it — the two elements want clear air between them). */
const INST = { x: 306, y: 30, w: 316, h: 178 } as const;
/** the plot area starts below a two-line header (title + who it serves) */
const IN = {
  l: INST.x + 30,
  r: INST.x + INST.w - 12,
  t: INST.y + 46,
  b: INST.y + INST.h - 26,
} as const;
/** the wage instrument re-titles as it changes grain, so the header narrates
    the very thing that is happening to the dots. TITLES are the canonical
    short chart names (user-set, consistent everywhere a chart is named:
    city population vs wages chart · MSA population vs wages chart · city housing scatter — the tree's
    "read: …" pointers use the same names); the sub line carries the
    narration. */
const INST_HEAD: Record<
  "city" | "msa" | "home",
  { title: string; sub: string }
> = {
  city: {
    title: "the city population vs wages chart",
    sub: "for the Demand fork · the same plane you just read, up close",
  },
  msa: {
    title: "the MSA population vs wages chart",
    sub: "for the Demand fork · one dot per MSA, not per city",
  },
  home: {
    title: "the city housing scatter",
    sub: "for the Supply fork · supply-side cities",
  },
};
/** city → its own MSA, for the give-way animation */
const METRO_BY_ID = new Map(METRO_DOTS.map((m) => [m.id, m]));
const pxi = (x: number) => scale(x, XD, IN.l, IN.r);
const pyiW = (y: number) => scale(y, YW, IN.b, IN.t);
const pyiH = (y: number) => scale(y, YH, IN.b, IN.t);

/* ————— the tree (bottom band, smaller + abstracted: title-only nodes) ————— */

type SideKey = "demand" | "supply";
/** dashed sub-question annex — sits BELOW each side's pile, so the branch
    edges leave from under the question, clear of the dots */
const AH = 36;
/* the whole tree rides 16px left of canvas-center (user-set: with the
   instrument panel anchored top-right, the centered tree read as crowding
   it — the shift plus the panel's trim opens a clear diagonal of air) */
const NODES = {
  root: {
    x: 304,
    y: 260,
    w: 212,
    h: 38,
    title: "same side of the medians?",
    side: null,
    color: "#b9b2a6",
  },
  /* each side node sits at the MIDPOINT of its two leaves, so the fork
     glyph is symmetric — off-center parents (they once sat at 180/460)
     make the inner run shorter than the outer one, which read as lopsided
     once the answer labels grew */
  demand: {
    x: 150,
    y: 336,
    w: 104,
    h: 30,
    title: "Demand",
    side: "demand" as SideKey,
    color: SIDE_C.demand,
  },
  supply: {
    x: 462,
    y: 336,
    w: 104,
    h: 30,
    title: "Supply",
    side: "supply" as SideKey,
    color: SIDE_C.supply,
  },
  /* yes branches LEFT on both forks (diagram order) — MSA-wide far left,
     matching the instrument's left-half violet lens; even 156px pitch */
  /* the leaf row rides low (user-set: the sub-forks' bottom halves — run →
     leaf drop — want real height, and the canvas has the room) */
  regional: {
    x: 72,
    y: 538,
    w: 104,
    h: 26,
    title: "MSA-wide",
    side: "demand" as SideKey,
    color: REGIONAL_C,
  },
  local: {
    x: 228,
    y: 538,
    w: 108,
    h: 26,
    title: "Admin-specific",
    side: "demand" as SideKey,
    color: SIDE_C.demand,
  },
  housing: {
    x: 384,
    y: 538,
    w: 104,
    h: 26,
    title: "Housing",
    side: "supply" as SideKey,
    color: HALF_C.above,
  },
  amen: {
    x: 540,
    y: 538,
    w: 104,
    h: 26,
    title: "Amenities",
    side: "supply" as SideKey,
    color: HALF_C.below,
  },
} as const;
type NodeId = keyof typeof NODES;
/* the chart's name says which dials it plots, so the sub no longer
   spells "people × pay" before it — at 9px the longer line ran past the
   root node's own width */
const ROOT_SUB = "read: the city population vs wages chart ↖";

/* Each side row stacks: the node → the cities that answered it → the NEXT
   question → the branches. Putting the pile above the question means the
   fork edges leave from below it and never thread past a pile. */
const CELL = 5;
const DOT_R = 2;
const SIDE_COLS = 20;
const LEAF_COLS = 14;
const SIDE_TOP = NODES.demand.y + NODES.demand.h / 2 + 12;
const SIDE_ROWS = Math.ceil(Math.max(DEMAND_N, SUPPLY_N) / SIDE_COLS);
/* +26 leaves clear air between the pile's count label and the question box */
const ANNEX_TOP = SIDE_TOP + SIDE_ROWS * CELL + 26;

const ANNEX: Record<SideKey, { w: number; q: string; read: string }> = {
  demand: {
    w: 184,
    q: "MSA pop growth below the median?",
    read: "read: the MSA population vs wages chart ↗",
  },
  supply: {
    w: 184,
    q: "cost of living above the median?",
    read: "read: the city housing scatter ↑",
  },
};

/** Where a parent hands off its edges: side nodes from the bottom of their
    question annex, the root from its own bottom. The edge PATH and the
    answer LABELS both derive from this one helper — they drifted apart
    once, leaving the labels floating inside the side piles. */
const edgeStartY = (p: (typeof NODES)[NodeId]): number =>
  p.side ? ANNEX_TOP + AH : p.y + p.h / 2;
/** the y of the elbow's horizontal run for a given parent — the drop is
    deep enough (14px) that the answer labels riding the run keep clear
    air under the question box above them (user-set spacing) */
const edgeRunY = (p: (typeof NODES)[NodeId]): number => edgeStartY(p) + 14;

/** orthogonal elbow: drop 14px, run level, then drop at the CHILD's x */
function edgePath(from: NodeId, to: NodeId): string {
  const p = NODES[from];
  const n = NODES[to];
  const y1 = edgeStartY(p);
  const y2 = n.y - n.h / 2;
  const ys = edgeRunY(p);
  return `M ${p.x} ${y1} L ${p.x} ${ys} L ${n.x} ${ys} L ${n.x} ${y2}`;
}
/** [parent, child, answer label] — the label states the fork's answer the
    way the diagram does ("yes — left half") */
const EDGES: [NodeId, NodeId, string][] = [
  ["root", "demand", "yes — together"],
  ["root", "supply", "no — apart"],
  ["demand", "regional", "yes — left half"],
  ["demand", "local", "no — right half"],
  ["supply", "housing", "yes — above"],
  ["supply", "amen", "no — below"],
];

/* ————— the piles (progressive: side piles fill at the first pour, leaf
   piles as each branch's fork is answered) ————— */

function grid(
  n: number,
  cx: number,
  top: number,
  cols: number,
  cell: number,
): { x: number; y: number }[] {
  const x0 = cx - ((Math.min(n, cols) - 1) * cell) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + (i % cols) * cell,
    y: top + Math.floor(i / cols) * cell,
  }));
}

/* the side piles are wide and shallow, sitting between each side node and
   its question box */
const SIDES: SideKey[] = ["demand", "supply"];
const SIDE_DOTS: Record<SideKey, FieldDot[]> = {
  demand: FIELD_DOTS.filter((d) => d.side === "demand"),
  supply: FIELD_DOTS.filter((d) => d.side === "supply"),
};
const SIDE_BIN = new Map<string, { x: number; y: number }>();
for (const s of SIDES) {
  grid(SIDE_DOTS[s].length, NODES[s].x, SIDE_TOP, SIDE_COLS, CELL).forEach(
    (p, i) => SIDE_BIN.set(SIDE_DOTS[s][i].id, p),
  );
}
const sideCountY = (s: SideKey) =>
  SIDE_TOP + Math.ceil(SIDE_DOTS[s].length / SIDE_COLS) * CELL + 13;

const LEAF_TOP = NODES.regional.y + NODES.regional.h / 2 + 14;
const LEAVES: LeafKey[] = ["regional", "local", "housing", "amen"];
const LEAF_DOTS: Record<LeafKey, FieldDot[]> = {
  local: FIELD_DOTS.filter((d) => d.leaf === "local"),
  regional: FIELD_DOTS.filter((d) => d.leaf === "regional"),
  housing: FIELD_DOTS.filter((d) => d.leaf === "housing"),
  amen: FIELD_DOTS.filter((d) => d.leaf === "amen"),
};
const LEAF_BIN = new Map<string, { x: number; y: number }>();
for (const leaf of LEAVES) {
  grid(
    LEAF_DOTS[leaf].length,
    NODES[leaf].x,
    LEAF_TOP,
    LEAF_COLS,
    CELL,
  ).forEach((p, i) => LEAF_BIN.set(LEAF_DOTS[leaf][i].id, p));
}
const SIDE_COUNTS: { id: SideKey; n: number }[] = [
  { id: "demand", n: DEMAND_N },
  { id: "supply", n: SUPPLY_N },
];
const LEAF_COUNTS: { id: LeafKey; n: number }[] = [
  { id: "regional", n: REGIONAL_N },
  { id: "local", n: LOCAL_N },
  { id: "housing", n: ABOVE_N },
  { id: "amen", n: BELOW_N },
];
const leafCountY = (leaf: LeafKey) =>
  LEAF_TOP + Math.ceil(LEAF_DOTS[leaf].length / LEAF_COLS) * CELL + 13;

/* ————— quadrant metadata (for the pair lenses) ————— */

const QUADS = [
  {
    key: "tr",
    right: true,
    top: true,
    side: "demand" as SideKey,
    sub: "people ↑ · pay ↑",
  },
  {
    key: "tl",
    right: false,
    top: true,
    side: "supply" as SideKey,
    sub: "people ↓ · pay ↑",
  },
  {
    key: "br",
    right: true,
    top: false,
    side: "supply" as SideKey,
    sub: "people ↑ · pay ↓",
  },
  {
    key: "bl",
    right: false,
    top: false,
    side: "demand" as SideKey,
    sub: "people ↓ · pay ↓",
  },
];

const TWEEN = { duration: 0.65, ease: "easeInOut" } as const;
const DRAW = { duration: 0.55, ease: "easeOut" } as const;

/** Tiny hand-drawn glyphs beside the axis labels (person = people, dollar
    bill = pay, house = home values). They sit at each label's START — its
    tail, before the first word (user-moved from the arrow tip): beside a
    horizontal label that is LEFT of the text, beside a rotated-90 label it
    is BELOW the label's bottom end — and `rot` matches a y-axis icon's
    orientation to its rotated label (user-set; horizontal labels keep
    upright icons). The bill carries a center emblem with a bar through it
    plus corner denomination dashes — the bare rect-and-circle version read
    as a flag of Japan (user). `s` scales the glyph to its label (1.3
    beside the full-size axis labels, 1.15 in the instrument panel); the
    stroke divides s back out so every icon keeps the same pen weight.
    (x, y) is the glyph's optical center — on a rotated label keep it on
    the glyph column, ~0.3em LEFT of the baseline pivot. Because the
    labels are end-anchored, a start-side icon needs the label's rendered
    length: `LBL_W` below holds measured advance widths. The parked card's
    small labels go without: at that size a glyph is noise. */
function AxisIcon({
  kind,
  x,
  y,
  color,
  s = 1,
  rot = 0,
}: {
  kind: "people" | "pay" | "home";
  x: number;
  y: number;
  color: string;
  s?: number;
  rot?: number;
}) {
  const st = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.2 / s,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {kind === "people" && (
        <>
          <circle cx={0} cy={-2.4} r={1.8} {...st} />
          <path d="M -3.1 3.4 C -3.1 0.6, 3.1 0.6, 3.1 3.4" {...st} />
        </>
      )}
      {kind === "pay" && (
        <>
          <rect x={-4.8} y={-3} width={9.6} height={6} rx={1} {...st} />
          <circle cx={0} cy={0} r={1.7} {...st} />
          <path d="M 0 -0.9 L 0 0.9" {...st} />
          <path d="M -3.2 -0.8 L -3.2 0.8 M 3.2 -0.8 L 3.2 0.8" {...st} />
        </>
      )}
      {kind === "home" && (
        <path
          d="M -3.4 0.3 L 0 -3 L 3.4 0.3 M -2.3 -0.1 L -2.3 3.2 L 2.3 3.2 L 2.3 -0.1"
          {...st}
        />
      )}
    </g>
  );
}
/** measured advance widths of the end-anchored axis labels (browser-
    measured via getComputedTextLength at their font sizes) — re-measure
    if the label copy or sizes change */
const LBL_W = {
  mainX: 178,
  mainY: 151,
  instX: 88,
  instWage: 71,
  instHome: 101,
} as const;

/** The MSA population vs wages chart's dots: REAL METROS (METRO_DOTS — the layer a
    demand-side city looks its own MSA up in), a plain field until the lens
    splits the halves violet/blue. */
function instMsaDot(
  m: MetroDot,
  lensOn: boolean,
): { fill: string; opacity: number } {
  return lensOn
    ? { fill: m.x < POP_MED ? REGIONAL_C : SIDE_C.demand, opacity: 0.45 }
    : { fill: FIELD_BLUE, opacity: 0.35 };
}
/** The housing scatter's dots: the CITY field with the supply cohort lit;
    gate colors arrive with the lens. */
function instHomeDot(
  d: FieldDot,
  lensOn: boolean,
): { fill: string; opacity: number } {
  if (d.side !== "supply") return { fill: GHOST, opacity: 0.1 };
  return lensOn
    ? { fill: d.above ? HALF_C.above : HALF_C.below, opacity: 0.55 }
    : { fill: SIDE_C.supply, opacity: 0.5 };
}

export function DiagnoseStage({
  scene,
  live = true,
  compact = false,
}: {
  scene: DiagScene;
  live?: boolean;
  /** a phone stage: in the tree phases the parked chart and the instrument
   *  leave the frame and the viewBox crops to the tree, so it draws half
   *  again as large — a 640-unit chart in a 360px column is otherwise 4px
   *  type */
  compact?: boolean;
}) {
  /* hover is GRACED (user-set, "make hovering smooth"): clearing waits
     120ms so sliding between neighboring dots re-targets without the
     tooltip flickering off and on, each dot's hit area is padded by a
     transparent stroke well past its painted radius, and the tooltip
     fades in per city instead of popping */
  const [hover, setHover] = useState<FieldDot | null>(null);
  const hoverClear = useRef<number | null>(null);
  const hoverEnter = (d: FieldDot) => {
    if (hoverClear.current !== null) {
      window.clearTimeout(hoverClear.current);
      hoverClear.current = null;
    }
    setHover(d);
  };
  const hoverLeave = (d: FieldDot) => {
    if (hoverClear.current !== null) window.clearTimeout(hoverClear.current);
    hoverClear.current = window.setTimeout(() => {
      hoverClear.current = null;
      setHover((h) => (h?.id === d.id ? null : h));
    }, 120);
  };
  useEffect(
    () => () => {
      if (hoverClear.current !== null) window.clearTimeout(hoverClear.current);
    },
    [],
  );

  /* the stage mounts at page load, hidden behind the hero — a visibility
     threshold fires while it is still sliding in mid-scroll, so the draw
     finishes before the reader's eyes land on it. Instead, the very first
     draw (the x axis) follows `live` — the scrolly's engaged signal (the
     first step card at the viewport's middle band) — in BOTH directions
     (user-set): it draws when the reader arrives and retracts when they
     scroll back above the scrolly, so shuttling over the boundary strokes
     the line on and off instead of ever presenting it pre-drawn. */
  const wage = scene.layout === "wage";
  /* the phone crop: the band the two corner cards occupy, gone once the
     stage is the tree's (the root card starts at 241) */
  const crop = compact && !wage ? 220 : 0;
  const parkOn = !wage;
  const flowOf = (s: SideKey): Flow => scene.flow?.[s] ?? "park";
  /* the parked card stays lit while it still holds anyone */
  const parkHolds = flowOf("demand") === "park" || flowOf("supply") === "park";
  const xAxisOn = wage && live;
  const yAxisOn = wage && (scene.axes ?? "xy") === "xy";
  const dotsOn = scene.dots !== false;
  const mx = px(POP_MED);
  const myY = pyW(WAGE_MED);

  const pairSide =
    scene.lens === "quad-demand"
      ? "demand"
      : scene.lens === "quad-supply"
        ? "supply"
        : null;
  /** is this quadrant's tint + corner label lit? */
  const quadLit = (side: SideKey) =>
    wage && (scene.lens === "quad-all" || pairSide === side);

  const target = (d: FieldDot): { x: number; y: number; r: number } => {
    switch (scene.layout) {
      case "wage":
        return {
          x: px(d.x),
          y: pyW(d.wage),
          r: radiusFor(d.pop, POP_MAX, 8, 1.7),
        };
      case "tree": {
        /* each side moves on the beat its own fork is answered */
        const f = flowOf(d.side);
        if (f === "leaf") return { ...LEAF_BIN.get(d.id)!, r: DOT_R };
        if (f === "side") return { ...SIDE_BIN.get(d.id)!, r: DOT_R };
        return {
          x: pxm(d.x),
          y: pym(d.wage),
          r: radiusFor(d.pop, POP_MAX, 3, 0.8),
        };
      }
    }
  };
  const style = (d: FieldDot): { fill: string; opacity: number } => {
    /* tree phase: a dot's color says how far it has been sorted — its
       side's color until its own fork is answered, then its leaf's — and
       the branch currently at rest dims */
    if (!wage) {
      const fill = flowOf(d.side) === "leaf" ? LEAF_C[d.leaf] : SIDE_C[d.side];
      /* the resting branch fades HARD (user-set: the first 0.3 was not
         faded enough) so the focused side owns the tree */
      const resting = !!scene.focus && scene.focus !== d.side;
      return { fill, opacity: resting ? 0.15 : 0.62 };
    }
    switch (scene.color ?? "plain") {
      case "side":
        return { fill: SIDE_C[d.side], opacity: 0.55 };
      case "demand":
        return d.side === "demand"
          ? { fill: SIDE_C.demand, opacity: 0.55 }
          : { fill: GHOST, opacity: 0.12 };
      case "supply":
        return d.side === "supply"
          ? { fill: SIDE_C.supply, opacity: 0.55 }
          : { fill: GHOST, opacity: 0.12 };
      default:
        return { fill: FIELD_BLUE, opacity: 0.38 };
    }
  };

  /* tree visibility + focus dimming */
  const t = scene.tree ?? {};
  const nodeOn = (id: NodeId): boolean => {
    if (id === "root") return !!t.root;
    if (id === "demand" || id === "supply") return !!t.sides;
    return NODES[id].side === "demand" ? !!t.demandLeaves : !!t.supplyLeaves;
  };
  const annexOn = (sid: SideKey): boolean =>
    sid === "demand" ? !!t.demandQ : !!t.supplyQ;
  const dimmed = (id: NodeId): boolean => {
    const side = NODES[id].side;
    return !!scene.focus && !!side && side !== scene.focus;
  };

  /* instrument panel state */
  const instK = scene.inst?.kind ?? null;
  const instAny = instK !== null;
  /* the slot builds its chart in stages, so the branch hand-off can show an
     empty, re-titled panel before the new instrument exists */
  const instAxes = instAny && (scene.inst?.axes ?? true);
  const instDots = instAny && (scene.inst?.dots ?? true);
  /* the panel wears the color of the branch it serves — the loudest signal
     that the instrument has been swapped */
  const instAccent = instK === "home" ? SIDE_C.supply : SIDE_C.demand;
  /* the wage instrument opens on the cities themselves and then hands over
     to their MSAs — same axes, same plane, one level up */
  const instGrain = scene.inst?.grain ?? "msa";
  const instHead = instK === "home" ? "home" : instGrain;
  const msaOn = instDots && instK === "wage" && instGrain === "msa";
  const lensW = instK === "wage" && instGrain === "msa" && !!scene.inst?.lens;
  const lensH = instK === "home" && !!scene.inst?.lens;
  const imx = pxi(POP_MED);
  const imyW = pyiW(WAGE_MED);
  const imyH = pyiH(HOME_GATE);

  return (
    <div className="diag-stage">
      <svg
        viewBox={`0 ${crop} ${W} ${H - crop}`}
        role="img"
        aria-label="The diagnostic pathway, assembled from the data"
      >
        {/* ————— quadrant-pair tints (wage phase) —————
            color SLIDES in, not fades (user-set): each tint sweeps out of
            the median crosshair toward its corner — the very lines that
            define it — and collapses back into the crosshair when its pair
            rests. The crosshair-side edges stay pinned because the offset
            and the size tween together. Same grammar as the instrument
            lenses' sweeps. */}
        {QUADS.map((q) => {
          const lit = quadLit(q.side);
          const w = q.right ? W - M.r - mx : mx - M.l;
          const h = q.top ? myY - M.t : PLOT_B - myY;
          return (
            <motion.rect
              key={q.key}
              x={q.right ? mx : M.l}
              y={q.top ? M.t : myY}
              fill={SIDE_C[q.side]}
              initial={false}
              animate={{
                width: lit ? w : 0,
                height: lit ? h : 0,
                x: lit || q.right ? 0 : w,
                y: lit || !q.top ? 0 : h,
                fillOpacity: lit ? 0.1 : 0,
              }}
              transition={{ default: TWEEN, fillOpacity: { duration: 0.25 } }}
            />
          );
        })}

        {/* ————— chart axes: one axis per beat, each line DRAWS and its
            ticks + label follow (r2d3-granular) ————— */}
        <motion.g
          initial={false}
          animate={{ opacity: wage ? 1 : 0 }}
          transition={TWEEN}
        >
          <motion.line
            x1={M.l}
            x2={W - M.r}
            y1={PLOT_B}
            y2={PLOT_B}
            stroke="#d6d0c4"
            strokeWidth={1}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: xAxisOn ? 1 : 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: xAxisOn ? 1 : 0 }}
            transition={{ duration: 0.4, delay: xAxisOn ? 0.45 : 0 }}
          >
            {XT.map((tk) => (
              <g key={`x${tk}`}>
                <line
                  x1={px(tk)}
                  x2={px(tk)}
                  y1={PLOT_B}
                  y2={PLOT_B + 4}
                  stroke="#d6d0c4"
                  strokeWidth={1}
                />
                <text
                  x={px(tk)}
                  y={PLOT_B + 17}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#8a867e"
                >
                  {tk > 0 ? `+${tk}` : tk}
                </text>
              </g>
            ))}
            <text
              x={W - M.r - 14}
              y={H - 14}
              textAnchor="end"
              fontSize={11.5}
              fill="#6f6e69"
            >
              population growth, % per year →
            </text>
            <AxisIcon
              kind="people"
              x={W - M.r - 14 - LBL_W.mainX - 9}
              y={H - 18}
              color="#6f6e69"
              s={1.3}
            />
          </motion.g>
          {/* the plane self-titles with its canonical name (user-set) — the
              same caps line the parked card carries, so the park later
              reads as the SAME chart shrinking, not a new card */}
          <motion.text
            x={M.l}
            y={15}
            fontSize={11}
            fontWeight={600}
            letterSpacing={0.5}
            fill="#8a867e"
            initial={{ opacity: 0 }}
            animate={{ opacity: xAxisOn ? 1 : 0 }}
            transition={{ duration: 0.4, delay: xAxisOn ? 0.35 : 0 }}
          >
            THE CITY POPULATION VS WAGES CHART · {N_CITIES} CITIES
          </motion.text>
          <motion.line
            x1={M.l}
            x2={M.l}
            y1={PLOT_B}
            y2={M.t}
            stroke="#d6d0c4"
            strokeWidth={1}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: yAxisOn ? 1 : 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: yAxisOn ? 1 : 0 }}
            transition={{ duration: 0.4, delay: yAxisOn ? 0.45 : 0 }}
          >
            {YWT.map((tk) => (
              <g key={`y${tk}`}>
                <line
                  x1={M.l - 4}
                  x2={M.l}
                  y1={pyW(tk)}
                  y2={pyW(tk)}
                  stroke="#d6d0c4"
                  strokeWidth={1}
                />
                <text
                  x={M.l - 8}
                  y={pyW(tk) + 3.5}
                  textAnchor="end"
                  fontSize={10}
                  fill="#8a867e"
                >
                  {tk > 0 ? `+${tk}` : tk}
                </text>
              </g>
            ))}
            <text
              x={16}
              y={M.t + 18}
              fontSize={11.5}
              fill="#6f6e69"
              transform={`rotate(-90 16 ${M.t + 18})`}
              textAnchor="end"
            >
              wage growth, % per year →
            </text>
            <AxisIcon
              kind="pay"
              x={12.5}
              y={M.t + 18 + LBL_W.mainY + 9}
              color="#6f6e69"
              s={1.3}
              rot={-90}
            />
          </motion.g>

          {/* median crosshair draws on — endpoint animation, NOT pathLength
              (framer's pathLength drives stroke-dasharray and would erase the
              dashed pattern) */}
          <motion.line
            x1={M.l}
            y1={myY}
            y2={myY}
            stroke="#9a958c"
            strokeWidth={1}
            strokeDasharray="3 5"
            initial={false}
            animate={{
              x2: scene.medians ? W - M.r : M.l,
              opacity: scene.medians ? 1 : 0,
            }}
            transition={{ x2: DRAW, opacity: { duration: 0.2 } }}
          />
          <motion.line
            x1={mx}
            x2={mx}
            y1={M.t}
            stroke="#9a958c"
            strokeWidth={1}
            strokeDasharray="3 5"
            initial={false}
            animate={{
              y2: scene.medians ? PLOT_B : M.t,
              opacity: scene.medians ? 1 : 0,
            }}
            transition={{
              y2: { ...DRAW, delay: 0.12 },
              opacity: { duration: 0.2 },
            }}
          />
          <motion.g
            initial={false}
            animate={{ opacity: scene.medians ? 1 : 0 }}
            transition={{ duration: 0.35, delay: 0.35 }}
          >
            <text
              x={W - M.r - 4}
              y={myY - 6}
              textAnchor="end"
              fontSize={10}
              fill="#7a766e"
              {...HALO}
            >
              typical MSA {sPct(WAGE_MED)}
            </text>
            <text
              x={mx + 6}
              y={PLOT_B - 8}
              fontSize={10}
              fill="#7a766e"
              {...HALO}
            >
              typical MSA {sPct(POP_MED)}
            </text>
          </motion.g>
        </motion.g>

        {/* ————— the parked field (tree + sorted phases): the chart, shrunk
            to a corner card; it empties on the final sort and dims ————— */}
        <motion.g
          initial={false}
          animate={{
            opacity: parkOn ? (scene.recap ? 0.3 : parkHolds ? 1 : 0.5) : 0,
          }}
          transition={TWEEN}
          style={{ display: crop ? "none" : undefined }}
        >
          <rect
            x={PARK.x}
            y={PARK.y}
            width={PARK.w}
            height={PARK.h}
            rx={10}
            fill="#ffffff"
            fillOpacity={0.92}
            stroke={CARD_STROKE}
            strokeWidth={1}
          />
          {/* the quadrant shading carries over from the full-size plane — the
              card keeps saying WHY each dot belongs to the side it flows to */}
          {QUADS.map((q) => (
            <rect
              key={`pq-${q.key}`}
              x={q.right ? pxm(POP_MED) : PK.l}
              y={q.top ? PK.t : pym(WAGE_MED)}
              width={q.right ? PK.r - pxm(POP_MED) : pxm(POP_MED) - PK.l}
              height={q.top ? pym(WAGE_MED) - PK.t : PK.b - pym(WAGE_MED)}
              fill={SIDE_C[q.side]}
              fillOpacity={0.075}
            />
          ))}
          <text
            x={PARK.x + 10}
            y={PARK.y + 14}
            fontSize={9}
            fontWeight={600}
            letterSpacing={0.3}
            fill="#8a867e"
          >
            POPULATION VS WAGES · {N_CITIES} CITIES
          </text>
          <motion.line
            x1={PK.l}
            x2={PK.r}
            y1={PK.b}
            y2={PK.b}
            stroke="#d6d0c4"
            strokeWidth={1}
            initial={false}
            animate={{ pathLength: parkOn ? 1 : 0 }}
            transition={DRAW}
          />
          <motion.line
            x1={PK.l}
            x2={PK.l}
            y1={PK.b}
            y2={PK.t}
            stroke="#d6d0c4"
            strokeWidth={1}
            initial={false}
            animate={{ pathLength: parkOn ? 1 : 0 }}
            transition={{ ...DRAW, delay: 0.1 }}
          />
          <line
            x1={PK.l}
            x2={PK.r}
            y1={pym(WAGE_MED)}
            y2={pym(WAGE_MED)}
            stroke="#b3ada1"
            strokeWidth={0.8}
            strokeDasharray="3 4"
          />
          <line
            x1={pxm(POP_MED)}
            x2={pxm(POP_MED)}
            y1={PK.t}
            y2={PK.b}
            stroke="#b3ada1"
            strokeWidth={0.8}
            strokeDasharray="3 4"
          />
          <text
            x={PK.r}
            y={PARK.y + PARK.h - 10}
            textAnchor="end"
            fontSize={8.5}
            fill="#8a867e"
          >
            people →
          </text>
          <text
            x={PARK.x + 12}
            y={PK.t + 4}
            fontSize={8.5}
            fill="#8a867e"
            transform={`rotate(-90 ${PARK.x + 12} ${PK.t + 4})`}
            textAnchor="end"
          >
            pay →
          </text>
        </motion.g>

        {/* ————— the instrument panel (tree phase, top-right): the secondary
            visualization at reading size — base draws, then the lens ————— */}
        <motion.g
          initial={false}
          animate={{ opacity: instAny ? (scene.recap ? 0.3 : 1) : 0 }}
          transition={TWEEN}
          style={{ display: crop ? "none" : undefined }}
        >
          {/* the slot: its border and header take the branch's color, so
              swapping instruments repaints the whole panel */}
          <motion.rect
            x={INST.x}
            y={INST.y}
            width={INST.w}
            height={INST.h}
            rx={10}
            fill="#ffffff"
            fillOpacity={0.95}
            strokeWidth={1.3}
            initial={false}
            animate={{
              stroke: instAny ? instAccent : CARD_STROKE,
              strokeOpacity: instAny ? 0.5 : 1,
            }}
            transition={TWEEN}
          />
          <motion.rect
            x={INST.x + 12}
            y={INST.y + 11}
            width={3}
            height={22}
            rx={1.5}
            initial={false}
            animate={{ fill: instAccent }}
            transition={TWEEN}
          />
          {(["city", "msa", "home"] as const).map((k) => (
            <motion.g
              key={`ih-${k}`}
              initial={false}
              animate={{ opacity: instHead === k ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <text
                x={INST.x + 21}
                y={INST.y + 22}
                fontSize={12}
                fontWeight={700}
                fill={k === "home" ? SIDE_C.supply : SIDE_C.demand}
              >
                {INST_HEAD[k].title}
              </text>
              <text x={INST.x + 21} y={INST.y + 35} fontSize={9} fill="#6f6e69">
                {INST_HEAD[k].sub}
              </text>
            </motion.g>
          ))}

          {/* NO quadrant shading in this panel (user-set): the MSA chart's
              dots are a lookup layer, not a demand/supply classification —
              tinting its quadrants would claim a sorting that isn't
              happening here. Its only shading is the fork's own lens. */}

          {/* lens tints DRAW: halves sweeps left from the fork line, the gate
              tints grow out of the gate */}
          {/* the halves lens shades BOTH answers (user-set): violet sweeps
              left for MSA-wide, blue sweeps right for Admin-specific — a
              tinted half against a blank one would read as one answer
              mattering and the other not */}
          <motion.rect
            y={IN.t}
            height={IN.b - IN.t}
            fill={REGIONAL_C}
            initial={false}
            animate={{
              x: lensW ? IN.l : imx,
              width: lensW ? imx - IN.l : 0,
              fillOpacity: lensW ? 0.09 : 0,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
              delay: lensW ? 0.15 : 0,
            }}
          />
          <motion.rect
            x={imx}
            y={IN.t}
            height={IN.b - IN.t}
            fill={SIDE_C.demand}
            initial={false}
            animate={{
              width: lensW ? IN.r - imx : 0,
              fillOpacity: lensW ? 0.09 : 0,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
              delay: lensW ? 0.15 : 0,
            }}
          />
          <motion.rect
            x={IN.l}
            width={IN.r - IN.l}
            fill={HALF_C.above}
            initial={false}
            animate={{
              y: lensH ? IN.t : imyH,
              height: lensH ? imyH - IN.t : 0,
              fillOpacity: lensH ? 0.08 : 0,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
              delay: lensH ? 0.15 : 0,
            }}
          />
          <motion.rect
            x={IN.l}
            y={imyH}
            width={IN.r - IN.l}
            fill={HALF_C.below}
            initial={false}
            animate={{
              height: lensH ? IN.b - imyH : 0,
              fillOpacity: lensH ? 0.08 : 0,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
              delay: lensH ? 0.15 : 0,
            }}
          />

          {/* the new instrument's frame DRAWS in its own beat (the slot sits
              re-titled and empty until then) — x is shared, the y axis is
              what the swap is really about, so it is the accent one */}
          <motion.line
            x1={IN.l}
            x2={IN.r}
            y1={IN.b}
            y2={IN.b}
            stroke="#c9c2b6"
            strokeWidth={1}
            initial={false}
            animate={{ pathLength: instAxes ? 1 : 0 }}
            transition={DRAW}
          />
          <motion.line
            x1={IN.l}
            x2={IN.l}
            y1={IN.b}
            y2={IN.t}
            strokeWidth={1.4}
            initial={false}
            animate={{
              pathLength: instAxes ? 1 : 0,
              stroke: instAccent,
              strokeOpacity: instAxes ? 0.55 : 0,
            }}
            transition={{ pathLength: { ...DRAW, delay: 0.1 }, default: TWEEN }}
          />
          <motion.g
            initial={false}
            animate={{ opacity: instAxes ? 1 : 0 }}
            transition={{ duration: 0.3, delay: instAxes ? 0.3 : 0 }}
          >
            <text
              x={IN.r - 12}
              y={INST.y + INST.h - 10}
              textAnchor="end"
              fontSize={9}
              fill="#8a867e"
            >
              population growth →
            </text>
            <AxisIcon
              kind="people"
              x={IN.r - 12 - LBL_W.instX - 8}
              y={INST.y + INST.h - 13}
              color="#8a867e"
              s={1.15}
            />
          </motion.g>
          {(["wage", "home"] as const).map((k) => (
            <motion.g
              key={`iy-${k}`}
              initial={false}
              animate={{ opacity: instAxes && instK === k ? 1 : 0 }}
              transition={{
                duration: 0.3,
                delay: instAxes && instK === k ? 0.3 : 0,
              }}
            >
              <text
                x={INST.x + 14}
                y={IN.t + 2}
                fontSize={9.5}
                fontWeight={600}
                fill={k === "wage" ? SIDE_C.demand : SIDE_C.supply}
                transform={`rotate(-90 ${INST.x + 14} ${IN.t + 2})`}
                textAnchor="end"
              >
                {k === "wage" ? "wage growth →" : "home-value growth →"}
              </text>
              <AxisIcon
                kind={k === "wage" ? "pay" : "home"}
                x={INST.x + 11.5}
                y={
                  IN.t +
                  2 +
                  (k === "wage" ? LBL_W.instWage : LBL_W.instHome) +
                  8
                }
                color={k === "wage" ? SIDE_C.demand : SIDE_C.supply}
                s={1.15}
                rot={-90}
              />
            </motion.g>
          ))}

          {/* pop-median vertical (both instruments read x against it) */}
          <motion.line
            x1={imx}
            x2={imx}
            y1={IN.t}
            stroke="#9a958c"
            strokeWidth={1}
            strokeDasharray="3 4"
            initial={false}
            animate={{ y2: instAxes ? IN.b : IN.t, opacity: instAxes ? 1 : 0 }}
            transition={{
              y2: { ...DRAW, delay: 0.25 },
              opacity: { duration: 0.15, delay: 0.25 },
            }}
          />
          {/* the wage median (context) vs THE GATE (the all-places home median) */}
          <motion.line
            x1={IN.l}
            y1={imyW}
            y2={imyW}
            stroke="#9a958c"
            strokeWidth={1}
            strokeDasharray="3 4"
            initial={false}
            animate={{
              x2: instAxes && instK === "wage" ? IN.r : IN.l,
              opacity: instAxes && instK === "wage" ? 1 : 0,
            }}
            transition={{
              x2: { ...DRAW, delay: 0.25 },
              opacity: { duration: 0.15, delay: 0.25 },
            }}
          />
          <motion.line
            x1={IN.l}
            y1={imyH}
            y2={imyH}
            stroke="#9a958c"
            strokeWidth={1}
            strokeDasharray="3 4"
            initial={false}
            animate={{
              x2: instAxes && instK === "home" ? IN.r : IN.l,
              opacity: instAxes && instK === "home" ? 1 : 0,
            }}
            transition={{
              x2: { ...DRAW, delay: 0.25 },
              opacity: { duration: 0.15, delay: 0.25 },
            }}
          />

          {/* THE GIVE-WAY: the wage instrument opens showing the very field
              the reader just read — the same cities, same axes, painted the
              same way as the parked chart — and then every city slides onto
              the MSA it belongs to and hands over to the metro field. Cities
              sharing a metro visibly converge on the same dot, which is the
              whole point: this is that plane, one level up. */}
          {instK === "wage" &&
            FIELD_DOTS.map((d) => {
              const m = METRO_BY_ID.get(d.msaId);
              const atCity = instGrain === "city" || !m;
              const s = style(d);
              return (
                <motion.circle
                  key={`il-${d.id}`}
                  initial={false}
                  animate={{
                    cx: atCity ? pxi(d.x) : pxi(m!.x),
                    cy: atCity ? pyiW(d.wage) : pyiW(m!.wage),
                    r: instDots
                      ? radiusFor(
                          atCity ? d.pop : m!.pop,
                          atCity ? POP_MAX : METRO_POP_MAX,
                          3.4,
                          0.8,
                        )
                      : 0,
                    fill: s.fill,
                    opacity: instDots && atCity ? s.opacity : 0,
                  }}
                  transition={{
                    opacity: { duration: 0.35, delay: atCity ? 0.3 : 0.45 },
                    default: { duration: 0.7, ease: "easeInOut" },
                  }}
                />
              );
            })}
          {/* the metro field takes over once the cities have arrived */}
          <motion.g
            initial={false}
            animate={{ opacity: msaOn ? 1 : 0 }}
            transition={{ duration: 0.4, delay: msaOn ? 0.5 : 0 }}
          >
            {METRO_DOTS.map((m) => {
              const s = instMsaDot(m, lensW);
              return (
                <circle
                  key={`iw-${m.id}`}
                  cx={pxi(m.x)}
                  cy={pyiW(m.wage)}
                  r={radiusFor(m.pop, METRO_POP_MAX, 3.4, 0.8)}
                  fill={s.fill}
                  opacity={s.opacity}
                />
              );
            })}
          </motion.g>
          {/* the housing field LANDS the way the opening plane did — dots
              grow in from r 0, staggered — rather than one layer-fade
              (user-set: draw, don't fade); paint still tweens in place
              when the gate lens recolors the cohort */}
          {FIELD_DOTS.map((d, i) => {
            const s = instHomeDot(d, lensH);
            const on = instDots && instK === "home";
            const stag = 0.3 + (i % 26) * 0.012;
            return (
              <motion.circle
                key={`ihd-${d.id}`}
                cx={pxi(d.x)}
                cy={pyiH(d.home)}
                initial={false}
                animate={{
                  r: on ? radiusFor(d.pop, POP_MAX, 3.4, 0.8) : 0,
                  fill: s.fill,
                  opacity: on ? s.opacity : 0,
                }}
                transition={{
                  fill: { duration: 0.3, ease: "easeOut" },
                  r: { duration: 0.45, ease: "easeOut", delay: on ? stag : 0 },
                  opacity: { duration: 0.25, delay: on ? stag : 0 },
                }}
              />
            );
          })}

          {/* lens verdict labels */}
          <motion.g
            initial={false}
            animate={{ opacity: lensW ? 1 : 0 }}
            transition={{ duration: 0.35, delay: lensW ? 0.45 : 0 }}
          >
            <text
              x={IN.l + 5}
              y={IN.t + 13}
              fontSize={10.5}
              fontWeight={600}
              fill={REGIONAL_C}
              {...HALO}
            >
              left → MSA-wide
            </text>
            <text
              x={IN.r - 5}
              y={IN.t + 13}
              textAnchor="end"
              fontSize={10.5}
              fontWeight={600}
              fill={SIDE_C.demand}
              {...HALO}
            >
              else → Admin-specific
            </text>
          </motion.g>
          <motion.g
            initial={false}
            animate={{ opacity: lensH ? 1 : 0 }}
            transition={{ duration: 0.35, delay: lensH ? 0.45 : 0 }}
          >
            <text
              x={IN.l + 5}
              y={imyH - 8}
              fontSize={10.5}
              fontWeight={600}
              fill={HALF_C.above}
              {...HALO}
            >
              faster → Housing
            </text>
            <text
              x={IN.l + 5}
              y={imyH + 16}
              fontSize={10.5}
              fontWeight={600}
              fill={HALF_C.below}
              {...HALO}
            >
              slower → Amenities
            </text>
          </motion.g>
        </motion.g>

        {/* ————— THE FIELD (lands on its own beat: dots grow in from r 0,
            staggered — drawn, not faded; the stagger doubles as each pour's
            streaming delay). PAINT (fill/opacity) leads GEOMETRY (cx/cy/r)
            so recolors read in place before dots fly. Rendered BENEATH the
            tree layers (edges, labels, nodes, annexes): a pour streams
            BEHIND the structure, so the branches stay legible while the
            field flies through them — painted above, the swarm used to
            erase the tree for the length of the flight. The landed piles
            sit in open bands, so nothing ever covers a resting dot. ————— */}
        {FIELD_DOTS.map((d, i) => {
          const p = target(d);
          const s = style(d);
          const stag = (i % 26) * 0.012;
          return (
            <motion.circle
              key={d.id}
              stroke="transparent"
              strokeWidth={7}
              initial={false}
              animate={{
                cx: p.x,
                cy: p.y,
                r: dotsOn ? p.r : 0,
                fill: s.fill,
                opacity: dotsOn ? s.opacity : 0,
              }}
              transition={{
                fill: { duration: 0.3, ease: "easeOut", delay: stag },
                opacity: { duration: 0.3, ease: "easeOut", delay: stag },
                default: {
                  duration: 0.75,
                  ease: "easeInOut",
                  delay: stag + 0.22,
                },
              }}
              onMouseEnter={() => hoverEnter(d)}
              onMouseLeave={() => hoverLeave(d)}
            />
          );
        })}

        {/* ————— tree edges (elbows DRAW, colored by the child they reach) ————— */}
        {EDGES.map(([a, b]) => {
          const vis =
            nodeOn(a) &&
            nodeOn(b) &&
            (a === "root" || annexOn(NODES[a].side as SideKey));
          const side = NODES[b].side as SideKey;
          const dim = dimmed(b);
          return (
            <motion.path
              key={`${a}-${b}`}
              d={edgePath(a, b)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="miter"
              stroke={NODES[b].color}
              initial={false}
              animate={{
                pathLength: vis ? 1 : 0,
                opacity: vis ? (dim ? 0.18 : 1) : 0,
                strokeWidth: vis && scene.focus === side ? 2 : 1.5,
              }}
              transition={{ pathLength: DRAW, default: TWEEN }}
            />
          );
        })}
        {/* STEMS: while a side's cities pile between its node and its
            question, the pile itself bridges them — but once that cohort
            pours to the leaves, the vacated band would leave the node
            floating above its question, the tree visibly disconnected. So
            the branch line draws down through the band as the dots leave,
            closing the tree behind them. */}
        {(["demand", "supply"] as const).map((sid) => {
          const n = NODES[sid];
          const on =
            !wage && flowOf(sid) === "leaf" && nodeOn(sid) && annexOn(sid);
          const dim = dimmed(sid);
          return (
            <motion.line
              key={`stem-${sid}`}
              x1={n.x}
              x2={n.x}
              y1={n.y + n.h / 2}
              y2={ANNEX_TOP}
              stroke={n.color}
              strokeLinecap="round"
              initial={false}
              animate={{
                pathLength: on ? 1 : 0,
                opacity: on ? (dim ? 0.18 : 1) : 0,
                strokeWidth: on && scene.focus === sid ? 2 : 1.5,
              }}
              transition={{
                pathLength: { ...DRAW, delay: on ? 0.3 : 0 },
                opacity: { duration: 0.2, delay: on ? 0.3 : 0 },
                default: TWEEN,
              }}
            />
          );
        })}

        {/* answer labels on each fork edge. The ROOT's ride its long runs,
            halo-punched mid-run; the SECOND-LEVEL answers sit on the DROP
            just above their leaf capsule instead (user-set): at 9.5px they
            out-measured the sub-forks' short run segments — text longer
            than the line it sat on read lopsided — while over the drop
            they are symmetric by construction. */}
        {EDGES.map(([a, b, lbl]) => {
          const vis =
            nodeOn(a) &&
            nodeOn(b) &&
            (a === "root" || annexOn(NODES[a].side as SideKey));
          const dim = dimmed(b);
          const p = NODES[a];
          const n = NODES[b];
          const onDrop = a !== "root";
          const lx = onDrop ? n.x : (p.x + n.x) / 2;
          /* a drop label centers on ITS segment — midway between the run
             and the capsule top (+3.5 baseline shift) — not a fixed offset
             off the capsule, which sat it low in the drop */
          const lyy = onDrop
            ? (edgeRunY(p) + n.y - n.h / 2) / 2 + 3.5
            : edgeRunY(p) + 3.5;
          return (
            <motion.text
              key={`el-${a}-${b}`}
              initial={false}
              animate={{ opacity: vis ? (dim ? 0.18 : 1) : 0 }}
              transition={{ duration: 0.3, delay: vis ? 0.4 : 0 }}
              x={lx}
              y={lyy}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={600}
              fill={NODES[b].color}
              {...HALO}
              /* drop labels cut a WIDER swath out of the line behind them
                 (user-set readability): the drop crosses mid-text, and the
                 default 3px halo let it show between glyphs */
              strokeWidth={onDrop ? 6 : 3}
            >
              {lbl}
            </motion.text>
          );
        })}

        {/* ————— nodes: dashed question capsule (root) + solid tinted answers ————— */}
        {(Object.keys(NODES) as NodeId[]).map((id) => {
          const n = NODES[id];
          const vis = nodeOn(id);
          const dim = dimmed(id);
          const isQ = id === "root";
          return (
            <motion.g
              key={id}
              initial={false}
              /* answers SETTLE in — a short slide down from the edge that
                 reaches them — instead of fading in place */
              animate={{ opacity: vis ? (dim ? 0.25 : 1) : 0, y: vis ? 0 : -6 }}
              transition={{
                opacity: { duration: 0.25 },
                y: { duration: 0.4, ease: "easeOut" },
              }}
            >
              <motion.rect
                x={n.x - n.w / 2}
                y={n.y - n.h / 2}
                width={n.w}
                height={n.h}
                rx={isQ ? n.h / 2 : 9}
                fill={isQ ? "#ffffff" : n.color}
                stroke={isQ ? "#a89f91" : "none"}
                strokeWidth={isQ ? 1.1 : 0}
                strokeDasharray={isQ ? "5 4" : undefined}
                initial={false}
                animate={{ fillOpacity: vis ? (isQ ? 0.92 : 0.13) : 0 }}
                transition={{ duration: 0.35, delay: vis ? 0.25 : 0 }}
              />
              <motion.g
                initial={false}
                animate={{ opacity: vis ? 1 : 0 }}
                transition={{ duration: 0.3, delay: vis ? 0.3 : 0 }}
              >
                <text
                  x={n.x}
                  y={isQ ? n.y - 4 : n.y + 4}
                  textAnchor="middle"
                  fontSize={isQ ? 12 : n.h === 30 ? 12.5 : 11}
                  fontWeight={600}
                  fill="#2c2823"
                >
                  {n.title}
                </text>
                {isQ && (
                  <text
                    x={n.x}
                    y={n.y + 12}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#6f6e69"
                  >
                    {ROOT_SUB}
                  </text>
                )}
              </motion.g>
            </motion.g>
          );
        })}

        {/* dashed sub-question annexes, glued under Demand / Supply */}
        {(["demand", "supply"] as const).map((sid) => {
          const n = NODES[sid];
          const a = ANNEX[sid];
          const vis = annexOn(sid) && nodeOn(sid);
          const dim = dimmed(sid);
          const top = ANNEX_TOP;
          return (
            <motion.g
              key={`ax-${sid}`}
              initial={false}
              animate={{ opacity: vis ? (dim ? 0.25 : 1) : 0, y: vis ? 0 : -6 }}
              transition={{
                opacity: { duration: 0.25 },
                y: { duration: 0.4, ease: "easeOut" },
              }}
            >
              <motion.rect
                x={n.x - a.w / 2}
                y={top}
                width={a.w}
                height={AH}
                rx={7}
                fill="#ffffff"
                stroke="#a89f91"
                strokeWidth={1}
                strokeDasharray="5 4"
                initial={false}
                animate={{ fillOpacity: vis ? 0.92 : 0 }}
                transition={{ duration: 0.35, delay: vis ? 0.25 : 0 }}
              />
              <motion.g
                initial={false}
                animate={{ opacity: vis ? 1 : 0 }}
                transition={{ duration: 0.3, delay: vis ? 0.3 : 0 }}
              >
                <text
                  x={n.x}
                  y={top + 15}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight={600}
                  fill="#3f3b34"
                >
                  {a.q}
                </text>
                <text
                  x={n.x}
                  y={top + 28.5}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontStyle="italic"
                  fill="#6f6e69"
                >
                  {a.read}
                </text>
              </motion.g>
            </motion.g>
          );
        })}

        {/* ————— leaf counts (the one sort, counted) ————— */}
        {/* counts land with the pile they belong to — under the side while a
            branch waits there, under the leaves once its fork is answered */}
        {/* counts get NUDGED into place from above — as if pushed out by
            the pile landing on them — instead of fading in situ */}
        {SIDE_COUNTS.map((sc) => {
          const on = !wage && flowOf(sc.id) === "side";
          return (
            <motion.text
              key={`sc-${sc.id}`}
              initial={false}
              animate={{
                opacity: on
                  ? scene.focus && scene.focus !== sc.id
                    ? 0.25
                    : 1
                  : 0,
                y: on ? 0 : -6,
              }}
              transition={{
                opacity: TWEEN,
                y: { duration: 0.5, ease: "easeOut" },
              }}
              x={NODES[sc.id].x}
              y={sideCountY(sc.id)}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={SIDE_C[sc.id]}
            >
              {sc.n} cities
            </motion.text>
          );
        })}
        {LEAF_COUNTS.map((lc) => {
          const on = !wage && flowOf(NODES[lc.id].side as SideKey) === "leaf";
          const dim = !!scene.focus && NODES[lc.id].side !== scene.focus;
          return (
            <motion.text
              key={`lc-${lc.id}`}
              initial={false}
              animate={{ opacity: on ? (dim ? 0.25 : 1) : 0, y: on ? 0 : -6 }}
              transition={{
                opacity: TWEEN,
                y: { duration: 0.5, ease: "easeOut" },
              }}
              x={NODES[lc.id].x}
              y={leafCountY(lc.id)}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={NODES[lc.id].color}
            >
              {lc.n} cities
            </motion.text>
          );
        })}

        {/* ————— quadrant-pair labels (over the dots, wage phase) ————— */}
        {QUADS.map((q) => {
          const lx = q.right ? W - M.r - 8 : M.l + 8;
          const anchor: "start" | "end" = q.right ? "end" : "start";
          const ly = q.top ? M.t + 18 : PLOT_B - 34;
          const lit = quadLit(q.side);
          return (
            <motion.g
              key={`lbl-${q.key}`}
              initial={false}
              /* the label rides its tint's sweep: it slides in from its
                 corner's edge instead of fading in place */
              animate={{
                opacity: lit ? 1 : 0,
                x: lit ? 0 : q.right ? 16 : -16,
              }}
              transition={{
                opacity: TWEEN,
                x: { duration: 0.55, ease: "easeOut" },
              }}
            >
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                fontSize={12.5}
                fontWeight={600}
                fill={SIDE_C[q.side]}
                {...HALO}
              >
                {q.side === "demand" ? "together → Demand" : "apart → Supply"}
              </text>
              <text
                x={lx}
                y={ly + 15}
                textAnchor={anchor}
                fontSize={10}
                fill="#6f6e69"
                {...HALO}
              >
                {q.sub}
              </text>
            </motion.g>
          );
        })}

        {/* ————— hover: name the city under the cursor, on a card so the
            label reads over dots and tree alike (user-set) ————— */}
        {hover &&
          dotsOn &&
          (() => {
            const p = target(hover);
            const flip = p.x > W - 175;
            const tx = flip ? p.x - 10 : p.x + 10;
            const anchor: "start" | "end" = flip ? "end" : "start";
            const ly = Math.min(Math.max(p.y, M.t + 18), H - 46);
            const l2 = `people ${sPct(hover.x)}/yr · pay ${sPct(hover.wage)}/yr`;
            const l3 = `MSA: ${hover.msaName} (${sPct(hover.msaPop)}/yr people)`;
            /* estimated card width — advance ≈ .60em bold title / .50em body */
            const cw =
              Math.max(
                hover.name.length * 6.9,
                l2.length * 4.75,
                l3.length * 4.75,
              ) + 12;
            return (
              <motion.g
                key={hover.id}
                pointerEvents="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r + 3}
                  fill="none"
                  stroke="#2c2823"
                  strokeWidth={1}
                />
                <rect
                  x={flip ? tx - cw + 6 : tx - 6}
                  y={ly - 14}
                  width={cw}
                  height={41}
                  rx={6}
                  fill="#ffffff"
                  fillOpacity={0.94}
                  stroke={CARD_STROKE}
                  strokeWidth={1}
                />
                <text
                  x={tx}
                  y={ly - 2}
                  textAnchor={anchor}
                  fontSize={11.5}
                  fontWeight={700}
                  fill="#2c2823"
                >
                  {hover.name}
                </text>
                <text
                  x={tx}
                  y={ly + 11}
                  textAnchor={anchor}
                  fontSize={9.5}
                  fill="#6f6e69"
                >
                  {l2}
                </text>
                <text
                  x={tx}
                  y={ly + 23}
                  textAnchor={anchor}
                  fontSize={9.5}
                  fill="#6f6e69"
                >
                  {l3}
                </text>
              </motion.g>
            );
          })()}

        {scene.caption && (
          <motion.text
            key={scene.caption}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            x={W / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize={13}
            fontStyle="italic"
            fill="#6f6e69"
          >
            {scene.caption}
          </motion.text>
        )}
      </svg>

      <div className="stage-hud">
        {scene.pills?.map((p) => (
          <span key={p} className="hud-pill">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
