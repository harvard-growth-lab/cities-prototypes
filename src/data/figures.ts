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
     way it moved". A side effect worth keeping: the quad pizza chart's
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
 *  One per quadrant of the population × wage plane. The pizza chart and the
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
 *  The researchers' forking logic, verbatim. Each fork is one comparison
 *  against the median metro IN THE CITY'S OWN COUNTRY, and the suggested
 *  descent is DERIVED here rather than hardcoded per city, so swapping the
 *  sample cities (or the window behind the data) re-runs the diagnostic
 *  instead of going stale.
 *
 *    fork 1   the PLACE's population growth and wage growth, each against
 *             the country's median metro. Both above, or both below →
 *             demand (people and pay moving together). One above and one
 *             below → supply (moving apart).
 *    fork 2   if demand: the METRO's population growth — and only that, not
 *             (demand)  the metro's pay. Below the median → metro-wide, the
 *             whole labor market isn't growing. At or above → place-specific.
 *    fork 2   if supply: cost-of-living growth — home values in the US,
 *    (supply)  rents in Mexico. Above the median → cost, people are being
 *              priced out. At or below → amenities, since the priced-out
 *              story doesn't hold and the fading pull is something else. */

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

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%/yr`;

export function diagnose(cityShort: string, country = USA): Diagnosis {
  const place = homePlace(cityShort);
  const metro = homeMsa(cityShort);
  const cost = placeCost(cityShort);
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
    /* fork 2, demand (revised Sept 2026): the MSA is read on the SAME pizza
       plane the city was — both dials, not population alone. The question is
       whether the shock reached past the city limits, and the answer is
       whether the metro landed in the city's own quadrant: a metro sharing
       it is the whole labor market moving, a metro anywhere else held up
       while the admin city did not. */
    const cityQuad = quadOf(place.pop, place.wage, med);
    const msaQuad = metro ? quadOf(metro.pop, metro.wage, med) : null;
    const metroWide = msaQuad === cityQuad;
    steps.push({
      fork: "branch",
      reason:
        metro && msaQuad
          ? metroWide
            ? `The MSA reads ${pct(metro.pop)} people · ${pct(metro.wage)} pay — the same ${QUAD_NAME[cityQuad]} quadrant the city is in, so the whole labor market moved and the shock reached past the city limits.`
            : `The MSA reads ${pct(metro.pop)} people · ${pct(metro.wage)} pay — ${QUAD_NAME[msaQuad]}, not the city's ${QUAD_NAME[cityQuad]}: the metro held up while the admin city slipped, so the problem is local to the city.`
          : "[no metro data for this city — the sub-fork falls back to place-specific]",
    });
    return {
      path: ["demand", metroWide ? "metrowide" : "placespec"],
      steps,
      derived: true,
    };
  }

  /* fork 2, supply (revised Sept 2026): a four-quadrant plane, not a single
     threshold — the admin city's cost of living against the typical metro's
     on one axis, its population against the typical metro's on the other.
     Home values in the US, rents in Mexico. */
  const measure = costMeasure(country);
  const hr = cost ? housingQuadOf(place.pop, cost.growth, med) : null;
  steps.push({
    fork: "branch",
    reason: hr
      ? `${measure.sentenceCase} are climbing ${pct(cost!.growth)} against the median metro's ${pct(med.cost)}, with population ${pct(place.pop)} against ${pct(med.pop)} — ${HOUSING_QUAD[hr.quad].label}: ${HOUSING_QUAD[hr.quad].read}. ` +
        (hr.priceUp
          ? "Cost of living is the story the numbers tell."
          : "The priced-out story doesn't hold, so the fading pull is something else.")
      : `[no ${measure.lower} data for this city — the sub-fork falls back to cost]`,
  });
  return {
    path: ["supply", hr?.leaf ?? "amen"],
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

/** where the MSA sits on the SAME pizza plane the admin city was read on.
 *  The demand fork asks whether the shock reached past the city limits, and
 *  the answer is whether the metro landed in the city's own quadrant. */
export function msaQuadOf(
  cityShort: string,
  country = USA,
): QuadSide | null {
  const msa = homeMsa(cityShort);
  return msa ? quadOf(msa.pop, msa.wage, countryMedians(country)) : null;
}

/* ---------- the supply branches' second plane: price × population ----------
 *  PROVISIONAL (Sept 2026). What is settled is the SHAPE: the supply forks
 *  read a four-quadrant home-price × population plane at the admin level,
 *  cut at the national medians, rather than the single price threshold this
 *  replaced. The routing below is the conservative reading of that plane —
 *  a city whose home values outrun the typical metro's is a housing story
 *  whichever way its population is moving, and one whose prices are in check
 *  is not. The population axis says WHICH housing story it is (squeezed by
 *  arrivals, or pricing its own residents out) and carries the copy, but
 *  does not flip the leaf. Refine here when the spec lands. */
export type HousingQuad = "squeezed" | "pricedout" | "absorbing" | "slack";

export const HOUSING_QUAD: Record<
  HousingQuad,
  { label: string; read: string; leaf: "col" | "amen" }
> = {
  squeezed: {
    label: "Squeezed",
    read: "people arriving and prices chasing them",
    leaf: "col",
  },
  pricedout: {
    label: "Priced out",
    read: "prices climbing even as people leave",
    leaf: "col",
  },
  absorbing: {
    label: "Absorbing",
    read: "growing with prices in check",
    leaf: "amen",
  },
  slack: {
    label: "Slack",
    read: "cheap, and still emptying out",
    leaf: "amen",
  },
};

export interface HousingRead {
  quad: HousingQuad;
  /** home-value growth above the typical metro's */
  priceUp: boolean;
  /** population growth at or above the typical metro's */
  popUp: boolean;
  /** the supply leaf this quadrant routes to */
  leaf: "col" | "amen";
}

/** the quadrant of the price × population plane a pair falls in */
export const housingQuadOf = (
  pop: number,
  price: number,
  med: { pop: number; cost: number },
): HousingRead => {
  const priceUp = price > med.cost;
  const popUp = pop >= med.pop;
  const quad: HousingQuad = priceUp
    ? popUp
      ? "squeezed"
      : "pricedout"
    : popUp
      ? "absorbing"
      : "slack";
  return { quad, priceUp, popUp, leaf: HOUSING_QUAD[quad].leaf };
};

/** the admin city's read of that plane, or nothing where a series is missing */
export function housingRead(
  cityShort: string,
  country = USA,
): HousingRead | null {
  const place = homePlace(cityShort);
  const cost = placeCost(cityShort);
  if (!place || !cost) return null;
  return housingQuadOf(place.pop, cost.growth, countryMedians(country));
}

/** Which leaf of the forked quadrant tree a shock branch lands on, per the
 *  revision spec's instruments. The supply forks reuse the alt tree's own
 *  housing test; the negative-demand fork reads the MSA through the existing
 *  metro read. The positive demand shock has no second layer (team revision,
 *  Sept 2026): its head is the ending, so it answers null. */
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
     evidence chip and the diagnostic-tree explainer all call that answer.
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
 *  The team's revision spec (Sept 2026) for the quadrant tree: each shock
 *  keeps its own OVERARCHING QUESTION, and all but the positive demand shock
 *  fork once more with their own instrument (QUAD_BRANCH_SPEC below carries
 *  the questions; the modules shown at each ending are in LEAF_MODULES).
 *  The four shock nodes are reused verbatim; the six leaves are new, their ids
 *  prefixed by branch so the two housing/amenities pairs stay distinct
 *  nodes. The positive demand shock has no second layer — its head is the
 *  ending, and the analysis opens straight on its modules.
 *  Bracketed text marks what the spec left open — the exact reading of each
 *  instrument. */
export const TREE_NODES_QUAD2: TreeNodeData[] = [
  ...TREE_NODES_QUAD,
  {
    id: "dn-regional",
    parent: "demandneg",
    title: "Regional (MSA)",
    detail:
      "[the MSA pizza chart reads weak too — the demand shock reaches past the admin boundary, so the constraint is diagnosed at the metro level]",
    tests:
      "Read the MSA pizza chart: MSA population change against MSA wage change. [the MSA in the same weak quadrant → regional]",
  },
  {
    id: "dn-local",
    parent: "demandneg",
    title: "Local (admin)",
    detail:
      "[the MSA pizza chart reads healthy — the demand loss is specific to the admin city, while the region around it does fine]",
    tests:
      "Read the MSA pizza chart: MSA population change against MSA wage change. [the MSA out of the weak quadrant → local]",
  },
  {
    id: "sp-col",
    parent: "supplypos",
    title: "Housing",
    detail:
      "[people are arriving faster than pay rises AND admin housing prices are climbing above the median admin's — is the boom being taken back at the door?]",
    tests: "Admin housing-price change above the median admin's.",
  },
  {
    id: "sp-amen",
    parent: "supplypos",
    title: "Amenities",
    detail:
      "[housing is not absorbing the boom — what is pulling people in, and will it hold?]",
    tests: "Admin housing-price change at or below the median admin's.",
  },
  {
    id: "sn-col",
    parent: "supplyneg",
    title: "Housing",
    detail:
      "[pay climbs while people leave, and admin housing prices are climbing above the median admin's — the wage gain is being taken back at the door]",
    tests: "Admin housing-price change above the median admin's.",
  },
  {
    id: "sn-amen",
    parent: "supplyneg",
    title: "Amenities",
    detail:
      "[the priced-out story doesn't hold — what living there is like, not what it costs, is pushing people out]",
    tests: "Admin housing-price change at or below the median admin's.",
  },
];

/** The spec's per-branch layer that is NOT another tree level: each shock's
 *  overarching question, and its fork stated with its instrument. Read by
 *  the analysis section, which leads with the question and names the fork
 *  the reader came down. (The modules shown at the end of a branch are a
 *  separate table — LEAF_MODULES — keyed by the ending, not the shock.) */
export interface QuadBranchSpec {
  /** the overarching question the branch's analysis opens on */
  question: string;
  /** the fork and the instrument that decides it, in one line — absent on a
   *  shock with no second layer (the positive demand shock) */
  forkLine?: string;
}
export const QUAD_BRANCH_SPEC: Partial<Record<BranchSide, QuadBranchSpec>> = {
  demandneg: {
    question: "What is my demand constraint?",
    forkLine:
      "Is it local or regional (admin or MSA)? Read the MSA on the same pizza chart — in the city's own quadrant it is regional, anywhere else it is local.",
  },
  /* no second layer on the positive demand shock (team revision, Sept 2026):
     the quadrant is the diagnosis, and the analysis opens straight on the
     head's own modules */
  demandpos: {
    question: "What are threats to future growth?",
  },
  supplyneg: {
    question: "What is my supply constraint?",
    forkLine:
      "Housing or amenities? Which quadrant of the housing-price × population plane the admin lands in, against the national medians.",
  },
  supplypos: {
    question: "Is it sustainable?",
    forkLine:
      "Housing or amenities? Which quadrant of the housing-price × population plane the admin lands in, against the national medians.",
  },
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
 *  nothing keys across the two, and the shared glyph is deliberate.) */

/** the level a module's data is read at — the MSA, the admin city, or both */
export type DataLevel = "msa" | "admin" | "both";
export const DATA_LEVEL_LABEL: Record<DataLevel, string> = {
  msa: "MSA-level data",
  admin: "Admin-level data",
  both: "MSA + admin data",
};

/** one data point of a module — a chart, map or table to come */
export interface ModuleView {
  name: string;
  /** what to read off it — the spec's "signal", where it gave one */
  signal?: string;
  /** set where this view's data level differs from its module's */
  level?: DataLevel;
}

export interface ModuleDef {
  id: string;
  title: string;
  level: DataLevel;
  /** the question the module helps answer, in the spec's own words — absent
   *  where the spec listed the data points but not the question */
  question?: string;
  /** the data points, in the spec's order */
  views: ModuleView[];
}

export const MODULES: Record<string, ModuleDef> = {
  shocks: {
    id: "shocks",
    title: "Shocks",
    level: "msa",
    question:
      "Did you face an external shock, or is something wrong within your MSA? Which industries drove the shock?",
    views: [
      {
        name: "Market share, nominal and marginal (4-digit tradables)",
        signal: "high or low? any breaks in the series?",
      },
      {
        name: "Shift-share analysis at the MSA (4-digit tradables)",
        signal: "local share + or −",
      },
    ],
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
        signal:
          "highlight where your tradable industries are intense in certain inputs over time",
      },
    ],
  },
  innovation: {
    id: "innovation",
    title: "Innovation",
    level: "msa",
    question:
      "Is my constraint related to a lack of innovation and firm creation?",
    views: [
      { name: "Firm creation", signal: "high or low" },
      { name: "MSA in patent space", signal: "specialization in the tech class" },
    ],
  },
  complexity: {
    id: "complexity",
    title: "Complexity",
    level: "msa",
    question: "Is my constraint related to my complexity?",
    views: [
      { name: "Complexity of the MSA", signal: "high / low" },
      { name: "Complexity rank over time", signal: "up / down" },
      {
        name: "Remoteness (market access)",
        signal: "remoteness index vs ECI scatter",
      },
      { name: "ECI vs population" },
      { name: "COI", signal: "high / low" },
    ],
  },
  mismatch: {
    id: "mismatch",
    title: "MSA / admin mismatch",
    level: "both",
    question: "Is my constraint related to dynamics between my admin and MSA?",
    views: [
      { name: "Admin vs MSA industry mix (2-digit)" },
      { name: "Shift-share and industry growth (2-digit), MSA and admin" },
      { name: "Commuters and out-commuters over time", level: "admin" },
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
      { name: "Housing prices over time", signal: "up / down" },
      { name: "Real wages" },
      { name: "Housing supply elasticity" },
      { name: "Housing price growth map", signal: "up / down" },
    ],
  },
  amenities: {
    id: "amenities",
    title: "Amenities",
    level: "admin",
    question: "Is my constraint related to amenities?",
    views: [
      { name: "Overall amenities score" },
      { name: "Education" },
      { name: "Crime" },
      { name: "Transportation" },
      { name: "Air quality index" },
      { name: "Quality of life (e.g. restaurants)" },
    ],
  },
  housingSupply: {
    id: "housingSupply",
    title: "Housing supply",
    level: "admin",
    views: [
      { name: "Housing prices over time", signal: "up / down" },
      { name: "Housing supply elasticity" },
      {
        name: "Spatial dimensions of housing growth in your admin / housing construction map",
      },
      { name: "Housing price growth map", signal: "up / down" },
    ],
  },
  demand: {
    id: "demand",
    title: "Demand",
    level: "admin",
    views: [
      { name: "Shift-share and industry growth (2-digit), MSA and place" },
    ],
  },
};

/** which modules an ending shows, in reading order — keyed by the node a
 *  descent ends on: a leaf of the forked quadrant tree, or the positive
 *  demand head, whose branch stops there. Complexity closes every list. */
const DN_REGIONAL = ["shocks", "inputs", "innovation", "complexity"];
const DN_LOCAL = ["mismatch", "complexity"];
const SN_HOUSING = ["housingSupply", "complexity"];
const SN_AMENITIES = ["amenities", "complexity"];
export const LEAF_MODULES: Record<string, string[]> = {
  "dn-regional": DN_REGIONAL,
  "dn-local": DN_LOCAL,
  demandpos: ["shocks", "housingDemand", "amenities", "complexity"],
  "sn-col": SN_HOUSING,
  "sn-amen": SN_AMENITIES,
  /* the positive supply shock reads ACROSS the fork: its housing leaf looks
     at amenities, its amenities leaf at housing supply — as specified;
     [confirm the crossing is intended] */
  "sp-col": ["amenities", "demand", "complexity"],
  "sp-amen": ["housingSupply", "demand", "complexity"],
  /* the alt tree (the initial draft's compact flow) carries no sign on its
     shocks: its demand leaves read as the negative demand shock's, its
     supply leaves as the negative supply shock's */
  metrowide: DN_REGIONAL,
  placespec: DN_LOCAL,
  col: SN_HOUSING,
  amen: SN_AMENITIES,
};

/** the modules for a picked descent — the node it ends on decides */
export const pathModules = (path: string[]): ModuleDef[] =>
  (LEAF_MODULES[path[path.length - 1]] ?? []).map((id) => MODULES[id]);
