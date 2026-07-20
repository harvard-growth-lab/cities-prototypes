/**
 * Content for the two figures every variant leans on, from
 * "Doing Growth Diagnostics in Cities" (Harvard Growth Lab, Jan 2026):
 *
 *   Figure 27 — City Growth Diagnostics Decision Tree (p. 71)
 *   Figure 31 — From Movements in Wages and Employment to Demand or
 *               Supply Growth Constraints (p. 77)
 *
 * Text condensed from the paper's own explanations; diagnosis colors are
 * the validated set. Single-sourced here for the whole app (the form-study
 * variants and the essay Finale both read these).
 */

/* ————— diagnosis colors (shared vocabulary across variants) ————— */

export const DIAG_COLORS = {
  positiveDemand: "#4f95e8",
  positiveSupply: "#199e70",
  negativeDemand: "#e66767",
  negativeSupply: "#c98500",
} as const;

/* ————— Figure 27: the decision tree ————— */

export interface TreeNodeData {
  id: string;
  parent?: string;
  title: string;
  sub?: string;
  detail: string;
  example?: string;
  tests?: string;
}

export const FIG27_NODES: TreeNodeData[] = [
  {
    id: "root",
    title: "The growth question",
    sub: "root of the tree",
    detail:
      "Every diagnosis starts from the question the city's trajectory poses: What constrains current growth? How do we make growth resilient? How do we grow through inclusion? What might constrain future growth? The tree maps the logical progression from that question to the potential binding constraints — progressing down any branch requires evidence that rules out the alternatives.",
    example:
      "Cali asked the first, Ciudad del Carmen the second, Savannah the third, Bangalore the fourth.",
  },
  {
    id: "demand",
    parent: "root",
    title: "Labor demand",
    sub: "firms & production",
    detail:
      "Constraints that most affect firms — the city's ability to produce and sell tradables. The demand for a city's exports determines the labor demanded in both the tradable and non-tradable sectors. This branch splits by whether the trouble lies with what the city already does, or with what it can't yet become.",
  },
  {
    id: "supply",
    parent: "root",
    title: "Labor supply",
    sub: "residents & location choice",
    detail:
      "Constraints that most affect residents' willingness to live and work in the city — its workforce is determined by what it costs to live there and what living there is like. The branch separates cost-of-living concerns from attractiveness (amenities).",
  },
  {
    id: "existing",
    parent: "demand",
    title: "Existing industries",
    sub: "the current export base",
    detail:
      "The city's present tradable activities are struggling. Two suspects: shocks arriving from outside, or production inputs the city fails to provide.",
  },
  {
    id: "newact",
    parent: "demand",
    title: "New activities",
    sub: "diversification",
    detail:
      "The city can't move into the adjacent possible — new industries that its know-how could support don't emerge. In Scrabble terms: the letters exist across many heads, but no new words get spelled.",
  },
  {
    id: "external",
    parent: "existing",
    title: "External shocks",
    detail:
      "China shocks, technological change, supply-chain relocation — forces no city controls. The policy answer is not to reverse the shock but to build resilience through diversification of the export base.",
    example: "Detroit's single-industry exposure; Ciudad del Carmen and oil.",
    tests: "Changes-in-changes: did city growth move when the shock hit?",
  },
  {
    id: "inputs",
    parent: "existing",
    title: "Production inputs",
    sub: "vertical & horizontal",
    detail:
      "Inputs firms need but can't buy at any reasonable price. Vertical inputs are industry-specific — power for smelters, water for chip fabs, specialized regulation or facilities. Horizontal inputs hit every firm: permitting, roads, land registry, waste collection.",
    tests:
      "High shadow prices, queues and wait times; bypassing (generators in every courtyard); camels & hippos — do the surviving firms barely use the scarce input?",
  },
  {
    id: "coord",
    parent: "newact",
    title: "Coordination problems",
    detail:
      "Chicken-and-egg failures: the new industry needs suppliers, trained workers, and specialized infrastructure that only appear once the industry exists. Nobody profitably moves first, so the diversification that the city's know-how could support never happens.",
    example:
      "The serendipity workaround: move brains in — Microsoft to Seattle, Walmart to Bentonville.",
    tests: "Magnetic fields: do capable firms sniff around and then locate elsewhere?",
  },
  {
    id: "col",
    parent: "supply",
    title: "Cost of living",
    detail:
      "The pay is fine; the deal isn't — housing and commuting eat the wage. Which of the two depends on whether housing prices are rising: if they are, suspect housing supply; if people simply can't reach jobs, suspect transportation. The two are deeply intertwined.",
  },
  {
    id: "amen",
    parent: "supply",
    title: "Amenities",
    sub: "attractiveness",
    detail:
      "What makes a place worth living in on top of its costs: safety, schools, public services, the natural environment, recreation. Revealed by compensating differentials — when the place gets worse, employers must pay a premium to keep anyone, and people leave anyway.",
    example:
      "Flint after the water crisis: rising wages, falling home values, outmigration.",
    tests: "Magnetic fields plus falling revealed premium (the amenity residual).",
  },
  {
    id: "housing",
    parent: "col",
    title: "Housing supply",
    detail:
      "Inelastic housing — FAR limits, height caps, parking minimums, missing radial and trunk infrastructure — turns growth into prices instead of people. The boom arrives; the cranes don't; rents eat the wage gain: a fortress city.",
    example: "San Francisco's restrictive zoning; slums where formal supply can't respond.",
    tests: "High price + low quantity: are prices rising while little gets built?",
  },
  {
    id: "transport",
    parent: "col",
    title: "Transportation",
    detail:
      "Congestion shrinks the effective labor market: the jobs exist but can't be reached within a livable commute, so workers and firms match badly. Distorted urban form makes this worse.",
    example: "Nairobi, where driving speeds cut the reachable jobs dramatically.",
    tests: "Bypassing: informal transit, moving next to the job, employer buses.",
  },
];

/* ————— Figure 31: eight scenarios (quadrants × elasticity) ————— */

export type WedgeId =
  | "1a"
  | "1b"
  | "2a"
  | "2c"
  | "3c"
  | "3d"
  | "4e"
  | "4f";

export interface Fig31Scenario {
  id: WedgeId;
  quadrant: string;
  shock: string;
  elasticity: string;
  title: string;
  blurb: string;
  color: string; // quadrant diagnosis color
  constrained: boolean;
}

export const FIG31_SCENARIOS: Fig31Scenario[] = [
  {
    id: "1a",
    quadrant: "pop ↑ · wages ↑↑",
    shock: "Positive labor demand",
    elasticity: "inelastic labor supply",
    title: "Boom meets a wall — or a Manhattan",
    blurb:
      "Wages outrun arrivals. Either something walls workers out — housing regulation, disamenities (a real, solvable constraint) — or the city is simply a dense superstar whose supply curve naturally flattens (no policy problem). The housing tests tell the two apart.",
    color: DIAG_COLORS.positiveDemand,
    constrained: true,
  },
  {
    id: "1b",
    quadrant: "pop ↑↑ · wages ↑",
    shock: "Positive labor demand",
    elasticity: "elastic labor supply",
    title: "The healthy boom",
    blurb:
      "People arrive faster than pay rises: the city absorbs its own success. No apparent constraint — the challenge is managing growth and keeping public services ahead of it.",
    color: DIAG_COLORS.positiveDemand,
    constrained: false,
  },
  {
    id: "2a",
    quadrant: "pop ↑↑ · wages ↓",
    shock: "Positive labor supply",
    elasticity: "elastic labor demand",
    title: "The word is out",
    blurb:
      "The city got cheaper or nicer relative to its rivals; newcomers pour in and firms stretch to absorb them. Watch the sectoral mix — retirement and consumer towns grow this way without wages ever moving.",
    color: DIAG_COLORS.positiveSupply,
    constrained: false,
  },
  {
    id: "2c",
    quadrant: "pop ↑ · wages ↓↓",
    shock: "Positive labor supply",
    elasticity: "inelastic labor demand",
    title: "Arrivals outrun the jobs",
    blurb:
      "People keep coming but demand won't stretch: wages sag hard while few jobs are created. A low-complexity export base that can't scale is the usual suspect — constrained labor demand hiding behind population growth.",
    color: DIAG_COLORS.positiveSupply,
    constrained: true,
  },
  {
    id: "3c",
    quadrant: "pop ↓ · wages ↓↓",
    shock: "Negative labor demand",
    elasticity: "inelastic labor supply",
    title: "Staying through the pain",
    blurb:
      "Jobs and pay fall, but people hang on — homeownership, community, amenities keep them rooted. San Francisco lost 17% of high-tech employment after the dot-com bust; population fell just 1.4%. Constrained demand either way.",
    color: DIAG_COLORS.negativeDemand,
    constrained: true,
  },
  {
    id: "3d",
    quadrant: "pop ↓↓ · wages ↓",
    shock: "Negative labor demand",
    elasticity: "elastic labor supply",
    title: "Following the firms out",
    blurb:
      "A few employers leave and many people follow. The strongest signal of a demand constraint — and a spiral risk, because exodus breeds its own supply problems (crime, fiscal stress) on the way down.",
    color: DIAG_COLORS.negativeDemand,
    constrained: true,
  },
  {
    id: "4e",
    quadrant: "pop ↓↓ · wages ↑",
    shock: "Negative labor supply",
    elasticity: "elastic labor demand",
    title: "Pushed out",
    blurb:
      "People leave even though the jobs are there; firms raise pay and still lose them. Cost of living or collapsing amenities are pushing residents toward better real wages elsewhere.",
    color: DIAG_COLORS.negativeSupply,
    constrained: true,
  },
  {
    id: "4f",
    quadrant: "pop ↓ · wages ↑↑",
    shock: "Negative labor supply",
    elasticity: "inelastic labor demand",
    title: "Paying them to stay — and failing",
    blurb:
      "Firms bid wages up hard to hold onto workers, and workers trickle away anyway. Supply is constrained; demand is not the immediate problem — find what makes staying unattractive.",
    color: DIAG_COLORS.negativeSupply,
    constrained: true,
  },
];

/** Which Figure-31 wedge a (Δpop, Δwage) point falls in — deltas measured
 *  relative to the comparison benchmark (zero, or the metro medians). */
export function wedgeOf(dPop: number, dWage: number): WedgeId {
  if (dPop >= 0 && dWage >= 0) return dWage > dPop ? "1a" : "1b";
  if (dPop >= 0 && dWage < 0) return dPop > -dWage ? "2a" : "2c";
  if (dPop < 0 && dWage < 0) return -dWage > -dPop ? "3c" : "3d";
  return -dPop > dWage ? "4e" : "4f";
}

export function scenarioOf(dPop: number, dWage: number): Fig31Scenario {
  const id = wedgeOf(dPop, dWage);
  return FIG31_SCENARIOS.find((s) => s.id === id)!;
}

/**
 * Polygon (in data coordinates) for each wedge, given the plot domains.
 * The diagonals have slope ±1 through the origin, as in the paper.
 */
export function wedgePolygon(
  id: WedgeId,
  [xmin, xmax]: [number, number],
  [ymin, ymax]: [number, number],
): [number, number][] {
  switch (id) {
    case "1a": // Q1, wage-dominant (y > x)
      return ymax <= xmax
        ? [[0, 0], [0, ymax], [ymax, ymax]]
        : [[0, 0], [0, ymax], [xmax, ymax], [xmax, xmax]];
    case "1b": // Q1, population-dominant (y < x)
      return xmax <= ymax
        ? [[0, 0], [xmax, xmax], [xmax, 0]]
        : [[0, 0], [ymax, ymax], [xmax, ymax], [xmax, 0]];
    case "2a": // Q2, population-dominant (y > −x)
      return xmax <= -ymin
        ? [[0, 0], [xmax, 0], [xmax, -xmax]]
        : [[0, 0], [xmax, 0], [xmax, ymin], [-ymin, ymin]];
    case "2c": // Q2, wage-dominant (y < −x)
      return -ymin <= xmax
        ? [[0, 0], [-ymin, ymin], [0, ymin]]
        : [[0, 0], [xmax, -xmax], [xmax, ymin], [0, ymin]];
    case "3c": // Q3, wage-dominant (y < x)
      return -ymin <= -xmin
        ? [[0, 0], [ymin, ymin], [0, ymin]]
        : [[0, 0], [xmin, xmin], [xmin, ymin], [0, ymin]];
    case "3d": // Q3, population-dominant (y > x)
      return -xmin <= -ymin
        ? [[0, 0], [xmin, 0], [xmin, xmin]]
        : [[0, 0], [xmin, 0], [xmin, ymin], [ymin, ymin]];
    case "4e": // Q4, population-dominant (y < −x)
      return -xmin <= ymax
        ? [[0, 0], [xmin, 0], [xmin, -xmin]]
        : [[0, 0], [xmin, 0], [xmin, ymax], [-ymax, ymax]];
    case "4f": // Q4, wage-dominant (y > −x)
      return -xmin <= ymax
        ? [[0, 0], [xmin, -xmin], [xmin, ymax], [0, ymax]]
        : [[0, 0], [-ymax, ymax], [0, ymax]];
  }
}
