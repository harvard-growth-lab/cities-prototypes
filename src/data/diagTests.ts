/* ---------- the open-ended diagnosis (Oct 2026) — a STUDY ----------
 *  The pathway walks one tree to one ending, and the ending decides which
 *  modules the analysis reads — which the team worried reads as too
 *  deterministic. The approach under study runs several TESTS side by side
 *  instead, the population vs wages quadrant being one of them; each test's
 *  result points at the data modules worth a look, the modules the most
 *  tests point at are SUGGESTED, and the reader can still open any module.
 *
 *  The tests are the tree's own comparisons, unhooked from the tree: fork
 *  one (the quadrant), the demand fork (the metro's population growth) and
 *  the supply fork (home-value growth) are each run for EVERY city rather
 *  than only on the branch that asks them. Two more come from the spec's
 *  module signals — the shift-share local share ("+ or −") and complexity
 *  ("high / low"), the latter with no data yet. Which modules a result
 *  points at follows LEAF_MODULES, the endings that comparison decides
 *  between on the tree. Where a rule here is a reading of the tree rather
 *  than something the team has written down, its comment says so. */

import {
  LEAF_MODULES,
  MODULES,
  QUAD_NAME,
  QUAD_SHOCK,
  TREE_SIDE_COLOR,
  demandRead,
  quadSideOf,
  supplyRead,
  treeNodes,
  type DataLevel,
  type ModuleDef,
  type QuadSide,
} from "./figures";
import { USA, countryMedians, homePlace } from "./metros";
import { driverData } from "./driverData";

export type TestId =
  | "quadrant"
  | "metroGrowth"
  | "homeValues"
  | "localShare"
  | "complexity";

export interface DiagTest {
  id: TestId;
  title: string;
  /** what is compared, as a label — not the test's copy */
  compares: string;
  level: DataLevel;
  /** the side of the economy the test reads — its colour */
  family: "demand" | "supply" | "neutral";
}

export const DIAG_TESTS: DiagTest[] = [
  {
    id: "quadrant",
    title: "Population vs Wages",
    compares: "population and wage growth against the median metro",
    level: "admin",
    family: "neutral",
  },
  {
    id: "metroGrowth",
    title: "Metro Population Growth",
    compares: "the MSA's population growth against the median metro",
    level: "msa",
    family: "demand",
  },
  {
    id: "homeValues",
    title: "Home Value Growth",
    compares: "home-value growth against the median metro",
    level: "admin",
    family: "supply",
  },
  {
    id: "localShare",
    title: "Local Share of Job Growth",
    compares: "the MSA's job growth net of the national trend and its industry mix",
    level: "msa",
    family: "demand",
  },
  {
    id: "complexity",
    title: "Economic Complexity",
    compares: "the MSA's complexity against metros of its size",
    level: "msa",
    family: "neutral",
  },
];

const FAMILY_COLOR: Record<DiagTest["family"], string> = {
  demand: TREE_SIDE_COLOR.demand,
  supply: TREE_SIDE_COLOR.supply,
  neutral: "#526066",
};

/** live: read off the city's data · nodata: the city has none for it ·
 *  tocome: no source draws the test yet */
export type TestStatus = "live" | "nodata" | "tocome";

export interface TestResult {
  test: DiagTest;
  status: TestStatus;
  /** the result, in a few words */
  outcome: string;
  /** the figures behind it */
  figures?: string;
  /** the city type, for the quadrant test's mark */
  side?: QuadSide;
  /** the modules the result points at — for a test to come, the ones it
   *  would point at */
  modules: string[];
  color: string;
}

const pct = (v: number) =>
  `${Math.abs(v) < 0.05 ? "" : v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%/yr`;
const jobs = (v: number) => {
  const a = Math.abs(v);
  const body = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : `${Math.round(a)}`;
  return (v < 0 ? "−" : "+") + body;
};

/** the modules an ending reads, less complexity (which every city reads —
 *  see STANDING) */
const endingModules = (ending: string): string[] =>
  (LEAF_MODULES[ending] ?? []).filter((id) => id !== "complexity");
const union = (lists: string[][]): string[] => [...new Set(lists.flat())];

/** the quadrant test points at every module the tree's endings under that
 *  quadrant read: on the tree its second fork would then choose between
 *  them, and here the other tests weigh in instead [a reading of the tree,
 *  to confirm] */
const quadModules = (side: QuadSide): string[] => {
  const leaves = treeNodes("quad2")
    .filter((n) => n.parent === side)
    .map((n) => n.id);
  return union((leaves.length ? leaves : [side]).map(endingModules));
};

const nodata = (test: DiagTest): TestResult => ({
  test,
  status: "nodata",
  outcome: "No data for this city",
  modules: [],
  color: FAMILY_COLOR[test.family],
});

function runTest(test: DiagTest, cityShort: string, country: string): TestResult {
  const color = FAMILY_COLOR[test.family];
  switch (test.id) {
    case "quadrant": {
      const place = homePlace(cityShort);
      if (!place) return nodata(test);
      const med = countryMedians(country);
      const side = quadSideOf(cityShort, country) as QuadSide;
      return {
        test,
        status: "live",
        outcome: `${QUAD_NAME[side]} · ${QUAD_SHOCK[side]}`,
        figures: `Population ${pct(place.pop)}, wages ${pct(place.wage)}; the median metro ${pct(med.pop)}, ${pct(med.wage)}`,
        side,
        modules: quadModules(side),
        color: TREE_SIDE_COLOR[side],
      };
    }
    case "metroGrowth": {
      /* the demand fork, run for every city: a metro below the median is
         an MSA-wide shortfall (dn-regional's modules), one at or above it
         leaves the gap with the admin city — the module dn-local adds */
      const dr = demandRead(cityShort, country);
      if (!dr) return nodata(test);
      const below = dr.side === "metro";
      return {
        test,
        status: "live",
        outcome: below
          ? "MSA growing slower than the median metro"
          : "MSA keeping pace with the median metro",
        figures: `MSA population ${pct(dr.popCagr)} against the median metro's ${pct(dr.popMedian)}`,
        modules: below ? endingModules("dn-regional") : ["mismatch"],
        color,
      };
    }
    case "homeValues": {
      /* the supply fork, run for every city. Rising at or above the median
         points at housing — supply, as on the tree, and demand, which the
         Magnet's ending reads for the same prices [a reading, to confirm];
         below it, at amenities */
      const sr = supplyRead(cityShort, country);
      if (!sr) return nodata(test);
      const cost = sr.side === "cost";
      return {
        test,
        status: "live",
        outcome: cost
          ? "Home values rising faster than the median metro"
          : "Home values rising slower than the median metro",
        figures: `${sr.grain === "place" ? "The city" : "The MSA"} ${pct(sr.costCagr)} against the median metro's ${pct(sr.costMedian)}`,
        modules: cost ? ["housingSupply", "housingDemand"] : ["amenities"],
        color,
      };
    }
    case "localShare": {
      /* the Shocks module's signal ("local share + or −"), made a test: a
         metro whose industries lost share against their national trends
         points at the industry story; one that gained share flags nothing
         [a reading of the signal, to confirm] */
      const ss = driverData(cityShort)?.shiftShare;
      if (!ss) return nodata(test);
      const losing = ss.local < 0;
      return {
        test,
        status: "live",
        outcome: losing
          ? "Local industries losing share"
          : "Local industries gaining share",
        figures: `${jobs(ss.local)} jobs against the national trend and industry mix, ${ss.t0}–${ss.t1}`,
        modules: losing ? ["shocks", "demand"] : [],
        color,
      };
    }
    case "complexity":
      return {
        test,
        status: "tocome",
        outcome: "Signal to come",
        figures: "read as high / low",
        modules: ["complexity", "innovation"],
        color,
      };
  }
}

/** every test, run for one city, in DIAG_TESTS order */
export const runTests = (cityShort: string, country = USA): TestResult[] =>
  DIAG_TESTS.map((t) => runTest(t, cityShort, country));

/** read for every city whatever the tests say: complexity closes every
 *  ending on the tree (the spec's standing "what could I do better?") */
export const STANDING: ReadonlySet<string> = new Set(["complexity"]);

export interface ModuleRelevance {
  module: ModuleDef;
  /** the live tests pointing at it, in test order */
  by: TestResult[];
  /** tests to come (no source yet) that would point at it */
  pending: TestResult[];
  standing: boolean;
  /** how many live tests point at it */
  score: number;
  suggested: boolean;
}

/** every module, the suggested ones first — the most tests pointing at it
 *  first, then the standing ones (complexity goes last, as everywhere in the
 *  section), then the spec's order */
export function rankModules(results: TestResult[]): ModuleRelevance[] {
  const order = Object.keys(MODULES);
  return Object.values(MODULES)
    .map((module) => {
      const by = results.filter(
        (r) => r.status === "live" && r.modules.includes(module.id),
      );
      const pending = results.filter(
        (r) => r.status === "tocome" && r.modules.includes(module.id),
      );
      const standing = STANDING.has(module.id);
      return {
        module,
        by,
        pending,
        standing,
        score: by.length,
        suggested: by.length > 0 || standing,
      };
    })
    .sort(
      (a, b) =>
        Number(b.suggested) - Number(a.suggested) ||
        b.score - a.score ||
        Number(a.standing) - Number(b.standing) ||
        order.indexOf(a.module.id) - order.indexOf(b.module.id),
    );
}

/** how many tests have a result for this city */
export const liveCount = (results: TestResult[]): number =>
  results.filter((r) => r.status === "live").length;
