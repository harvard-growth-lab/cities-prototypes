import { MotionConfig } from "framer-motion";
import { ScrollyAct, type ActStep } from "./ScrollyAct";
import { DiagnoseStage, type DiagScene } from "./DiagnoseStage";
import { PHONE_QUERY, useMediaQuery } from "../../components/pages/walkFit";
import { POP_MED, HOME_GATE, PLACE_HOME_N, N_CITIES, DEMAND_N, SUPPLY_N, METRO_DOTS, START, END, sPct } from "./data";
import "./tree.css";

/**
 * How to Read the Diagnostic Pathway — the GENERAL explainer of the tree's
 * forking logic (no particular city), ported from the cities-explainer
 * prototype (its "#/tree" route, sort-at-the-end version) to live under
 * the Explainers tab. One continuous scrolly at r2d3 granularity — the
 * population vs wages chart assembles one element per beat (x axis → y axis → the
 * cities land → the medians → one quadrant pair → the other → all four
 * lit), then the chart PARKS as a corner card and the tree draws fork by
 * fork, smaller and abstracted: root question → the two answers →
 * Demand's question, whose instrument OPENS ON THE CITIES (the very
 * plane just read, at reading size in the stage's top-right panel) and
 * then hands over: every city slides onto the MSA it belongs to, so the
 * reader sees this is the same chart one level up, not a new one
 * (`inst.grain`) → the lens + Demand's answers → Supply's question + the
 * housing scatter → Supply's answers.
 * **The demand→supply hand-off is
 * staged, not a cross-fade (user-set):** the instrument panel is a SLOT
 * that visibly changes instruments — at the hand-off beat the MSA chart's
 * axes and dots retract, the frame + header repaint in the other branch's
 * color and re-title ("for the Supply fork"), and the new chart is then
 * built in its own beats (frame + its new vertical axis → its own field →
 * the gate), the same one-element-per-beat way the opening plane was. The
 * dots do
 * NOT move during any of this — the whole field waits, classified, in the
 * parked chart. Only the finale sorts: every city cascades down the tree
 * into the four leaf piles. The secondary visualizations live ON the
 * stage in this version (no MiniChart side panels in the narrative
 * column). Language rule: "admin" = the place by its official definition,
 * "MSA" = its metro area; the dots are cities.
 *
 * COPY RULE (user-set, Aug 2026): each step succinctly states the step's
 * GOAL — its job in outline form, using the canonical chart names — with
 * the body a single crisp takeaway line. The placeholder BRACKETS are
 * removed (user, 2026-08-12) but the words are otherwise the same
 * outline-form copy; edit wording only on request.
 */
const STEPS: ActStep<DiagScene>[] = [
  /* 1 · the first axis, alone */
  {
    scene: { layout: "wage", color: "plain", axes: "x", dots: false },
    title: "Introduce dial one: people",
    body: ["Population growth — is a city gaining people, or losing them?"],
  },

  /* 2 · the second axis */
  {
    scene: { layout: "wage", color: "plain", axes: "xy", dots: false },
    title: "Introduce dial two: pay",
    body: ["Wage growth — has the work there been paying better, or worse?"],
  },

  /* 3 · the cities land */
  {
    scene: { layout: "wage", color: "plain" },
    title: "Land the field on the city population vs wages chart",
    body: ["Every US city over 100k, placed by its own decade of people and pay"],
  },

  /* 4 · the median crosshair */
  {
    scene: { layout: "wage", color: "plain", medians: true },
    title: "Add the benchmark",
    body: ["The typical US metro on each dial — growth only means something against it"],
  },

  /* 5 · one pair of quadrants: Demand */
  {
    scene: { layout: "wage", color: "demand", medians: true, lens: "quad-demand" },
    title: "Read the together-quadrants → Demand",
    body: ["People and pay moving as one: what changed is the pull of the work itself"],
  },

  /* 6 · the other pair: Supply */
  {
    scene: { layout: "wage", color: "supply", medians: true, lens: "quad-supply" },
    title: "Read the apart-quadrants → Supply",
    body: ["Pay climbing while people leave, or the reverse: the constraint is the place, not the work"],
  },

  /* 7 · the whole plane, classified: both pairs lit at once */
  {
    scene: { layout: "wage", color: "side", medians: true, lens: "quad-all" },
    title: "Classify the whole field",
    body: ["One question asked of every city: did its two dials move together, or apart?"],
  },

  /* 8 · the chart parks; the root question draws (the field still waits) */
  {
    scene: { layout: "tree", tree: { root: true } },
    title: "Park the chart, pose the root question",
    body: ["The tree begins: a diagnosis is the order you ask questions in"],
  },

  /* 9 · fork one is answered → THE FIRST POUR: the whole field leaves the
     parked chart for the two side piles */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true },
      flow: { demand: "side", supply: "side" },
    },
    title: "Answer the root fork — the first pour",
    body: ["Every city goes one way: Demand (the jobs engine) or Supply (being there)"],
  },

  /* 10 · Demand's question + the instrument OPENS ON THE CITIES — the very
     plane just read, so the reader recognizes it before it changes grain */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true },
      inst: { kind: "wage", grain: "city" },
      focus: "demand",
      flow: { demand: "side", supply: "side" },
    },
    branch: "demand",
    title: "Pose Demand's sub-question: the city, or its region?",
    body: ["Reopen the city population vs wages chart up close — the same two dials, about to be asked of somewhere bigger"],
  },

  /* 11 · the give-way: each city slides onto its own MSA */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true },
      inst: { kind: "wage", grain: "msa" },
      focus: "demand",
      flow: { demand: "side", supply: "side" },
    },
    branch: "demand",
    title: "Step up a level: the MSA population vs wages chart",
    body: ["Each city gives way to its own metro — same plane, one dot per MSA"],
  },

  /* 12 · the demand fork is answered → THE SECOND POUR: that pile splits */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true, demandLeaves: true },
      inst: { kind: "wage", grain: "msa", lens: true },
      focus: "demand",
      flow: { demand: "leaf", supply: "side" },
      pills: [`the fork line: median population growth ${sPct(POP_MED)}/yr`],
    },
    branch: "demand",
    title: "Answer the demand fork — the second pour",
    body: ["Metro weak too → MSA-wide; metro healthy → Admin-specific"],
  },

  /* 13 · THE HAND-OFF: focus swings to Supply, its question draws, and the
     instrument slot empties + repaints orange — the swap made loud */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true, demandLeaves: true, supplyQ: true },
      inst: { kind: "home", axes: false, dots: false },
      focus: "supply",
      flow: { demand: "leaf", supply: "side" },
    },
    branch: "supply",
    title: "Hand off to Supply: swap the instrument",
    body: ["Demand's question is settled — and nothing on the jobs plane can answer the supply side"],
  },

  /* 14 · the new instrument's frame draws (its own beat, like the opening) */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true, demandLeaves: true, supplyQ: true },
      inst: { kind: "home", dots: false },
      focus: "supply",
      flow: { demand: "leaf", supply: "side" },
    },
    branch: "supply",
    title: "Introduce the new vertical: housing cost",
    body: ["The supply side turns on what being there costs, not what the work pays"],
  },

  /* 15 · its own field lands */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true, demandLeaves: true, supplyQ: true },
      inst: { kind: "home" },
      focus: "supply",
      flow: { demand: "leaf", supply: "side" },
    },
    branch: "supply",
    title: "Land the supply cohort on the city housing scatter",
    body: ["Only the cities that took this fork — the rest are already sorted"],
  },

  /* 16 · the gate is answered → THE LAST POUR: the supply pile splits */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true, demandLeaves: true, supplyQ: true, supplyLeaves: true },
      inst: { kind: "home", lens: true },
      focus: "supply",
      flow: { demand: "leaf", supply: "leaf" },
      pills: [`the gate: median home-value growth ${sPct(HOME_GATE)}/yr`],
    },
    branch: "supply",
    title: "Answer the gate — the last pour",
    body: ["Home values outrunning the typical US place → Housing; lagging behind → Amenities"],
  },

  /* 17 · the recap: nothing moves, the instruments dim, the tree owns it */
  {
    scene: {
      layout: "tree",
      tree: { root: true, sides: true, demandQ: true, demandLeaves: true, supplyQ: true, supplyLeaves: true },
      inst: { kind: "home", lens: true },
      flow: { demand: "leaf", supply: "leaf" },
      recap: true,
      caption: `${N_CITIES} cities — ${DEMAND_N} demand-side · ${SUPPLY_N} supply-side`,
    },
    title: "Recap: four diagnoses from two questions",
    body: ["Every city ends up under the diagnosis its own numbers argue for"],
  },
];
export function TreePage() {
  /* the phone tier (tree.css): the stage crops to the tree */
  const phone = useMediaQuery(PHONE_QUERY);
  return (
    <MotionConfig reducedMotion="user">
      <div className="tree-page">
        {/* the landing carries ONLY the title (user-set) — no eyebrow, no
            lede; the scroll cue stays as furniture, and an abstract tree
            glyph (root → two sides → four leaves, in the page's branch
            colors and elbow style) keeps the hero from feeling empty */}
        <header className="tree-hero">
          <svg className="tree-hero-glyph" viewBox="0 0 240 132" aria-hidden="true">
            <g fill="none" strokeWidth={2} strokeLinecap="round">
              <path d="M 120 22 L 120 36 L 60 36 L 60 52" stroke="#3d7ab8" />
              <path d="M 120 22 L 120 36 L 180 36 L 180 52" stroke="#c98500" />
              <path d="M 60 66 L 60 82 L 24 82 L 24 100" stroke="#7059ad" />
              <path d="M 60 66 L 60 82 L 96 82 L 96 100" stroke="#3d7ab8" />
              <path d="M 180 66 L 180 82 L 144 82 L 144 100" stroke="#8a5a00" />
              <path d="M 180 66 L 180 82 L 216 82 L 216 100" stroke="#199e70" />
            </g>
            <circle cx={120} cy={16} r={6.5} fill="#ffffff" stroke="#a89f91" strokeWidth={1.4} strokeDasharray="3.5 3" />
            <circle cx={60} cy={59} r={6} fill="#3d7ab8" fillOpacity={0.85} />
            <circle cx={180} cy={59} r={6} fill="#c98500" fillOpacity={0.85} />
            <circle cx={24} cy={106} r={5.5} fill="#7059ad" fillOpacity={0.8} />
            <circle cx={96} cy={106} r={5.5} fill="#3d7ab8" fillOpacity={0.8} />
            <circle cx={144} cy={106} r={5.5} fill="#8a5a00" fillOpacity={0.8} />
            <circle cx={216} cy={106} r={5.5} fill="#199e70" fillOpacity={0.8} />
          </svg>
          <h1>How to Read the Diagnostic Pathway</h1>
          <p className="tree-sub">What is your city's constraint likely to be?</p>
          <div className="tree-cue">Scroll ↓</div>
        </header>

        <ScrollyAct steps={STEPS}>
          {(scene, _active, engaged) => (
            <DiagnoseStage scene={scene} live={engaged} compact={phone} />
          )}
        </ScrollyAct>

        {/* fine-print data note: the filters that produce the field
            (PLACE_MIN_POP + readings-at-window with the nearest-year snap +
            resolvable MSA, applied in scripts/build-real-data.mjs) and the
            two benchmark sources (people/pay: metro medians · the home gate:
            the all-US-places median) */}
        <footer className="tree-datanote">
          <strong>The field, precisely.</strong> Every US city of 100,000+ residents (by its
          official admin boundary) with population, wage and home-value readings at the
          pinned {START}–{END} window and a resolvable MSA: {N_CITIES} cities qualify.
          Where a series stops short of an endpoint, its reading snaps to the nearest
          year with data — the live tool's own rule, and what keeps Connecticut (whose
          wage series ends in 2020) on the chart. The population and wage medians are
          computed across all {METRO_DOTS.length} US metros, never from the city field
          itself; the home-value gate is the median across all{" "}
          {PLACE_HOME_N.toLocaleString("en-US")} US places with a home-value series —
          the same benchmark the live tool's supply test reads.
        </footer>
      </div>
    </MotionConfig>
  );
}
