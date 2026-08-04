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

/* ---------- Figure 27: the decision tree ---------- */

export type TreeSide = "root" | "demand" | "supply";

export interface TreeNodeData {
  id: string;
  parent?: string;
  title: string;
  detail: string;
  example?: string;
  tests?: string;
}

export const TREE_ROOT_QUESTION =
  "What are binding constraints for economic growth in cities?";

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
  /** the branch of the tree this quadrant defaults to */
  side: "demand" | "supply";
  /** default descent below the root, in tree-node ids */
  path: string[];
  spot: [number, number];
  /** bracketed placeholder shown in the card; {city} is substituted */
  note: string;
}

export const QUADRANTS: QuadrantDef[] = [
  {
    id: "q1",
    dx: 1,
    dy: 1,
    shock: "Positive demand shock",
    sub: "population ↑ · wages ↑",
    side: "supply",
    path: ["supply", "col", "housing"],
    spot: [0.66, 0.78],
    note: "[evidence placing {city} here: population and nominal wage growth vs the ___ benchmark]",
  },
  {
    id: "q2",
    dx: 1,
    dy: -1,
    shock: "Positive supply shock",
    sub: "population ↑ · wages ↓",
    side: "demand",
    path: ["demand", "newact", "coord"],
    spot: [0.68, -0.75],
    note: "[what-if: arrivals outrun the jobs — check ___ for signs demand can't stretch]",
  },
  {
    id: "q3",
    dx: -1,
    dy: -1,
    shock: "Negative demand shock",
    sub: "population ↓ · wages ↓",
    side: "demand",
    path: ["demand", "existing", "external"],
    spot: [-0.68, -0.75],
    note: "[what-if: jobs and pay fall together — check ___ for the industry taking the hit]",
  },
  {
    id: "q4",
    dx: -1,
    dy: 1,
    shock: "Negative supply shock",
    sub: "population ↓ · wages ↑",
    side: "supply",
    path: ["supply", "col", "housing"],
    spot: [-0.66, 0.78],
    note: "[{city} itself lands here — population ↓ while wages ↑; the fork goes to the labor supply branch]",
  },
];

/** The sample city's quadrant (population ↓ · wages ↑). It decides the fork
 *  taken in the tree and the default branch for the section that follows. */
export const PLACE_QUAD: QuadrantDef = QUADRANTS.find((q) => q.id === "q4")!;

/** A selection must name a FULL route — the section that follows navigates to
 *  a leaf, so a pick on an inner node completes downward: follow whichever
 *  child continues an already-marked path (the current pick first, then the
 *  data-driven suggestion), else the leftmost child. */
export function completeToLeaf<N extends { data: TreeNodeData; children?: N[] }>(
  node: N,
  preferred: string[][],
): N {
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
