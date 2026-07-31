/**
 * Shared model for the tree-lab variants: Figure 27's nodes (single-sourced
 * from learning/content/figures) hung as an actual tree, with the side
 * classification (demand | supply), per-side colors, short labels for the
 * compact renderings, and the fork questions the wizard variant asks.
 */

import {
  FIG27_NODES,
  FIG27_ROOT_QUESTION,
  type TreeNodeData,
} from "../learning/content/figures";

export type Side = "root" | "demand" | "supply";

export interface TNode extends TreeNodeData {
  children: TNode[];
  depth: number;
  side: Side;
  leafCount: number;
}

export const byId: Record<string, TNode> = {};

function build(): TNode {
  for (const n of FIG27_NODES)
    byId[n.id] = { ...n, children: [], depth: 0, side: "root", leafCount: 0 };
  for (const n of FIG27_NODES) if (n.parent) byId[n.parent].children.push(byId[n.id]);
  const walk = (n: TNode, depth: number, side: Side) => {
    n.depth = depth;
    n.side = side;
    if (!n.children.length) {
      n.leafCount = 1;
      return;
    }
    n.leafCount = 0;
    for (const c of n.children) {
      walk(c, depth + 1, n.id === "root" ? (c.id as Side) : side);
      n.leafCount += c.leafCount;
    }
  };
  walk(byId.root, 0, "root");
  return byId.root;
}

export const ROOT: TNode = build();

/** root → … → node, inclusive */
export function pathTo(id: string): TNode[] {
  const out: TNode[] = [];
  let n: TNode | undefined = byId[id];
  while (n) {
    out.unshift(n);
    n = n.parent ? byId[n.parent] : undefined;
  }
  return out;
}

export function descendantIds(id: string): string[] {
  const out: string[] = [];
  const walk = (n: TNode) => {
    out.push(n.id);
    n.children.forEach(walk);
  };
  walk(byId[id]);
  return out;
}

/** all nodes, depth-first in figure order (the reading order of the tree) */
export const DFS: TNode[] = (() => {
  const out: TNode[] = [];
  const walk = (n: TNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  walk(ROOT);
  return out;
})();

export const LEAVES: TNode[] = DFS.filter((n) => !n.children.length);

/** Tidy cross-axis fraction (0…1) per node: leaves evenly spaced in figure
 *  order, parents at the mean of their children. The large tree drawings
 *  (blueprint, grove) turn this into x or y coordinates. */
export const TIDY: Record<string, number> = (() => {
  const t: Record<string, number> = {};
  LEAVES.forEach((l, i) => (t[l.id] = i / (LEAVES.length - 1)));
  [...DFS].reverse().forEach((n) => {
    if (n.children.length)
      t[n.id] = n.children.reduce((s, c) => s + t[c.id], 0) / n.children.length;
  });
  return t;
})();

/* ————— labels ————— */

export const SHORT: Record<string, string> = {
  root: "The growth question",
  demand: "Labor demand",
  supply: "Labor supply",
  newact: "New activities",
  existing: "Existing industries",
  coord: "Coordination",
  external: "External shocks",
  inputs: "Production inputs",
  horizontal: "Horizontal inputs",
  vertical: "Vertical inputs",
  col: "Cost of living",
  amen: "Amenities",
  housing: "Housing",
  transport: "Transportation",
};

/** one-line gists, condensed from each node's detail text */
export const GIST: Record<string, string> = {
  root: FIG27_ROOT_QUESTION,
  demand: "Constraints that bind the firms — producing and selling tradables.",
  supply: "Constraints that bind the residents — the cost and the quality of staying.",
  newact: "Industries the city's know-how could support don't emerge.",
  existing: "The present export base is struggling.",
  coord: "Chicken-and-egg failures nobody profitably solves first.",
  external: "China shocks, technology, supply chains — forces no city controls.",
  inputs: "Things firms need but can't buy at any reasonable price.",
  horizontal: "A scarce input every firm pays for — land, power, permits.",
  vertical: "A scarce input one industry chokes on while its neighbors shrug.",
  col: "The pay is fine; the deal isn't — housing and commuting eat the wage.",
  amen: "What makes staying attractive on top of what it costs.",
  housing: "Growth turns into prices instead of people.",
  transport: "The jobs exist but can't be reached in a livable commute.",
};

/** the question asked at each fork (nodes with children) — wizard variant */
export const FORK_QUESTION: Record<string, string> = {
  root: "Whose problem is it — the firms' (labor demand) or the residents' (labor supply)?",
  demand:
    "Is the trouble breaking into new activities, or growing the industries the city already has?",
  supply: "Is it what living there costs — or what living there is like?",
  newact: "New activities aren't emerging. The classic culprit on this branch:",
  existing: "Are shocks arriving from outside, or is the city failing its firms on an input?",
  inputs: "Does the scarce input hit every firm — or one industry in particular?",
  col: "Is it the rent, or the commute?",
};

/** how the chips name a node's side of the tree */
export const SIDE_LABEL: Record<Side, string> = {
  root: "the root",
  demand: "firms' side",
  supply: "residents' side",
};

/* ————— color language: demand = institutional blue, supply = gold ————— */

export const SIDE_COLOR: Record<Side, { base: string; deep: string; tint: string }> = {
  root: { base: "#4f4a42", deep: "#1a1714", tint: "rgba(79, 74, 66, 0.07)" },
  demand: { base: "#1a5a8e", deep: "#003e6b", tint: "rgba(26, 90, 142, 0.09)" },
  supply: { base: "#b07d1e", deep: "#785312", tint: "rgba(176, 125, 30, 0.10)" },
};

/** sunburst fill ramps, one step per absolute depth 1…4 (dark → pale) */
export const RAMP: Record<"demand" | "supply", string[]> = {
  demand: ["#255a86", "#5583a8", "#a8c3d6", "#d3e2ec"],
  supply: ["#a4741c", "#c09a4e", "#dcc493", "#eee0c2"],
};

export function ringFill(n: TNode): string {
  if (n.side === "root") return "#e9e5db";
  return RAMP[n.side][Math.min(n.depth - 1, 3)];
}

/** legible text color on a ring fill (dark rings for depth ≤ 2) */
export function ringInk(n: TNode): string {
  return n.depth <= 2 ? "#fbfaf7" : "#3d3831";
}
