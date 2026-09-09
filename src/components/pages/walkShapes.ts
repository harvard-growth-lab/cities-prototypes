/** The guided walk's TREE SHAPES — how many branches hang off the root, and
 *  where every card on the walk's tree sits.
 *
 *  A different axis from the section's user-flow switch: the flow decides how
 *  the sequence is TOLD, the shape decides what the tree it tells IS. The
 *  walk's tree is hand-laid rather than solved by d3 (the walking dot traces
 *  an authored polyline through it, and the cards carry copy, not just
 *  titles), so each shape carries its own geometry table — which is also what
 *  makes it a layout study: the positions are there to be nudged.
 *
 *  Shared across shapes: the ROW geometry below (which y each rank sits at,
 *  where the elbow buses run, where the traveller rests). A shape sets the
 *  horizontal layout, the card sizes, and its own copy.
 *
 *  To add a shape — a four-path root, say — append one entry to WALK_SHAPES
 *  with its branches and x positions. Nothing else needs to change: the walk
 *  reads its tree entirely from this table, and `scripts` in the git history
 *  show how the spacing was checked for overlap. */

import type { BranchSide, TreeVariant } from "../../data/figures";

/* ---------- rows: shared by every shape ---------- */

/* Three ranks spread evenly down the stage (Sept 2026 revision): the head
   row sits at the vertical midpoint between the root and the leaves, so the
   two forks get the same drop. There used to be a fourth rank — a question
   card under each head — which came off the tree to reduce clutter; the
   root and leaf rows stayed where they were, since the stage poses are
   tuned to the tree's extents. */
export const ROOT_ROW = { y: 84, h: 34 };
export const HEAD_ROW = { y: 250, h: 32 };
export const LEAF_ROW = { y: 420 };

/** the elbow buses — root → heads, and heads → leaves — each halfway down
 *  its gap (root bottom 101 → head top 226; head bottom 274 → leaf top 399
 *  on the mounted shape) */
export const ROOT_BUS = 164;
export const LEAF_BUS = 336;
/** where the second fork's stem hands over to the elbows: the fork-two stop
 *  draws a head's stem down to the bus, the leaf stop fans out from it */
export const FORK2_Y = LEAF_BUS;

/* where the walking dot rests at each station: under the root question,
   below its branch head (see DOT_BELOW_HEAD), partway down the stem at the
   second fork, then at its leaf */
export const DOT_ROOT_Y = 120;
export const DOT_FORK2_Y = 312;
export const DOT_LEAF_Y = 458;

/* ---------- the shapes ---------- */

export type WalkShapeId = "two" | "three" | "quad" | "quad2";

export interface WalkLeafDef {
  /** a tree-node id of the shape's variant, so a pick converts app-wide */
  id: string;
  /** the card's label, one entry per line — the narrower shapes wrap */
  lines: string[];
  /** the answer that reaches this leaf. No longer DRAWN — the second
   *  fork's edge labels came off with its question cards (Sept 2026
   *  revision); kept as the fork's authored wording, like `question` */
  edge: string;
  /** the card's centre and width */
  x: number;
  w: number;
}

export interface WalkBranchDef {
  id: BranchSide;
  title: string;
  /** the head card's label, one entry per line — defaults to [title] */
  titleLines?: string[];
  /** the root → head edge label: the answer that reaches this branch */
  edge: string;
  /** the second fork's question, one entry per line. Takes the medians it
   *  reads against, since the question names the number it compares to.
   *  No longer DRAWN — the question cards came off the tree (Sept 2026
   *  revision, to reduce clutter); the rail's fork-two stop carries the
   *  logic instead. Kept as the fork's authored wording. */
  question: (n: { medPop: string; medCost: string }) => string[];
  /** the head's centre — its stem and its leaves' bus share it */
  x: number;
  /** EMPTY where the branch stops at its head — every branch of a structure
   *  that forks once, or one branch of a forking tree with no second layer
   *  (the positive demand shock): the head is then the diagnosis itself,
   *  and the walk ends there */
  leaves: WalkLeafDef[];
}

/* ---------- the plane: how the pizza chart is divided ----------
 *  The chart is the population × wage plane — x is population growth against
 *  the median metro, y is wage growth — drawn as a square from −1 to 1 in
 *  both. A shape divides it into SECTORS, each named by the two rays that
 *  bound it (degrees counter-clockwise from the +x axis, i.e. from "people
 *  arriving, pay at the median"). Sectors must tile the full 360°.
 *
 *  The two-branch shape's four sectors are exactly the quadrants — 0–90,
 *  90–180 and so on — so one model serves both shapes and the shipped chart
 *  is unchanged. The three-branch shape cuts on the two 45° diagonals
 *  instead, which is a different reading of the same plane: what decides the
 *  branch is no longer which quadrant a city is in but whether pay moved
 *  more than people did. */

export interface PlaneSector {
  side: BranchSide;
  /** the bounding rays, degrees counter-clockwise from the +x axis */
  from: number;
  to: number;
  /** the reading, shown where the sector meets the chart's edge */
  sub: string;
  /** and the branch it argues for, under it */
  tag: string;
  /** the same rule as one line, in the legend under the inset chart */
  legend: string;
  /** the word the rail uses for "Boston: apart." — defaults to `sub` */
  read?: string;
}

export interface WalkShapeDef {
  id: WalkShapeId;
  label: string;
  hint: string;
  about: string;
  /** the app-wide structure a pick on this shape converts into */
  variant: TreeVariant;
  /** the root card: its question, centre and width */
  rootQuestion: string;
  rootX: number;
  rootW: number;
  /** card sizes that vary with how much room the shape leaves */
  headW: number;
  headSize?: number;
  headH?: number;
  /** the head row's y — a shape that forks once drops it down the stage, so
   *  the tree still fills the height a three-row one does */
  headY?: number;
  leafH: number;
  leafSize: number;
  /** how the walk describes its own root fork, in the rail copy */
  forkOneLine: string;
  /** how the rail introduces the plane: the beat's kicker, and the rule in
   *  one line (the chart beat in the full walk, the fork-one stop in the
   *  shortened one) */
  planeCopy: { kicker: string; lead: string };
}

export type WalkShape = WalkShapeDef & {
  branches: WalkBranchDef[];
  plane: PlaneSector[];
};

/* The two-branch tree: the shipped walk, its numbers unchanged. Every card
   was placed by eye against the 1180×640 stage, so they are listed rather
   than solved for — the tree's extents (x 19–749) are what the stage poses
   in TREE_OPENING_POSE and friends are tuned against. */
const TWO: WalkShape = {
  id: "two",
  label: "Two branches",
  hint: "Demand and supply — four diagnoses",
  about:
    "The root forks once into labor demand and labor supply, and each side forks again: four leaves",
  variant: "alt",
  rootQuestion: "population × wages — same side of the medians?",
  rootX: 405,
  rootW: 318,
  headW: 152,
  leafH: 30,
  leafSize: 16,
  forkOneLine:
    "one fork splits demand from supply, one more names the constraint",
  /* the four quadrants, in figure order — each is a 90° sector, so this
     renders exactly the square blocks the chart has always drawn */
  planeCopy: {
    kicker: "Reading the quadrant",
    lead: "Together → demand. Apart → supply.",
  },
  plane: [
    {
      side: "demand",
      from: 0,
      to: 90,
      sub: "population ↑ · wages ↑",
      tag: "together → demand",
      legend: "together → Labor Demand",
      read: "together",
    },
    {
      side: "supply",
      from: 90,
      to: 180,
      sub: "population ↓ · wages ↑",
      tag: "apart → supply",
      legend: "apart → Labor Supply",
      read: "apart",
    },
    {
      side: "demand",
      from: 180,
      to: 270,
      sub: "population ↓ · wages ↓",
      tag: "together → demand",
      legend: "together → Labor Demand",
      read: "together",
    },
    {
      side: "supply",
      from: 270,
      to: 360,
      sub: "population ↑ · wages ↓",
      tag: "apart → supply",
      legend: "apart → Labor Supply",
      read: "apart",
    },
  ],
  branches: [
    {
      id: "demand",
      title: "Labor Demand",
      edge: "yes — together",
      x: 205,
      question: (n) => [
        "metro population growth",
        `below the median (${n.medPop})?`,
      ],
      leaves: [
        {
          id: "metrowide",
          lines: ["Metro-wide shock"],
          edge: "yes — below",
          x: 105,
          w: 172,
        },
        {
          id: "placespec",
          lines: ["Place-specific shock"],
          edge: "no — at or above",
          x: 305,
          w: 188,
        },
      ],
    },
    {
      id: "supply",
      title: "Labor Supply",
      edge: "no — apart",
      x: 605,
      question: (n) => [
        "home values climbing faster",
        `than the typical metro (${n.medCost})?`,
      ],
      leaves: [
        /* "Housing", not "Cost of living": this fork tests home-value growth
           alone, and the box is sized to the shorter word (x is the centre) */
        { id: "col", lines: ["Housing"], edge: "yes — faster", x: 505, w: 118 },
        {
          id: "amen",
          lines: ["Amenities"],
          edge: "no — slower",
          x: 685,
          w: 128,
        },
      ],
    },
  ],
};

/* The three-branch tree: the same two branches, plus one that is neither —
   a placeholder, so the question is how the tree READS with an odd root,
   not what the third branch says.
   Six leaves have to share the SAME band the four do (x 19–749) — the
   stage poses that carry the tree, enlarged then aside, are tuned to those
   extents, so a wider tree would need all of them re-derived. The room comes
   out of the cards instead: leaf type drops to 13.5px and the two long shock
   titles wrap onto a second line. Within a branch the leaves sit 14px apart,
   between branches 27px — the grouping has to survive the tighter spacing,
   or the row reads as six unrelated boxes instead of three pairs. */
const THREE: WalkShape = {
  id: "three",
  label: "Three branches",
  hint: "A third branch off the root — six diagnoses",
  about:
    "The same two branches plus a third that is neither demand nor supply — a placeholder, to see how an odd root lays out",
  variant: "alt3",
  rootQuestion: "population × wages — plus [the third read]",
  rootX: 383,
  rootW: 318,
  headW: 152,
  leafH: 42,
  leafSize: 13.5,
  forkOneLine:
    "the root splits three ways, and one more fork names the constraint",
  /* Cut on the two 45° diagonals rather than on the axes. Each sector is
     named by its bounding rays: supply runs from the top-right diagonal
     round to the −x axis, demand from there on to the bottom-right diagonal,
     and the wedge left between the two diagonals — where a city's pay moved
     less than its population did — is the third branch's.
     NB this is a READING of the plane, not a test the tree runs: diagnose()
     still forks two ways, so nothing can be diagnosed INTO the third wedge.
     All four sample cities land in the sector their diagnosis argues for, so
     the chart and the tree agree today; a city landing in the wedge would
     see it marked "yours" while the tree walked demand or supply. */
  planeCopy: {
    kicker: "Reading the wedge",
    lead: "Wages outrun population → supply. Wages fall behind → demand. Wages barely move either way → the third branch.",
  },
  plane: [
    {
      side: "supply",
      from: 45,
      to: 180,
      sub: "wages outrun population",
      tag: "→ labor supply",
      legend: "wages outrun population → Labor Supply",
    },
    {
      side: "demand",
      from: 180,
      to: 315,
      sub: "wages fall behind population",
      tag: "→ labor demand",
      legend: "wages fall behind → Labor Demand",
    },
    {
      side: "third",
      from: 315,
      to: 45,
      sub: "population moves · wages hold",
      tag: "→ [third branch]",
      legend: "wages barely move → [Third branch]",
    },
  ],
  branches: [
    {
      id: "demand",
      title: "Labor Demand",
      edge: "yes — together",
      x: 134,
      question: (n) => [
        "metro population growth",
        `below the median (${n.medPop})?`,
      ],
      leaves: [
        {
          id: "metrowide",
          lines: ["Metro-wide", "shock"],
          edge: "yes — below",
          x: 71,
          w: 104,
        },
        {
          id: "placespec",
          lines: ["Place-specific", "shock"],
          edge: "no — at or above",
          x: 197,
          w: 120,
        },
      ],
    },
    {
      id: "supply",
      title: "Labor Supply",
      edge: "no — apart",
      x: 384,
      question: (n) => [
        "home values climbing faster",
        `than the typical metro (${n.medCost})?`,
      ],
      leaves: [
        { id: "col", lines: ["Housing"], edge: "yes — faster", x: 330, w: 92 },
        {
          id: "amen",
          lines: ["Amenities"],
          edge: "no — slower",
          x: 438,
          w: 96,
        },
      ],
    },
    {
      id: "third",
      title: "[Third branch]",
      edge: "[the third answer]",
      x: 630,
      question: () => [
        "[fork two on this branch —",
        "the comparison, to come]",
      ],
      leaves: [
        {
          id: "third1",
          lines: ["[First leaf]"],
          edge: "[yes]",
          x: 567,
          w: 108,
        },
        {
          id: "third2",
          lines: ["[Second leaf]"],
          edge: "[no]",
          x: 692,
          w: 114,
        },
      ],
    },
  ],
};

/* The four-quadrant tree: one fork, and then nothing. The quadrant a city
   lands in IS the diagnosis, so each branch is also a leaf and the question
   and leaf rows never draw — which is why the head row drops to y 300 and the
   cards grow. The four are the paper's own shock readings, promoted from
   labels on the chart to branches of the tree.
   Heads run left to right in quadrant order (q1…q4), which alternates demand
   and supply — so no two neighbours share a colour even though only two
   colours are in play. */
const QUAD: WalkShape = {
  id: "quad",
  label: "Four quadrants · flat",
  hint: "One fork on the tree — each shock's second question is asked in the analysis",
  about:
    "The root forks four ways, straight into the quadrants of the pizza chart, and stops there: the revision spec's second fork and its themes are asked in the analysis section below",
  variant: "quad",
  rootQuestion: "population × wages — which quadrant?",
  rootX: 384,
  rootW: 318,
  headW: 142,
  headSize: 15.5,
  headH: 48,
  headY: 300,
  leafH: 30,
  leafSize: 16,
  forkOneLine:
    "one fork, four ways — the quadrant a city lands in is the whole diagnosis",
  planeCopy: {
    kicker: "Reading the quadrant",
    lead: "Each quadrant is its own shock, and its own branch.",
  },
  plane: [
    {
      side: "demandpos",
      from: 0,
      to: 90,
      sub: "population ↑ · wages ↑",
      tag: "→ positive demand shock",
      legend: "people ↑ pay ↑ → Positive demand shock",
      read: "population ↑ · wages ↑",
    },
    {
      side: "supplyneg",
      from: 90,
      to: 180,
      sub: "population ↓ · wages ↑",
      tag: "→ negative supply shock",
      legend: "people ↓ pay ↑ → Negative supply shock",
      read: "population ↓ · wages ↑",
    },
    {
      side: "demandneg",
      from: 180,
      to: 270,
      sub: "population ↓ · wages ↓",
      tag: "→ negative demand shock",
      legend: "people ↓ pay ↓ → Negative demand shock",
      read: "population ↓ · wages ↓",
    },
    {
      side: "supplypos",
      from: 270,
      to: 360,
      sub: "population ↑ · wages ↓",
      tag: "→ positive supply shock",
      legend: "people ↑ pay ↓ → Positive supply shock",
      read: "population ↑ · wages ↓",
    },
  ],
  branches: [
    {
      id: "demandpos",
      title: "Positive demand shock",
      titleLines: ["Positive demand", "shock"],
      edge: "people ↑ · pay ↑",
      x: 111,
      question: () => [],
      leaves: [],
    },
    {
      id: "supplypos",
      title: "Positive supply shock",
      titleLines: ["Positive supply", "shock"],
      edge: "people ↑ · pay ↓",
      x: 293,
      question: () => [],
      leaves: [],
    },
    {
      id: "demandneg",
      title: "Negative demand shock",
      titleLines: ["Negative demand", "shock"],
      edge: "people ↓ · pay ↓",
      x: 475,
      question: () => [],
      leaves: [],
    },
    {
      id: "supplyneg",
      title: "Negative supply shock",
      titleLines: ["Negative supply", "shock"],
      edge: "people ↓ · pay ↑",
      x: 657,
      question: () => [],
      leaves: [],
    },
  ],
};

/* The four-quadrant tree, FORKED — the revision spec drawn in full: the root
   forks into the four shocks, and each shock forks once more with its own
   instrument (QUAD_BRANCH_SPEC in figures.ts carries the overarching
   questions; the analysis section carries the themes). The positive demand
   shock has no second layer (team revision, Sept 2026) — its head is the
   ending — so seven endings share the band the two-branch tree's four use,
   and the cards run narrow — 12px leaf type, pairs 6px apart inside a
   branch, ~8px between branches. Bracketed labels mark what the spec left
   open: the exact reading of each remaining instrument. */
const QUAD2: WalkShape = {
  id: "quad2",
  label: "Four quadrants · forked",
  hint: "Three quadrants ask one more question — seven diagnoses",
  about:
    "The revision spec in full: the root forks into the four quadrant shocks, and every shock but the positive demand one forks once more with its own instrument — seven endings",
  variant: "quad2",
  rootQuestion: "population × wages — which quadrant?",
  rootX: 384,
  rootW: 318,
  headW: 142,
  headSize: 15.5,
  headH: 48,
  leafH: 42,
  leafSize: 12,
  forkOneLine:
    "one fork picks the quadrant's shock, and all but the positive demand shock ask one more question",
  planeCopy: {
    kicker: "Reading the quadrant",
    lead: "Each quadrant is its own shock — and all but one get one more question.",
  },
  plane: QUAD.plane,
  branches: [
    {
      id: "demandpos",
      title: "Positive demand shock",
      titleLines: ["Positive demand", "shock"],
      edge: "people ↑ · pay ↑",
      x: 111,
      /* no second layer (team revision, Sept 2026): the head is the ending */
      question: () => [],
      leaves: [],
    },
    {
      id: "supplypos",
      title: "Positive supply shock",
      titleLines: ["Positive supply", "shock"],
      edge: "people ↑ · pay ↓",
      x: 293,
      question: (n) => [
        "housing prices above the",
        `median admin (${n.medCost})?`,
      ],
      leaves: [
        {
          id: "sp-col",
          lines: ["Housing"],
          edge: "yes — faster",
          x: 248,
          w: 84,
        },
        {
          id: "sp-amen",
          lines: ["Amenities"],
          edge: "no — slower",
          x: 338,
          w: 84,
        },
      ],
    },
    {
      id: "demandneg",
      title: "Negative demand shock",
      titleLines: ["Negative demand", "shock"],
      edge: "people ↓ · pay ↓",
      x: 475,
      question: () => ["local or regional?", "(MSA pop × wage chart)"],
      leaves: [
        {
          id: "dn-regional",
          lines: ["Regional", "(MSA)"],
          edge: "MSA weak too",
          x: 430,
          w: 84,
        },
        {
          id: "dn-local",
          lines: ["Local", "(admin)"],
          edge: "MSA healthy",
          x: 520,
          w: 84,
        },
      ],
    },
    {
      id: "supplyneg",
      title: "Negative supply shock",
      titleLines: ["Negative supply", "shock"],
      edge: "people ↓ · pay ↑",
      x: 657,
      question: (n) => [
        "housing prices above the",
        `median admin (${n.medCost})?`,
      ],
      leaves: [
        {
          id: "sn-col",
          lines: ["Housing"],
          edge: "yes — faster",
          x: 612,
          w: 84,
        },
        {
          id: "sn-amen",
          lines: ["Amenities"],
          edge: "no — slower",
          x: 702,
          w: 84,
        },
      ],
    },
  ],
};

/* No longer a menu: the tree-shape switch was retired when the team settled
   on the forked quadrant tree (Sept 2026), so the walk mounts
   DEFAULT_WALK_SHAPE and nothing reads the rest. They stay defined as layout
   studies — re-offering one is a matter of mapping this array in a switch
   again (see git history for the control). */
export const WALK_SHAPES: WalkShape[] = [QUAD2, QUAD, TWO, THREE];

/** the tree the walk tells — the revision spec's forked quadrant structure,
 *  and now the only one the section mounts */
export const DEFAULT_WALK_SHAPE: WalkShapeId = "quad2";

export const walkShape = (id: WalkShapeId): WalkShape =>
  WALK_SHAPES.find((s) => s.id === id) ?? TWO;

/* ---------- derived lookups ---------- */

export const shapeLeaves = (s: WalkShape): WalkLeafDef[] =>
  s.branches.flatMap((b) => b.leaves);

/** ending id → its branch: the branch a leaf hangs off, or — where a branch
 *  ends at its head — that head's own id */
export const leafSide = (s: WalkShape, leaf: string): BranchSide =>
  s.branches.find((b) => b.leaves.some((l) => l.id === leaf))?.id ??
  s.branches.find((b) => b.id === leaf)?.id ??
  "supply";

/** does this structure fork twice, or stop at the branch heads? */
export const hasLeaves = (s: WalkShape): boolean =>
  s.branches.some((b) => b.leaves.length > 0);
/** does THIS branch fork again, or end at its head? A forking tree can carry
 *  a branch that stops early (the positive demand shock), so the walk asks
 *  per branch, not per tree. */
export const branchForks = (s: WalkShape, side: string): boolean =>
  (s.branches.find((b) => b.id === side)?.leaves.length ?? 0) > 0;
/** an ending id names a leaf, or a head whose branch stops there */
export const isHeadEnding = (s: WalkShape, id: string): boolean =>
  s.branches.some((b) => b.id === id && b.leaves.length === 0);

export const headRowY = (s: WalkShape): number => s.headY ?? HEAD_ROW.y;
export const headRowH = (s: WalkShape): number => s.headH ?? HEAD_ROW.h;

/** where the traveller comes to rest, and what the badges point at: the leaf
 *  it reached, or — in a one-fork structure — the branch head itself */
/** how far below a head card the traveller comes to rest */
export const DOT_BELOW_HEAD = 18;

export const landingY = (s: WalkShape): number =>
  hasLeaves(s) ? DOT_LEAF_Y : headRowY(s) + headRowH(s) / 2 + DOT_BELOW_HEAD;
export const landingX = (s: WalkShape, route: string[]): number =>
  hasLeaves(s)
    ? leafX(s, route[route.length - 1])
    : headX(s, route[0] as BranchSide);
/** where one ending sits across — a leaf's centre, or the head's where its
 *  branch stops there — so a badge centres under whichever a route reached
 *  (badges share one row, landingY, whatever they point at) */
export const endingX = (s: WalkShape, id: string): number =>
  isHeadEnding(s, id) ? headX(s, id as BranchSide) : leafX(s, id);

/** the x extents of the leaf row — the widest rank, so this is the tree's
 *  own band. Both shapes span 19–749 by construction: the stage poses that
 *  carry the tree are tuned to those extents, and anything hung off a leaf
 *  (the badges) has to stay inside them or it clips at the viewBox edge. */
export const shapeBand = (s: WalkShape): [number, number] => {
  const boxes = hasLeaves(s)
    ? shapeLeaves(s).map((l) => [l.x, l.w] as const)
    : s.branches.map((b) => [b.x, s.headW] as const);
  return [
    Math.min(...boxes.map(([x, w]) => x - w / 2)),
    Math.max(...boxes.map(([x, w]) => x + w / 2)),
  ];
};

/** every card's centre, for the walking dot and the badges */
export const leafX = (s: WalkShape, leaf: string): number =>
  shapeLeaves(s).find((l) => l.id === leaf)?.x ?? s.rootX;
export const headX = (s: WalkShape, side: BranchSide): number =>
  s.branches.find((b) => b.id === side)?.x ?? s.rootX;

/* ---------- sector geometry, in unit coords (−1…1 on both axes) ---------- */

const norm360 = (d: number) => ((d % 360) + 360) % 360;

/** where a ray at `deg` from the centre leaves the unit SQUARE. Rounded, so
 *  a ray along an axis or a diagonal lands EXACTLY on the edge or the corner
 *  rather than a float-fuzz away from it — otherwise the quadrant sectors
 *  would emit coordinates like 868.0000000000001 and the shipped chart's
 *  markup would differ from itself. */
export const rayExit = (deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const t = 1 / Math.max(Math.abs(c), Math.abs(s));
  const snap = (v: number) => Math.round(v * 1e6) / 1e6;
  return [snap(c * t), snap(s * t)];
};

const CORNERS: { deg: number; pt: [number, number] }[] = [
  { deg: 45, pt: [1, 1] },
  { deg: 135, pt: [-1, 1] },
  { deg: 225, pt: [-1, -1] },
  { deg: 315, pt: [1, -1] },
];

/** a sector's stretch of the chart's OUTER edge — its polygon minus the
 *  centre, stroked in the branch's colour */
export const sectorRim = (sec: PlaneSector): [number, number][] =>
  sectorPoly(sec).slice(1);

/** the rays that divide the plane — one per sector boundary, deduped. A cut
 *  that lands on an axis is already drawn by the axis itself; a diagonal one
 *  has nothing under it, so the chart draws a surface-coloured gap there and
 *  the neighbouring regions never touch. */
export const planeCuts = (s: WalkShape): number[] =>
  [...new Set(s.plane.map((sec) => norm360(sec.from)))].filter(
    (deg) => deg % 90 !== 0,
  );

/** Does this plane need its regions outlined? Only where a boundary is NOT an
 *  axis. On a quadrant plane the axes already cut the regions apart and each
 *  one is a plain rectangle, so a rim would be a second line over a border
 *  that is already drawn. A plane cut on the diagonals has nothing marking
 *  its boundaries, and its tint fills cannot carry the difference — measured
 *  on this palette they sit at ΔE 1–4 against a floor of 15, while the same
 *  hues at full strength are ΔE 18–26 — so there the rim, not the fill, is
 *  what tells the regions apart. */
export const planeNeedsRim = (s: WalkShape): boolean => planeCuts(s).length > 0;

/** a sector as a polygon: the centre, the two bounding rays where they leave
 *  the square, and whichever of the square's corners fall between them —
 *  without those the sector would cut its corner off diagonally */
export const sectorPoly = (sec: PlaneSector): [number, number][] => {
  const span = norm360(sec.to - sec.from) || 360;
  const between = CORNERS.map((c) => ({ ...c, off: norm360(c.deg - sec.from) }))
    .filter((c) => c.off > 0 && c.off < span)
    .sort((a, b) => a.off - b.off)
    .map((c) => c.pt);
  return [[0, 0], rayExit(sec.from), ...between, rayExit(sec.to)];
};

/** where the sector's reading sits: on the edge its middle points at. For a
 *  quadrant that is the corner the labels have always used. */
export const sectorAnchor = (sec: PlaneSector): [number, number] =>
  rayExit(norm360(sec.from + (norm360(sec.to - sec.from) || 360) / 2));

/** one sector per BRANCH, first occurrence wins — the legend names branches,
 *  and the two-branch plane spends four sectors on two of them */
export const planeBranches = (s: WalkShape): PlaneSector[] =>
  s.plane.filter(
    (sec, i) => s.plane.findIndex((o) => o.side === sec.side) === i,
  );

/** the sector a city's dot falls in — its branch, under this shape's reading */
export const sectorAt = (
  s: WalkShape,
  x: number,
  y: number,
): PlaneSector | undefined => {
  const deg = norm360((Math.atan2(y, x) * 180) / Math.PI);
  return s.plane.find(
    (sec) => norm360(deg - sec.from) < (norm360(sec.to - sec.from) || 360),
  );
};

/* ---------- fitting the tree to a stage that is not 1180×640 ----------
 *  The walk's tree is authored against a fixed stage and then scaled to fit,
 *  which is fine until the stage narrows: everything shrinks together, and
 *  13.5px leaf type at 0.6× is 8px. These modes are different answers to
 *  "keep the tree readable without losing it as a map of where you are".
 *
 *    fit     today's behaviour — the whole tree, scaled to the stage
 *    focus   the frame follows the walked route: the whole tree while it is
 *            being introduced, then the root and its branches, then just the
 *            branch the city took. Type stays near native size because the
 *            frame is smaller; the map you lose comes back as a minimap.
 */
export type FitMode = "fit" | "focus" | "side" | "ride" | "sideride";

export const FIT_MODES: {
  id: FitMode;
  label: string;
  hint: string;
  about: string;
}[] = [
  {
    id: "fit",
    label: "Fit whole",
    hint: "The whole tree, scaled to the stage",
    about:
      "Today's behaviour: the entire tree scaled down to whatever the stage gives it",
  },
  {
    id: "ride",
    label: "Zoom",
    hint: "Scroll steps between stops; the frame rides the route between them",
    about:
      "A stepped immersive pass: each gesture lands on the next stop, and the frame (with the dot) rides the route there at reading zoom — the branch not taken slides off the edge — while the schematic keeps the whole tree",
  },
  {
    id: "sideride",
    label: "Zoom (horizontal)",
    hint: "The same stepped ride, along the sideways tree",
    about:
      "The camera ride over the sideways layout: stop by stop, left to right along the route, with the rows not taken sliding off the frame's edge",
  },
];

/** the rows a shape occupies, top to bottom, in tree coords */
export const shapeExtent = (s: WalkShape): [number, number] => [
  ROOT_ROW.y - ROOT_ROW.h / 2 - 34, // the caption above the root card
  landingY(s) + 56, // the badge row under the landing
];

/** the "where we think you are" pill is wider than anything it points at, so
 *  a frame that only covered the cards would crop it */
const BADGE_W = ("where we think you are".length + 2) * 7.8 + 30;

/** The band a badge may occupy without clipping — the STAGE's, not the
 *  tree's. A badge centred on an outer leaf overhangs the leaf row, and the
 *  stage has room for it: the viewBox runs 0–1180, and the widest static
 *  pose (scale 1.2, translate −8) keeps tree x 8–980 on stage. Clamping to
 *  the tree band instead visibly un-centres the pill from its leaf. */
const BADGE_BAND: [number, number] = [8, 980];

/** centre a badge of width `w` on `x`, kept inside the stage's safe band */
export const badgeCX = (x: number, w: number): number =>
  Math.min(Math.max(x, BADGE_BAND[0] + w / 2), BADGE_BAND[1] - w / 2);

/** Where a branch's own subtree sits, for the focus frame: its head, its
 *  leaves if it has any, and — the part that is easy to miss — the badge
 *  hanging under whichever leaf it lands on. The badge is clamped into the
 *  stage's safe band before it draws, so the frame has to account for the
 *  clamped position, not the raw one. */
export const branchBox = (
  s: WalkShape,
  side: string,
): [number, number, number, number] => {
  const b = s.branches.find((br) => br.id === side) ?? s.branches[0];
  const cards: (readonly [number, number])[] = [
    [b.x, s.headW] as const,
    ...(b.leaves.length
      ? b.leaves.map((l) => [l.x, l.w] as const)
      : ([] as (readonly [number, number])[])),
  ];
  /* every landing this branch could produce, with its badge around it */
  const landings = b.leaves.length ? b.leaves.map((l) => l.x) : [b.x];
  const badges = landings.map((x) => [badgeCX(x, BADGE_W), BADGE_W] as const);
  const all = [...cards, ...badges];
  const pad = 34;
  return [
    Math.min(...all.map(([x, w]) => x - w / 2)) - pad,
    headRowY(s) - headRowH(s) / 2 - 18,
    Math.max(...all.map(([x, w]) => x + w / 2)) + pad,
    landingY(s) + 56,
  ];
};

/** the whole tree's box — its band, widened where a landing's badge would
 *  overhang the leaf row (the badge is centred on its leaf, and an outer
 *  leaf's pill is wider than the leaf is), so a whole-tree fit keeps the
 *  pill on stage */
export const wholeBox = (s: WalkShape): [number, number, number, number] => {
  const [x0, x1] = shapeBand(s);
  const [y0, y1] = shapeExtent(s);
  /* every ending: the leaves, plus any head whose branch stops there */
  const landings = hasLeaves(s)
    ? [
        ...shapeLeaves(s).map((l) => l.x),
        ...s.branches.filter((b) => !b.leaves.length).map((b) => b.x),
      ]
    : s.branches.map((b) => b.x);
  const bx0 = Math.min(...landings.map((x) => badgeCX(x, BADGE_W) - BADGE_W / 2));
  const bx1 = Math.max(...landings.map((x) => badgeCX(x, BADGE_W) + BADGE_W / 2));
  return [Math.min(x0, bx0) - 12, y0, Math.max(x1, bx1) + 12, y1];
};

/** `translate(...) scale(...)` that maps `box` into `into`, centred and
 *  never upscaled past `maxScale` — the tree should fill the frame, not be
 *  blown up past the size it was drawn for */
export const fitScale = (
  box: [number, number, number, number],
  into: [number, number, number, number],
  maxScale = 2.4,
): number => {
  const [bx0, by0, bx1, by1] = box;
  const [ix0, iy0, ix1, iy1] = into;
  return Math.min(
    maxScale,
    (ix1 - ix0) / Math.max(1, bx1 - bx0),
    (iy1 - iy0) / Math.max(1, by1 - by0),
  );
};

/** the same fit, as numbers — [k, tx, ty] — for anything that has to map a
 *  tree point into posed stage coordinates itself (the transition studies) */
export const fitPose = (
  box: [number, number, number, number],
  into: [number, number, number, number],
  maxScale = 2.4,
): [number, number, number] => {
  const [bx0, by0, bx1, by1] = box;
  const [ix0, iy0, ix1, iy1] = into;
  const k = fitScale(box, into, maxScale);
  const tx = (ix0 + ix1) / 2 - k * ((bx0 + bx1) / 2);
  const ty = (iy0 + iy1) / 2 - k * ((by0 + by1) / 2);
  return [k, tx, ty];
};

export const fitTransform = (
  box: [number, number, number, number],
  into: [number, number, number, number],
  maxScale = 2.4,
): string => {
  const [k, tx, ty] = fitPose(box, into, maxScale);
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${k.toFixed(3)})`;
};

/** the count the rail copy names ("two questions, six diagnoses") */
const NUMBER_WORD: Record<number, string> = {
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
};
export const numberWord = (n: number) => NUMBER_WORD[n] ?? String(n);
