/** The cities the app knows, and the names the sections build from them.
 *  The section list, copy and sample journey state are v-3's own
 *  (src/legacy), so they no longer live here. */

import { TREE_SIDE_LABEL, type BranchSide } from "./figures";
import { PLACEHOLDER_CITY_NAMES } from "./placeholderCities";

/** The cities the prototype carries: BOSTON, the one city with real data
 *  end to end — the walk's forks (metrosData.ts), the Drivers charts
 *  (driverData.ts), the Amenities and Innovation Modules' indicators
 *  (amenityData.ts, innovationData.ts) — and, since 2026-09-24, three
 *  PLACEHOLDER cities beside it: City A, City B and City C, one for each
 *  ending Boston does not take, with made-up dials and no module data
 *  (placeholderCities.ts), so each user flow can be walked from the picker.
 *  v-3's own sections carry Boston's figures whatever the picker says, as
 *  they do on main. The branch a city lands on is DERIVED from its data
 *  (diagnose() in figures.ts), not pinned here: Boston, on the live tool's
 *  2014 → 2024 window, is Fortress › Amenities.
 *
 *  Before Sept 2026 there were four real-ish cities — Memphis (Leak ›
 *  MSA-wide), San Antonio (Sponge › Housing) and San Jose (Fortress ›
 *  Housing) beside Boston — picked as one city per ending, with schematic
 *  charts; the prototype was then Boston only for a while.
 *
 *  The same list is the options in v-3's two city pickers
 *  (scripts/v3/port.mjs writes them, and the landing's verdict per city).
 *  Still a list, so a second REAL city is one more entry here, in the three
 *  data scripts, and in the port. */
export const CITIES = ["Boston, United States of America", ...PLACEHOLDER_CITY_NAMES];

/** Where the app opens — the picker's selected option. */
export const DEFAULT_CITY = CITIES[0]; // Boston — Fortress › Amenities

export const cityShortName = (city: string) => city.split(",")[0];
/** the country half of a picker entry — the forks compare a place to the
 *  median metro in its own country, so it has to travel with the city */
export const cityCountryName = (city: string) =>
  city.split(",").slice(1).join(",").trim();

/** The branch picked on the diagnostic pathway names its analysis section. Built
 *  from the side's own label (figures.ts) rather than listed per branch, so a
 *  structure that adds branches needs no edit here — the third branch keeps
 *  its brackets because its LABEL is bracketed, which is the point. */
export const branchSectionName = (side: BranchSide) => {
  const label = TREE_SIDE_LABEL[side];
  return `${label[0].toUpperCase()}${label.slice(1)} analysis`;
};
