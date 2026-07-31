/** All prototype copy, options, and sample state for the Cities Tool.
 *  Figma-hosted placeholder assets; swap for real ones when available. */

export const ASSETS = {
  logo: "https://www.figma.com/api/mcp/asset/88485d58-0a09-4b76-a794-9c77770e11c5",
  treemap: "https://www.figma.com/api/mcp/asset/6bb40150-76ee-4013-bcb1-78de2deb40b4",
  scatter: "https://www.figma.com/api/mcp/asset/336768cb-4a4b-4ad6-9382-60dd383739b3",
} as const;

export const CITIES = [
  "Boston, United States of America",
  "Chicago, United States of America",
  "Detroit, United States of America",
  "Bogotá, Colombia",
  "Nairobi, Kenya",
];

export const SPANS = ["10 years", "5 years", "20 years"];

export const cityShortName = (city: string) => city.split(",")[0];

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

export const INTRO_QUESTIONS: IntroQuestion[] = [
  {
    progress: 1,
    question:
      "Over the past 10 years, how has the population of Boston changed compared with its metro area?",
    options: [
      { text: "The city grew faster than the metro area" },
      { text: "Both grew at about the same rate" },
      { text: "The metro area grew, while the city itself shrank", correct: true },
    ],
    feedbackCorrect:
      "Correct — Boston city lost about 0.8% of its residents per year, while the wider metro area kept growing at +0.4% per year.",
    feedbackWrong:
      "Not quite — Boston city actually shrank (−0.8%/yr) while the wider metro area kept growing (+0.4%/yr).",
  },
  {
    slideId: "page-intro-q2",
    progress: 2,
    question: "What do you think the Boston metro area exports most?",
    options: [
      { text: "Seafood and food products" },
      {
        text: "Knowledge services — scientific research, software, and higher education",
        correct: true,
      },
      { text: "Cars and industrial machinery" },
    ],
    feedbackCorrect:
      "Right — the biggest blocks in Boston’s export basket are knowledge services: scientific research, software publishing, and universities.",
    feedbackWrong:
      "Not quite — the largest blocks in Boston’s export basket are knowledge services: scientific research, software, and higher education.",
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

export const CITY_INDICATORS: IndicatorRow[] = [
  {
    name: "Population",
    level: "660K",
    slider: { zero: "50%", from: "50%", to: "10%", good: false },
    change: "−0.8%/yr",
    changeGood: false,
    rank: "1 / 35",
  },
  {
    name: "Average salary",
    level: "$100K",
    slider: { zero: "0%", from: "50%", to: "72%", good: true },
    change: "+5.8%/yr",
    changeGood: true,
    rank: "62 / 130",
  },
  {
    name: "Home value",
    level: "$971K",
    slider: { zero: "0%", from: "50%", to: "45%", good: true },
    change: "+3.6%/yr",
    changeGood: true,
    rank: "14 / 130",
  },
  {
    name: "Unemployment",
    level: "3.5%",
    slider: { zero: "50%", from: "50%", to: "60%", good: true },
    change: "+0.1 pp",
    changeGood: true,
    rank: "21 / 35",
  },
];

export const MSA_INDICATORS: IndicatorRow[] = [
  {
    name: "Population",
    level: "4.9M",
    slider: {
      zero: "50%",
      from: "10%",
      to: "70%",
      good: true,
      focus: true,
      ghost: { pos: "10%", good: false, tip: "City −0.8%/yr" },
    },
    change: "+0.4%/yr",
    changeGood: true,
    rank: "11 / 384",
    hero: true,
    heroNote: "the city is shrinking (−0.8%/yr) while the metro keeps growing (+0.4%/yr)",
  },
  {
    name: "Average salary",
    level: "$83K",
    slider: {
      zero: "0%",
      from: "72%",
      to: "56%",
      good: true,
      ghost: { pos: "72%", good: true, tip: "City +5.8%/yr" },
    },
    change: "+4.5%/yr",
    changeGood: true,
    rank: "6 / 262",
  },
  {
    name: "Home value",
    level: "$648K",
    slider: {
      zero: "0%",
      from: "45%",
      to: "89%",
      good: true,
      ghost: { pos: "45%", good: true, tip: "City +3.6%/yr" },
    },
    change: "+7.1%/yr",
    changeGood: true,
    rank: "19 / 379",
  },
  {
    name: "Unemployment",
    level: "3.3%",
    slider: {
      zero: "50%",
      from: "60%",
      to: "40%",
      good: false,
      ghost: { pos: "60%", good: true, tip: "City +0.1 pp" },
    },
    change: "−0.1 pp",
    changeGood: false,
    rank: "144 / 371",
  },
];

/* ---------- data chat ---------- */

export const CHAT_SUGGESTIONS = [
  "Boston’s exports in 2024",
  "Compare Boston and Chicago export complexity",
  "Employment by sector as a CSV",
];

/* ---------- learning journey ---------- */

export interface Insight {
  section: string;
  city: string;
  span: string;
  text: string;
}

/* Sample state for the prototype: Boston + Chicago explored,
   sections 1 & 2 completed, City Exports in progress. */

export const SAMPLE_EXPLORED_CITIES = [
  "Boston, United States of America",
  "Chicago, United States of America",
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
    city: "Boston, United States of America",
    span: "10 years",
    text: "Boston's export basket leans heavily on knowledge services — scientific research, software, and higher education dominate the treemap. The opportunity seems to be in translating that research strength into advanced manufacturing; the constraint is likely housing costs, which the scatter plot hints at through fast wage growth but slow population growth.",
  },
];
