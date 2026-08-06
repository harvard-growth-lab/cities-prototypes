/** All prototype copy, options, and sample state for the Cities Tool.
 *  Figma-hosted placeholder assets; swap for real ones when available. */

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
  /** label follows the branch picked on the diagnostic tree */
  branchNamed?: boolean;
}

export interface SectionDef {
  name: string;
  pages: string[];
  entry: string;
  /** section 1 shows a star instead of a number in the rail */
  star?: boolean;
  steps?: RailStep[];
}

/** the branch picked on the diagnostic tree names its analysis section */
export const branchSectionName = (side: "demand" | "supply") =>
  side === "demand" ? "Demand side analysis" : "Supply side analysis";

export const SECTION_DEFS: SectionDef[] = [
  {
    name: "Introduction to your City",
    pages: ["page-intro-q1", "page-intro-q2"],
    entry: "page-intro-q1",
    star: true,
  },
  {
    name: "City Overview",
    pages: ["page-overview", "page-overview-msa"],
    entry: "page-overview",
    steps: [
      { id: "page-overview", label: "How well is your city doing" },
      { id: "page-overview-msa", label: "Your city is not an island" },
    ],
  },
  {
    name: "City Description",
    pages: ["page-description", "page-msa"],
    entry: "page-description",
  },
  {
    name: "City Exports",
    pages: ["page-export-basket", "page-export-complexity", "page-practice"],
    entry: "page-export-basket",
    steps: [
      { id: "page-export-basket", label: "Your exports matter" },
      { id: "page-export-complexity", label: "Lorem Ipsum" },
      { id: "page-practice", label: "Put in Practice" },
    ],
  },
  {
    name: "City Constraints",
    pages: ["page-constraints", "page-constraints-diagnose", "page-branch-analysis"],
    entry: "page-constraints",
    steps: [
      { id: "page-constraints", label: "Where is your constraint?" },
      { id: "page-constraints-diagnose", label: "How we diagnose the constraint" },
      /* default label; the Rail renames it live from the selected tree branch */
      { id: "page-branch-analysis", label: "Supply side analysis", branchNamed: true },
    ],
  },
  {
    name: "Levers for Change",
    pages: ["page-levers"],
    entry: "page-levers",
  },
];

/* ---------- intro quiz ---------- */

export interface IntroQuestion {
  /** extra anchor id on the slide, when a rail entry points at it */
  slideId?: string;
  /** number of filled progress segments (out of INTRO_SEGMENTS) */
  progress: number;
  question: string;
  options: { text: string; correct?: boolean }[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

export const INTRO_SEGMENTS = 5;

/* Blank for now. These were written against Boston's numbers and would be
   simply wrong under the other three sample cities; only City Constraints
   is populated with real data at this stage. {city} is substituted live. */
export const INTRO_QUESTIONS: IntroQuestion[] = [
  {
    progress: 1,
    question: "[intro question 1 — {city}'s population against its metro's]",
    options: [
      { text: "[option A]" },
      { text: "[option B]", correct: true },
      { text: "[option C]" },
    ],
    feedbackCorrect: "[feedback when right — the figure and where it comes from]",
    feedbackWrong: "[feedback when wrong — the figure and where it comes from]",
  },
  {
    slideId: "page-intro-q2",
    progress: 2,
    question: "[intro question 2 — what {city} exports most]",
    options: [
      { text: "[option A]" },
      { text: "[option B]", correct: true },
      { text: "[option C]" },
    ],
    feedbackCorrect: "[feedback when right]",
    feedbackWrong: "[feedback when wrong]",
  },
];

/* ---------- overview indicator tables ---------- */

export interface GhostSpec {
  /** resting position of the city dot (css --gpos) */
  pos: string;
  good: boolean;
  tip: string;
}

export interface SliderSpec {
  /** where the dashed zero divider sits (css --zero) */
  zero: string;
  from: string;
  to: string;
  good: boolean;
  /** larger knob for the highlighted data point */
  focus?: boolean;
  ghost?: GhostSpec;
}

export interface IndicatorRow {
  name: string;
  level: string;
  slider: SliderSpec;
  change: string;
  changeGood: boolean;
  rank: string;
  /** highlighted row with an annotation caption */
  hero?: boolean;
  heroNote?: string;
}

/* Blank for now — the numbers here were Boston's, and under a different
   sample city they would read as that city's. The rows keep their names and
   the knobs sit on the zero line, so the table reads as "no data yet"
   rather than as data. */
const BLANK_ROWS = (): IndicatorRow[] =>
  ["Population", "Average salary", "Home value", "Unemployment"].map(
    (name) => ({
      name,
      level: "[—]",
      slider: { zero: "50%", from: "50%", to: "50%", good: true },
      change: "[—]",
      changeGood: true,
      rank: "[—]",
    }),
  );

export const CITY_INDICATORS: IndicatorRow[] = BLANK_ROWS();

export const MSA_INDICATORS: IndicatorRow[] = BLANK_ROWS();

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
