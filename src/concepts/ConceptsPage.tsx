import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Ctx } from "../pixel/pixel";
import { SKY_H, SKY_W, drawSkyline, BOOM, NIGHT, type SkyScene } from "../readcity/skyline";
import { ST_H, ST_W, drawStreet, type StScene } from "../readcity/street";
import { VAL_H, VAL_W, drawValley, type ValScene } from "./valley";
import {
  TWIN_H,
  TWIN_W,
  drawTwin,
  readTwin,
  TWIN_MODEL,
  type TwinReadout,
  type TwinScene,
} from "./twin";
import { PizzaThumb, PizzaWidget } from "./PizzaWidget";
import { PixelSim } from "./PixelSim";
import { MiniScrolly, type MiniStep } from "./MiniScrolly";
import { Barrel } from "./Barrel";
import { TEXTBOOK_CONCEPTS } from "./TextbookFigs";
import { SKETCH_A } from "./SketchFigsA";
import { SKETCH_B } from "./SketchFigsB";
import { MICRO_A } from "./MicroFigsA";
import { MICRO_B } from "./MicroFigsB";
import { MICRO_C } from "./MicroFigsC";
import { MICRO_D } from "./MicroFigsD";
import { MICRO_E } from "./MicroFigsE";
import "./concepts.css";

/**
 * "City Concepts" — seven bite-size toys, one per idea the city profiles
 * lean on. Free-play only: predict-then-reveal lives in the profile's
 * quiz layer; this page is the reference shelf you can poke.
 * Scene presets are lifted from the story's hand-tuned ACT states.
 */

/* ————— 01 · people vote with their feet ————— */

const FEET_ORDER = ["steady", "inflow", "exodus"] as const;
type FeetKey = (typeof FEET_ORDER)[number];
const FEET: Record<FeetKey, { label: string; state: SkyScene; caption: string }> = {
  steady: {
    label: "A steady evening",
    state: NIGHT,
    caption:
      "Just past nine on a normal night. Every lit window is a household that chose this city today — a census is this picture, counted carefully.",
  },
  inflow: {
    label: "Word gets out",
    state: { ...NIGHT, hour: 7.4, flow: 1, occ: 0.95, harbor: 0.65 },
    caption:
      "Decent pay, sane rent, livable streets — nobody files a report about a good deal; they just come. Every truck on the bridge is a household voting yes.",
  },
  exodus: {
    label: "The deal sours",
    state: { ...NIGHT, hour: 18.5, flow: -1, occ: 0.55, factory: 0.35, harbor: 0.4 },
    caption:
      "Better pay or safer streets somewhere else, and the same bridge runs in reverse. The windows go dark one lease at a time — Detroit's story.",
  },
};

function FeetWidget() {
  const [k, setK] = useState<FeetKey>("steady");
  return (
    <>
      <div className="widget-controls">
        {FEET_ORDER.map((key) => (
          <button key={key} className="btn" aria-pressed={k === key} onClick={() => setK(key)}>
            {FEET[key].label}
          </button>
        ))}
      </div>
      <PixelSim
        w={SKY_W}
        h={SKY_H}
        draw={drawSkyline}
        target={FEET[k].state}
        ariaLabel="A pixel riverfront city at night. Depending on the chosen scenario, moving trucks stream across the bridge into town or out of it, and the share of lit windows rises or falls."
      />
      <p className="widget-caption">{FEET[k].caption}</p>
      <p className="data-note">
        In practice this scene becomes two comparisons: is the city gaining people faster than its
        country, and faster than its peers? Four combinations, four situations:
      </p>
      <div className="mini-table2">
        <span className="mt-corner" />
        <span className="mt-col">faster than peers</span>
        <span className="mt-col">slower than peers</span>
        <span className="mt-row">growing faster than the nation</span>
        <span className="mt-cell is-good">Star performer</span>
        <span className="mt-cell">Good — could be great</span>
        <span className="mt-row">growing slower than the nation</span>
        <span className="mt-cell">Resilience in decline</span>
        <span className="mt-cell is-bad">Critical growth challenge</span>
      </div>
    </>
  );
}

/* ————— 02 · spatial equilibrium ————— */

const TWIN_ORDER = ["steady", "boomB", "crisisA", "boomBoth"] as const;
type TwinKey = (typeof TWIN_ORDER)[number];
const TWIN: Record<TwinKey, { label: string; state: TwinScene; caption: string }> = {
  steady: {
    label: "No shocks",
    state: { hour: 18.2, boomA: 0, boomB: 0, amenA: 1, amenB: 1 },
    caption:
      "Two identical towns — and the bridge still never empties. People cross both ways all the time; the flows just cancel out. That's spatial equilibrium: neither town is a better deal, so the moving trucks tie.",
  },
  boomB: {
    label: "Jobs boom in Bruma",
    state: { hour: 19.2, boomA: 0, boomB: 1, amenA: 1, amenB: 1 },
    caption:
      "New jobs land in Bruma and its deal pulls ahead — watch the trucks tip east and the meters respond. But every arrival bids up rents, and a line forms at the letting office. Once crowding catches up with the pay, the deals even out and the trucks tie again. Bruma keeps the extra people; the advantage is gone.",
  },
  crisisA: {
    label: "A crisis hits Alba",
    state: { hour: 13.5, boomA: 0, boomB: 0, amenA: 0.12, amenB: 1 },
    caption:
      "Bad water, failing schools — take your pick. Alba's quality-of-life meter drops and people leave even though the jobs never changed. Alba ends up smaller and cheaper: the low rent is what it now takes to keep anyone. Shrinking while pay holds up is the signature of this story — think Flint.",
  },
  boomBoth: {
    label: "Boom on both banks",
    state: { hour: 19.8, boomA: 1, boomB: 1, amenA: 1, amenB: 1 },
    caption:
      "Give both towns the same boom and neither gets ahead — the trucks go straight back to their tie. People move on relative deals, not absolute ones.",
  },
};

const TOWN_META = [
  { name: "Alba", color: "#3987e5" },
  { name: "Bruma", color: "#9085e9" },
] as const;

function Meter({
  label,
  v,
  max,
  color,
}: {
  label: string;
  v: number;
  max: number;
  color: string;
}) {
  return (
    <div className="meter">
      <span>{label}</span>
      <span className="bar">
        <span
          style={{
            width: `${Math.max(2, Math.min(100, (Math.max(0, v) / max) * 100))}%`,
            background: color,
          }}
        />
      </span>
      <span className="val">{Math.round(v * 100)}</span>
    </div>
  );
}

function TownPanel({ town, r }: { town: 0 | 1; r: TwinReadout | null }) {
  const pick = (a: number, b: number) => (town ? b : a);
  const share = r ? pick(r.shareA, r.shareB) : 0.5;
  const wage = r ? pick(r.wageA, r.wageB) : 0;
  const amen = r ? pick(r.amenA, r.amenB) : TWIN_MODEL.W_AMEN;
  const crowd = r ? pick(r.crowdA, r.crowdB) : TWIN_MODEL.W_CROWD * 0.5;
  const deal = r ? pick(r.dealA, r.dealB) : TWIN_MODEL.W_AMEN - TWIN_MODEL.W_CROWD * 0.5;
  return (
    <div className="city-stats">
      <h4>
        <span className="city-dot" style={{ background: TOWN_META[town].color }} />
        {TOWN_META[town].name}
      </h4>
      <Meter label="Population share" v={share} max={1} color={TOWN_META[town].color} />
      <Meter label="Job-market pull" v={wage} max={TWIN_MODEL.W_BOOM} color="var(--ink-3)" />
      <Meter label="Quality of life" v={amen} max={TWIN_MODEL.W_AMEN} color="#1a6b53" />
      <Meter label="Rent pressure" v={crowd} max={TWIN_MODEL.W_CROWD} color="var(--c-2)" />
      <Meter label="The deal" v={deal} max={0.7} color="var(--accent)" />
    </div>
  );
}

function FlowNote({ net }: { net: number | undefined }) {
  const n = net ?? 0;
  const balanced = Math.abs(n) < 0.07;
  return (
    <p className="data-note" style={{ textAlign: "center", margin: "6px 0 0" }} aria-live="polite">
      {balanced
        ? "Deals even on both banks — people still cross, but the flows cancel."
        : n > 0
          ? "Bruma's deal is better right now — net flow east until crowding evens it out."
          : "Alba's deal is better right now — net flow west until crowding evens it out."}
    </p>
  );
}

function TwinWidget() {
  const [k, setK] = useState<TwinKey>("steady");
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const [r, setR] = useState<TwinReadout | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setR(readTwin(cvRef.current)), 300);
    return () => window.clearInterval(id);
  }, []);
  return (
    <>
      <div className="widget-controls">
        {TWIN_ORDER.map((key) => (
          <button key={key} className="btn" aria-pressed={k === key} onClick={() => setK(key)}>
            {TWIN[key].label}
          </button>
        ))}
      </div>
      <PixelSim
        w={TWIN_W}
        h={TWIN_H}
        draw={drawTwin}
        target={TWIN[k].state}
        canvasRef={cvRef}
        ariaLabel="Two pixel towns, Alba and Bruma, face each other across a strait, joined by one arched bridge. Trucks cross in both directions at all times. When one town booms or sours, extra trucks flow toward the better deal, its windows fill, and a queue grows at its letting office until the flows balance again."
        overlay={
          <div className="sim-towntags" aria-hidden>
            <span className="tt">
              <i style={{ background: "#3987e5" }} /> Alba
            </span>
            <span className="tt">
              <i style={{ background: "#9085e9" }} /> Bruma
            </span>
          </div>
        }
      />
      <FlowNote net={r?.net} />
      <div className="sim-stats">
        <TownPanel town={0} r={r} />
        <TownPanel town={1} r={r} />
      </div>
      <p className="widget-caption">{TWIN[k].caption}</p>
    </>
  );
}

/* ————— 03 · you are not an island ————— */

const VALLEY_TIMES = ["dawn", "midday", "evening", "night"] as const;
type ValleyKey = (typeof VALLEY_TIMES)[number];
const VALLEY: Record<ValleyKey, { label: string; hour: number; caption: string }> = {
  dawn: {
    label: "Morning rush",
    hour: 8.3,
    caption:
      "The house windows dim and the road pours across the line into the towers. None of these commuters moved cities this morning — they just changed which side of a line they stand on.",
  },
  midday: {
    label: "Midday",
    hour: 12.8,
    caption:
      "Downtown now holds far more people than it houses — even the hospital's parking lot filled up on schedule. Count “the city” at noon and at midnight and you get two different cities.",
  },
  evening: {
    label: "Evening rush",
    hour: 18.3,
    caption:
      "The tide turns: towers empty, house windows come on, and the same line gets crossed the other way. The labor market breathes through the boundary twice a day.",
  },
  night: {
    label: "Night",
    hour: 21.8,
    caption:
      "Everyone's home. Only now does the line match where people actually are — which is exactly why residence-based numbers alone can mislead you.",
  },
};
const VALLEY_HIDDEN_CAPTION =
  "Line's gone. Try to find the boundary now — the valley can't either. Commuters, customers and rents never noticed it was there.";
const VALLEY_CITY_ONLY_CAPTION =
  "Govern only your side of the line, and this is your whole city: a hospital somewhere out in the dark, its parking lot stranded on your side, towers whose workers sleep where you can't count them. That's why the profile switches to metro numbers.";

function ValleyWidget() {
  const [k, setK] = useState<ValleyKey>("dawn");
  const [hideLine, setHideLine] = useState(false);
  const [cityOnly, setCityOnly] = useState(false);
  const target: ValScene = {
    hour: VALLEY[k].hour,
    boundary: hideLine ? 0 : 1,
    cityOnly: cityOnly ? 1 : 0,
  };
  const caption = cityOnly
    ? VALLEY_CITY_ONLY_CAPTION
    : hideLine
      ? VALLEY_HIDDEN_CAPTION
      : VALLEY[k].caption;
  return (
    <>
      <div className="widget-controls">
        {VALLEY_TIMES.map((key) => (
          <button key={key} className="btn" aria-pressed={k === key} onClick={() => setK(key)}>
            {VALLEY[key].label}
          </button>
        ))}
        <span className="control-sep" />
        <button className="btn" aria-pressed={hideLine} onClick={() => setHideLine((v) => !v)}>
          Hide the line
        </button>
        <button className="btn" aria-pressed={cityOnly} onClick={() => setCityOnly((v) => !v)}>
          Only my city
        </button>
      </div>
      <PixelSim
        w={VAL_W}
        h={VAL_H}
        draw={drawValley}
        target={target}
        ariaLabel="A pixel valley: small houses on the left, a main street and hospital in the middle, downtown towers on the right, one road running through. A dashed red line — the city limit — stands mid-scene. As the time of day changes, commuter cars stream across the line toward the towers in the morning and back home at dusk, and the lit windows swap sides accordingly."
      />
      <p className="widget-caption">{caption}</p>
      <p className="data-note">
        Metro areas are drawn from commuting — where people actually live and work — not from the
        lines on the charter map. That's why serious city analysis measures the whole metro: the
        labor market is the unit that matters, and no city hall governs all of its own.
      </p>
    </>
  );
}

/* ————— 04 · exports are a city's oxygen ————— */

const DOCKS: StScene = {
  hour: 8.4,
  factory: 1,
  ship: 1,
  shops: 0.92,
  workers: 0.6,
  tourists: 0.25,
  gold: 0,
};

const OXYGEN_STEPS: MiniStep<StScene>[] = [
  {
    state: { ...DOCKS, hour: 9.2 },
    title: "A city can't feed itself.",
    body: [
      "The food, the fuel, the phones — almost all of it is made somewhere else, and all of it must be paid for with money earned from somewhere else. That money enters here: the docks, where the city sells what it makes to people who don't live in it.",
    ],
  },
  {
    state: { ...DOCKS, hour: 10.2, gold: 1 },
    title: "Breathe in, breathe out.",
    body: [
      "Boxes go out; money comes in. Economists call it tradable income, but it behaves exactly like oxygen. Every gold fleck drifting off the ship is a paycheck that outsiders are funding.",
    ],
  },
  {
    state: { ...DOCKS, hour: 12.2, gold: 0.6, tourists: 1 },
    title: "An export doesn't need a box.",
    body: [
      "A hospital treating patients from three counties away is exporting surgery. A university is exporting lectures. That tour boat is exporting a nice Tuesday afternoon. None of it ships in a container — and all of it is oxygen.",
    ],
  },
  {
    state: { ...DOCKS, hour: 16.6, gold: 1, workers: 1, shops: 1, tourists: 0.4 },
    title: "One paycheck from outside, two more at home.",
    body: [
      "Follow the shift change: the dockworkers' wages get spent at the bakery, the grocer, the barber — local jobs funded entirely by export money. In US cities, each exporting job supports roughly 1.6–2.5 local ones. The multiplier.",
    ],
  },
  {
    state: { ...DOCKS, hour: 19.6, factory: 0, ship: 0, gold: 0, workers: 0, shops: 0.1, tourists: 0 },
    title: "Now hold your breath.",
    body: [
      "Close the plant and the multiplier runs in reverse: lose the plant, lose the barista, and the FOR RENT signs bloom down Main Street. This — not the closure itself — is how a city empties.",
    ],
  },
];

/* ————— 06 · the fortress city ————— */

const FORTRESS_ORDER = ["build", "fortress"] as const;
type FortressKey = (typeof FORTRESS_ORDER)[number];
const FORTRESS: Record<
  FortressKey,
  { label: string; state: SkyScene; caption: string; split: { pop: string; price: string } }
> = {
  build: {
    label: "Let it build",
    state: { ...BOOM, hour: 11.4, crane: 1, build: 0.8, flow: 1, occ: 1.05, harbor: 1 },
    caption:
      "The city says yes: permits keep pace with arrivals and the boom becomes people. Rents drift up a little — the skyline does most of the adjusting.",
    split: { pop: "+12%", price: "+6%" },
  },
  fortress: {
    label: "Ban the cranes",
    state: { ...BOOM, hour: 18.4, crane: 0.04, build: 0.16, fortress: 1, flow: 0, harbor: 1, factory: 0.9 },
    caption:
      "The city says no: the tower freezes at the legal lid, arrivals turn back at the bridge, and the same boom becomes rent instead of neighbors. High pay here is mostly the price of admission.",
    split: { pop: "+1%", price: "+34%" },
  },
};

function FortressWidget() {
  const [k, setK] = useState<FortressKey>("build");
  return (
    <>
      <div className="widget-controls">
        {FORTRESS_ORDER.map((key) => (
          <button key={key} className="btn" aria-pressed={k === key} onClick={() => setK(key)}>
            {FORTRESS[key].label}
          </button>
        ))}
      </div>
      <PixelSim
        w={SKY_W}
        h={SKY_H}
        draw={drawSkyline}
        target={FORTRESS[k].state}
        ariaLabel="The same export boom run twice over the pixel skyline. With building allowed, a tower crane raises a new building; with cranes banned, the half-built tower freezes under a dashed height-cap line and moving trucks turn back at the bridge."
      />
      <p className="widget-caption">{FORTRESS[k].caption}</p>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">where the boom went · people</div>
          <div className="value">{FORTRESS[k].split.pop}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">where the boom went · rents</div>
          <div className="value">{FORTRESS[k].split.price}</div>
        </div>
      </div>
      <p className="data-note">
        Illustrative numbers — it's the same boom both times; the only change is whether building
        is allowed. Researchers estimate this mistake, in just a few big US cities, costs the
        whole country a few percent of GDP.
      </p>
    </>
  );
}

/* ————— the page: a grid of cards, each opening a bite-size modal ————— */

/** One still frame of a scene — the card thumbnails. Rendered full-size
 *  offscreen, then area-averaged down to half size so the Bayer-dithered
 *  skies melt into smooth gradients instead of aliasing into plaid. */
function SceneThumb<S extends Record<string, number>>({
  w,
  h,
  draw,
  state,
}: {
  w: number;
  h: number;
  draw: (ctx: Ctx, t: number, s: S) => void;
  state: S;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    const ctx = cv.getContext("2d");
    if (!octx || !ctx) return;
    draw(octx, 2.4, state);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, w / 2, h / 2);
  }, [draw, state, w, h]);
  return <canvas ref={ref} width={w / 2} height={h / 2} aria-hidden />;
}

/** The barrel card's still: staves and water, no chrome. */
function BarrelThumb() {
  const staves = [82, 72, 52, 58, 30];
  const colors = ["#4f95e8", "#4f95e8", "#c98500", "#c98500", "#e66767"];
  const water = Math.min(...staves);
  return (
    <svg viewBox="0 0 480 270" aria-hidden style={{ display: "block", width: "100%", height: "auto" }}>
      <rect x={64} y={236 - water * 2.1} width={352} height={water * 2.1} fill="#5d86b8" opacity={0.55} />
      <rect x={64} y={236 - water * 2.1} width={352} height={4} fill="#8fb4dc" />
      {staves.map((hh, i) => (
        <g key={i}>
          <rect x={72 + i * 68} width={56} y={236 - hh * 2.1} height={hh * 2.1} fill={i % 2 ? "#4a3a22" : "#544228"} />
          <rect x={72 + i * 68} width={56} y={236 - hh * 2.1} height={6} fill={colors[i]} />
        </g>
      ))}
      <rect x={60} y={200} width={360} height={6} rx={2} fill="#241c10" />
      <rect x={60} y={172} width={360} height={6} rx={2} fill="#241c10" />
    </svg>
  );
}

export interface Concept {
  id: string;
  num: string;
  eyebrow: string;
  title: string;
  teaser: string;
  lede: string;
  tag: string;
  thumb: ReactNode;
  body: () => ReactNode;
  /** figure-style cards render their thumb on paper, not the dark film frame */
  paperThumb?: boolean;
}

const MICRO_CONCEPTS: Concept[] = [...MICRO_A, ...MICRO_B, ...MICRO_C, ...MICRO_D, ...MICRO_E];

const CONCEPTS: Concept[] = [
  {
    id: "feet",
    num: "01",
    eyebrow: "Population",
    title: "People vote with their feet",
    teaser: "Flip a city's fortunes and watch people vote with their feet.",
    lede: "Cities can't hold anyone. Within a country, moving is close to frictionless — so a city's population is a running vote on whether it's a good place to live and work, and it's the first number worth checking. Change the city's fortunes and watch the vote change.",
    tag: "the population cards at the top of every city profile — growth compared with the country, and with peer cities, is the first thing to check.",
    thumb: <SceneThumb w={SKY_W} h={SKY_H} draw={drawSkyline} state={FEET.inflow.state} />,
    body: () => <FeetWidget />,
  },
  {
    id: "equilibrium",
    num: "02",
    eyebrow: "Spatial equilibrium",
    title: "No city stays a bargain",
    teaser: "Shock one of two towns and watch the deal even back out.",
    lede: "Alba and Bruma share a strait and one bridge, and nobody needs permission to cross. So neither town can stay a better deal for long: people move toward the better offer until crowding eats the advantage. Shock one side and watch the meters even back out.",
    tag: "all over the tool — it's why population and pay are always read together. A pay gap usually means a rent or quality-of-life gap, not free money on the table.",
    thumb: <SceneThumb w={TWIN_W} h={TWIN_H} draw={drawTwin} state={TWIN.boomB.state} />,
    body: () => <TwinWidget />,
  },
  {
    id: "island",
    num: "03",
    eyebrow: "Labor markets",
    title: "You are not an island",
    teaser: "Run a day; the city breathes across its own boundary.",
    lede: "One valley, one job market — and an old line on the map through the middle of it. Run the day and watch the city breathe across its own boundary, twice, on schedule.",
    tag: "the moment a profile zooms out from the city line to the whole metro — and why most numbers after that point cover the metro, not just the city.",
    thumb: <SceneThumb w={VAL_W} h={VAL_H} draw={drawValley} state={{ hour: 8.3, boundary: 1, cityOnly: 0 }} />,
    body: () => <ValleyWidget />,
  },
  {
    id: "oxygen",
    num: "04",
    eyebrow: "Exports",
    title: "Exports are a city's oxygen",
    teaser: "Follow outside money from the docks to the barber — and back out.",
    lede: "Almost everything a city consumes is made somewhere else, and all of it has to be paid for with money earned from outside. Scroll the story: where that money comes in, how far it travels through town, and what happens when it stops.",
    tag: "the industry treemap in a profile's exports section — the exporting slices are the city's lungs, and the rest of the economy breathes through them.",
    thumb: <SceneThumb w={ST_W} h={ST_H} draw={drawStreet} state={{ ...DOCKS, hour: 10.2, gold: 1 }} />,
    body: () => (
      <MiniScrolly
        w={ST_W}
        h={ST_H}
        draw={drawStreet}
        steps={OXYGEN_STEPS}
        ariaLabel="Street level in the pixel city: a container ship at the quay, a factory behind, five small shops down Main Street. As the steps advance, gold flecks of export money arc from the ship to the works, workers spend wages down the street — and when the plant closes, the shops board up one by one."
      />
    ),
  },
  {
    id: "pizza",
    num: "05",
    eyebrow: "The pizza chart",
    title: "Two dials, eight slices",
    teaser: "Set the dials, name the cause, land on your slice of the pizza.",
    lede: "Every diagnosis starts with two dials: are people arriving or leaving, and is pay rising or falling? Setting them drops you in one quarter of the pizza chart. Naming the cause behind the numbers is the second cut — it finds your slice, one of eight kinds of city around the typical one.",
    tag: "the big scatter of metros in the diagnosis section — every city placed by these same two changes and cut into these same eight slices, same colors, same verdicts, with hundreds of real metros in place of these drawn ones.",
    thumb: <PizzaThumb />,
    body: () => <PizzaWidget />,
  },
  {
    id: "fortress",
    num: "06",
    eyebrow: "Housing",
    title: "The fortress city",
    teaser: "One switch: does success become neighbors, or rent?",
    lede: "Same boom, same money, run twice — the only difference is whether the city lets homes get built. That one switch decides whether success turns into neighbors or into rent.",
    tag: "the housing branch of the diagnosis — price trends and the construction map test exactly this switch.",
    thumb: <SceneThumb w={SKY_W} h={SKY_H} draw={drawSkyline} state={FORTRESS.fortress.state} />,
    body: () => <FortressWidget />,
  },
  {
    id: "barrel",
    num: "07",
    eyebrow: "Binding constraints",
    title: "The shortest stave sets the water",
    teaser: "Three tokens of attention. Only the shortest stave pays.",
    lede: "A city grows like a barrel fills: the level is set by the shortest stave, not the average one. You have three tokens of political attention — spend them where they move the water.",
    tag: "the end of every diagnosis: find the shortest stave first, because attention spent anywhere else changes nothing.",
    thumb: <BarrelThumb />,
    body: () => <Barrel />,
  },
];

/* ————— the sandbox: extra prototype shelves, folded behind one toggle ————— */

interface Shelf {
  id: string;
  eyebrow: string;
  title: string;
  blurb: string;
  items: Concept[];
}

const SANDBOX: Shelf[] = [
  {
    id: "textbook",
    eyebrow: "Second take · the same ideas as figures",
    title: "The interactive textbook",
    blurb:
      "The same seven ideas again — this time plated the way a textbook would draw them: axes, curves, flows and levers instead of pixel scenes. Every figure is live; drag, slide and toggle to push on the idea.",
    items: TEXTBOOK_CONCEPTS,
  },
  {
    id: "sketchbook",
    eyebrow: "Third take · twenty sketches",
    title: "The sketchbook",
    blurb:
      "Twenty quick experiments on the same framework — the paper's tests and metaphors, each tried as a different kind of interactive: gauges, queues, letter tiles, vector fields, sorting quizzes, draggable rules. Rougher than the figures above, on purpose.",
    items: [...SKETCH_A, ...SKETCH_B],
  },
  {
    id: "pocket",
    eyebrow: "Fourth take · fifty micro-pages",
    title: "The pocket textbook",
    blurb:
      "Fifty more pages in the textbook register, reaching past the paper onto the wider urban-economics shelf: how cities grow, how land and housing work, how labor markets match, how trade picks places — and how to read evidence without fooling yourself. One idea per page, one figure, one thing to poke.",
    items: MICRO_CONCEPTS,
  },
];

const SANDBOX_COUNT = SANDBOX.reduce((n, s) => n + s.items.length, 0);
const SANDBOX_IDS = new Set(SANDBOX.flatMap((s) => s.items.map((c) => c.id)));

function ConceptCard({ c, onOpen }: { c: Concept; onOpen: () => void }) {
  return (
    <button className="concept-card" onClick={onOpen}>
      <span className={`cc-thumb${c.paperThumb ? " paper" : ""}`}>{c.thumb}</span>
      <span className="cc-head">
        <span className="widget-num">{c.num}</span>
        <span className="eyebrow">{c.eyebrow}</span>
      </span>
      <span className="cc-title">{c.title}</span>
      <span className="cc-teaser">{c.teaser}</span>
    </button>
  );
}

function ConceptModal({ c, onClose }: { c: Concept; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="concept-overlay" onClick={onClose}>
      <div
        className="concept-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`cm-title-${c.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} className="cm-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="widget-head">
          <span className="widget-num">{c.num}</span>
          <div>
            <span className="eyebrow">{c.eyebrow}</span>
            <h2 id={`cm-title-${c.id}`}>{c.title}</h2>
          </div>
        </div>
        <p className="widget-setup">{c.lede}</p>
        {c.body()}
        <p className="widget-tag">
          <strong>Where you'll see it:</strong> {c.tag}
        </p>
      </div>
    </div>
  );
}

export function ConceptsPage({ hash }: { hash: string }) {
  const rawId = hash.split("/")[2] || null;
  // "dials" folded into the pizza widget; keep old deep links working
  const openId = rawId === "dials" ? "pizza" : rawId;
  const open =
    [...CONCEPTS, ...SANDBOX.flatMap((s) => s.items)].find((c) => c.id === openId) ?? null;
  const close = () => {
    window.location.hash = "#/concepts";
  };

  // the sandbox stays shut by default — but a deep link into it must land
  // on an open shelf, so closing the modal doesn't drop you on a bare page
  const [sandboxOpen, setSandboxOpen] = useState(() => !!openId && SANDBOX_IDS.has(openId));
  useEffect(() => {
    if (openId && SANDBOX_IDS.has(openId)) setSandboxOpen(true);
  }, [openId]);

  return (
    <div className="gl-app concepts-page">
      <div className="gl-corner">
        <a className="story-link" href="#/">
          ← City profile
        </a>
        <a className="story-link" href="#/story">
          How to Read a City →
        </a>
      </div>

      <header className="concepts-hero">
        <span className="eyebrow">
          A hands-on primer · Doing Growth Diagnostics in Cities · Harvard Growth Lab
        </span>
        <h1>Seven ideas that read a city</h1>
        <p className="lede">
          City profiles lean on a handful of ideas from growth diagnostics.
          Each card opens a two-minute toy — poke it, break it, then go spot
          the real thing in a profile.
        </p>
      </header>

      <div className="concepts-grid">
        {CONCEPTS.map((c) => (
          <ConceptCard
            key={c.id}
            c={c}
            onOpen={() => {
              window.location.hash = `#/concepts/${c.id}`;
            }}
          />
        ))}
      </div>

      <section className="sandbox">
        <button
          className="sandbox-toggle"
          aria-expanded={sandboxOpen}
          aria-controls="sandbox-shelves"
          onClick={() => setSandboxOpen((v) => !v)}
        >
          <span className="sandbox-flag">Sandbox</span>
          <span className="sandbox-label">
            {SANDBOX_COUNT} more explainer prototypes
            <em>
              Work in progress — the same ideas retried as textbook figures, rough sketches and
              micro-pages.
            </em>
          </span>
          <span className="sandbox-chev" aria-hidden>
            {sandboxOpen ? "▲" : "▼"}
          </span>
        </button>

        {sandboxOpen && (
          <div id="sandbox-shelves">
            {SANDBOX.map((shelf) => (
              <div key={shelf.id}>
                <div className="concepts-part">
                  <span className="eyebrow">{shelf.eyebrow}</span>
                  <h2>{shelf.title}</h2>
                  <p>{shelf.blurb}</p>
                </div>
                <div className="concepts-grid">
                  {shelf.items.map((c) => (
                    <ConceptCard
                      key={c.id}
                      c={c}
                      onOpen={() => {
                        window.location.hash = `#/concepts/${c.id}`;
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="concepts-footer">
        <div className="btn-row">
          <a className="btn gold" href="#/">
            Now read the real thing →
          </a>
          <a className="btn" href="#/story">
            Prefer the scenic route? How to Read a City →
          </a>
        </div>
        <p className="note">
          The scenes are drawn, not plotted — no numbers were harmed. The
          framework is real: <em>Doing Growth Diagnostics in Cities</em>,
          Harvard Growth Lab (2026).
        </p>
      </footer>

      {open && <ConceptModal c={open} onClose={close} />}
    </div>
  );
}
