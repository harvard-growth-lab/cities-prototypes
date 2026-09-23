/** Content for the diagnostic figures, from "Doing Growth Diagnostics in
 *  Cities" (Harvard Growth Lab, Jan 2026):
 *
 *    Figure 31 — the population × wage plane, read at QUADRANT level per the
 *                researchers' current guidance (the eight elasticity wedges
 *                are retired; see git history for the octant version)
 *    Figure 27 — City Growth Diagnostics Decision Tree (p. 71)
 *
 *  Tree node titles and sibling order follow the figure verbatim; the longer
 *  blurbs are condensed from the paper's own text. */

import {
  USA,
  costMeasure,
  countryMedians,
  homeMsa,
  homePlace,
  placeCost,
} from "./metros";

/* ---------- Figure 27: the decision tree ---------- */

export type TreeSide =
  | "root"
  | "demand"
  | "supply"
  | "third"
  /* the four-quadrant structure's branches: demand and supply each split by
     the SIGN of the shock. They are separate branches with separate ids, but
     they deliberately share the two parent colours — see TREE_SIDE_COLOR. */
  | "demandpos"
  | "demandneg"
  | "supplypos"
  | "supplyneg";

/** a branch of the tree — every side but the root, which is where a descent
 *  starts rather than something it hangs off */
export type BranchSide = Exclude<TreeSide, "root">;

/** the tree comes in three structures, flipped by a stage toggle: "full" is
 *  the figure's five-level tree; "alt" keeps the demand/supply fork but goes
 *  straight to two leaves per side — demand → metro-wide/place-specific
 *  shock, supply → housing/amenities; "alt3" is that same tree with a third,
 *  still-unnamed branch hanging off the root (a layout study — see
 *  TREE_NODES_ALT3); "quad" is the four-quadrant tree, one fork and done;
 *  "quad2" is that tree under the Sept 2026 revision spec — each shock forks
 *  once more with its own instrument, eight leaves (TREE_NODES_QUAD2) */
export type TreeVariant = "full" | "alt" | "alt3" | "quad" | "quad2";

/** The tree section's top-level choice. Not a styling experiment like the
 *  icon/chip/curve toggles — each mode is a different proposal for how the
 *  diagnostic is structured, and the themed one may end up shaping how the
 *  whole app is navigated. It therefore gets its own control, and the
 *  variant + themes flags are DERIVED from it rather than set independently
 *  (which is what kept them needing to be coupled by hand). */
export type TreeMode = "paper" | "alt" | "themes";

/** `hint` rides inline beside the control, so it has to stay short enough to
 *  share the row; `about` is the fuller line, shown on hover. */
export const TREE_MODES: {
  id: TreeMode;
  label: string;
  hint: string;
  about: string;
}[] = [
  {
    id: "themes",
    label: "Alt + modules",
    hint: "Four leaves + the modules under each",
    about:
      "The four leaves, each carrying the modules you would look into there",
  },
  {
    id: "paper",
    label: "Paper tree",
    hint: "Figure 27 as published",
    about: "Figure 27 as published — five levels, ten leaves",
  },
  {
    id: "alt",
    label: "Alt tree",
    hint: "One fork per side, four leaves",
    about: "One fork per side: four leaves, each a diagnosable branch",
  },
];

/* NB: "alt3" is deliberately absent here. The third branch is a layout study
   on the GUIDED WALK's hand-laid tree (walkShapes.ts), which chooses its own
   structure; this control belongs to the initial draft's d3-solved tree, and
   offering the same idea in two places would make them two settings that
   have to agree. */
export const modeVariant = (m: TreeMode): TreeVariant =>
  m === "paper" ? "full" : "alt";
export const modeThemes = (m: TreeMode): boolean => m === "themes";

/** what the section opens on — and, like the flows, listed first in
 *  TREE_MODES so the default leads the pill row. The paper figure stays one
 *  switch away, but the proposal shown first is the four-leaf tree carrying
 *  the modules under each leaf — so the structure is read as the
 *  diagnostic, not as a variant of it. */
export const DEFAULT_TREE_MODE: TreeMode = "themes";

/* The section's USER-FLOW choice is gone (Sept 2026): the zoomed walk is the
   section, so there is nothing left to choose between. It kept the guided
   walk's chart phase and changed how the tree opens — the tree arrives whole
   with no city on it, and each scroll zooms the camera one station down the
   city's path before opening back out onto the lit route. The other tellings
   it was chosen over (the initial-draft five-step walk, the guided walk, the
   tree-first shortened walk) came out with the switch; see git history. */

export interface TreeNodeData {
  id: string;
  parent?: string;
  title: string;
  detail: string;
  example?: string;
  tests?: string;
}

export const TREE_ROOT_QUESTION =
  "What are binding constraints for economic growth in my city?";

/** side colors, darkened a step from the site tokens so figure text holds up
 *  at small sizes (base tokens: --teal #255862, --orange-dark #cf4f2c) */
export const TREE_SIDE_COLOR: Record<TreeSide, string> = {
  root: "#1a2226", // --ink
  demand: "#1d4b54",
  supply: "#b8431f",
  /* placeholder hue for the third branch: a muted violet, picked to sit at
     the same weight as the other two so the three-way root reads evenly —
     what the branch IS will decide what colour it keeps */
  third: "#5f4a86",
  /* Four branches, TWO hues: each shock keeps its parent side's colour —
     demand teal, supply rust — exactly as the two-branch tree draws them,
     and the SIGN moves off the colour channel: negative shocks draw broken
     (dashed strokes, hollow dots — see TREE_SIDE_DASH below), positive ones
     solid. Hue answers "which side of the economy", stroke answers "which
     way it moved". A side effect worth keeping: the quad population vs wages chart's
     colouring becomes identical to the two-branch chart's, and because the
     quadrants alternate demand/supply around the ring, no two adjacent
     regions share a hue even with only two in play. (The four-hue set this
     replaces — teal/blue/magenta/rust, ΔE- and colourblind-gated — is in
     the git history if a shape ever needs four true hues again.) */
  demandpos: "#1d4b54", // q1 · people ↑ pay ↑ · solid teal
  supplyneg: "#b8431f", // q4 · people ↓ pay ↑ · dashed rust
  demandneg: "#1d4b54", // q3 · people ↓ pay ↓ · dashed teal
  supplypos: "#b8431f", // q2 · people ↑ pay ↓ · solid rust
};

/** The stroke that says "negative shock" wherever a side draws a line or a
 *  card border — the sign's channel, now that hue belongs to the parent
 *  side. Everything else stays solid. The tiny schematics (the minimap)
 *  scale the pattern down rather than reading it verbatim, and dots
 *  too small to dash go hollow instead — sideHollow. */
export const TREE_SIDE_DASH: Partial<Record<TreeSide, string>> = {
  demandneg: "7 4",
  supplyneg: "7 4",
};
export const sideDash = (side: string): string | undefined =>
  TREE_SIDE_DASH[side as TreeSide];
/** a negative shock's dot draws as a ring, not a disc */
export const sideHollow = (side: string): boolean => sideDash(side) != null;

/** how a branch is named in running text — "On the tree · demand side" */
export const TREE_SIDE_LABEL: Record<TreeSide, string> = {
  root: "the root",
  demand: "demand side",
  supply: "supply side",
  third: "[third branch]",
  demandpos: "magnet city",
  demandneg: "leak city",
  supplypos: "sponge city",
  supplyneg: "fortress city",
};

/* ---------- the landing's four city types ----------
 *  One per quadrant of the population × wage plane. The population vs wages chart and the
 *  tree lead with these; the shock each one IS rides underneath as a
 *  caption, and the running copy names both where it helps. [Mapped by
 *  meaning, since the landing names the four without their dials: a magnet
 *  pulls people and pay up together, a sponge soaks up arrivals on thinner
 *  pay, a fortress shuts the door so only pay rises, a leak lets people and
 *  pay drain away together — confirm against the landing copy] */
export type QuadSide = "demandpos" | "demandneg" | "supplypos" | "supplyneg";
export const QUAD_NAME: Record<QuadSide, string> = {
  demandpos: "Magnet",
  supplypos: "Sponge",
  supplyneg: "Fortress",
  demandneg: "Leak",
};
/** the shock behind each city type — the caption under its name */
export const QUAD_SHOCK: Record<QuadSide, string> = {
  demandpos: "positive demand shock",
  supplypos: "positive supply shock",
  supplyneg: "negative supply shock",
  demandneg: "negative demand shock",
};
/** the two dials that define each quadrant: which way people and pay moved */
export const QUAD_DIR: Record<QuadSide, { pop: 1 | -1; pay: 1 | -1 }> = {
  demandpos: { pop: 1, pay: 1 },
  supplypos: { pop: 1, pay: -1 },
  supplyneg: { pop: -1, pay: 1 },
  demandneg: { pop: -1, pay: -1 },
};
const isQuadSide = (id: string): id is QuadSide => id in QUAD_NAME;
/** a branch id's city type, or nothing for a branch that is not a quadrant */
export const quadName = (id: string): string | undefined =>
  isQuadSide(id) ? QUAD_NAME[id] : undefined;
export const quadShock = (id: string): string | undefined =>
  isQuadSide(id) ? QUAD_SHOCK[id] : undefined;

/** Branches that draw but do not pick: a placeholder has no test behind it
 *  and no analysis section to navigate to, so the tree shows it and the
 *  leaves under it stay inert. Keyed by branch id, so a future placeholder
 *  branch only has to be listed here. */
export const PLACEHOLDER_BRANCHES: ReadonlySet<string> = new Set(["third"]);

/** which top-level branch a descent hangs off: its first id below the root.
 *  Anything unrecognised falls back to supply, which is what the several
 *  hand-written `path[0] === "demand" ? … : "supply"` reads this replaces
 *  each did on their own. */
const BRANCH_SIDES = new Set<string>([
  "demand",
  "supply",
  "third",
  "demandpos",
  "demandneg",
  "supplypos",
  "supplyneg",
]);
export const sideOfPath = (path: string[]): BranchSide =>
  BRANCH_SIDES.has(path[0]) ? (path[0] as BranchSide) : "supply";

/* ---------- quadrant → default tree path (chart→tree transitions) ---------- */

/** Per the researchers' current guidance, the QUADRANT a city lands in on the
 *  population × wage plane — not the eight elasticity wedges — decides which
 *  branch of the decision tree we walk by default. Each quadrant carries its
 *  shock reading, the descent it argues for, and a representative spot
 *  (unit coords, −1…1) where the city / what-if dot sits. */
export interface QuadrantDef {
  id: "q1" | "q2" | "q3" | "q4";
  /** which half of each axis: +1 above/right of average, −1 below/left */
  dx: 1 | -1;
  dy: 1 | -1;
  /** the landing's city type for this quadrant — what the chart leads with */
  name: string;
  shock: string;
  sub: string;
  /** the branch of the tree this quadrant defaults to — DERIVED, see below */
  side: "demand" | "supply";
  /** default descent below the root, in tree-node ids */
  path: string[];
  spot: [number, number];
  /** bracketed placeholder shown in the card; {city} is substituted */
  note: string;
}

/** Fork 1, as geometry. Population and pay on the SAME side of their medians
 *  (both above, or both below) means they move together — a demand story.
 *  On opposite sides they move apart — a supply story. Because dx and dy are
 *  exactly those two comparisons, the branch is the sign test dx === dy, and
 *  deriving it here rather than listing it per quadrant is what stops the
 *  chart and diagnose() drifting apart again — they previously disagreed on
 *  the two top quadrants for exactly that reason. */
const quadSide = (dx: 1 | -1, dy: 1 | -1): "demand" | "supply" =>
  dx === dy ? "demand" : "supply";

const QUADRANT_DEFS: Omit<QuadrantDef, "side">[] = [
  {
    id: "q1",
    dx: 1,
    dy: 1,
    name: "Magnet",
    shock: "Positive demand shock",
    sub: "population ↑ · wages ↑",
    path: ["demand", "newact", "coord"],
    spot: [0.66, 0.78],
    note: "[people and pay both running ahead of the typical metro — they move together, so the question is what the demand is running into]",
  },
  {
    id: "q2",
    dx: 1,
    dy: -1,
    name: "Sponge",
    shock: "Positive supply shock",
    sub: "population ↑ · wages ↓",
    path: ["supply", "col", "housing"],
    spot: [0.68, -0.75],
    note: "[arrivals outrun the pay — people and pay move apart, so the question is what living here costs and offers]",
  },
  {
    id: "q3",
    dx: -1,
    dy: -1,
    name: "Leak",
    shock: "Negative demand shock",
    sub: "population ↓ · wages ↓",
    path: ["demand", "existing", "external"],
    spot: [-0.68, -0.75],
    note: "[jobs and pay fall together — check ___ for the industry taking the hit]",
  },
  {
    id: "q4",
    dx: -1,
    dy: 1,
    name: "Fortress",
    shock: "Negative supply shock",
    sub: "population ↓ · wages ↑",
    path: ["supply", "col", "housing"],
    spot: [-0.66, 0.78],
    note: "[population ↓ while wages ↑ — people and pay move apart, so the fork goes to the labor supply branch]",
  },
];

export const QUADRANTS: QuadrantDef[] = QUADRANT_DEFS.map((q) => ({
  ...q,
  side: quadSide(q.dx, q.dy),
}));

/** Fallback quadrant when a city has no data at all (population ↓ · wages ↑). */
export const PLACE_QUAD: QuadrantDef = QUADRANTS.find((q) => q.id === "q4")!;

/* ---------- the diagnosis: which leaf the data argues for ----------
 *  The live tool's forking logic (cities-tool, src/lib/diagnosis.ts —
 *  classifyPlace, readDemand, classifySupply; argued in
 *  docs/diagnosis-logic.html), restated here. Each fork is one comparison
 *  against the median metro IN THE CITY'S OWN COUNTRY, and the suggested
 *  descent is DERIVED rather than hardcoded per city, so swapping the sample
 *  cities (or the window behind the data) re-runs the diagnostic instead of
 *  going stale.
 *
 *    fork 1   the PLACE's population growth and wage growth, each against
 *             the country's median metro — the dashed lines the plane
 *             draws. Both above, or both below → demand (people and pay
 *             moving together). One above and one below → supply (moving
 *             apart). The quadrant names the shock.
 *    fork 2   if demand: the METRO's population growth — and only that, not
 *    (demand)  the metro's pay — against the median metro's. Below it →
 *             metro-wide: a place is not only its own export base, and a
 *             labor market that isn't growing can hold it back. At or
 *             above → place-specific. The metro's OWN quadrant then says
 *             why (see DemandRead).
 *    fork 2   if supply: cost-of-living growth — home values in the US,
 *    (supply)  rents in Mexico — against the median. At or above → cost,
 *              which is what being priced out looks like. Below →
 *              amenities: "priced out" is hard to sustain, and the other
 *              supply lever is the pull of the place itself. The plane's Y
 *              axis moves to price growth for this read; its split lines
 *              stay put, and the price axis is a TWO-way split, not four
 *              quadrants ("supply shock" is a statement about population ×
 *              pay and does not survive swapping the axis). */

export interface ForkStep {
  /** which fork this is, for the rail's step list */
  fork: "root" | "branch";
  /** the comparison in words, with the numbers that decided it */
  reason: string;
}

export interface Diagnosis {
  /** the descent below the root, on the ALT structure */
  path: string[];
  steps: ForkStep[];
  /** false when the city has no data and the fallback quadrant was used */
  derived: boolean;
}

const pct = (v: number) =>
  `${Math.abs(v) < 0.05 ? "" : v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%/yr`;

export function diagnose(cityShort: string, country = USA): Diagnosis {
  const place = homePlace(cityShort);
  if (!place)
    return {
      path: convertPath(PLACE_QUAD.path, "alt"),
      steps: [],
      derived: false,
    };

  const med = countryMedians(country);
  /* "above" throughout means at or above: the forks split below/at-or-above,
     so a value sitting exactly on the median counts as the healthy side */
  const popBelow = place.pop < med.pop;
  const wageBelow = place.wage < med.wage;
  const together = popBelow === wageBelow;

  const steps: ForkStep[] = [
    {
      fork: "root",
      reason: together
        ? `Population ${pct(place.pop)} and pay ${pct(place.wage)} are both ${popBelow ? "below" : "above"} the median metro (${pct(med.pop)}, ${pct(med.wage)}) — people and pay move together, which is a demand story.`
        : `Population ${pct(place.pop)} is ${popBelow ? "below" : "above"} the median metro (${pct(med.pop)}) while pay ${pct(place.wage)} is ${wageBelow ? "below" : "above"} it (${pct(med.wage)}) — people and pay move apart, which is a supply story.`,
    },
  ];

  if (together) {
    const dr = demandRead(cityShort, country);
    steps.push({
      fork: "branch",
      reason: dr
        ? `Metro population ${pct(dr.popCagr)} against the median metro's ${pct(dr.popMedian)}: ${dr.side === "metro" ? "below it, so MSA-wide" : "at or above it, so admin-specific"}.`
        : "[no metro data for this city — the sub-fork falls back to admin-specific]",
    });
    return {
      path: ["demand", dr?.side === "metro" ? "metrowide" : "placespec"],
      steps,
      derived: true,
    };
  }

  const measure = costMeasure(country);
  const sr = supplyRead(cityShort, country);
  steps.push({
    fork: "branch",
    reason: sr
      ? `${measure.sentenceCase} ${pct(sr.costCagr)} against the median's ${pct(sr.costMedian)}: ${sr.side === "cost" ? "at or above it, so housing" : "below it, so amenities"}.`
      : `[no ${measure.lower} data for this city — the sub-fork falls back to cost]`,
  });
  return {
    path: ["supply", sr?.leaf ?? "amen"],
    steps,
    derived: true,
  };
}

/** the quadrant a (population, wage) pair falls in against a country's
 *  medians — the cut fork one makes on the city, reused by the demand fork
 *  to read the MSA on that same plane. "Above" means at-or-above: a value
 *  sitting exactly on the median counts as the healthy side. */
export const quadOf = (
  pop: number,
  wage: number,
  med: { pop: number; wage: number },
): QuadSide => {
  const popUp = pop >= med.pop;
  const wageUp = wage >= med.wage;
  return popUp && wageUp
    ? "demandpos"
    : !popUp && !wageUp
      ? "demandneg"
      : popUp
        ? "supplypos"
        : "supplyneg";
};

/** the sign-aware quadrant branch the city's own dials argue for — which the
 *  lossy demand→demandpos alias in CROSS_VARIANT cannot recover */
export function quadSideOf(cityShort: string, country = USA): BranchSide {
  const place = homePlace(cityShort);
  if (!place) return "supplyneg"; // the fallback quadrant (PLACE_QUAD, q4)
  return quadOf(place.pop, place.wage, countryMedians(country));
}

/* ---------- the second forks' reads ----------
 *  The live tool's two second-fork reads (cities-tool: readDemand and
 *  classifySupply), one per family of shock. Both are read off the SAME
 *  plane fork one used — that is the point of the instrument: the demand
 *  fork looks at a different MARK on it (the metro instead of the place),
 *  the supply fork at a different Y AXIS (price growth instead of pay). */

export type DemandSide = "metro" | "place";

export interface DemandRead {
  side: DemandSide;
  /** the metro's population growth, and the median metro's it is read
   *  against — the two numbers the fork turned on */
  popCagr: number;
  popMedian: number;
  /** the stronger, absolute statement, carried separately: a metro can lag
   *  the field while still growing */
  shrinking: boolean;
  /** the metro's OWN quadrant, which says why it is growing or not — and so
   *  which sentence follows the fork */
  metroQuad: QuadSide;
  /** the subtle path: a metro-wide shortfall whose metro is itself
   *  SUPPLY-bound (pay running ahead of people — a wall rather than a
   *  slump). Which kind of wall is then a question about the METRO, so it
   *  is answered with the metro's own price growth, and the supply branch
   *  is offered as a second exit. Null everywhere else. */
  metroSupply: SupplyRead | null;
}

export function demandRead(
  cityShort: string,
  country = USA,
): DemandRead | null {
  const metro = homeMsa(cityShort);
  if (!metro) return null;
  const med = countryMedians(country);
  const side: DemandSide = metro.pop < med.pop ? "metro" : "place";
  const metroQuad = quadOf(metro.pop, metro.wage, med);
  return {
    side,
    popCagr: metro.pop,
    popMedian: med.pop,
    shrinking: metro.pop < 0,
    metroQuad,
    metroSupply:
      side === "metro" && metroQuad === "supplyneg" && metro.home != null
        ? supplySplit(metro.home, med.cost, "metro")
        : null,
  };
}

export type SupplySide = "cost" | "amenity";

export interface SupplyRead {
  side: SupplySide;
  /** cost-of-living growth over the window, and the median it is read
   *  against — the two numbers the fork turned on */
  costCagr: number;
  costMedian: number;
  /** the grain the measure was read at: the place where the country
   *  publishes one, else the metro */
  grain: "place" | "metro";
  /** the supply leaf this side routes to */
  leaf: "col" | "amen";
}

/** at or above the median → cost; below → amenity (the live tool's
 *  `mine >= med ? 'cost' : 'amenity'`) */
const supplySplit = (
  growth: number,
  median: number,
  grain: "place" | "metro",
): SupplyRead => {
  const side: SupplySide = growth >= median ? "cost" : "amenity";
  return {
    side,
    costCagr: growth,
    costMedian: median,
    grain,
    leaf: side === "cost" ? "col" : "amen",
  };
};

/** the supply fork's read, at place grain where the series exists and
 *  falling back to the metro's where it does not */
export function supplyRead(
  cityShort: string,
  country = USA,
): SupplyRead | null {
  const med = countryMedians(country);
  const cost = placeCost(cityShort);
  if (cost) return supplySplit(cost.growth, med.cost, "place");
  const metro = homeMsa(cityShort);
  return metro?.home != null
    ? supplySplit(metro.home, med.cost, "metro")
    : null;
}

/** Which leaf of the forked quadrant tree a shock branch lands on. The
 *  second fork belongs to the FAMILY of shock, as in the live tool: a demand
 *  shock reads the metro (demandRead), a supply shock reads price growth
 *  (supplyRead) — whatever the shock's sign. The positive demand shock has
 *  no second layer (team revision, Sept 2026): its head is the ending, so it
 *  answers null. */
export function quadLeaf(
  side: BranchSide,
  cityShort: string,
  country = USA,
): string | null {
  const sub = diagnose(cityShort, country).path[1];
  switch (side) {
    case "demandneg":
      return sub === "placespec" ? "dn-local" : "dn-regional";
    case "demandpos":
      return null;
    case "supplypos":
      return sub === "amen" ? "sp-amen" : "sp-col";
    default:
      return sub === "amen" ? "sn-amen" : "sn-col";
  }
}

/** the diagnosed descent, told on whichever structure is being shown */
export const suggestedPath = (
  cityShort: string,
  variant: TreeVariant = "full",
): string[] => {
  /* the quadrant structures need the SIGN of the shock, which the alt path
     does not carry — they derive it from the dials, then run the branch's
     own instrument */
  if (variant === "quad") return [quadSideOf(cityShort)];
  if (variant === "quad2") {
    const side = quadSideOf(cityShort);
    const leaf = quadLeaf(side, cityShort);
    /* a branch with no second layer ends at its head */
    return leaf ? [side, leaf] : [side];
  }
  const alt = diagnose(cityShort).path;
  return variant === "alt" ? alt : convertPath(alt, variant);
};

/** A selection must name a FULL route — the section that follows navigates to
 *  a leaf, so a pick on an inner node completes downward: follow whichever
 *  child continues an already-marked path (the current pick first, then the
 *  data-driven suggestion), else the leftmost child. */
export function completeToLeaf<
  N extends { data: TreeNodeData; children?: N[] },
>(node: N, preferred: string[][]): N {
  let n = node;
  while (n.children?.length) {
    const kids = n.children;
    n =
      preferred
        .map((ids) => kids.find((c) => ids.includes(c.data.id)))
        .find(Boolean) ?? kids[0];
  }
  return n;
}

/** Node titles and sibling order follow the figure exactly (left → right). */
export const TREE_NODES: TreeNodeData[] = [
  {
    id: "root",
    title: TREE_ROOT_QUESTION,
    detail:
      "The root question, verbatim. Which emphasis matters — better, more inclusive, higher, or more resilient — varies with the city's case. The tree maps the logical progression from that question to the potential binding constraints, and progressing down any branch requires evidence that rules out the alternatives.",
    example:
      "Cali asked about current growth, Ciudad del Carmen about resilience, Savannah about inclusion, Bangalore about future growth.",
  },
  {
    id: "demand",
    parent: "root",
    title: "Labor Demand",
    detail:
      "Constraints that most affect firms — the city's ability to produce and sell tradables. The demand for a city's exports determines the labor demanded in both the tradable and non-tradable sectors. This branch splits into low diversification into new activities and low growth of existing industries.",
  },
  {
    id: "supply",
    parent: "root",
    title: "Labor Supply",
    detail:
      "Constraints that most affect residents' willingness to live and work in the city — its workforce is determined by what living there costs and what living there is like. The branch separates cost of living from amenities.",
  },
  {
    id: "newact",
    parent: "demand",
    title: "Low diversification into new activities",
    detail:
      "The city cannot move into the adjacent possible: new industries its know-how could support never emerge. Research links a city's growth strongly to its capacity to create new industries and activities.",
  },
  {
    id: "existing",
    parent: "demand",
    title: "Low growth of existing industries",
    detail:
      "The city's present tradable activities are struggling. Two suspects: external shocks arriving from outside, or production inputs the city fails to provide.",
  },
  {
    id: "coord",
    parent: "newact",
    title: "Coordination problems",
    detail:
      "Chicken-and-egg failures: a new industry needs suppliers, trained workers, and specialized infrastructure that only appear once the industry exists. Nobody profitably moves first, so the diversification the city's know-how could support never happens.",
    example:
      "The serendipity workaround is to move brains in — Microsoft to Seattle, Walmart to Bentonville.",
    tests:
      "Magnetic fields: do capable firms look at the city and then locate elsewhere?",
  },
  {
    id: "external",
    parent: "existing",
    title: "External shocks",
    detail:
      "Global industry trends, technological change, natural disasters, national demographics — forces no city controls. Shift-share (Bartik) analysis helps disentangle local dynamics from external ones. The policy answer is not to reverse the shock but to build resilience by diversifying the export base.",
    example:
      "Detroit's single-industry exposure; Acapulco and natural disasters; Japan and aging.",
    tests: "Changes in changes: did city growth move when the shock hit?",
  },
  {
    id: "inputs",
    parent: "existing",
    title: "Production inputs",
    detail:
      "Inputs firms need but cannot buy at any reasonable price. The tree splits them by reach: horizontal inputs hit every firm, vertical inputs are specific to an industry.",
    tests:
      "High shadow prices, queues and wait times; bypassing (a generator in every courtyard); camels and hippos — do the surviving firms barely use the scarce input?",
  },
  {
    id: "horizontal",
    parent: "inputs",
    title: "Horizontal inputs",
    detail:
      "Inputs every firm uses, whatever it makes: permitting, roads, land and commercial space, electricity, waste collection. When one is scarce, the whole export base pays for it.",
  },
  {
    id: "vertical",
    parent: "inputs",
    title: "Vertical inputs",
    detail:
      "Industry-specific inputs — power for smelters, water for chip fabs, specialized regulation or facilities. Scarcity chokes one industry while its neighbors barely notice.",
  },
  {
    id: "col",
    parent: "supply",
    title: "Cost of Living",
    detail:
      "The pay is fine; the deal is not — housing and commuting eat the wage. Which of the two depends on whether housing prices are rising: if they are, suspect housing; if people simply cannot reach the jobs, suspect transportation. The two are deeply intertwined.",
  },
  {
    id: "amen",
    parent: "supply",
    title: "Amenities",
    detail:
      "What makes a place attractive on top of what it costs. The figure's own examples: recreational services like restaurants; the natural environment, such as parks, public spaces or climate; and other services such as education, childcare or public safety. Amenities are hard to quantify, but a city gets unattractive when public goods are poor, natural conditions are unfavorable, or recreation is scarce.",
    example:
      "Flint after the water crisis: rising wages, falling home values, outmigration.",
    tests: "Magnetic fields, plus a falling revealed premium for living there.",
  },
  {
    id: "housing",
    parent: "col",
    title: "Housing",
    detail:
      "Inelastic housing supply — FAR limits, height caps, parking minimums, missing trunk infrastructure — turns growth into prices instead of people. The boom arrives, the cranes do not, and rent eats the wage gain.",
    example:
      "San Francisco's restrictive zoning; slums where formal supply cannot respond.",
    tests:
      "High price with low quantity: are prices rising while little gets built?",
  },
  {
    id: "transport",
    parent: "col",
    title: "Transportation",
    detail:
      "Congestion shrinks the effective labor market: the jobs exist but cannot be reached within a livable commute, so workers and firms match badly. Distorted urban form makes this worse, and it feeds back into housing costs.",
    example:
      "Nairobi, where driving speeds sharply cut the number of reachable jobs.",
    tests:
      "Bypassing: informal transit, moving next to the job, employer-run buses.",
  },
];

/* ---------- the alt structure ---------- */

const nodeById = new Map(TREE_NODES.map((n) => [n.id, n]));

/** Alternate tree: the root fork is unchanged, then each side goes straight
 *  to two leaves — demand → metro-wide/place-specific, supply →
 *  housing/amenities. The root is reused verbatim; the two branch heads keep
 *  their ids and titles but restate their closing sentence, which in the
 *  paper tree names the children THAT tree has (new activities / existing
 *  industries, cost of living / amenities) and would otherwise describe a
 *  fork the reader cannot see here. The supply and amenities leaves keep
 *  their ids too, so a pick survives the variant switch, and reparent to the
 *  branch head; the two demand leaves are new. */
export const TREE_NODES_ALT: TreeNodeData[] = [
  nodeById.get("root")!,
  {
    ...nodeById.get("demand")!,
    detail:
      "Constraints that most affect firms — the city's ability to produce and sell tradables. The demand for a city's exports determines the labor demanded in both the tradable and non-tradable sectors. This branch splits by how far the trouble reached: a metro-wide shock, or one specific to the place.",
  },
  {
    ...nodeById.get("supply")!,
    detail:
      "Constraints that most affect residents' willingness to live and work in the city — its workforce is determined by what living there costs and what living there is like. The branch separates housing from amenities.",
  },
  {
    id: "metrowide",
    parent: "demand",
    title: "Metro-wide shock",
    detail:
      "People and pay move together, and the surrounding metro is not growing either — so whatever hit demand reached past the city limits. The city is sharing a regional decline rather than suffering one of its own.",
    tests:
      "Is the metro's population growth below the median metro's? The metro's pay is not part of this fork — population alone says whether the wider labor market is growing.",
  },
  {
    id: "placespec",
    parent: "demand",
    title: "Place-specific shock",
    detail:
      "People and pay move together, but the surrounding metro is growing — demand is being lost inside the city while the region around it does fine. That points at something the city itself controls.",
    tests:
      "Is the metro's population growth at or above the median metro's, while the place's is not?",
  },
  /* This leaf keeps the full tree's Cost of Living NODE ID, so a pick
     round-trips between the two structures (supply/col/housing ⇄
     supply/col). It is TITLED Housing, though: the alt fork tests housing
     cost alone — home values in the US, rents in Mexico — with no
     transportation branch under it, and Housing is what the fork's own
     question ("home values climbing faster than the typical metro?"), its
     evidence chip and the diagnostic-pathway explainer all call that answer.
     Only the full tree, where Cost of Living really does fork into Housing
     and Transportation, still carries the broader name. */
  {
    ...nodeById.get("col")!,
    parent: "supply",
    title: "Housing",
    detail:
      "People and pay move apart — they are leaving while pay climbs — and housing is climbing faster than the typical metro. The wage gain is being taken back at the door.",
    tests:
      "Is housing-cost growth above the median metro's? Home values are the measure in the US, rents in Mexico.",
  },
  {
    ...nodeById.get("amen")!,
    parent: "supply",
    tests:
      "Cost-of-living growth at or below the median metro's — the priced-out story does not hold, so the fading pull is something else.",
  },
];

/* ---------- the alt structure, plus a third branch ----------
 *  A LAYOUT study, not a proposal about the diagnostic: the alt tree exactly
 *  as above, with one more branch hanging off the root — something that is
 *  neither labor demand nor labor supply. What that branch would BE has not
 *  been decided, so it and its two leaves are bracketed placeholders; the
 *  question this variant asks is how the tree reads and lays out with an odd
 *  number of branches — three arrows off the root, six leaves across the
 *  bottom row — not what the third one says.
 *
 *  It is appended rather than slotted between the existing two, so demand
 *  and supply stay adjacent and keep their sibling order, and every id in
 *  those subtrees is unchanged: a pick still round-trips through
 *  convertPath() into either other structure. Nothing DIAGNOSES into this
 *  branch — diagnose() knows only the two forks — so it is reachable by
 *  clicking it and by nothing else, which is the right behaviour for a
 *  branch with no test behind it yet. */
export const TREE_NODES_ALT3: TreeNodeData[] = [
  ...TREE_NODES_ALT,
  {
    id: "third",
    parent: "root",
    title: "[Third branch]",
    detail:
      "[a third branch off the root, neither labor demand nor labor supply — what it asks, and why the growth question forks three ways instead of two, to be written]",
    tests: "[the comparison that would send a city down this branch]",
  },
  {
    id: "third1",
    parent: "third",
    title: "[First leaf]",
    detail: "[the first answer under the third branch]",
    tests: "[what you would read to land here]",
  },
  {
    id: "third2",
    parent: "third",
    title: "[Second leaf]",
    detail: "[the second answer under the third branch]",
    tests: "[what you would read to land here]",
  },
];

/* ---------- the four-quadrant structure ----------
 *  One fork and then nothing: the quadrant a city lands in on the population
 *  × wage plane IS the diagnosis, so every branch is also a leaf. The four
 *  are the paper's own four shock readings (see QUADRANT_DEFS), promoted from
 *  a label on the chart to a branch of the tree, and titled with the
 *  landing's city types (QUAD_NAME) — the shock each one is stays in its
 *  detail. Nothing here is a placeholder — the structure is a real proposal,
 *  just a flatter one. */
export const TREE_NODES_QUAD: TreeNodeData[] = [
  nodeById.get("root")!,
  {
    id: "demandpos",
    parent: "root",
    title: "Magnet",
    detail:
      "Population and pay are both running ahead of the typical metro. Demand for what the city sells is growing; the question is what that demand is running into.",
    tests: "Population growth and wage growth both above the median metro's.",
  },
  {
    id: "supplypos",
    parent: "root",
    title: "Sponge",
    detail:
      "People are arriving faster than pay is rising — the city got easier to live in or cheaper to live in, and labor supply moved before labor demand did.",
    tests: "Population growth above the median metro's, wage growth below it.",
  },
  {
    id: "demandneg",
    parent: "root",
    title: "Leak",
    detail:
      "Population and pay are falling together. Something took demand out of the city's export base, and the labor market shrank with it.",
    tests: "Population growth and wage growth both below the median metro's.",
  },
  {
    id: "supplyneg",
    parent: "root",
    title: "Fortress",
    detail:
      "Pay is climbing while people leave — the city is holding its demand but losing its workforce, so what living there costs or offers is the suspect.",
    tests: "Population growth below the median metro's, wage growth above it.",
  },
];

/* ---------- the four-quadrant structure, FORKED ----------
 *  Each shock keeps its own OVERARCHING QUESTION (the team's revision spec,
 *  Sept 2026), and all but the positive demand shock fork once more. The
 *  second forks are the LIVE TOOL'S (cities-tool, DiagnosisTree.tsx): they
 *  belong to the family of shock, not its sign —
 *
 *    a demand shock   is the shortfall the metro's, or the place's own?
 *                     Read off where the METRO sits against the field.
 *    a supply shock   is the wall the cost of living, or is it amenities?
 *                     Read off price growth against the field.
 *
 *  The four shock nodes are reused verbatim; the six leaves carry ids
 *  prefixed by branch, so the two housing/amenities pairs stay distinct
 *  nodes. The demand leaves are titled in this app's own geography words —
 *  the MSA and the admin city, as the diagnostic-pathway explainer has them —
 *  for the live tool's "Metro-wide" and "Place-specific". The positive
 *  demand shock has no second layer — its head is the ending, and the
 *  analysis opens straight on its modules. */
export const TREE_NODES_QUAD2: TreeNodeData[] = [
  ...TREE_NODES_QUAD,
  {
    id: "dn-regional",
    parent: "demandneg",
    title: "MSA-wide",
    detail:
      "[placeholder: the metro is not growing either. the constraint sits at metro level]",
    tests: "[metro population growth below the median metro's]",
  },
  {
    id: "dn-local",
    parent: "demandneg",
    title: "Admin-specific",
    detail:
      "[placeholder: the metro is growing. the constraint is specific to the admin city]",
    tests: "[metro population growth at or above the median metro's]",
  },
  {
    id: "sp-col",
    parent: "supplypos",
    title: "Housing",
    detail:
      "[placeholder: home values rising faster than average. look at housing]",
    tests: "[home-value growth at or above the median]",
  },
  {
    id: "sp-amen",
    parent: "supplypos",
    title: "Amenities",
    detail:
      "[placeholder: home values rising slower than average. look at amenities]",
    tests: "[home-value growth below the median]",
  },
  {
    id: "sn-col",
    parent: "supplyneg",
    title: "Housing",
    detail:
      "[placeholder: home values rising faster than average. people are priced out]",
    tests: "[home-value growth at or above the median]",
  },
  {
    id: "sn-amen",
    parent: "supplyneg",
    title: "Amenities",
    detail:
      "[placeholder: home values rising slower than average. not priced out, so amenities]",
    tests: "[home-value growth below the median]",
  },
];

/** The per-branch layer that is NOT another tree level: each shock's
 *  overarching question (the team's spec), and its second fork stated with
 *  its instrument — a placeholder naming the comparison, since the copy is
 *  still to be written. Read by the analysis section, which leads with the
 *  question and names the fork the reader came down. (The modules shown at
 *  the end of a branch are a separate table — LEAF_MODULES — keyed by the
 *  ending, not the shock.) */
export interface QuadBranchSpec {
  /** the overarching question the branch's analysis opens on */
  question: string;
  /** the fork and the instrument that decides it, in one line — absent on a
   *  shock with no second layer (the positive demand shock) */
  forkLine?: string;
}
const DEMAND_FORK =
  "[placeholder: fork two. metro population growth vs the median metro]";
const SUPPLY_FORK = "[placeholder: fork two. home-value growth vs the median]";
export const QUAD_BRANCH_SPEC: Partial<Record<BranchSide, QuadBranchSpec>> = {
  demandneg: { question: "What is my demand constraint?", forkLine: DEMAND_FORK },
  /* no second layer on the positive demand shock (team revision, Sept 2026):
     the quadrant is the diagnosis, and the analysis opens straight on the
     head's own modules */
  demandpos: { question: "What are threats to future growth?" },
  supplyneg: { question: "What is my supply constraint?", forkLine: SUPPLY_FORK },
  supplypos: { question: "Is it sustainable?", forkLine: SUPPLY_FORK },
};

export const treeNodes = (variant: TreeVariant): TreeNodeData[] =>
  variant === "quad"
    ? TREE_NODES_QUAD
    : variant === "quad2"
      ? TREE_NODES_QUAD2
      : variant === "full"
        ? TREE_NODES
        : variant === "alt3"
          ? TREE_NODES_ALT3
          : TREE_NODES_ALT;

/** every root→leaf descent (ids below the root) of a variant, figure order */
function leafPaths(variant: TreeVariant): string[][] {
  const nodes = treeNodes(variant);
  const out: string[][] = [];
  const walk = (id: string, trail: string[]) => {
    const kids = nodes.filter((n) => n.parent === id);
    if (!kids.length) out.push(trail);
    else kids.forEach((k) => walk(k.id, [...trail, k.id]));
  };
  walk("root", []);
  return out;
}

/** Nodes that say the same thing on the other structure but under a
 *  different name. Housing and amenities need no entry — they keep their ids
 *  across both trees — but the two demand leaves are alt-only, and without
 *  these a demand pick would land on whichever route happens to be leftmost. */
const CROSS_VARIANT: Record<string, string[]> = {
  /* the shock reached past the city limits ⇄ forces no city controls — and,
     on the forked quadrant tree, the regional read of a negative demand
     shock */
  metrowide: ["external", "dn-regional"],
  external: ["metrowide"],
  /* the city is not generating demand its region manages to ⇄ the city
     cannot move into the adjacent possible */
  placespec: ["coord", "dn-local"],
  coord: ["placespec"],
  "dn-regional": ["metrowide"],
  "dn-local": ["placespec"],
  /* the four-quadrant branches carry the demand/supply split inside them, so
     a pick there lands on the matching side of every other structure. The
     reverse is a choice rather than a fact — a plain "demand" read does not
     say which SIGN of demand shock it is — so it resolves to the positive
     one and the reader re-picks if they meant the other. */
  demandpos: ["demand"],
  demandneg: ["demand"],
  supplypos: ["supply"],
  supplyneg: ["supply"],
  demand: ["demandpos"],
  supply: ["supplypos"],
  /* the forked quadrant tree's housing/amenities pairs are the alt tree's
     own leaves, one per supply sign — either way round they say the same
     thing */
  col: ["sp-col", "sn-col"],
  amen: ["sp-amen", "sn-amen"],
  "sp-col": ["col"],
  "sn-col": ["col"],
  "sp-amen": ["amen"],
  "sn-amen": ["amen"],
};

/** carry a pick across the variant switch: of the target variant's full
 *  routes, take the one sharing the most node ids with the old path — its
 *  own ids or their cross-variant aliases (leftmost on ties), so
 *  supply/col/housing ⇄ supply/housing and demand/metrowide ⇄
 *  demand/existing/external both round-trip. */
export function convertPath(path: string[], variant: TreeVariant): string[] {
  const want = new Set(
    path.flatMap((id) => [id, ...(CROSS_VARIANT[id] ?? [])]),
  );
  const score = (p: string[]) => p.filter((id) => want.has(id)).length;
  return leafPaths(variant).reduce((best, p) =>
    score(p) > score(best) ? p : best,
  );
}

/* ---------- modules: what to look into once the tree is walked ----------
 *  A module is a theme that groups the data points worth reading at the end
 *  of a branch — the analysis section's content once a leaf is reached
 *  (team revision, Sept 2026). Modules are NOT another level of the
 *  diagnostic and NOT verdicts: none says "this is definitively the
 *  problem". They are an overview of where to look, and which ones are
 *  shown depends on the branch taken (LEAF_MODULES). Most are reached from
 *  several endings, so they live in a flat registry keyed by id and are
 *  referenced from wherever they are reached. (Two module ids share a name
 *  with a tree node — inputs, demand — but they are separate namespaces;
 *  nothing keys across the two, and the shared glyph is deliberate.)
 *
 *  WHAT IS ALREADY DRAWN. A data point that carries a `chart` is one the
 *  Growth Lab's tools already have data for, and the analysis section draws
 *  it. Two sources, and only where they answer a data point the TEAM'S SPEC
 *  lists (Sept 2026, the user's call — the modules are the spec's, and a
 *  tool's chart earns a place by being one of their data points, not by
 *  existing):
 *    - the live tool's Drivers section (cities-tool, src/components/story/
 *      DriversSection.tsx) — the shift-share waterfall and the industry
 *      effects for the spec's shift-share and market-share points, the
 *      price map and the cost trend for its two housing-price points;
 *    - the Amenities Module (cities.taimur.sh/tools/amenities-module.html)
 *      — education, crime, job accessibility, air quality and urban
 *      vitality, for five of the spec's six Amenities points;
 *    - the Innovation Module (cities.taimur.sh/tools/innovation-module.html)
 *      — firm entry and exit, patents and publications per resident with
 *      their RCAs, for the spec's three Innovation points (its annual
 *      lines and output-against-population fits answer none, and stay
 *      on the page).
 *  Drivers' own AMENITY story — the amenity-residual map, the metro's
 *  residual drift and the places net of their metro — was drawn here for a
 *  while and is gone: the residual (home value not explained by pay) is a
 *  measure the spec's Amenities module never asks for.
 *  The COPY is never the tools': `read` is a one-line bracketed placeholder
 *  naming what the step's copy will cover, nothing more. A data point the
 *  spec lists and no source draws yet carries `chart: "placeholder"` and a
 *  `placeholder` spec — the chart FORM its data type and signal call for,
 *  drawn from a seed with no axis carrying a value (placeholderCharts.tsx)
 *  and tagged as such in its well — so every data point is a card, and the
 *  shape of what is still to come is legible. */

/** the level a module's data is read at — the MSA, the admin city, or both */
export type DataLevel = "msa" | "admin" | "both";
export const DATA_LEVEL_LABEL: Record<DataLevel, string> = {
  msa: "MSA-Level Data",
  admin: "Admin-Level Data",
  both: "MSA + Admin Data",
};

/** which chart a data point is — the live tool's Drivers charts
 *  (driverCharts.tsx), the Amenities Module's indicators
 *  (amenityCharts.tsx) and the Innovation Module's (innovationCharts.tsx) */
export type ChartKind =
  /** ShiftShareWaterfall: start → national → industry mix → local share →
   *  new industries → end */
  | "waterfall"
  /** IndustryEffectViews: treemap / ranked bars / share paths, switchable */
  | "effectViews"
  /** NewIndustriesTreemap: what the metro built up from nothing */
  | "newIndustries"
  /** MsaPlacesChoropleth, filled by price growth */
  | "priceMap"
  /** MsaCostTrend: the metro, the median metro and the place, over time */
  | "costTrend"
  /* ---- the Amenities Module's indicators ---- */
  /** school achievement against the national average, place and metro */
  | "education"
  /** the crime-cost index, % of the national figure, place and metro */
  | "crime"
  /** jobs reachable by car in 15 / 30 / 60 minutes, with the place's ranks */
  | "jobAccess"
  /** EPA's AQI by month, place and metro, against the health categories */
  | "airQuality"
  /** establishments per 1,000 residents against the national rate */
  | "vitality"
  /* ---- the Innovation Module's indicators ---- */
  /** firm entry against exit, every metro, the all-metro cross and the
   *  four quadrants */
  | "firmCreation"
  /** patent families per resident among all metros, and RCA by IPC
   *  section / subclass */
  | "patents"
  /** publications per resident among all metros, and RCA by field /
   *  concept */
  | "publications"
  /** no source yet: the form in the view's `placeholder` spec, seeded */
  | "placeholder";

/** the chart forms a placeholder can take (placeholderCharts.tsx) — each
 *  the form a data type and signal call for */
export type PlaceholderForm =
  /** one value among all metros or places, read high / low */
  | "histogram"
  /** a rank over time, read up / down — 1 at the top */
  | "rankLine"
  /** two measures across every metro, with the fit */
  | "scatter"
  /** one measure per 2-digit sector, the city against its MSA */
  | "sectorScatter"
  /** one share per 2-digit sector, city and MSA side by side */
  | "dumbbell"
  /** two series over time */
  | "lines"
  /** tradable industries × inputs, an earlier and the latest window */
  | "heatmap"
  /** one scalar per metro, ranked, the MSA lit */
  | "rankColumns"
  /** a measure across the city's tracts */
  | "map";

export interface PlaceholderSpec {
  form: PlaceholderForm;
  /** the measure on the x axis (or the one measure), in the data point's
   *  own terms */
  x?: string;
  /** the measure on the y axis */
  y?: string;
  /** the two series' names — "{city}" stands for the city the section is
   *  about */
  series?: [string, string];
  /** what the histogram counts: "metros" (default) or "places" */
  among?: string;
  /** which way a scatter's fit runs: 1 rising, -1 falling */
  slope?: 1 | -1;
}

/** one data point of a module */
export interface ModuleView {
  name: string;
  /** the card's one line of copy: what the data point shows, the main
   *  idea only (plain text since Sept 2026 — no brackets, no prefix) */
  read?: string;
  /** one more plain sentence, shown only at the section's full width */
  more?: string;
  /** the chart this is — a source's, or "placeholder" for a data point no
   *  source draws yet */
  chart?: ChartKind;
  /** the placeholder's form and labels, where `chart` is "placeholder" */
  placeholder?: PlaceholderSpec;
  /** what to read off it — the spec's "signal", where it gave one */
  signal?: string;
  /** set where this view's data level differs from its module's */
  level?: DataLevel;
  /** a condition on the step, in the live tool's own terms — one plain
   *  line under the copy */
  note?: string;
}

export interface ModuleDef {
  id: string;
  title: string;
  level: DataLevel;
  /** the question the module helps answer, in the spec's own words — absent
   *  where the spec listed the data points but not the question */
  question?: string;
  /** the data points: the live tool's steps first, in its order, then the
   *  spec's remaining ones */
  views: ModuleView[];
}

/* the live tool's steps, written once — several modules reach the same one */
const STEP_WATERFALL: ModuleView = {
  name: "Shift-share waterfall",
  read: "What grew the jobs: the national trend, the industry mix and local performance.",
  more: "The local share is what the metro did on its own, once the national trend and its mix of industries are taken out.",
  chart: "waterfall",
  signal: "local share + or −",
  level: "msa",
};
const STEP_EFFECTS: ModuleView = {
  name: "Industry effects: ranked bars, share paths, treemap",
  read: "Which industries drove it, and each one's share of the national industry over time.",
  more: "A sector that grows slower here than it does nationally is losing market share, even if its job count is up.",
  chart: "effectViews",
  signal: "market share high or low? any breaks in the series?",
  level: "msa",
};
const STEP_NEW: ModuleView = {
  name: "New industries treemap",
  read: "Industries new to the metro over the window.",
  more: "Industries with no jobs in the metro at the start of the window and some at the end.",
  chart: "newIndustries",
  note: "Shown only when material.",
  level: "msa",
};
const STEP_PRICE_MAP: ModuleView = {
  name: "Home-value growth map",
  read: "Where home values rose fastest within the metro, and where the city sits.",
  more: "Each place is shaded by how fast its home values grew over the window.",
  chart: "priceMap",
  signal: "up / down",
  level: "both",
};
const STEP_COST_TREND: ModuleView = {
  name: "Home values over time",
  read: "Home values over time for the city, its MSA and the median metro.",
  more: "A city rising faster than the median metro is getting expensive faster than most.",
  chart: "costTrend",
  signal: "up / down",
  level: "both",
};
/* no source yet: a placeholder, in both housing modules */
const STEP_ELASTICITY: ModuleView = {
  name: "Housing supply elasticity",
  read: "How much housing supply responds to prices, against all metros.",
  more: "A low number means building does not keep up when prices rise.",
  chart: "placeholder",
  placeholder: { form: "rankColumns", y: "supply elasticity" },
};

export const MODULES: Record<string, ModuleDef> = {
  /* the live tool's INDUSTRY story — where both demand branches exit: the
     sub-fork changes what the reader is told, not what they are shown */
  shocks: {
    id: "shocks",
    title: "Shocks",
    level: "msa",
    question:
      "Did you face an external shock, or is something wrong within your MSA? Which industries drove the shock?",
    views: [STEP_WATERFALL, STEP_EFFECTS, STEP_NEW],
  },
  inputs: {
    id: "inputs",
    title: "Inputs",
    level: "msa",
    question:
      "Are my tradable industries intense in certain inputs, over time?",
    views: [
      {
        name: "Rajan-Zingales (inputs)",
        read: "Which inputs the tradable industries lean on, and how that has changed.",
        more: "Industries that depend heavily on one input are the ones a shortage of it would hold back.",
        chart: "placeholder",
        placeholder: { form: "heatmap" },
        signal:
          "highlight where your tradable industries are intense in certain inputs over time",
      },
    ],
  },
  /* the spec's three data points (revised Sept 2026), by its names and in
     its order, each drawn from the Innovation Module (innovationData.ts) */
  innovation: {
    id: "innovation",
    title: "Innovation",
    level: "msa",
    question: "Is my constraint related to lack of innovation & firm creation?",
    views: [
      {
        name: "Firm creation",
        read: "Firm entry and exit rates against all metros.",
        more: "More firms opening than closing is a sign of a healthy business climate.",
        chart: "firmCreation",
        signal: "high or low",
      },
      {
        name: "Patents per capita and specialization (RCA)",
        read: "Patents per resident against all metros, and the technologies the MSA specializes in.",
        more: "The RCA shows which technology classes the MSA patents in more than the country does.",
        chart: "patents",
        signal: "specialization in the tech class",
      },
      {
        name: "Publications per capita and specialization (RCA)",
        read: "Publications per resident against all metros, and the fields the MSA specializes in.",
        more: "The RCA shows which research fields the MSA publishes in more than the country does.",
        chart: "publications",
        signal: "specialization in the tech class",
      },
    ],
  },
  complexity: {
    id: "complexity",
    title: "Complexity",
    level: "msa",
    question: "Is my constraint related to my complexity?",
    views: [
      {
        name: "Complexity of the MSA",
        read: "The MSA's economic complexity against all metros.",
        more: "A more complex economy makes a wider range of products that few other places can.",
        chart: "placeholder",
        placeholder: { form: "histogram", x: "economic complexity (ECI)" },
        signal: "high / low",
      },
      {
        name: "Complexity rank over time",
        read: "The MSA's complexity rank, year by year.",
        more: "A falling rank means other metros are becoming complex faster.",
        chart: "placeholder",
        placeholder: { form: "rankLine", y: "complexity rank" },
        signal: "up / down",
      },
      {
        name: "Remoteness (market access)",
        read: "Remoteness against complexity, for every metro.",
        more: "Metros far from large markets tend to be less complex, so distance can explain part of a low score.",
        chart: "placeholder",
        placeholder: { form: "scatter", x: "remoteness index", y: "ECI", slope: -1 },
        signal: "remoteness index vs ECI scatter",
      },
      {
        name: "ECI vs population",
        read: "Complexity against population, for every metro.",
        more: "Larger metros tend to be more complex, so size can explain part of the score too.",
        chart: "placeholder",
        placeholder: { form: "scatter", x: "population (log)", y: "ECI", slope: 1 },
      },
      {
        name: "COI",
        read: "The MSA's complexity outlook against all metros.",
        more: "The outlook says how close the MSA is to products it does not make yet.",
        chart: "placeholder",
        placeholder: { form: "histogram", x: "complexity outlook (COI)" },
        signal: "high / low",
      },
    ],
  },
  mismatch: {
    id: "mismatch",
    title: "MSA / admin mismatch",
    level: "both",
    question: "Is my constraint related to dynamics between my admin and MSA?",
    views: [
      {
        name: "Admin vs MSA industry mix (2-digit)",
        read: "Each sector's share of jobs in the city and in its MSA.",
        more: "A big gap in one sector means the city and its metro lean on different work.",
        chart: "placeholder",
        placeholder: { form: "dumbbell", x: "share of jobs", series: ["{city}", "its MSA"] },
      },
      {
        name: "Shift-share and industry growth (2-digit), admin against MSA",
        read: "Each sector's growth in the city against its MSA.",
        more: "A sector below the line grows more slowly in the city than in the rest of its metro.",
        chart: "placeholder",
        placeholder: { form: "sectorScatter", x: "growth in the MSA", y: "growth in the city" },
      },
      {
        name: "Commuters and out-commuters over time",
        read: "Workers commuting in and out of the city, over time.",
        more: "More people commuting in than out means the city holds jobs its residents do not fill.",
        chart: "placeholder",
        placeholder: { form: "lines", y: "workers", series: ["in-commuters", "out-commuters"] },
        level: "admin",
      },
    ],
  },
  housingDemand: {
    id: "housingDemand",
    title: "Housing demand",
    level: "admin",
    /* the spec's wording, verbatim — it reads like the housing-supply
       question, so [confirm this is the question meant] */
    question: "Is my constraint related to housing supply?",
    views: [
      STEP_COST_TREND,
      STEP_PRICE_MAP,
      {
        name: "Real wages",
        read: "Real wages over time for the city and its MSA.",
        more: "Wages after inflation: a flat line means pay is not keeping up with prices.",
        chart: "placeholder",
        placeholder: { form: "lines", y: "real wages", series: ["{city}", "its MSA"] },
      },
      STEP_ELASTICITY,
    ],
  },
  /* the spec's six data points, by its names and in its order. Five are drawn
     from the Amenities Module's indicators (amenityData.ts); the module
     publishes no composite, so the overall score is a placeholder. The spec
     gave these no "signal", so none is invented here. */
  amenities: {
    id: "amenities",
    title: "Amenities",
    level: "admin",
    question: "Is my constraint related to amenities?",
    views: [
      {
        name: "Overall amenities score",
        read: "The composite amenities score against all places.",
        more: "One number for how good a place is to live in, beyond jobs and pay.",
        chart: "placeholder",
        placeholder: { form: "histogram", x: "amenities score", among: "places" },
      },
      {
        name: "Education",
        read: "School achievement against the national average, for the city and its MSA.",
        more: "Measured in standard deviations, where about 0.3 is one grade level.",
        chart: "education",
        level: "both",
      },
      {
        name: "Crime",
        read: "Crime against the national level, for the city and its MSA.",
        more: "An index of the cost of crime, with 100 as the national level.",
        chart: "crime",
        level: "both",
      },
      {
        /* the module's transport measure is access to jobs by car */
        name: "Transportation",
        read: "Jobs reachable by car in 15, 30 and 60 minutes, and the city's rank.",
        more: "More jobs within a short drive means more of the region's work is within reach.",
        chart: "jobAccess",
      },
      {
        name: "Air quality index",
        read: "Air quality over time against the health categories, for the city and its MSA.",
        more: "The EPA's index, where the bands mark when the air is unhealthy for some or all groups.",
        chart: "airQuality",
        level: "both",
      },
      {
        /* the module's "urban vitality": establishments per resident */
        name: "Quality of life (e.g. restaurants)",
        read: "Restaurants, daily-needs shops and arts venues per resident, against the national rate.",
        more: "Places with more restaurants, shops and venues per resident tend to draw and keep people.",
        chart: "vitality",
      },
    ],
  },
  /* the live tool's HOUSING story */
  housingSupply: {
    id: "housingSupply",
    title: "Housing supply",
    level: "admin",
    views: [
      STEP_PRICE_MAP,
      STEP_COST_TREND,
      STEP_ELASTICITY,
      {
        name: "Spatial dimensions of housing growth in your admin / housing construction map",
        read: "Where housing grew within the city.",
        more: "Each neighbourhood is shaded by how much new housing was built there.",
        chart: "placeholder",
        placeholder: { form: "map" },
      },
    ],
  },
  demand: {
    id: "demand",
    title: "Demand",
    level: "msa",
    views: [STEP_WATERFALL, STEP_EFFECTS],
  },
};

/** which modules an ending shows, in reading order — keyed by the node a
 *  descent ends on: a leaf of the forked quadrant tree, or the positive
 *  demand head, whose branch stops there. The module that carries the live
 *  tool's story for the ending LEADS — the industry story on a demand
 *  ending, housing on a cost ending, amenities on an amenities ending —
 *  and complexity closes every list. */
const DN_REGIONAL = ["shocks", "inputs", "innovation", "complexity"];
/* both demand branches exit to the same industry story in the live tool;
   the admin-specific one then asks what the metro is adding that the place
   is not holding, which is the mismatch module's question */
const DN_LOCAL = ["shocks", "mismatch", "complexity"];
const SN_HOUSING = ["housingSupply", "complexity"];
const SN_AMENITIES = ["amenities", "complexity"];
export const LEAF_MODULES: Record<string, string[]> = {
  "dn-regional": DN_REGIONAL,
  "dn-local": DN_LOCAL,
  demandpos: ["shocks", "housingDemand", "amenities", "complexity"],
  "sn-col": SN_HOUSING,
  "sn-amen": SN_AMENITIES,
  /* the positive supply shock leads with its own leaf's story, as the live
     tool does, and then reads ACROSS the fork, as the team's spec has it —
     "is it sustainable?" is asked of both sides: a housing leaf goes on to
     amenities, an amenities leaf to housing supply */
  "sp-col": ["housingSupply", "amenities", "demand", "complexity"],
  "sp-amen": ["amenities", "housingSupply", "demand", "complexity"],
  /* the alt tree carries no sign on its shocks: its demand leaves read as
     the negative demand shock's, its supply leaves as the negative supply
     shock's */
  metrowide: DN_REGIONAL,
  placespec: DN_LOCAL,
  col: SN_HOUSING,
  amen: SN_AMENITIES,
};

/** the modules for a picked descent — the node it ends on decides */
export const pathModules = (path: string[]): ModuleDef[] =>
  (LEAF_MODULES[path[path.length - 1]] ?? []).map((id) => MODULES[id]);
/** the order the analysis reads an ending's modules in: complexity is the
 *  transition to what comes next, so it goes last however the spec
 *  happened to order the rest (the walk's closing stop and the analysis
 *  section both read this order) */
export const orderModules = (modules: ModuleDef[]): ModuleDef[] => [
  ...modules.filter((m) => m.id !== "complexity"),
  ...modules.filter((m) => m.id === "complexity"),
];

/** how many of a module's data points are drawn from a source — a
 *  placeholder is a card, not a drawn data point */
export const drawnCount = (m: ModuleDef): number =>
  m.views.filter((v) => v.chart && v.chart !== "placeholder").length;

/* ---------- how an ending reads, for one city ----------
 *  The analysis section's opening lines. The COPY is still to be written,
 *  so each line is a bracketed placeholder naming what it will cover —
 *  which differs by the family of shock and by whether the ending on screen
 *  is the one the city's data argues for:
 *
 *    read    the city's own read: its two dials, and the quadrant
 *    landed  the second fork, and the comparison that decided it
 *    leads   what the modules below go on to read
 *
 *  An ending the data does NOT argue for (a pick on the schematic, or in
 *  the sandbox) gets the rule that would land a city there instead. */
export interface EndingRead {
  diagnosed: boolean;
  read: string;
  landed?: string;
  leads?: string;
  /** the subtle path's second exit: a metro-wide shortfall whose metro is
   *  itself supply-bound, so the supply branch is worth walking too */
  detour?: { label: string; path: string[] };
}

export function endingRead(
  cityShort: string,
  path: string[],
  country = USA,
): EndingRead {
  const side = sideOfPath(path);
  const own = suggestedPath(cityShort, "quad2");
  const diagnosed = !!homePlace(cityShort) && own.join("/") === path.join("/");
  const demandFamily = side === "demandneg" || side === "demandpos";
  const landed = path.length > 1 ? QUAD_BRANCH_SPEC[side]?.forkLine : undefined;
  const leads = "[placeholder: what the modules below read, and at which level]";

  if (!diagnosed)
    return {
      diagnosed,
      read: "[placeholder: the rule that lands a city on this ending. the city's own data points elsewhere]",
      landed,
      leads,
    };

  const ms = demandFamily ? demandRead(cityShort, country)?.metroSupply : null;
  return {
    diagnosed,
    read: "[placeholder: the city's population and pay growth, and the quadrant they put it in]",
    landed,
    leads: ms
      ? "[placeholder: the metro is itself supply-bound, so the supply branch is a second exit]"
      : leads,
    detour: ms
      ? {
          label: "[second exit: the metro's supply branch]",
          path: ["supplyneg", ms.side === "amenity" ? "sn-amen" : "sn-col"],
        }
      : undefined,
  };
}
