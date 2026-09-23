/**
 * The explainers' data layer — TWO real grains, both extracted from the live
 * cities tool's own parquet exports (see realData.ts; regenerate with
 * scripts/build-real-data.mjs):
 *
 *   METRO_DOTS   every US MSA (n = 379) — the BENCHMARK layer. The people/pay
 *                medians every fork reads against ("typical MSA") come from
 *                here, matching the live tool, whose places read "against
 *                …the medians across US metros"; the MSA population vs wages chart
 *                instrument plots this field.
 *   FIELD_DOTS   every US city ≥ 100k population (admin places, n = 330) —
 *                the FIELD the pages sort down the tree. Each row carries
 *                its OWN MSA's population reading, so the demand sub-fork
 *                tests the city's real metro (no stand-in, no fudge).
 *
 * The one benchmark NOT from the metro table is the supply gate (HOME_GATE):
 * per the live tool's classifySupply at place grain, it is the median
 * home-value CAGR across ALL ~15.7k US places, imported precomputed from
 * realData. Every value here is full precision — classification happens on
 * exact >= comparisons (the pop median is ≈0.4998; rounded data flips
 * knife-edge cities) — so round for DISPLAY only, via sPct.
 *
 * Nothing here is generated at runtime and nothing is synthesized: the
 * numbers are the same ones cities.taimur.sh draws.
 */

import { REAL_METROS, REAL_PLACES, DATA_WINDOW, PLACE_HOME_MED, PLACE_HOME_N } from "./realData";

export { PLACE_HOME_N };

export const START = DATA_WINDOW.from;
export const END = DATA_WINDOW.to;

/** One MSA on the plane — the benchmark layer and the MSA instrument's
 *  scatter. `x` is population growth; `pop` is the population LEVEL, which
 *  drives dot area. */
export type MetroDot = { id: string; name: string; pop: number; x: number; wage: number };

export const METRO_DOTS: MetroDot[] = REAL_METROS.map((m) => ({
  id: m.id,
  name: m.name,
  pop: m.size,
  x: m.pop,
  wage: m.wage,
}));

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The "typical US MSA" — the people/pay benchmarks the root fork and the
 *  demand sub-fork read against. These are METRO medians (not medians of the
 *  city field), per the live tool. */
export const POP_MED = median(REAL_METROS.map((m) => m.pop));
export const WAGE_MED = median(REAL_METROS.map((m) => m.wage));
/** The supply gate — the median home-value CAGR across ALL ~15.7k US places
 *  (the live tool's classifySupply benchmark at place grain, ≈+8.64%/yr).
 *  Deliberately NOT a metro median: the metro home median sits ≈0.2pp higher
 *  and misroutes the cities between the two (El Cajon, Miami, Orange CA). */
export const HOME_GATE = PLACE_HOME_MED;
export const METRO_POP_MAX = Math.max(...METRO_DOTS.map((d) => d.pop));

export const sPct = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
export const sPp = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(d)} pp`;

/** One city (admin place) on the plane. `x` is population growth — the
 *  shared x-axis of both planes; `pop` is the population LEVEL. `msaPop` is
 *  the city's own MSA's population growth — the demand sub-fork's input. */
export type BackDot = {
  id: string;
  name: string;
  pop: number;
  x: number;
  wage: number;
  home: number;
  /** the city's own MSA — `msaId` joins to METRO_DOTS, so a chart can show
      each city giving way to the metro it belongs to */
  msaId: string;
  msaName: string;
  msaPop: number;
};

export const BACKDROP: BackDot[] = REAL_PLACES.map((p) => ({
  id: p.id,
  name: p.name,
  pop: p.size,
  x: p.pop,
  wage: p.wage,
  home: p.home,
  msaId: p.msaId,
  msaName: p.msaName,
  msaPop: p.msaPop,
}));

export const POP_MAX = Math.max(...BACKDROP.map((d) => d.pop));
export const N_CITIES = BACKDROP.length;

/* ————— every city takes BOTH forks, for real —————
 * The forks aren't rules invented for one city: every dot is classified by
 * the same comparisons, so the stage can pour the whole field all the way to
 * the leaves (the r2d3 move). Three fields:
 *
 *   side  fork 1 — the city's people and pay on the same side of the METRO
 *         medians → demand, opposite sides → supply.
 *   above fork 2 on the supply branch — the city's home-value growth vs the
 *         all-US-places median (HOME_GATE).
 *   leaf  fork 2 on BOTH branches, so all four leaves hold a pile. The
 *         demand sub-fork looks up the city's OWN MSA (msaPop, joined from
 *         place_directory at extract time): MSA below the median population
 *         growth → the whole labor market is weak → regional (MSA-wide);
 *         otherwise → local (Admin-specific).
 */

export type LeafKey = "local" | "regional" | "housing" | "amen";

export interface FieldDot extends BackDot {
  side: "demand" | "supply";
  above: boolean;
  leaf: LeafKey;
}

export const FIELD_DOTS: FieldDot[] = BACKDROP.map((d) => {
  const side = (d.x >= POP_MED) === (d.wage >= WAGE_MED) ? ("demand" as const) : ("supply" as const);
  const above = d.home >= HOME_GATE;
  const leaf: LeafKey =
    side === "demand" ? (d.msaPop < POP_MED ? "regional" : "local") : above ? "housing" : "amen";
  return { ...d, side, above, leaf };
});

const leafCount = (k: LeafKey) => FIELD_DOTS.filter((d) => d.leaf === k).length;

export const DEMAND_N = FIELD_DOTS.filter((d) => d.side === "demand").length;
export const SUPPLY_N = FIELD_DOTS.length - DEMAND_N;
export const ABOVE_N = leafCount("housing");
export const BELOW_N = leafCount("amen");
export const LOCAL_N = leafCount("local");
export const REGIONAL_N = leafCount("regional");
