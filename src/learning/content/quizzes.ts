/**
 * Learning-mode quizzes — guess before the data reveals, one per story section
 * in scroll order (stages 1–10). Most are multiple-choice cards; two are
 * INTERACTIVE instruments graded like a quiz: stage 4 (drag the metro onto the
 * pop × wage plane) and stage 6 (walk the diagnostic tree). Instrument cards
 * are composed with their widget in proto/InstrumentCards.tsx. Single-city
 * MVP: prompts are written against the Boston profile.
 */

export interface ChoiceQuiz {
  id: string;
  stage: number;
  kind: "choice";
  prompt: string;
  options: string[];
  correctIndex: number;
  reveal: string;
}

export interface SliderQuiz {
  id: string;
  stage: number;
  kind: "slider";
  prompt: string;
  min: number;
  max: number;
  unit: string;
  answer: number;
  tolerance: number; // "close enough" band
  reveal: string;
}

/** A hands-on widget graded like a quiz; the card supplies its own controls. */
export interface InstrumentQuiz {
  id: string;
  stage: number;
  kind: "instrument";
  prompt: string;
  reveal: string;
}

export type Quiz = ChoiceQuiz | SliderQuiz | InstrumentQuiz;

export const QUIZZES: Quiz[] = [
  {
    id: "city-growth",
    stage: 1,
    kind: "choice",
    prompt: "Over 2017–2023, did Boston (the city proper) gain or lose population — and how does that compare to the country?",
    options: [
      "Grew faster than the US",
      "Grew, but slower than the US",
      "Shrank while the US grew",
    ],
    correctIndex: 2,
    reveal:
      "Boston proper shrank about 0.8% a year while the country grew about 0.5% — even as salaries in the city climbed nearly 6% a year. Feet and paychecks are pointing in opposite directions.",
  },
  {
    id: "msa-share",
    stage: 2,
    kind: "slider",
    prompt: "What share of the metro's population lives inside Boston's city line?",
    min: 0,
    max: 100,
    unit: "%",
    answer: 13,
    tolerance: 5,
    reveal:
      "Boston proper is about 655,000 people in a metro of 4.9 million — roughly 13%, spread over seven counties in two states. The labor market you're diagnosing is over seven times the city you can see from City Hall.",
  },
  {
    id: "largest-tradable",
    stage: 3,
    kind: "choice",
    prompt: "Which of these is the Boston metro's largest tradable industry — the biggest earner of outside income?",
    options: ["Restaurants", "Hospitals", "Grocery stores", "Building contractors"],
    correctIndex: 1,
    reveal:
      "Hospitals — 126,000 jobs treating patients who arrive from everywhere, which makes them exporters. Restaurants employ more people (175,000), but they mostly serve the neighbors: they circulate oxygen, they don't earn it.",
  },
  {
    id: "place-the-metro",
    stage: 4,
    kind: "instrument",
    prompt:
      "Drag the gold dot to where you think the Boston metro sits on the people × pay plane — then lock it in.",
    reveal:
      "Boston lands at +0.4% people, +4.5% pay — the slow-people, fast-pay slice. Wages are sprinting while population barely moves: the signature of a constrained labor supply.",
  },
  {
    id: "place-vs-metro",
    stage: 5,
    kind: "choice",
    prompt:
      "The metro dot is about to burst into its 197 cities and towns. Where does Boston proper itself land?",
    options: [
      "Growing faster than its metro — the core is the engine",
      "Moving with the metro",
      "Losing people even as its metro gains them",
    ],
    correctIndex: 2,
    reveal:
      "Boston proper shed about 0.8%/yr while the metro added +0.4% — the departures didn't leave the labor market, they moved across the city line. A city and its metro can point in opposite directions.",
  },
  {
    id: "walk-the-tree",
    stage: 6,
    kind: "instrument",
    prompt:
      "Walk the diagnostic tree yourself — at each fork, pick the branch the evidence on the table points to.",
    reveal:
      "For Boston the evidence lights root → labor supply → amenities: the export engine is growing, home-value growth lags the nation, and the amenity residual is bleeding away.",
  },
  {
    id: "losing-pull",
    stage: 7,
    kind: "choice",
    prompt:
      "Strip out what wages explain about home prices; the residual is a metro's revealed “pull.” Which way has Boston's drifted since 2017?",
    options: [
      "Up — the deal keeps getting better",
      "Flat — pull unchanged",
      "Down — the deal feels worse even as paychecks grow",
    ],
    correctIndex: 2,
    reveal:
      "Down: prices rose less than the wage boom alone would predict, which reads as the metro's non-wage appeal fading. That drift is the amenity story the tree points to.",
  },
  {
    id: "net-of-metro",
    stage: 8,
    kind: "choice",
    prompt:
      "In the next chart every town is read net of the metro average. Why subtract the metro's own trend first?",
    options: [
      "So metro-wide forces cancel out, leaving each town's own drift",
      "To make the axes easier to label",
      "Because towns don't publish their own data",
    ],
    correctIndex: 0,
    reveal:
      "Netting out the metro removes what's happening to everyone — the national cycle, the metro-wide shock — so what remains is each town's own pull relative to its neighbors. Boston proper is then read against its own suburbs, not against the country.",
  },
  {
    id: "where-shifting",
    stage: 9,
    kind: "choice",
    prompt:
      "If the metro's fading pull were mainly a Boston-proper problem, what should the map of residual drift show?",
    options: [
      "Drift concentrated in the urban core, with the suburbs holding up",
      "A uniform wash — every town drifting alike",
      "Drift only at the metro's outer edge",
    ],
    correctIndex: 0,
    reveal:
      "Geography is the tiebreaker: a core-concentrated drift points at city-specific amenities (schools, safety, transit), while a uniform wash points at metro-wide costs. Read where the color pools before deciding which lever is yours.",
  },
  {
    id: "first-lever",
    stage: 10,
    kind: "choice",
    prompt:
      "The diagnosis reads supply-side, amenities before housing. Which family of levers gets first claim on the city's scarce bandwidth?",
    options: [
      "Export-sector support — deepen the tradable base",
      "Housing supply — build until prices bend",
      "Amenity investment — restore the pull that draws residents",
    ],
    correctIndex: 2,
    reveal:
      "The residual drift says amenities are where Boston leaks. Housing is the watch-item and exports are the engine to protect — but scarce bandwidth goes first to the binding constraint. A diagnosis is a hypothesis about where to look, not a verdict.",
  },
];

export const quizForStage = (stage: number): Quiz | undefined =>
  QUIZZES.find((q) => q.stage === stage);

/* ————— stored answers ————— */

export interface QuizAnswer {
  quizId: string;
  /** choice index or slider value */
  guess: number | [number, number];
  correct: boolean;
  skipped?: boolean;
}
