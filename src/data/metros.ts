/** The walk's data: every US metro on the population × pay plane, the walk's
 *  city at both geographies, and the medians each fork reads.
 *
 *  The NUMBERS live in metrosData.ts, which is GENERATED — pulled from the
 *  live tool's own files (cities.taimur.sh, the ones its rendered pages
 *  fetch) by scripts/build-driver-data.mjs. This file wraps them with the
 *  app's helpers and keeps the names the section already reads.
 *
 *    source   /data/usa/city_panel + place_panel (population, pay) and
 *             city_housing + place_housing (Zillow ZHVI, all homes)
 *    measure  population CAGR × average-pay CAGR, %/yr
 *    window   the live tool's DEFAULT, 2014 → 2024, each end snapped to the
 *             nearest year a series has (the live tool's own rule), on its
 *             default pay series (the IRS wage carried past its frontier)
 *    checked  against the live page for Boston: population +0.2%/yr, pay
 *             +4.8%/yr, the negative supply shock quadrant — matches.
 *
 *  ONE WINDOW, BY CONSTRUCTION. Every series and every threshold here —
 *  including the home-value median the supply fork tests against — comes
 *  out of one run of one script, as does the analysis charts' data
 *  (driverData.ts). That is what stops a fork comparing a benchmark from one
 *  window against a city value from another and flipping on the mismatch
 *  rather than on the city. (This file used to be a hand-pinned 2017 → 2022
 *  extraction on raw IRS pay; moving to the live tool's window moved San
 *  Antonio from Leak › Admin-specific to Sponge › Housing — its population
 *  growth clears the ten-year median where it fell short of the five-year
 *  one. The diagnostic-pathway EXPLAINER under src/explainers keeps its own
 *  data and its own window.) */

import {
  DATA_WINDOW,
  METRO_HOUSING_ROWS,
  METRO_MEDIAN_HOME,
  METRO_ROWS,
  PLACE_HOUSING_ROWS,
  PLANE_SPAN,
  PRICE_PLANE_SPAN,
  SAMPLE_METROS,
  SAMPLE_PLACES,
  type MetroRow,
} from "./metrosData";

/** The one window every series and threshold in the section is measured on —
 *  set by the extraction script, never here. */
export { DATA_WINDOW };
export const DATA_WINDOW_LABEL = `${DATA_WINDOW.from}–${DATA_WINDOW.to}`;

/** one unit on the plane: growth as CAGR %/yr, `home` null where Zillow
 *  publishes no series, `size` the latest population (dot sizing) */
export type MetroDatum = MetroRow;

/** every US metro with both dials over the window — the grey field, and the
 *  universe every median is taken across */
export const METROS: MetroDatum[] = METRO_ROWS;

/** The cities from the city picker (Boston only, since Sept 2026 — see
 *  content.ts), at both geographies. The branch
 *  each one lands on is DERIVED from these numbers (diagnose() in figures.ts). */
export const US_SAMPLE_CITIES: readonly string[] = Object.keys(SAMPLE_PLACES);

/* ---------- home values (Zillow ZHVI), for the supply sub-fork ----------
 *  The place figure is what the Housing-vs-Amenities fork tests; the metro
 *  median is the benchmark it is tested against — both from the same run. */

export interface HousingDatum {
  /** home-value growth, CAGR %/yr */
  zhvi: number;
  /** latest home value, USD */
  level: number;
}

const housing = (
  rows: Record<string, { zhvi: number | null; level: number | null }>,
): Record<string, HousingDatum> =>
  Object.fromEntries(
    Object.entries(rows).flatMap(([city, h]) =>
      h.zhvi != null && h.level != null
        ? [[city, { zhvi: h.zhvi, level: h.level }]]
        : [],
    ),
  );
export const PLACE_HOUSING: Record<string, HousingDatum> =
  housing(PLACE_HOUSING_ROWS);
/** the same measure at metro level, for the walk's metros */
export const METRO_HOUSING: Record<string, HousingDatum> =
  housing(METRO_HOUSING_ROWS);

/** The typical metro's home-value growth — the median across every US metro
 *  with a Zillow series, on the window above. It is both the dashed line the
 *  supply fork's plane draws and the benchmark the fork tests against, so
 *  the tree and the chart make the same claim. (The live tool's place-grain
 *  test reads the median across every US PLACE instead — PLACE_MEDIAN_HOME
 *  in metrosData.ts; the two sit 0.03 apart on this window and no sample
 *  city falls between them.) */
export const METRO_MEDIAN_ZHVI = METRO_MEDIAN_HOME;

export const placeHousing = (city: string): HousingDatum | null =>
  PLACE_HOUSING[city] ?? null;

/* ---------- country scoping ----------
 *  The forks compare a place to the median metro IN ITS OWN COUNTRY, and the
 *  cost fork reads a different series per country: home values in the US,
 *  rents in Mexico. Only USA metros are loaded so far, so that is the only
 *  populated entry — a Mexican or UK sample city needs its own median set
 *  AND a rent series before it can be diagnosed. */

export const USA = "United States of America";

export interface CountryMedians {
  /** median metro population growth, CAGR %/yr */
  pop: number;
  /** median metro wage growth, CAGR %/yr */
  wage: number;
  /** median metro cost-of-living growth, CAGR %/yr */
  cost: number;
}

/** how the cost fork's series is named in that country's copy */
export interface CostMeasure {
  sentenceCase: string;
  lower: string;
}

const COST_MEASURE: Record<string, CostMeasure> = {
  [USA]: { sentenceCase: "Home values", lower: "home-value" },
  Mexico: { sentenceCase: "Rents", lower: "rent" },
};

export const costMeasure = (country: string): CostMeasure =>
  COST_MEASURE[country] ?? { sentenceCase: "Costs", lower: "cost-of-living" };

/** Median metros per country. USA is the only set loaded — METROS holds US
 *  metros only — so every country resolves to it today. That is fine while
 *  all four sample cities are American, and wrong the moment one is not:
 *  adding a Mexican city means loading `mex` rows from city_panel.parquet
 *  and city_rent.parquet, computing their medians on the same pinned window
 *  (see DATA_WINDOW), and adding an entry here. The parameter exists so
 *  those call sites already read correctly. */
const COUNTRY_MEDIANS: Record<string, CountryMedians> = {
  get [USA]() {
    return { ...METRO_MEDIANS, cost: METRO_MEDIAN_ZHVI };
  },
};

export const countryMedians = (country: string): CountryMedians =>
  COUNTRY_MEDIANS[country] ?? COUNTRY_MEDIANS[USA];

/** the place's cost-of-living growth, whichever series its country uses */
export const placeCost = (city: string): { growth: number } | null => {
  const h = PLACE_HOUSING[city];
  return h ? { growth: h.zhvi } : null;
};

/** the selected city's metro / city proper; null when we have no data. The
 *  metro is resolved by id at extraction time, not by matching names — four
 *  US metros are called Springfield */
export const homeMsa = (city: string): MetroDatum | null =>
  SAMPLE_METROS[city] ?? null;
export const homePlace = (city: string): MetroDatum | null =>
  SAMPLE_PLACES[city] ?? null;

/** the walk's other US cities, as labeled peer dots — none, now that Boston
 *  is the only one (kept: it is how a second city would show up) */
export const peerMetros = (city: string): MetroDatum[] =>
  US_SAMPLE_CITIES.filter((n) => n !== city).map((n) => SAMPLE_METROS[n]);

const median = (vs: number[]) => {
  const s = [...vs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/** the crosshair: the typical metro */
export const METRO_MEDIANS = {
  pop: median(METROS.map((m) => m.pop)),
  wage: median(METROS.map((m) => m.wage)),
};

/* unit-square mapping for the population vs wages chart: the median crosshair is the
   centre, spans measured off the data so ~96% of metros fall inside; the
   tail is clamped just inside the rim */
export const METRO_SPAN = PLANE_SPAN;
/** the supply fork's plane — population × home-value growth — centred on its
 *  own medians, and wide enough for the sample ADMIN cities too */
export const PRICE_SPAN = PRICE_PLANE_SPAN;
const clamp = (v: number) => Math.max(-0.97, Math.min(0.97, v));
export const metroUnit = (m: MetroDatum): [number, number] => [
  clamp((m.pop - METRO_MEDIANS.pop) / METRO_SPAN.pop),
  clamp((m.wage - METRO_MEDIANS.wage) / METRO_SPAN.wage),
];

/* a value that rounds to zero carries no sign */
const sgn = (v: number) => (Math.abs(v) < 0.05 ? "" : v > 0 ? "+" : "−");
/** ["pop −0.6%/yr", "wages +5.8%/yr"] — two short rows, so the dot-label
 *  stacks stay narrow enough to fit the gaps between quadrant labels */
export const metroStatsRows = (m: MetroDatum): string[] => [
  `pop ${sgn(m.pop)}${Math.abs(m.pop).toFixed(1)}%/yr`,
  `wages ${sgn(m.wage)}${Math.abs(m.wage).toFixed(1)}%/yr`,
];
