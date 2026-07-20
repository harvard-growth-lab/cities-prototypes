import { useState } from "react";
import { SKY_H, SKY_W, drawSkyline, BOOM, type SkyScene } from "../readcity/skyline";
import { MEDIANS } from "../learning/data/metros";
import { verdictAt } from "../learning/data/derive";
import { DIAG_COLORS } from "../learning/content/figures";
import { PixelSim, type SimHud } from "./PixelSim";

/**
 * 05 · Two dials, eight slices — the pizza chart as a three-click
 * diagnosis. Step 1: set the two dials (people ▲/▼, paychecks ▲/▼) and
 * land in a quarter. Step 2: name the CAUSE behind the numbers — each
 * quarter asks its own follow-up question, and the answer is the second
 * cut, picking one of the quarter's two slices. Beside the steps, a
 * compact pizza figure builds itself as you answer: quadrant tints,
 * then the diagonals, then the wedge ids — with a "you" dot walking out
 * from the typical city at the center. Slices are tap-to-jump for free
 * play. The skyline below acts out whatever is currently diagnosed.
 * Verdicts come from the same verdictAt() the profile's chart uses.
 */

/** The tool's demand/supply verdict, said plainly. */
const SIDE_PLAIN: Record<string, string> = {
  demand: "a jobs-side story",
  supply: "a living-side story",
  none: "no constraint in sight",
};

/** The scenarios carry the sandbox's dark-theme diagnosis colors; on this
 *  paper page we speak the same GL-light palette as the rest of the page. */
const GL_COLOR: Record<string, string> = {
  [DIAG_COLORS.positiveDemand]: "var(--pos-demand)",
  [DIAG_COLORS.positiveSupply]: "var(--pos-supply)",
  [DIAG_COLORS.negativeDemand]: "var(--neg-demand)",
  [DIAG_COLORS.negativeSupply]: "var(--neg-supply)",
};
const glc = (c: string) => GL_COLOR[c] ?? c;

type Dir = 1 | -1;

/* ————— step 1: the four quarters, each with its step-2 question ————— */

type QuarterKey = "upup" | "updown" | "downup" | "downdown";
const quadOf = (pop: Dir, wage: Dir): QuarterKey =>
  pop > 0 ? (wage > 0 ? "upup" : "updown") : wage > 0 ? "downup" : "downdown";

const QUARTERS: Record<
  QuarterKey,
  {
    pop: Dir;
    wage: Dir;
    tint: string;
    rect: { x: number; y: number }; // quadrant fill, in the 100×70 box
    state: SkyScene;
    hud: SimHud;
    caption: string;
    question: string;
    causes: { cell: string; label: string }[]; // answer → slice
  }
> = {
  upup: {
    pop: 1,
    wage: 1,
    tint: "var(--pos-demand)",
    rect: { x: 50, y: 0 },
    state: { ...BOOM, hour: 12.1, crane: 0.8, build: 0.55, flow: 0.85, harbor: 1, factory: 1, occ: 1 },
    hud: { people: 1, wages: 1, label: "a jobs boom" },
    caption:
      "People and pay rising together: employers are winning the tug-of-war for workers. That points at the jobs side — the demand side — of the city. The next question is whether housing keeps up.",
    question: "The jobs boom is on — what's housing doing?",
    causes: [
      { cell: "e", label: "Keeping pace: the boom becomes neighbors" },
      { cell: "ne", label: "Falling behind: the boom becomes rents and raises" },
    ],
  },
  updown: {
    pop: 1,
    wage: -1,
    tint: "var(--pos-supply)",
    rect: { x: 50, y: 35 },
    state: { ...BOOM, hour: 15.2, crane: 0.95, build: 0.8, flow: 0.8, harbor: 0.45, factory: 0.5, occ: 1.05 },
    hud: { people: 1, wages: -1, label: "cheap living pulls people in" },
    caption:
      "More people on thinner paychecks: the city itself got easier to afford or nicer to live in, and people accept a little less pay to be here. That's the living side — the supply side — and it isn't a problem.",
    question: "Pay is thinner, yet people keep coming — why?",
    causes: [
      { cell: "se", label: "The city got cheaper or nicer, and the jobs stretch" },
      { cell: "s", label: "They come anyway; the jobs can't stretch" },
    ],
  },
  downup: {
    pop: -1,
    wage: 1,
    tint: "var(--neg-supply)",
    rect: { x: 0, y: 0 },
    state: { ...BOOM, hour: 13.2, rain: 1, factory: 0.85, harbor: 0.8, flow: -0.75, occ: 0.7, crane: 0.08, build: 0.3 },
    hud: { people: -1, wages: 1, label: "life is pushing people out" },
    caption:
      "People leave even as pay rises: employers are paying extra to keep anyone, and losing. The living side has gone wrong — think Flint after the water crisis. Rising pay in a shrinking city is a warning light, not a win.",
    question: "Life here is pushing people out — how does it show?",
    causes: [
      { cell: "nw", label: "The exodus leads; raises can't hold anyone" },
      { cell: "n", label: "Employers bid pay way up — and still lose people slowly" },
    ],
  },
  downdown: {
    pop: -1,
    wage: -1,
    tint: "var(--neg-demand)",
    rect: { x: 0, y: 35 },
    state: { ...BOOM, hour: 20.3, factory: 0.05, harbor: 0.1, flow: -0.9, occ: 0.5, crane: 0.04, build: 0.3 },
    hud: { people: -1, wages: -1, label: "the jobs are leaving" },
    caption:
      "People and pay falling together: the jobs engine itself is failing — a plant closed, an industry moved on. The demand side is the patient here.",
    question: "The jobs engine is failing — what do people do?",
    causes: [
      { cell: "w", label: "They follow the firms out" },
      { cell: "sw", label: "They stay and ride it out; pay keeps sliding" },
    ],
  },
};

/* ————— step 2's landing spots: the eight slices ————— */

interface WedgeCell {
  key: string;
  bearing: number | null; // degrees from +x axis, CCW; null = center
  dPop: number; // illustrative deltas vs the benchmark (sector center)
  dWage: number;
  state: SkyScene;
  story: string;
}

const CELLS: WedgeCell[] = [
  {
    key: "center",
    bearing: null,
    dPop: 0,
    dWage: 0,
    state: { hour: 17.8, occ: 0.8, flow: 0.05, factory: 0.7, harbor: 0.6, crane: 0.12, build: 0.15, fortress: 0, rain: 0 },
    story:
      "Dead center: the typical city, growing at the middle-of-the-pack rate on both dials. This calm little town is the reference point — every other city on this wheel is a way of leaving it.",
  },
  {
    key: "e",
    bearing: 22.5,
    dPop: 1.4,
    dWage: 0.6,
    state: { hour: 12.1, occ: 1, flow: 0.85, factory: 1, harbor: 1, crane: 0.8, build: 0.55, fortress: 0, rain: 0 },
    story:
      "People arrive faster than pay rises: the boom is being absorbed. Cranes keep pace with the bridge, so success shows up as population.",
  },
  {
    key: "ne",
    bearing: 67.5,
    dPop: 0.6,
    dWage: 1.4,
    state: { hour: 11.2, occ: 0.95, flow: 0.45, factory: 1, harbor: 1, crane: 0.4, build: 0.35, fortress: 0.45, rain: 0 },
    story:
      "Pay is outrunning people: employers bid up wages faster than the city can house the winners. Note the lid creeping over the lot — a boom leaking into prices.",
  },
  {
    key: "n",
    bearing: 112.5,
    dPop: -0.6,
    dWage: 1.4,
    state: { hour: 17.6, occ: 0.8, flow: -0.35, factory: 0.85, harbor: 0.8, crane: 0.05, build: 0.25, fortress: 0.6, rain: 0.2 },
    story:
      "Paychecks up, people slipping out anyway — the raise is compensation, not success. Something about living here needs paying for.",
  },
  {
    key: "nw",
    bearing: 157.5,
    dPop: -1.4,
    dWage: 0.6,
    state: { hour: 13.2, occ: 0.7, flow: -0.75, factory: 0.85, harbor: 0.8, crane: 0.08, build: 0.3, fortress: 0, rain: 1 },
    story:
      "The exodus leads and wages chase it: Flint's wedge. The jobs are fine; life isn't. Rising pay in an emptying city is a distress flare.",
  },
  {
    key: "w",
    bearing: 202.5,
    dPop: -1.4,
    dWage: -0.6,
    state: { hour: 19.4, occ: 0.55, flow: -0.8, factory: 0.35, harbor: 0.3, crane: 0, build: 0.2, fortress: 0, rain: 0 },
    story:
      "People go first, pay follows: the slow leak. Each departing household takes a little demand with it, and the town dims one window at a time.",
  },
  {
    key: "sw",
    bearing: 247.5,
    dPop: -0.6,
    dWage: -1.4,
    state: { hour: 20.3, occ: 0.5, flow: -0.9, factory: 0.05, harbor: 0.1, crane: 0.04, build: 0.3, fortress: 0, rain: 0 },
    story:
      "Pay collapses ahead of population: the export base went, the oxygen thinned, and the people who can leave are leaving. Part two's ghost street, on the chart.",
  },
  {
    key: "s",
    bearing: 292.5,
    dPop: 0.6,
    dWage: -1.4,
    state: { hour: 16, occ: 0.8, flow: 0.25, factory: 0.35, harbor: 0.35, crane: 0.1, build: 0.2, fortress: 0, rain: 0 },
    story:
      "Pay sags but people trickle in anyway — the town is cheap, and cheap is a kind of offer. Watch whether the jobs machine ever catches up.",
  },
  {
    key: "se",
    bearing: 337.5,
    dPop: 1.4,
    dWage: -0.6,
    state: { hour: 15.2, occ: 1.05, flow: 0.8, factory: 0.5, harbor: 0.45, crane: 0.95, build: 0.8, fortress: 0, rain: 0 },
    story:
      "Growth on thinner paychecks: homes got built, commutes got shorter, and the good life does the recruiting instead of the payroll. Nothing is wrong with this city.",
  },
];

const CENTER = CELLS[0];
const RING = CELLS.filter((c) => c.bearing !== null);
const cellVerdict = (c: WedgeCell) =>
  verdictAt(MEDIANS.popCagr + c.dPop, MEDIANS.wageCagr + c.dWage);
const cellQuad = (c: WedgeCell): QuarterKey => quadOf(c.dPop > 0 ? 1 : -1, c.dWage > 0 ? 1 : -1);
/** "pop ↑ · wages ↑↑" → the page's plain words. */
const plainQuad = (q: string) => q.replace("pop", "people").replace("wages", "pay");

/* ————— figure geometry: 8 wedges of a w×h box around (cx, cy) ————— */

// The eight wedges are bounded by the two axes (drawn through the centre) and
// the two box diagonals (centre → each corner). Because the box isn't square,
// true 45° geometric sectors would land at slope ±1 and miss the corners — so
// the wedge edges are pinned to the same perimeter points the axes/diagonals
// reach, and every wedge is a triangle whose outer edge lies on the box border.
// Order matches sectorOf(): index 0 opens at the +x axis and runs CCW.
const perimPoints = (cx: number, cy: number, w: number, h: number): [number, number][] => [
  [w, cy], // 0 · +x axis
  [w, 0], //  1 · NE corner (diagonal)
  [cx, 0], // 2 · +y (up) axis
  [0, 0], //  3 · NW corner (diagonal)
  [0, cy], // 4 · −x axis
  [0, h], //  5 · SW corner (diagonal)
  [cx, h], // 6 · −y (down) axis
  [w, h], //  7 · SE corner (diagonal)
];

/** Triangle points for wedge k: centre → perimeter[k] → perimeter[k+1]. */
export function sectorPoints(cx: number, cy: number, w: number, h: number, k: number): string {
  const perim = perimPoints(cx, cy, w, h);
  const pts: [number, number][] = [[cx, cy], perim[k], perim[(k + 1) % 8]];
  return pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
}

/** Sector index (0..7) under a ring cell's bearing. */
const sectorOf = (bearing: number) => Math.round((bearing - 22.5) / 45);

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Where the "you" dot sits for a slice, in the 100×70 box. */
const slicePos = (bearing: number): [number, number] => [
  50 + 33 * Math.cos(rad(bearing)),
  35 - 23 * Math.sin(rad(bearing)),
];
/** Wedge id label spot — a touch further out than the dot. */
const idPos = (bearing: number): [number, number] => [
  50 + 40 * Math.cos(rad(bearing)),
  35.4 - 28 * Math.sin(rad(bearing)),
];

/* ————— the widget ————— */

export function PizzaWidget() {
  const [pop, setPop] = useState<Dir | null>(null);
  const [wage, setWage] = useState<Dir | null>(null);
  const [slice, setSlice] = useState<string | null>(null);

  const quadrant = pop !== null && wage !== null ? quadOf(pop, wage) : null;
  const cell = slice ? CELLS.find((c) => c.key === slice)! : null;
  const verdict = cell ? cellVerdict(cell) : null;

  // any dial change moves the quadrant, so the chosen slice no longer applies
  const setDial = (which: "pop" | "wage", dir: Dir) => {
    if (which === "pop") {
      if (pop === dir) return;
      setPop(dir);
    } else {
      if (wage === dir) return;
      setWage(dir);
    }
    setSlice(null);
  };
  // tap a quarter of the figure = set both dials at once
  const jumpQuad = (key: QuarterKey) => {
    if (quadrant === key) return;
    setPop(QUARTERS[key].pop);
    setWage(QUARTERS[key].wage);
    setSlice(null);
  };
  // tap a slice = the whole diagnosis in one go
  const jumpSlice = (c: WedgeCell) => {
    setPop(c.dPop > 0 ? 1 : -1);
    setWage(c.dWage > 0 ? 1 : -1);
    setSlice(c.key);
  };

  const target = cell ? cell.state : quadrant ? QUARTERS[quadrant].state : CENTER.state;
  const hud: SimHud = {
    people: pop ?? 0,
    wages: wage ?? 0,
    label: verdict
      ? verdict.scenario.title
      : quadrant
        ? QUARTERS[quadrant].hud.label
        : "the typical city",
  };
  const you: [number, number] = cell
    ? slicePos(cell.bearing!)
    : quadrant
      ? [QUARTERS[quadrant].rect.x + 25, QUARTERS[quadrant].rect.y + 17.5]
      : [50, 35];

  return (
    <>
      <div className="pz-row">
        <div className="pz-steps">
          <div className="pz-step">
            <span className="pz-step-head">1 · Read the two dials</span>
            <div className="pz-dial">
              <span className="pz-dial-name">People</span>
              <button className="btn" aria-pressed={pop === 1} onClick={() => setDial("pop", 1)}>
                ▲ arriving
              </button>
              <button className="btn" aria-pressed={pop === -1} onClick={() => setDial("pop", -1)}>
                ▼ leaving
              </button>
            </div>
            <div className="pz-dial">
              <span className="pz-dial-name">Paychecks</span>
              <button className="btn" aria-pressed={wage === 1} onClick={() => setDial("wage", 1)}>
                ▲ rising
              </button>
              <button className="btn" aria-pressed={wage === -1} onClick={() => setDial("wage", -1)}>
                ▼ falling
              </button>
            </div>
          </div>

          <div className={`pz-step${quadrant ? "" : " off"}`}>
            <span className="pz-step-head">2 · Name the cause — the second cut</span>
            <p className="pz-question">
              {quadrant ? QUARTERS[quadrant].question : "Set both dials first."}
            </p>
            {quadrant && (
              <div className="pz-causes">
                {QUARTERS[quadrant].causes.map((cz) => {
                  const cc = CELLS.find((x) => x.key === cz.cell)!;
                  const v = cellVerdict(cc);
                  return (
                    <button
                      key={cz.cell}
                      className="btn pz-cause"
                      aria-pressed={slice === cz.cell}
                      onClick={() => setSlice(cz.cell)}
                    >
                      <span className="pc-main">{cz.label}</span>
                      <span className="pc-sub">
                        <b style={{ color: glc(v.scenario.color) }}>{v.wedge}</b>{" "}
                        {plainQuad(v.scenario.quadrant)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <figure className={`pz-fig${quadrant ? " has-quad" : ""}${slice ? " has-slice" : ""}`}>
          <svg viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden>
            {(Object.keys(QUARTERS) as QuarterKey[]).map((key) => (
              <rect
                key={key}
                className={`pz-q${quadrant === key ? " on" : ""}`}
                x={QUARTERS[key].rect.x}
                y={QUARTERS[key].rect.y}
                width={50}
                height={35}
                fill={QUARTERS[key].tint}
                onClick={() => jumpQuad(key)}
              />
            ))}
            {RING.map((c) => {
              const cand = !slice && quadrant === cellQuad(c);
              return (
                <polygon
                  key={c.key}
                  className={`pz-sector${slice === c.key ? " on" : cand ? " cand" : ""}`}
                  points={sectorPoints(50, 35, 100, 70, sectorOf(c.bearing!))}
                  fill={glc(cellVerdict(c).scenario.color)}
                  onClick={() => jumpSlice(c)}
                >
                  <title>{cellVerdict(c).scenario.title}</title>
                </polygon>
              );
            })}
            <line className="pz-axis" x1={1.5} y1={35} x2={98.5} y2={35} />
            <line className="pz-axis" x1={50} y1={1.5} x2={50} y2={68.5} />
            <line className="pz-diag" x1={8} y1={5.6} x2={92} y2={64.4} />
            <line className="pz-diag" x1={8} y1={64.4} x2={92} y2={5.6} />
            <text className="pz-axlabel" x={98} y={33} textAnchor="end">
              people →
            </text>
            <text className="pz-axlabel" x={52.5} y={5}>
              pay ↑
            </text>
            {RING.map((c) => {
              const [x, y] = idPos(c.bearing!);
              const cand = !slice && quadrant === cellQuad(c);
              return (
                <text
                  key={c.key}
                  className={`pz-wid${slice === c.key ? " on" : cand ? " cand" : ""}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fill={glc(cellVerdict(c).scenario.color)}
                >
                  {cellVerdict(c).wedge}
                </text>
              );
            })}
            <circle className="pz-home" cx={50} cy={35} r={4} />
            <g className="pz-you" style={{ transform: `translate(${you[0]}px, ${you[1]}px)` }}>
              <circle className="halo" r={3.4} />
              <circle className="core" r={1.9} />
            </g>
          </svg>
          <figcaption className="data-note pz-fig-hint">
            The pizza chart: the colors are the four quarters, the diagonals the second cut, the
            dashed ring the typical city — or tap any slice to jump straight to it.
          </figcaption>
        </figure>
      </div>

      <PixelSim
        w={SKY_W}
        h={SKY_H}
        draw={drawSkyline}
        target={target}
        hud={hud}
        ariaLabel="The pixel skyline acts out your answers: it idles at the typical city until the dials are set, then cranes and inbound trucks play the booms, rain and outbound trucks the declines. Two HUD chips read the dials."
      />
      <p className="widget-caption">
        {cell ? (
          <>
            {cell.story}
            {verdict && (
              <>
                {" "}
                <span className="wc-verdict">
                  In the pizza chart this is slice{" "}
                  <b style={{ color: glc(verdict.scenario.color) }}>{verdict.wedge}</b> ·{" "}
                  {verdict.scenario.title} — <strong>{SIDE_PLAIN[verdict.side]}</strong>
                  {verdict.spiralRisk ? ", and it can spiral if ignored" : ""}.
                </span>
              </>
            )}
          </>
        ) : quadrant ? (
          QUARTERS[quadrant].caption
        ) : (
          "Every diagnosis starts with these two numbers, read together. Set both dials — until then the skyline idles at the typical city, dead center of the chart."
        )}
      </p>
    </>
  );
}

/* ————— the card thumbnail: the pizza itself, on the dark frame ————— */

const THUMB_COLS = [
  DIAG_COLORS.positiveDemand,
  DIAG_COLORS.positiveDemand,
  DIAG_COLORS.negativeSupply,
  DIAG_COLORS.negativeSupply,
  DIAG_COLORS.negativeDemand,
  DIAG_COLORS.negativeDemand,
  DIAG_COLORS.positiveSupply,
  DIAG_COLORS.positiveSupply,
];

export function PizzaThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden style={{ display: "block", width: "100%", height: "auto" }}>
      {THUMB_COLS.map((c, k) => (
        <polygon
          key={k}
          points={sectorPoints(240, 135, 480, 270, k)}
          fill={c}
          opacity={k % 2 ? 0.2 : 0.34}
        />
      ))}
      <line x1={10} y1={135} x2={470} y2={135} stroke="#e9e7e0" strokeWidth={1.6} strokeDasharray="7 5" opacity={0.6} />
      <line x1={240} y1={8} x2={240} y2={262} stroke="#e9e7e0" strokeWidth={1.6} strokeDasharray="7 5" opacity={0.6} />
      <line x1={48} y1={27} x2={432} y2={243} stroke="#e9e7e0" strokeWidth={1.2} strokeDasharray="4 7" opacity={0.42} />
      <line x1={48} y1={243} x2={432} y2={27} stroke="#e9e7e0" strokeWidth={1.2} strokeDasharray="4 7" opacity={0.42} />
      <circle cx={240} cy={135} r={26} fill="#0d0d0d" opacity={0.85} />
      <g fill="#e9e7e0" opacity={0.92}>
        <rect x={228} y={128} width={7} height={19} />
        <rect x={237} y={121} width={8} height={26} />
        <rect x={247} y={132} width={6} height={15} />
      </g>
    </svg>
  );
}
