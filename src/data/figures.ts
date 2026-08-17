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

export type TreeSide = "root" | "demand" | "supply";

/** the tree comes in two structures, flipped by a stage toggle: "full" is the
 *  figure's five-level tree; "alt" keeps the demand/supply fork but goes
 *  straight to two leaves per side — demand → metro-wide/place-specific
 *  shock, supply → housing/amenities */
export type TreeVariant = "full" | "alt";

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
    label: "Alt + themes",
    hint: "Four leaves + the evidence under each",
    about:
      "The four leaves, each carrying the evidence you would read there",
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

export const modeVariant = (m: TreeMode): TreeVariant =>
  m === "paper" ? "full" : "alt";
export const modeThemes = (m: TreeMode): boolean => m === "themes";

/** what the section opens on — and, like the flows, listed first in
 *  TREE_MODES so the default leads the pill row. The paper figure stays one
 *  switch away, but the proposal shown first is the four-leaf tree carrying
 *  the evidence under each leaf — so the structure is read as the
 *  diagnostic, not as a variant of it. */
export const DEFAULT_TREE_MODE: TreeMode = "themes";

/** The section's USER-FLOW choice — a different axis from the tree structure
 *  above. Each flow is a different proposal for how the pizza-chart → tree
 *  sequence is TOLD: "compact" is the initial-draft five-step walk (your metro and
 *  place land on the chart, their quadrant picks the fork); "guided" borrows
 *  the cities-explainer prototype's narrative moves (dials, benchmark,
 *  together/apart, tree-as-questions, an instrument per fork) but keeps them
 *  concise by making the SELECTED CITY the one example that walks the tree —
 *  the reference toured the entire dataset; this page diagnoses one city.
 *  "short" retells it tree-first in three stops: the whole tree up front,
 *  then an instrument per fork moving the city's dot down it, with the route
 *  pinned to the diagnosis until the analysis section has been read. */
export type ConstraintFlow = "compact" | "guided" | "short";

/** what the section opens on — also listed FIRST in CONSTRAINT_FLOWS, since
 *  the pill row renders in array order and the default leads it */
export const DEFAULT_CONSTRAINT_FLOW: ConstraintFlow = "short";

/* the default leads the row; the rest keep their original order */
export const CONSTRAINT_FLOWS: {
  id: ConstraintFlow;
  label: string;
  hint: string;
  about: string;
}[] = [
  {
    id: "short",
    label: "Shortened guided walk",
    hint: "The whole tree up front — two instruments walk it",
    about:
      "Tree-first: the full tree opens the walk, the pizza chart answers fork one, the housing chart fork two — and the other paths open only at the end of the analysis below",
  },
  {
    id: "guided",
    label: "Guided walk",
    hint: "Two dials, three questions — your city walks the tree",
    about:
      "The explainer flow: the chart builds dial by dial and your city answers each fork with its own numbers, one instrument per question",
  },
  {
    id: "compact",
    label: "Initial draft",
    hint: "The pizza and tree in five quick steps",
    about:
      "The first-draft flow: your metro and place land on the chart, and their quadrant picks the tree fork",
  },
];

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
};

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
    /* fork 2, demand: the METRO's population growth alone decides. Its pay
       is deliberately not consulted — the question is whether the wider
       labor market is growing, and population is what answers that */
    const metroBelow = !!metro && metro.pop < med.pop;
    steps.push({
      fork: "branch",
      reason: metro
        ? metroBelow
          ? `The metro's population is growing ${pct(metro.pop)}, below the median metro's ${pct(med.pop)} — the whole labor market isn't growing, so the shock reached past the city limits.`
          : `The metro's population is growing ${pct(metro.pop)}, at or above the median metro's ${pct(med.pop)} — the metro is fine, so the problem is local to the city.`
        : "[no metro data for this city — the sub-fork falls back to place-specific]",
    });
    return {
      path: ["demand", metroBelow ? "metrowide" : "placespec"],
      steps,
      derived: true,
    };
  }

  /* fork 2, supply: is cost of living being bid up faster than the typical
     metro? Home values in the US, rents in Mexico */
  const measure = costMeasure(country);
  const pricedOut = !!cost && cost.growth > med.cost;
  steps.push({
    fork: "branch",
    reason: cost
      ? pricedOut
        ? `${measure.sentenceCase} are climbing ${pct(cost.growth)}, faster than the median metro's ${pct(med.cost)} — people are being priced out.`
        : `${measure.sentenceCase} are climbing only ${pct(cost.growth)} against the median metro's ${pct(med.cost)} — the priced-out story doesn't hold, so the fading pull is something else.`
      : `[no ${measure.lower} data for this city — the sub-fork falls back to cost]`,
  });
  return {
    path: ["supply", pricedOut ? "col" : "amen"],
    steps,
    derived: true,
  };
}

/** the diagnosed descent, told on whichever structure is being shown */
export const suggestedPath = (
  cityShort: string,
  variant: TreeVariant = "full",
): string[] => {
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
 *  housing/amenities. Root and branch heads are reused verbatim;
 *  housing/amenities keep their ids (so a pick survives the variant switch)
 *  but reparent to the branch head; the two demand leaves are new. */
export const TREE_NODES_ALT: TreeNodeData[] = [
  nodeById.get("root")!,
  nodeById.get("demand")!,
  nodeById.get("supply")!,
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
  /* the alt supply fork is cost vs amenities, so this leaf reuses the full
     tree's Cost of Living node rather than jumping straight to Housing —
     which also lets a pick round-trip between the two structures, since the
     id is shared */
  {
    ...nodeById.get("col")!,
    parent: "supply",
    title: "Cost of living",
    detail:
      "People and pay move apart — they are leaving while pay climbs — and what it costs to live here is climbing faster than the typical metro. The wage gain is being taken back at the door.",
    tests:
      "Is cost-of-living growth above the median metro's? Home values are the measure in the US, rents in Mexico.",
  },
  {
    ...nodeById.get("amen")!,
    parent: "supply",
    tests:
      "Cost-of-living growth at or below the median metro's — the priced-out story does not hold, so the fading pull is something else.",
  },
];

export const treeNodes = (variant: TreeVariant): TreeNodeData[] =>
  variant === "alt" ? TREE_NODES_ALT : TREE_NODES;

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
const CROSS_VARIANT: Record<string, string> = {
  /* the shock reached past the city limits ⇄ forces no city controls */
  metrowide: "external",
  external: "metrowide",
  /* the city is not generating demand its region manages to ⇄ the city
     cannot move into the adjacent possible */
  placespec: "coord",
  coord: "placespec",
};

/** carry a pick across the variant switch: of the target variant's full
 *  routes, take the one sharing the most node ids with the old path — its
 *  own ids or their cross-variant aliases (leftmost on ties), so
 *  supply/col/housing ⇄ supply/housing and demand/metrowide ⇄
 *  demand/existing/external both round-trip. */
export function convertPath(path: string[], variant: TreeVariant): string[] {
  const want = new Set(
    path.flatMap((id) => [id, CROSS_VARIANT[id]]).filter(Boolean),
  );
  const score = (p: string[]) => p.filter((id) => want.has(id)).length;
  return leafPaths(variant).reduce((best, p) =>
    score(p) > score(best) ? p : best,
  );
}

/* ---------- themes: the evidence hanging under each alt-tree leaf ----------
 *  Themes are NOT another level of the diagnostic — they are the data views
 *  you would read once a leaf is reached. Two of them hang off two leaves
 *  each, which is why they live in a flat registry keyed by id rather than
 *  as tree nodes: a theme is authored once and referenced from wherever it
 *  is reached. (Theme ids share a couple of names with tree-node ids —
 *  housing, amenities — but they are separate namespaces; nothing keys
 *  across the two.) */

export interface ThemeDef {
  id: string;
  title: string;
  /** what the theme asks — bracketed placeholder until the copy exists */
  detail: string;
  /** the data views that make the case, from the researchers' notes */
  indicators: string[];
  /** this ground is already covered earlier in the tool */
  seeAlso?: string;
}

export const THEMES: Record<string, ThemeDef> = {
  /* Two pairs below run on the same underlying data — the shift-share pair
     and the accessibility pair. Rather than repeat a title and then have to
     mark the repeat, each is named for the question IT answers, and the
     shared data is called out in the copy. Nothing in the UI has to treat
     these as a special case. */
  localShift: {
    id: "localShift",
    title: "Local competitive shift",
    detail:
      "[what the city lost that its own industries' national trends do not explain — the shift-share's local component, isolated]",
    indicators: ["Nominal and market shares", "Shift-share analysis"],
  },
  jobAccess: {
    id: "jobAccess",
    title: "Job accessibility",
    detail:
      "[how much of the labor market a resident can actually reach — jobs that exist but cannot be commuted to are jobs the city has effectively lost]",
    indicators: ["Map of accessible jobs within 20 / 30 / 40 minutes"],
  },
  complexity: {
    id: "complexity",
    title: "Complexity",
    detail:
      "[whether the city's productive know-how is deepening or thinning, and what it could plausibly move into next]",
    indicators: [
      "Complexity rank over time",
      "ECI vs population",
      "New industries over time and their complexity",
      "Complexity outlook index",
    ],
    seeAlso: "City Exports · export complexity",
  },
  industryTrends: {
    id: "industryTrends",
    title: "Industry and national trends",
    detail:
      "[how much of the decline the city's industry mix would predict on its own — the same shift-share, read for its industry and national components]",
    indicators: ["Nominal and market shares", "Shift-share analysis"],
  },
  remoteness: {
    id: "remoteness",
    title: "Remoteness",
    detail:
      "[how far the city sits from the demand it would need to sell into]",
    indicators: ["Market access"],
  },
  innovation: {
    id: "innovation",
    title: "Innovation",
    detail:
      "[whether new firms and new ideas are appearing at the rate the city's know-how should support]",
    indicators: ["Firm creation", "Patent space"],
    seeAlso: "City Exports · export basket",
  },
  inputs: {
    id: "inputs",
    title: "Vertical / horizontal inputs",
    detail:
      "[inputs firms cannot buy at a reasonable price — horizontal ones hit every firm, vertical ones choke a single industry]",
    indicators: ["Input price rankings", "Rajan-Zingales dependence"],
  },
  housingSupply: {
    id: "housingSupply",
    title: "Housing supply and prices",
    detail:
      "[whether growth is turning into prices instead of people — the boom arrives, the cranes do not. Cost is read from home values in the US and from rents in Mexico]",
    indicators: [
      "Housing prices over time",
      "Housing price growth map",
      "Housing construction map",
      "[rent index — the cost measure outside the US]",
    ],
  },
  commuting: {
    id: "commuting",
    title: "Commuting burden",
    detail:
      "[what the daily commute costs a resident in time — the same accessibility map, read as a reason to leave rather than as labor demand out of reach]",
    indicators: ["Map of accessible jobs within 20 / 30 / 40 minutes"],
  },
  amenityQuality: {
    id: "amenityQuality",
    title: "Amenity quality",
    detail:
      "[what living in the city is like on top of what it costs — public goods, safety, natural conditions]",
    indicators: ["Overall amenities score", "Education", "Crime", "Weather"],
  },
};

/** which themes hang off each alt-tree leaf, in reading order. Every slot
 *  carries its own title, so no label appears twice anywhere in the tree
 *  and nothing needs a "this one is repeated" marker. */
export const LEAF_THEMES: Record<string, string[]> = {
  metrowide: [
    "complexity",
    "industryTrends",
    "remoteness",
    "innovation",
    "inputs",
  ],
  placespec: ["localShift", "jobAccess"],
  col: ["housingSupply"],
  amen: ["commuting", "amenityQuality"],
};

/** themes for a picked descent — the leaf at its end decides */
export const pathThemes = (path: string[]): ThemeDef[] =>
  (LEAF_THEMES[path[path.length - 1]] ?? []).map((id) => THEMES[id]);
