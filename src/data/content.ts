/** All prototype copy, options, and sample state for the Cities Tool.
 *  Figma-hosted placeholder assets; swap for real ones when available. */

import { TREE_SIDE_LABEL, type BranchSide } from "./figures";

export const ASSETS = {
  logo: "https://www.figma.com/api/mcp/asset/88485d58-0a09-4b76-a794-9c77770e11c5",
  treemap: "https://www.figma.com/api/mcp/asset/6bb40150-76ee-4013-bcb1-78de2deb40b4",
  scatter: "https://www.figma.com/api/mcp/asset/336768cb-4a4b-4ad6-9382-60dd383739b3",
} as const;

/** One sample city per leaf of the alt diagnostic tree, in leaf order:
 *  Memphis → demand / metro-wide, San Antonio → demand / place-specific,
 *  San Jose → supply / housing, Boston → supply / amenities. The branch
 *  each one lands on is DERIVED from its data (see diagnose() in
 *  figures.ts), not pinned here. */
export const CITIES = [
  "Memphis, United States of America",
  "San Antonio, United States of America",
  "San Jose, United States of America",
  "Boston, United States of America",
];

/** Where the app opens. Kept separate from the array order, which is the
 *  tree's leaf order and is worth preserving as documentation of which
 *  sample covers which branch. */
export const DEFAULT_CITY = CITIES[3]; // Boston — supply / amenities

export const SPANS = ["10 years", "5 years", "20 years"];

export const cityShortName = (city: string) => city.split(",")[0];
/** the country half of a picker entry — the forks compare a place to the
 *  median metro in its own country, so it has to travel with the city */
export const cityCountryName = (city: string) =>
  city.split(",").slice(1).join(",").trim();

/* ---------- pages & sections ---------- */

export const PAGE_IDS = [
  "page-intro-q1",
  "page-intro-q2",
  "page-overview",
  "page-overview-msa",
  "page-description",
  "page-msa",
  "page-export-basket",
  "page-export-complexity",
  "page-practice",
  "page-constraints",
  "page-constraints-diagnose",
  "page-branch-analysis",
  "page-levers",
];

export interface RailStep {
  id: string;
  label: string;
}

export interface SectionDef {
  name: string;
  pages: string[];
  entry: string;
  /** section 1 shows a star instead of a number in the rail */
  star?: boolean;
  /** listed but inert: the empty shell sections stay visible in the nav so
   *  the tool reads whole, but only the prototype section is clickable */
  disabled?: boolean;
  steps?: RailStep[];
}

/** The branch picked on the diagnostic tree names its analysis section. Built
 *  from the side's own label (figures.ts) rather than listed per branch, so a
 *  structure that adds branches needs no edit here — the third branch keeps
 *  its brackets because its LABEL is bracketed, which is the point. */
export const branchSectionName = (side: BranchSide) => {
  const label = TREE_SIDE_LABEL[side];
  return `${label[0].toUpperCase()}${label.slice(1)} analysis`;
};

export const SECTION_DEFS: SectionDef[] = [
  {
    name: "Introduction to your City",
    disabled: true,
    pages: ["page-intro-q1", "page-intro-q2"],
    entry: "page-intro-q1",
    star: true,
  },
  {
    name: "City Overview",
    disabled: true,
    pages: ["page-overview", "page-overview-msa"],
    entry: "page-overview",
    steps: [
      { id: "page-overview", label: "How well is your city doing" },
      { id: "page-overview-msa", label: "Your city is not an island" },
    ],
  },
  {
    name: "City Description",
    disabled: true,
    pages: ["page-description", "page-msa"],
    entry: "page-description",
  },
  {
    name: "City Exports",
    disabled: true,
    pages: ["page-export-basket", "page-export-complexity", "page-practice"],
    entry: "page-export-basket",
    steps: [
      { id: "page-export-basket", label: "Your exports matter" },
      { id: "page-export-complexity", label: "Lorem Ipsum" },
      { id: "page-practice", label: "Put in Practice" },
    ],
  },
  {
    /* matches nt-prototypes' V2 rail: a bare section head, no sub-steps —
       the pages array still names every anchor inside the section so the
       head highlights (and the journey counts) across the whole prototype */
    name: "City Constraints",
    pages: ["page-constraints", "page-constraints-diagnose", "page-branch-analysis"],
    entry: "page-constraints",
  },
  {
    name: "Levers for Change",
    disabled: true,
    pages: ["page-levers"],
    entry: "page-levers",
  },
];

/* ---------- data chat ---------- */

export const CHAT_SUGGESTIONS = [
  "[a question about this city's exports]",
  "[compare two of the sample cities]",
  "[ask for a table as a CSV]",
];

/* ---------- learning journey ---------- */

export interface Insight {
  section: string;
  city: string;
  span: string;
  text: string;
}

/* Sample journey state for the prototype: two cities explored, the early
   sections visited. The saved insight is blank for now — the only section
   carrying real data is City Constraints. */

export const SAMPLE_EXPLORED_CITIES = [
  "Memphis, United States of America",
  "Boston, United States of America",
];

export const SAMPLE_VISITED_PAGES = [
  "page-overview",
  "page-overview-msa",
  "page-description",
  "page-msa",
  "page-export-basket",
  "page-export-complexity",
];

export const SAMPLE_INSIGHTS: Insight[] = [
  {
    section: "City Exports · Put in Practice",
    city: "Memphis, United States of America",
    span: "10 years",
    text: "[a saved note the user wrote in Put in Practice — what the export basket showed, what it implies about the binding constraint]",
  },
];
