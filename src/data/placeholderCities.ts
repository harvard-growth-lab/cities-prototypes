/** PLACEHOLDER cities — City A, City B and City C — one for each ending of
 *  the diagnostic pathway that Boston does not take, so every user flow can
 *  be walked from the city picker (Sept 2026, the user's call). The numbers
 *  are MADE UP: each city's dials are set on whichever side of the median
 *  metro lands it on its ending, and nothing else about it is real. No
 *  module data has been pulled for them (the analysis cards draw an empty
 *  well saying so), and main's own sections keep Boston's figures whichever
 *  city is picked, as they do on main.
 *
 *  Boston (real, metrosData.ts) lands on Fortress › Amenities. The three here:
 *
 *    City A   Magnet    population ↑ · wages ↑ → positive demand shock, which
 *                       has no second fork: the walk ends on the head
 *    City B   Sponge    population ↑ · wages ↓ → positive supply shock; home
 *                       values grow faster than the median → Housing (sp-col)
 *    City C   Leak      population ↓ · wages ↓ → negative demand shock; the
 *                       METRO's population also trails the median → MSA-wide
 *                       (dn-regional). The metro sits in Leak too, so the
 *                       "metro is itself supply-bound" detour stays off.
 *
 *  Every comparison is against the medians metros.ts takes across the real
 *  field (population +0.54%/yr, pay +3.77%/yr, home values +6.59%/yr on the
 *  2014–2024 window) AND against the medians main's landing teaser splits
 *  its city types on (+0.48, +3.43): each dial sits well clear of both, so
 *  the landing's verdict and the walk's diagnosis name the same type. All
 *  dots stay inside ±0.9 of the plane's unit square, so none is clamped to
 *  the rim, and the two Magnet dots sit back from the top-right corner so
 *  the metro read's labels have room beside them. The landing keeps its own copy of the place dials in
 *  scripts/v3/port.mjs (the "city hints" patch) — change the two together.
 *
 *  The paths are DERIVED from these numbers by diagnose() in figures.ts, as
 *  Boston's is; `lands` below is a note of what they should come to, not an
 *  input. */

import type { MetroRow } from "./metrosData";

export const USA_SUFFIX = ", United States of America";

interface Dials {
  /** population growth, CAGR %/yr */
  pop: number;
  /** average-pay growth, CAGR %/yr */
  wage: number;
  /** home-value growth, CAGR %/yr */
  home: number;
  /** latest population (dot sizing) */
  size: number;
  /** latest home value, USD */
  homeLevel: number;
}

export interface PlaceholderCity {
  /** the picker's name for it, before the country */
  short: string;
  place: Dials;
  metro: Dials;
  /** the ending the dials land on, on the forked quadrant tree (a note) */
  lands: string[];
}

export const PLACEHOLDER_CITIES: PlaceholderCity[] = [
  {
    short: "City A",
    place: { pop: 1.6, wage: 4.8, home: 7.4, size: 900_000, homeLevel: 640_000 },
    metro: { pop: 1.4, wage: 4.6, home: 7.0, size: 4_500_000, homeLevel: 560_000 },
    lands: ["demandpos"],
  },
  {
    short: "City B",
    place: { pop: 1.8, wage: 2.4, home: 8.5, size: 1_400_000, homeLevel: 410_000 },
    metro: { pop: 1.9, wage: 2.6, home: 8.0, size: 2_600_000, homeLevel: 380_000 },
    lands: ["supplypos", "sp-col"],
  },
  {
    short: "City C",
    place: { pop: -0.5, wage: 2.5, home: 3.5, size: 380_000, homeLevel: 230_000 },
    metro: { pop: -0.2, wage: 2.8, home: 3.8, size: 1_150_000, homeLevel: 210_000 },
    lands: ["demandneg", "dn-regional"],
  },
];

/** the picker entries, "City, Country" — all American, since the forks
 *  compare a place to the median metro in its own country and only US
 *  medians are loaded (see countryMedians in metros.ts) */
export const PLACEHOLDER_CITY_NAMES: readonly string[] = PLACEHOLDER_CITIES.map(
  (c) => `${c.short}${USA_SUFFIX}`,
);

export const isPlaceholderCity = (cityShort: string): boolean =>
  PLACEHOLDER_CITIES.some((c) => c.short === cityShort);

/* ---------- the same shapes metrosData.ts exports, for metros.ts to merge ---------- */

const row = (short: string, d: Dials): MetroRow => ({
  name: short,
  pop: d.pop,
  wage: d.wage,
  home: d.home,
  size: d.size,
});
const housing = (d: Dials) => ({ zhvi: d.home, level: d.homeLevel });
const byShort = <T,>(pick: (c: PlaceholderCity) => T): Record<string, T> =>
  Object.fromEntries(PLACEHOLDER_CITIES.map((c) => [c.short, pick(c)]));

export const PLACEHOLDER_PLACES: Record<string, MetroRow> = byShort((c) =>
  row(c.short, c.place),
);
export const PLACEHOLDER_METROS: Record<string, MetroRow> = byShort((c) =>
  row(c.short, c.metro),
);
export const PLACEHOLDER_PLACE_HOUSING: Record<string, { zhvi: number; level: number }> =
  byShort((c) => housing(c.place));
export const PLACEHOLDER_METRO_HOUSING: Record<string, { zhvi: number; level: number }> =
  byShort((c) => housing(c.metro));

/** the empty well an analysis card draws for a city no module data has been
 *  pulled for — worded for the placeholder cities, which have none by
 *  design, and as before for a real city whose pull is still to come */
export const missingDataLabel = (source: string, cityShort: string): string =>
  isPlaceholderCity(cityShort)
    ? `${cityShort} is a placeholder city — no ${source} data to draw`
    : `No ${source} data has been pulled for ${cityShort}`;
