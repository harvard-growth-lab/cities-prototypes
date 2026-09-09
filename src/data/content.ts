/** The cities the app knows, and the names the sections build from them.
 *  The section list, copy and sample journey state are v-3's own
 *  (src/legacy), so they no longer live here. */

import { TREE_SIDE_LABEL, type BranchSide } from "./figures";

/** One sample city per leaf of the alt diagnostic tree, in leaf order:
 *  Memphis → demand / metro-wide, San Antonio → demand / place-specific,
 *  San Jose → supply / housing, Boston → supply / amenities. The branch
 *  each one lands on is DERIVED from its data (see diagnose() in
 *  figures.ts), not pinned here.
 *
 *  The same four are the options in v-3's two city pickers
 *  (scripts/v3/port.mjs writes them): v-3's sections carry Boston's figures
 *  whichever city is picked — as they do on main, where the picker only
 *  relabels them — so the list stays the tree's. */
export const CITIES = [
  "Memphis, United States of America",
  "San Antonio, United States of America",
  "San Jose, United States of America",
  "Boston, United States of America",
];

/** Where the app opens — the picker's selected option. Kept separate from
 *  the array order, which is the tree's leaf order and is worth preserving
 *  as documentation of which sample covers which branch. */
export const DEFAULT_CITY = CITIES[3]; // Boston — supply / amenities

export const cityShortName = (city: string) => city.split(",")[0];
/** the country half of a picker entry — the forks compare a place to the
 *  median metro in its own country, so it has to travel with the city */
export const cityCountryName = (city: string) =>
  city.split(",").slice(1).join(",").trim();

/** The branch picked on the diagnostic tree names its analysis section. Built
 *  from the side's own label (figures.ts) rather than listed per branch, so a
 *  structure that adds branches needs no edit here — the third branch keeps
 *  its brackets because its LABEL is bracketed, which is the point. */
export const branchSectionName = (side: BranchSide) => {
  const label = TREE_SIDE_LABEL[side];
  return `${label[0].toUpperCase()}${label.slice(1)} analysis`;
};
