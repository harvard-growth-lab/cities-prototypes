import {
  Fragment,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { easeCubicInOut } from "d3-ease";
import {
  convertPath,
  diagnose,
  demandRead,
  supplyRead,
  quadLeaf,
  quadName,
  quadShock,
  sideDash,
  sideOfPath,
  TREE_SIDE_COLOR,
  treeNodes,
  type BranchSide,
  type TreeVariant,
} from "../../data/figures";
import {
  NARROW_QUERY,
  PHONE_QUERY,
  STAGE_GONE_MARGIN,
  useInScroller,
  useMediaQuery,
  useStageHeadroom,
  useStageScale,
  useStageWidthroom,
} from "./walkFit";
import {
  SidewaysTree,
  sideBox,
  sideRests,
  sideRoute,
  type WalkViewProps,
} from "./walkVariants";
import {
  badgeCX,
  branchBox,
  branchForks,
  DEFAULT_WALK_SHAPE,
  DOT_BELOW_HEAD,
  DOT_FORK2_Y,
  DOT_LEAF_Y,
  DOT_ROOT_Y,
  endingX,
  fitPose,
  fitScale,
  fitTransform,
  FORK2_Y,
  hasLeaves,
  headRowH,
  headRowY,
  headX,
  landingY,
  LEAF_BUS,
  LEAF_ROW,
  numberWord,
  planeBranches,
  planeCuts,
  planeNeedsRim,
  rayExit,
  ROOT_BUS,
  ROOT_ROW,
  sectorAnchor,
  sectorAt,
  sectorPoly,
  sectorRim,
  shapeLeaves,
  type FitMode,
  type PlaneSector,
  walkShape,
  wholeBox,
} from "./walkShapes";
import { MetricMark, QuadMark, QuadMetrics, nameWidth } from "./quadIcons";
import {
  DATA_WINDOW_LABEL,
  METROS,
  METRO_MEDIANS,
  METRO_SPAN,
  PRICE_SPAN,
  countryMedians,
  homeMsa,
  homePlace,
  metroStatsRows,
  metroUnit,
  placeCost,
} from "../../data/metros";
import { branchSectionName } from "../../data/content";

/* The GUIDED retelling of the City Constraints sequence. The reference this
   flow started from (the cities-explainer prototype's tree page) is an
   in-depth tour of the ENTIRE dataset — it classifies every metro and pours
   the whole field down the tree. This page's job is different: concisely
   lead the user through the pizza chart and the tree for ONE example — the
   selected city. So the city's dot is the protagonist and the field is
   backdrop:

     0  the intro               what the section does, on an empty stage
     1  dial one: people        the x axis draws; the dot sits on it
     2  dial two: pay           the plane completes; the dot lifts to its spot
     3  the metro               the city's MSA joins it, a hollow dot beside
     4  the benchmark           the median crosshair + the grey field around it
     5  reading the plane       the regions the shape cuts it into; yours marked
     6  the tree begins         the chart parks; the dot carries to the root
     7  the root question       (station table only) the city at the root
     8  fork one                the dot drops to its side, on its own numbers
     9  fork two + instrument   the side's question, read on its own chart
    10  the landing             the dot reaches its leaf — where we think you are
    11  the endings             the whole tree again, the diagnosed route lit

   Every number on the walk is real (metros.ts / diagnose()); a city without
   data walks the fallback read behind bracketed placeholders. The tree is
   always the alt structure (two forks define the story); a leaf pick converts
   to whichever structure the app is on. */

const W = 1180;
const H = 640;

/* the chart square, centred on the stage (same geometry as the compact flow,
   so swapping flows keeps the chart where the eye left it) */
/* (r 278 → 268 and cy 316 → 312, Sept 2026: the x-axis title moved down
   from its ticks, and on a stage no taller than the viewBox — a phone on
   its side, the stacked layouts — the authored 640 is all the height there
   is, so the square gave up the room rather than the title clipping; the
   nameplate above the square keeps its 26.) */
const CQ = { cx: W / 2, cy: 312, r: 268 };
const cxu = (v: number) => CQ.cx + v * CQ.r;
const cyu = (v: number) => CQ.cy - v * CQ.r;
/* the axis titles' furniture: the dial's mark before each title (the
   people and pay glyphs of the quadrant labels and tree heads), and the
   x title's seat under its axis — its ticks sit at +22, and at +54 the
   title's cap line clears them by ~16 where +44 left ~6 */
const AX_MARK = 22;
const AX_GAP = 7;
const AX_TITLE_DY = 54;
/** a .jz-ms-title's width, near enough to centre a mark + title pair on
 *  the axis: 17px Source Sans 3 runs 0.44em a glyph on these titles
 *  (measured 329 for the wage title's 44 glyphs, 310 for population's 42) */
const axTitleW = (s: string) => s.length * 0.44 * 17;
const POP_AXIS = `Population growth (annual rate, ${DATA_WINDOW_LABEL})`;
const WAGE_AXIS = `Average wage growth (annual rate, ${DATA_WINDOW_LABEL})`;

/** where a plane region's label hangs: where its sector meets the edge,
 *  which for a quadrant is its outer corner. Shared by the chart, which
 *  draws the label there, and the hand-off, whose card grows out of it.
 *  `y0` is the name's baseline — a quadrant reads as three lines (name,
 *  dials, shock), so a bottom corner starts higher; a sector centred on the
 *  x axis has no corner to sit in and straddles the axis at the edge. */
const planeLabelAt = (sec: PlaneSector) => {
  const [ax, ay] = sectorAnchor(sec);
  const anchor: "start" | "middle" | "end" =
    ax > 0 ? "end" : ax < 0 ? "start" : "middle";
  const xa = cxu(ax) + (ax > 0 ? -14 : ax < 0 ? 14 : 0);
  const ya = ay > 0 ? cyu(ay) + 26 : ay < 0 ? cyu(ay) - 36 : cyu(0) - 7;
  const y0 = quadName(sec.side) ? (ay > 0 ? cyu(ay) + 24 : cyu(ay) - 60) : ya;
  return { ax, ay, anchor, xa, ya, y0 };
};

/* ---------- the step schedule ----------
   The guided flows are all cut from the same eleven BEATS, and every gate in the
   render below is keyed on the beat rather than on the scroll stop. What a
   flow chooses is which beats get a stop: a stop landing on a later beat
   reveals the skipped ones with it, and the traveller covers the extra
   stations in one move — a shorter walk loses scrolling, not animation. */
/* The chart half's beats: an intro first (Sept 2026 — what the section
   does, before any instrument draws), then the two dials, then the metro
   joins the plane, then the benchmark, then the plane's reading. The tree
   half's beats follow, named as well since the schedules below are written
   in them. */
/** the intro: how this section works, on an otherwise empty stage */
const INTRO_BEAT = 0;
/** dial one: the population axis draws and the dot sits on it */
const DIAL1_BEAT = 1;
/** dial two: the plane completes and the dot lifts to its spot */
const DIAL2_BEAT = 2;
/** the city's MSA joins the plane beside the city's own dot */
const MSA_BEAT = 3;
/** the benchmark: the median crosshair and the grey field */
const BENCH_BEAT = 4;
/** reading the plane: the regions the shape cuts it into, yours marked */
const PLANE_BEAT = 5;
/** the tree opens — and, in the guided walk, fork one is answered on the
 *  same stop: the chart parks into the inset, the root card and the branch
 *  heads arrive, the edges draw down to them and the city's branch lights.
 *  (Merged from two stops, Sept 2026: a tree with heads but no paths was a
 *  stop that showed nothing the next one did not.) */
const TREE_BEAT = 6;
/** the root station. No flow stops here any more (Sept 2026: the zoomed
 *  walk's "the city enters at the root" stop was cut — the quadrant already
 *  says which branch is the city's, so entering at the root and then walking
 *  to that branch spent a stop re-asking a question the chart had answered).
 *  It survives as the number the station table is written in: station 0 is
 *  the root, and `stationFor` reads a beat's station as its distance from
 *  here. */
const ROOT_BEAT = 7;
/** fork one as its OWN stop — the tree-first tellings take it: they open
 *  on the whole tree with the dot at the root, and the pizza chart answers
 *  the root question here */
const FORK1_BEAT = 8;
/** fork two is asked: each head's stem reaches down to the bus (the rail
 *  carries the question itself). The fork stands alone here — its instrument
 *  waits for the landing (see `carriesPanel`) */
const FORK2_BEAT = 9;
/** the leaves arrive and the traveller lands on the diagnosed one, and fork
 *  two's instrument arrives with it: the figure comes with its verdict */
const LEAF_BEAT = 10;
/** the four diagnoses — the only beat that hands the pick to the reader */
const CHOICE_BEAT = 11;

/* the chart half's stops: the intro, the two dials, the metro, the
   benchmark, the plane's reading */
const CHART_BEATS = [
  INTRO_BEAT,
  DIAL1_BEAT,
  DIAL2_BEAT,
  MSA_BEAT,
  BENCH_BEAT,
  PLANE_BEAT,
];
/* the zoomed walk (the section's default, Sept 2026): the guided walk's
   four chart stops — the quadrants are still walked through — and then a
   different opening for the tree: it arrives WHOLE, the chart pours into its
   heads, and the city rides down with the pour onto the branch its quadrant
   became. From there the camera walks its path one station per stop — its
   branch, the second fork, the landing — and opens back out onto the lit
   route. Nothing on the tree is revealed along the way: it is drawn whole
   from its first stop, and what the zoom adds is where the reader is
   looking. The tree stop itself does not zoom — it is the hand-off, and the
   reader needs the whole tree to see the quadrant land on it; the first zoom
   is the stop after, closing on the branch the city is already standing
   on. (The root's four drops span the tree's whole width, so a frame that
   closes on the ROOT slices the outer heads — that version was tried and
   cut, and the stop it belonged to went with it.) */
const ZOOM_BEATS = [
  ...CHART_BEATS,
  TREE_BEAT,
  FORK1_BEAT,
  FORK2_BEAT,
  LEAF_BEAT,
  CHOICE_BEAT,
];
/* the zoomed walk's reading zoom, per station (root, head, fork two, leaf —
   the root entry only keeps the table in station order: that stop frames
   the whole tree, see ZOOM_BEATS): how wide a slice of the tree the frame
   shows, in tree units — set by what
   each stop has to keep in view (the root card with the whole bus and its
   four drops; the head with its neighbour and the bus it came down; the
   stem and its two leaves; the landing with its badge and the head above
   it). Derived from a width rather than a fixed scale so the step in from
   the whole-tree fit reads the same on every stage. */
const ZOOM_FRAME_W = [560, 515, 435, 500];
/* and where the camera looks relative to the dot's rest: the root station
   lifts its frame so it cuts just above the heads (the four drops imply
   them — cards half in frame read as a mistake), the head station lifts a
   little to keep the bus in, the fork station drops onto the stem and its
   leaves, the landing lifts so the head the leaf hangs off stays in view */
const ZOOM_BIAS_Y = [-36, -20, 20, -60];
/* On a phone the stage is a CAMERA, not a map: a 312px stage cannot show the
   whole tree legibly under any shape (12-unit leaf type at the whole-tree
   fit lands at ~4px), so the whole-tree stops are an overview and each
   zoomed stop frames one card and its parent — the head with a sliver of
   its neighbours, the stem with its two leaves, the landing with its badge.
   Narrower frames, a taller cap (the 3.4 was set for a 900px stage) and
   biases scaled to the frame. */
const ZOOM_FRAME_W_PHONE = [560, 300, 240, 280];
const ZOOM_BIAS_Y_PHONE = [-36, -10, 10, -30];
const ZOOM_CAP = 3.4;
const ZOOM_CAP_PHONE = 6;

/* ---------- the hand-off's clock (the quadrant pour), in seconds ----------
   Forward, the chart becomes the tree's first rank in two movements:
     1. CONDENSE — every quadrant shrinks, in place and all at once, into a
        card around its own corner label: four regions become four cards,
        and the name the reader just read never leaves the screen;
     2. DEAL — the cards fly to the head row in STRAIGHT lines, each `flight`
        long, and each hands over to the head it landed on (`land`). What
        keeps four straight flights off each other is WHEN they leave (see
        `pourDealAt`), since the paths themselves cross.
   The rewind is the same film backwards, shorter: the reader has seen it.
   One table, because three clocks have to agree on it — the stylesheet's
   keyframes (handed these as custom properties), the head cards' and the
   edges' entrances, and the dot's own entrance in the ride loop. */
const POUR = {
  condense: 0.4,
  /* the four cards stand at their corners for a moment before the first is
     dealt — without it the condense ran straight into the deal and the
     first card seemed to be snatched away */
  beat: 0.1,
  /* between the two cards of one column of the plane, and the extra wait
     before the second column leaves — in FLIGHTS, not seconds: what keeps
     the straight paths off each other is where one card has got to when the
     next leaves, so the gaps have to scale with the flight (see pourDealAt) */
  stagger: 0.12,
  colGap: 0.21,
  /* The flight has been 0.7s (keyed legs: "jarring"), 1.0s on smootherstep
     (smooth, but it dwelt at both ends — a fifth of the flight to cover the
     first 6%) and is now 0.8s on a curve that leaves promptly and lands
     firmly (the user: "slightly faster and sharper"; the curve is the
     stylesheet's — see "movement 2: the deal"). The longest flight peaks at
     about 1200px/s: up from 880, still two thirds of the first cut's 1800. */
  flight: 0.8,
  land: 0.3,
  backFlight: 0.6,
  expand: 0.38,
};
/** when a card leaves its corner, in seconds from the first to leave: the
 *  n-th dealt, from the `col`-th column of the plane to go.
 *
 *  The flights are straight (Sept 2026, the user's call — the first cuts
 *  bent them into lanes to keep them apart, and the bends were what read as
 *  fussy), and straight paths from a 2×2 to a 1×4 CROSS: the plane unrolls
 *  clockwise into the row, so its upper pair swap sides on the way down and
 *  its lower pair on the way up, and an upper card comes in so shallow that
 *  it sweeps low over the slot NEXT to its own. So the order is the
 *  geometry's, not the row's:
 *    - the plane's RIGHT column goes first, then its left: that puts about
 *      half a flight between the two cards of each swapping pair, and by then
 *      the first is well below (or above) the second's path;
 *    - within a column the UPPER card goes first: it has to be past its
 *      neighbour's slot before the lower card lands in it.
 *  Simulated over every frame, that leaves two bounding-box grazes of about
 *  60px² — each at two ROUNDED corners, so the painted cards do not touch —
 *  where row order (left to right, the city's own last) clipped a card by a
 *  third of its height, and all four at once pile up whole. */
const pourDealAt = (n: number, col: number) =>
  (n * POUR.stagger + col * POUR.colGap) * POUR.flight;
/** the same, on the hand-off's own clock: after the condense and its beat */
const pourLaunch = (dealAt: number) => POUR.condense + POUR.beat + dealAt;
/** when the tree may grow around the row — the root question, the edges and
 *  the ranks below: as the LAST card is two thirds through its flight — clear
 *  of the root's own spot, which an upper quadrant's path runs through — so
 *  the edge to it draws down while it lands */
const pourAfter = (lastDealAt: number) =>
  pourLaunch(lastDealAt) + POUR.flight * 0.65;

/* a side's hue let down into white — the dealt card's ground. Opaque on
   purpose: a translucent tile would show the dissolving chart through it */
const tintOf = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(255 + (c - 255) * a);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

/* the scroll per stop, in vh: half again the compact flow's 40 for a plain
   walk (the text blocks need the room), and 1.7× it where the camera rides
   between stops, so a leg has room to settle. The track's height follows
   from it — see the steps column in the render. */
const STEP_VH = 40;
const stopVhFor = (ride: boolean) => STEP_VH * (ride ? 1.7 : 1.5);

/* the text column's light, in stops from a block's own middle: fully lit
   within LIT_PLATEAU, at rest beyond LIT_REST (see the scroll effect).
   Rest past 0.5 is what makes the cross-fade — a block is still fading as
   its neighbour comes up. Half lit each at the boundary with these two. */
const LIT_PLATEAU = 0.15;
const LIT_REST = 0.85;

/* the intro's three placeholders — the chart, the tree, the analysis — each
   with a line glyph, drawn on the stage before anything real does */
const INTRO_PARTS = [
  {
    id: "chart",
    title: "the pizza chart",
    ph: "[two readings place the city]",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth={2}>
        <circle r={24} />
        <path d="M-24,0 h48 M0,-24 v48" />
        <circle r={4} cx={10} cy={-9} fill="currentColor" stroke="none" />
      </g>
    ),
  },
  {
    id: "tree",
    title: "the diagnostic tree",
    ph: "[its quadrant picks a branch]",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <path d="M0,-26 v10 M-36,-16 h72 M-36,-16 v10 M-12,-16 v10 M12,-16 v10 M36,-16 v10" />
        {[-36, -12, 12, 36].map((x) => (
          <rect key={x} x={x - 9} y={-6} width={18} height={12} rx={3} />
        ))}
        <path d="M12,6 v8 M2,14 h20 M2,14 v6 M22,14 v6" />
      </g>
    ),
  },
  {
    id: "analysis",
    title: "the analysis",
    ph: "[the ending's modules]",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 3">
        {[-42, -13, 16].map((x) => (
          <rect key={x} x={x} y={-20} width={26} height={18} rx={3} />
        ))}
        {[-42, -13, 16].map((x) => (
          <rect key={`b${x}`} x={x} y={2} width={26} height={18} rx={3} />
        ))}
      </g>
    ),
  },
];

/** the geography a step reads, hung on its title the way the tool's own
 *  scrolly rails do (v3's .geo-badge) — a note on the title, not a control */
function GeoBadge({
  geo,
  cityShort,
}: {
  geo: "city" | "metro";
  cityShort: string;
}) {
  return (
    <span className={"geo-badge geo-badge--" + geo}>
      <span className="gb-view">Viewing:</span>
      {geo === "metro" ? (
        <svg
          viewBox="0 0 30 22"
          width="25"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <ellipse cx="15" cy="11" rx="13" ry="8.6" strokeDasharray="2.6 3" />
          <path d="M10.5 15.5h9" />
          <path d="M12.2 15.5V10h3v5.5" />
          <path d="M16.6 15.5V7h3v8.5" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 30"
          width="16"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 26h20" />
          <path d="M5 26V13h6v13" />
          <path d="M13 26V5h7v21" />
          <path d="M15.4 9h2.2M15.4 13h2.2M15.4 17h2.2" />
        </svg>
      )}
      <span className="gb-name">
        {cityShort} {geo === "metro" ? "metro" : "admin"}
      </span>
    </span>
  );
}

const TREE_HOME_POSE = "translate(0px, 0px) scale(1)";
/* the tree phase is not a fixed pose: the whole tree is FITTED
   to the room the stage gives it (see `wholeFit` below), so it fills a
   narrow stage's width and sits centred on a wide one instead of leaving
   the stage's right quarter empty. It only applies from TREE_BEAT: during
   the chart beats the traveller dot inside this wrap is positioned in
   full-stage chart coordinates, which must not be scaled. */

const med = METRO_MEDIANS;
/* a value that rounds to zero carries no sign: "−0.0%" reads as a typo */
const pc = (v: number) =>
  `${Math.abs(v) < 0.05 ? "" : v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%/yr`;

/* the grey backdrop field, sized like the compact flow's metro field */
const maxSize = Math.max(...METROS.map((m) => m.size));
const dotR = (s: number) => 1.3 + 10.7 * Math.sqrt(s / maxSize);

/* ---------- tree geometry (no cohort stacks — one dot walks it) ----------
   Which cards the tree carries, and where they sit, comes from the SHAPE
   (walkShapes.ts) — the rows are what every shape shares. Three ranks,
   evenly spaced: the fork logic is connective tissue (edge labels on the
   buses, and the rail's copy), and the answers (heads, leaves) are what the
   eye should land on. */

/* the instrument panel: sized for a pizza square big enough to read, with
   margins for a rotated y-axis title on the left and the axis title +
   quadrant readings stacked below */
/* both panels sit trimmed against the right edge (user-set, twice now: the
   instruments kept crowding the tree, which rides enlarged since the trim) */
const INSET = { x: 802, y: 30, w: 358, h: 372 };
/* sideways modes stack the instrument under the tree rather than docking it
  to the right, so the panel widens and flattens into the stage's lower band */
const INSET_SIDE = { x: 802, y: 30, w: 358, h: 372 };
/* the shortened walk's HERO version of the same panel: the right half of
   the stage — the instrument is the thing being read at those stops, so it
   gets the room */
const INSET_HERO = { x: 760, y: 24, w: 410, h: 470 };

/** arc-length parametrisation of a polyline: total length, and the point
 *  a given arc distance along it — the walking dot and the camera rides
 *  both steer by it */
const arcWalk = (pts: [number, number][]) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(
      cum[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  const at = (s: number): [number, number] => {
    const v = Math.max(0, Math.min(cum[cum.length - 1], s));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < v) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const f = (v - cum[i - 1]) / seg;
    return [
      pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
      pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
    ];
  };
  return { at, cum, total: cum[cum.length - 1] };
};

/** elbow path: straight drop, bus across, straight drop */
const elbow = (x0: number, y0: number, busY: number, x1: number, y1: number) =>
  `M${x0},${y0} V${busY} H${x1} V${y1}`;

const ROOT_BOT = ROOT_ROW.y + ROOT_ROW.h / 2;

/** bracketed segments render as the repo's placeholder idiom */
function Body({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((part, i) =>
        part.startsWith("[") ? (
          <span key={i} className="ph">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/* ---------- the variants disclosure ----------
   The team's revision (Sept 2026) settled the section on one telling: the
   zoomed walk over the four-quadrant forked tree, whose quadrants pour into
   its branches. The tree-shape, chart→tree and user-flow switches are all
   gone with that decision, so the walk's own header carries no control any
   more; what still uses this disclosure is the branch-analysis section
   below, whose four layouts remain a study. The button face carries the
   current setting so the state is legible without opening it, and marks
   itself when it is off the default. */

export function VariantOptions({
  face,
  changed,
  children,
}: {
  /** the current settings, on the button's face */
  face: string;
  /** a folded-away control must still say when it is doing something */
  changed: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  /* a panel that floats over the stage has to close the way readers expect
     one to: clicking away from it, or pressing Escape */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="jz-opts" ref={box}>
      <button
        className={
          "jz-opts-btn" + (open ? " open" : "") + (changed ? " set" : "")
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="jz-opts-k">Variants</span>
        <span className="jz-opts-now">{face}</span>
        <svg viewBox="0 0 10 6" aria-hidden="true">
          <path
            d="M1 1.5 5 4.8 9 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && <div className="jz-opts-panel">{children}</div>}
    </div>
  );
}

/* ------------------------------ the scrolly ------------------------------ */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ---------- the camera's motion ----------
   A critically damped spring per camera quantity — the arc the dot has
   walked, the frame's centre, the zoom (in log space). A spring eases IN
   from rest as well as out, keeps its momentum when a stop changes
   mid-move (a fast scroll re-aims the camera without a hitch), and never
   overshoots. One time constant for all of them keeps the pan, the zoom
   and the dot's walk in phase, so a leg reads as one movement rather than
   three filters decaying at their own rates. The integrator is the
   SmoothDamp form (Game Programming Gems 4): `smoothTime` is roughly the
   time to cover 60% of the gap; the move is all but over at three times
   that. */
const RIDE_SMOOTH_S = 0.42;
const smoothDamp = (
  cur: number,
  tgt: number,
  vel: number,
  dt: number,
  smoothTime = RIDE_SMOOTH_S,
): [number, number] => {
  const w = 2 / smoothTime;
  const x = w * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - tgt;
  const tmp = (vel + w * ch) * dt;
  let v = (vel - w * tmp) * e;
  let out = tgt + (ch + tmp) * e;
  /* a long frame can carry the closed form past the target — clamp there,
     and drop the velocity with it */
  if (tgt - cur > 0 === out > tgt) {
    out = tgt;
    v = 0;
  }
  return [out, v];
};

export function ConstraintNarrative({
  cityShort,
  country,
  selectedPath,
  onSelectPath,
  onPhaseInView,
  onStageInView,
  variant,
}: {
  cityShort: string;
  country: string;
  /** the descent picked for the next section, on the APP's structure */
  selectedPath: string[];
  onSelectPath: (path: string[]) => void;
  onPhaseInView: (pageId: string) => void;
  /** whether the pinned stage — the tree — is still on screen; the section
   *  below keeps its floating schematic down until it is not */
  onStageInView?: (inView: boolean) => void;
  /** the app-wide tree structure — leaf picks convert into it */
  variant: TreeVariant;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  /* the text column: its blocks are lit from the scroll position directly
     (see the scroll effect), so the column is written to, not re-rendered */
  const stepsRef = useRef<HTMLDivElement>(null);
  /* the pinned stage, reported up: the analysis's schematic floats only
     once the tree has (mostly) scrolled off — see STAGE_GONE_MARGIN */
  const stageRef = useRef<HTMLDivElement>(null);
  useInScroller(stageRef, onStageInView, STAGE_GONE_MARGIN);
  const onPhaseRef = useRef(onPhaseInView);
  onPhaseRef.current = onPhaseInView;
  /* the scroll STOP; `step` below is the BEAT it lands on, and everything
     that renders reads the beat (see the schedule at the top of the file) */
  const [stepIdx, setStepIdx] = useState(0);
  /* how far a camera ride has PULLED UP: the highest station the camera
     has arrived at under the current stop. The reveal gates read it so a
     rank's cards fade in as the dot reaches them, not the moment the
     scroll lands; outside the rides it is ignored. Written by the ride
     effect's loop. */
  const [rideArrived, setRideArrived] = useState(0);
  const arrivedRef = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageScale = useStageScale(svgRef);
  const stageHeadroom = useStageHeadroom(svgRef);
  const stageWidthroom = useStageWidthroom(svgRef);
  /* the phone tier (src/styles/figures.css): the camera's frames and the
     hand-off follow it. A ref too, for the ride loop, which runs outside
     React's render */
  const phone = useMediaQuery(PHONE_QUERY);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  /* the beat fork one is answered on: the walk folds it into the tree beat,
     where the chart's quadrants pour onto the branch heads */
  const fork1At = TREE_BEAT;
  /* the beat the instrument inset arrives on: the fork-one stop, which comes
     AFTER the tree stop that already answered it, so the chart returns there
     as the evidence for a branch the city is standing on rather than as a
     question */
  const insetAt = FORK1_BEAT;
  /* the beat the route starts lighting: with fork one's answer, which is
     what there is to light */
  const litFrom = fork1At;
  /* which tree station a beat parks the traveller at — below the head, the
     second fork, the leaf. There is no root stop: fork one is answered by
     the quadrant on the tree beat, so the dot goes straight to its branch
     head. */
  const stationFor = useCallback(
    (stp: number) =>
      stp < TREE_BEAT ? 0 : Math.min(Math.max(stp - ROOT_BEAT, 1), 3),
    [],
  );
  /* the tree this walk tells: its branches, its cards and where they sit.
     Everything below reads the tree from here rather than from constants, so
     a shape switch is a data swap and nothing else. */
  /* The walk tells ONE tree (team revision, Sept 2026): the four-quadrant
     forked structure. It is no longer a choice, so the shape is read straight
     from the default rather than from a control — the other shapes stay
     defined in walkShapes.ts as studies. */
  const sh = walkShape(DEFAULT_WALK_SHAPE);
  const leaves = useMemo(() => shapeLeaves(sh), [sh]);
  /* how many endings the structure has: its leaves plus any head whose
     branch stops there, or — where it forks once — its branch heads */
  const endings = leaves.length
    ? leaves.length + sh.branches.filter((b) => !b.leaves.length).length
    : sh.branches.length;
  /* the leaf row is the one rank whose height varies with the shape — the
     narrow shapes wrap their titles onto a second line */
  const LEAF_TOP = LEAF_ROW.y - sh.leafH / 2;
  /* the head row and the rows below it move with the shape: a structure that
     forks once has no question or leaf row, so its heads drop down the stage
     and carry the diagnosis themselves */
  const forks2 = hasLeaves(sh);
  /* the stage answer is settled (Sept 2026, user call: the responsiveness
     switch is gone): the whole tree is always fitted to the stage, and the
     zoomed walk's camera ride is what keeps it legible. The small-stage
     modes (focus, sideways, the sideways ride) stay in walkShapes and
     walkVariants as studies, unreachable from here. */
  const fit = "fit" as FitMode;
  const focusMode = fit === "focus";
  const sideMode = fit === "side";
  /* the walk IS a camera ride, on any stage: only the sideways ride
     (a small-stage answer) may take the camera off the authored tree */
  const rideMode = fit !== "sideride";
  const sideRideMode = fit === "sideride";
  /* the two axes the last two modes combine: which tree is drawn, and
     whether the camera rides it */
  const sideLayout = sideMode || sideRideMode;
  const rideOn = rideMode || sideRideMode;
  /* THE hand-off (team revision, Sept 2026): as the chart dissolves, each
     tinted region flies onto the branch head it becomes, and the city's dot
     rides down with it onto the branch its own quadrant became. It needs the
     open stage, so the small-stage fits — which redraw the tree their own
     way — keep the plain fade instead. A phone stage is not open either: at
     a quarter scale the tiles fly across 300px onto 37px cards, motion
     without meaning. */
  const pourOn = fit === "fit" && !phone;
  /* the stops the walk gets */
  const beats = ZOOM_BEATS;
  const stopVh = stopVhFor(rideOn);
  const step = beats[Math.min(stepIdx, beats.length - 1)];
  /* the tree is drawn WHOLE the moment it appears: the walk keeps it whole
     under its camera from the tree beat on — there the ride is how the
     reader is guided, not how the tree is revealed (and before that beat the
     chart phase must find no tree on the stage) */
  const treeUpFront = step >= TREE_BEAT;
  const HEAD_Y = headRowY(sh);
  const HEAD_H = headRowH(sh);
  const HEAD_TOP = HEAD_Y - HEAD_H / 2;
  const HEAD_BOT = HEAD_Y + HEAD_H / 2;
  /* the stop where the rail's second step ("How we diagnose") takes over:
     the walk flips when its chart stops end */
  const diagStop = Math.max(0, beats.indexOf(TREE_BEAT));

  /* ---------- scroll → step ----------
     The blocks ARE the stops (Sept 2026): the committed stop is the block
     whose top the stage's centre line has passed, and each block's light is
     a smooth function of how far its own centre is from that line, in units
     of its own height. A block is at least one stop tall (--nv-stop) and
     grows past that when its content needs to — a caption with the
     instrument panel under it at the column's full width — so the math
     reads the blocks rather than dividing the track evenly, and a taller
     block simply holds its stop for longer. */
  useEffect(() => {
    const track = trackRef.current!;
    const scroller = track.closest(".pages") as HTMLElement | null;
    /* one column (the stage stacked over the steps): the reading line is
       the middle of the band UNDER the stage, not the stage's own middle */
    const stacked = window.matchMedia(NARROW_QUERY);
    let ticking = false;
    const update = () => {
      ticking = false;
      const sTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const sH = scroller ? scroller.clientHeight : window.innerHeight;
      const r = track.getBoundingClientRect();
      /* hidden: the tool shows one section at a time (v3's .sec-off is
         display:none), and a hidden track measures 0×0 with every block's
         top at 0 — which the loop below would read as "the line has passed
         every block" and park the walk on its LAST stop. That is what the
         first click on the tab then played backwards, from the back-out
         pose down to the storyboard. Hold the opening stop instead, lit,
         so the stage is already in its opening pose when the section
         appears. */
      if (r.height === 0) {
        const hidden = stepsRef.current?.children;
        if (hidden)
          for (let i = 0; i < hidden.length; i++)
            (hidden[i] as HTMLElement).style.setProperty(
              "--nv-lit",
              i === 0 ? "1" : "0",
            );
        setStepIdx(0);
        return;
      }
      const st = stageRef.current?.getBoundingClientRect();
      const mid = !st
        ? sTop + sH / 2
        : stacked.matches
          ? (st.bottom + sTop + sH) / 2
          : st.top + st.height / 2;
      const kids = stepsRef.current?.children;
      const n = kids ? kids.length : 0;
      let s = 0;
      for (let i = 0; i < n; i++) {
        const el = kids![i] as HTMLElement;
        const b = el.getBoundingClientRect();
        /* the stop: the last block whose top the line has passed — the
           first before any has, the last once all have */
        if (b.top <= mid) s = i;
        /* ---------- the text column's light, continuous ----------
           The stop is a step function of the scroll — it has to be, the
           stage plays one pose per stop — but the text must not read as one:
           a block that sits dim for a whole stop and flips on at the boundary
           makes the scroll feel like it snaps. So each block's light is a
           smooth function of how far its own middle is from the reading
           line, in units of its own height: full only around the middle,
           easing out to the rest state well PAST the boundary — so at the
           boundary the outgoing block is still half lit while the incoming
           one is already half lit, and the two cross-fade rather than trade
           places. The first and last blocks stay lit past their outer edge,
           so the section arrives and leaves on a lit block. Written straight
           to the DOM every scroll frame — a React state per block per frame
           would be the wrong tool. */
        let d = b.height > 0 ? (mid - (b.top + b.height / 2)) / b.height : 0;
        if (i === 0) d = Math.max(0, d);
        if (i === n - 1) d = Math.min(0, d);
        d = Math.abs(d);
        /* smoothstep: full within LIT_PLATEAU of the middle, at rest
           LIT_REST out — past the boundary at 0.5, which is what makes
           neighbours overlap */
        const t = clamp01((d - LIT_PLATEAU) / (LIT_REST - LIT_PLATEAU));
        const lit = 1 - t * t * (3 - 2 * t);
        el.style.setProperty("--nv-lit", lit.toFixed(3));
      }
      s = Math.min(beats.length - 1, s);
      setStepIdx(s);
      /* the line is the STAGE's, and the stage travels with the track — so
         "the line is inside the track" holds wherever the track is, on screen
         or not. While the walk was the whole page that made no difference; in
         a layout that stacks the sections in one scroll (src/site/) it had
         the walk claiming the page from three sections away. The line has to
         be on screen as well. */
      if (r.top <= mid && r.bottom >= mid && mid >= sTop && mid <= sTop + sH)
        onPhaseRef.current(
          s < diagStop ? "page-constraints" : "page-constraints-diagnose",
        );
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    /* the tab system shows and hides the section, and the blocks grow with
       their content — any change of the track's size re-reads the stops,
       scroll event or not */
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onScroll)
        : null;
    ro?.observe(track);
    update();
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
  }, [beats, diagStop]);

  /* ---------- the city's own read (real numbers where they exist) ---------- */
  const place = useMemo(() => homePlace(cityShort), [cityShort]);
  const msa = useMemo(() => homeMsa(cityShort), [cityShort]);
  const cost = useMemo(() => placeCost(cityShort), [cityShort]);
  const medCost = countryMedians(country).cost;
  const placeSpot = place
    ? metroUnit(place)
    : ([-0.72, 0.82] as [number, number]);
  const placeStats = place
    ? metroStatsRows(place)
    : [`[no ${cityShort} data yet — sample spot]`];
  /* the region of the plane the city's dot falls in — what the chart marks
     as "yours". Which regions exist is the shape's call, so this follows the
     shape rather than the four quadrants. */
  const placeSector = sectorAt(sh, placeSpot[0], placeSpot[1]);

  const dx = useMemo(() => diagnose(cityShort, country), [cityShort, country]);
  /* Which branch the city takes. Where the tree forks twice that is the
     researchers' diagnosis, converted onto this shape. Where it forks ONCE,
     the branch IS the region of the plane the city landed in — there is no
     second question to answer, so the chart alone decides it. */
  const suggAlt = useMemo(() => {
    /* the quadrant structures are sign-aware: the branch is the SECTOR the
       city's dot landed in, which the alt path's plain demand/supply cannot
       name. The forked variant then runs the branch's own instrument. */
    if (sh.variant === "quad2") {
      const side = (placeSector?.side ?? "supplyneg") as BranchSide;
      const leaf = quadLeaf(side, cityShort, country);
      /* a branch with no second layer ends at its head */
      return leaf ? [side, leaf] : [side];
    }
    return forks2
      ? convertPath(dx.path, sh.variant)
      : [placeSector?.side ?? "supply"];
  }, [forks2, dx, sh, placeSector, cityShort, country]);
  const citySide = sideOfPath(suggAlt);
  const suggLeaf = suggAlt[suggAlt.length - 1];
  /* whether the WALKED branch forks again: the tree may (forks2) while the
     city's own branch stops at its head — the positive demand shock has no
     second layer, so a city there lands on the head itself */
  const cityForks = forks2 && branchForks(sh, citySide);
  /* The tree is a statement of the diagnosis, never a mirror of the app's
     pick (Sept 2026): whatever the reader chooses elsewhere — the analysis
     section's schematic, the sandbox — this tree keeps lighting the
     diagnosed route and never grows a "you selected this path" badge. A tree
     that changed under the reader made the section's navigation unstable;
     the sandbox below is where a pick is made and marked. The ONE thing in
     here that reads the pick is the rail's "up next", which names the
     analysis section that actually follows — a section, not a route. The
     alias that carries a pick across structures cannot recover a shock's
     SIGN, so on the forked quadrant tree an app path that merely mirrors
     the suggestion reads AS the suggestion. */
  const nextSide = useMemo(() => {
    if (
      sh.variant === "quad2" &&
      convertPath(suggAlt, variant).join("/") === selectedPath.join("/")
    )
      return sideOfPath(suggAlt);
    return sideOfPath(convertPath(selectedPath, sh.variant));
  }, [selectedPath, sh, suggAlt, variant]);
  /* which FAMILY of instrument the walked branch's second fork reads — the
     live tool's two second forks (cities-tool, DiagnosisSection.tsx). Both
     are read off the SAME plane fork one used: a demand shock (whatever its
     sign) looks at a different MARK on it — the metro, against the median
     population line — and a supply shock at a different Y AXIS — price
     growth in place of pay. */
  const demandFork =
    citySide === "demand" ||
    citySide === "demandpos" ||
    citySide === "demandneg";
  /* the demand fork's read: the metro's population growth against the
     median metro's, and the metro's own quadrant, which says why */
  const metroRead = useMemo(
    () => demandRead(cityShort, country),
    [cityShort, country],
  );
  /* the supply fork's read: price growth against the median — a two-way
     split of the re-axed plane, not four quadrants */
  const priceRead = useMemo(
    () => supplyRead(cityShort, country),
    [cityShort, country],
  );
  /* What the stage is looking at, beat by beat: the whole tree while it is
     being introduced, the root and its branches once fork one is answered,
     then just the branch the city took. Only "focus" mode acts on it; the
     minimap draws it in every mode so the frame is never a surprise. */
  /* ---------- what the stage is looking at ----------
     TWO poses, not four. The tree is far wider than it is tall relative to
     the stage, so any frame that keeps its full width is width-bound at the
     SAME scale — a "root and its branches" frame is exactly as wide as the
     whole tree, so framing it moved the tree without ever zooming it. A pose
     that only pans is worse than no pose at all: it costs the reader a
     re-orientation and buys them nothing.
     So the frame changes only where it can actually narrow — the whole tree
     while the walk is still at the root and its forks, then the branch the
     city took once it has landed. The choice beat opens back out, because
     there every leaf is a target again and a frame around one branch would
     put the others off-stage. */
  const frame = useMemo((): [number, number, number, number] => {
    if (step < LEAF_BEAT) return wholeBox(sh);
    /* a one-fork structure has nothing to pick on its tree, so its landing
       frame is simply where it stays */
    if (step >= CHOICE_BEAT && forks2) return wholeBox(sh);
    return branchBox(sh, citySide);
  }, [step, sh, forks2, citySide]);
  /* the room the tree has on stage: the whole width while it is alone, the
     left of it once an instrument is up. Smaller screens get a more
     aggressive zoom cap so the framed tree stays readable instead of
     squashing to a tiny footprint. */
  /* The viewBox grows past its authored 640 to the stage's own aspect,
     symmetrically (dy above and below), so a stage taller than the tree is
     wide stops letterboxing: the whole-tree fit and a framed branch can use
     the height. On a narrow stage the instrument then sits over the stage's
     bottom-left corner, so a frame has two rooms to choose from — the full
     width above the instrument, or the full height right of it — and takes
     whichever shows its box larger: wide boxes (the whole tree) the first,
     tall ones (a branch) the second. On a wide stage both are the whole
     room. */
  const dy = (H * (stageHeadroom - 1)) / 2;
  /* and sideways, on a stage wider than the tree's proportion (a phone on
     its side): the viewBox grows by sx each side, so the ride's frames span
     the stage's real width rather than a letterboxed 1180 */
  const sx = (W * (stageWidthroom - 1)) / 2;
  const intoFor = useCallback(
    (
      _box: [number, number, number, number],
    ): [number, number, number, number] => [
      24 - sx,
      18 - dy,
      W - 24 + sx,
      H - 18 + dy,
    ],
    [sx, dy],
  );
  /* the ride's room: it frames the whole tree at its full stops and centres
     its zoomed ones, so it reads the room the whole tree would get */
  const focusInto = useMemo(() => intoFor(wholeBox(sh)), [intoFor, sh]);
  /* the "fit whole" pose: the whole tree fitted to its room, capped so a
     very wide stage does not blow it up past reading size */
  const wholePose = useMemo(
    () => fitPose(wholeBox(sh), focusInto, 1.5),
    [sh, focusInto],
  );
  const wholeFit = `translate(${wholePose[1].toFixed(1)}px, ${wholePose[2].toFixed(1)}px) scale(${wholePose[0].toFixed(3)})`;
  /* ---------- the pour tiles (the chart → tree hand-off) ----------
     One tile per plane region, and three boxes per tile, all in stage
     coordinates so plain CSS transforms carry them while the whole-tree pose
     settles underneath:
       the QUADRANT — the sector's bounding box on the full-stage chart;
       the CORNER CARD — a card the size its head will be, tucked into the
         quadrant's outer corner, which is where the chart hangs the
         quadrant's label. The quadrant condenses onto it, so the label the
         reader was just reading stays put and becomes the card's title;
       the SLOT — the branch head it becomes, run through the whole-tree pose.
     (Sept 2026 revision. The tiles used to fly straight from quadrant to
     slot as bare tinted rectangles: the name and the mark went out with the
     chart and came back on the card, so for the length of the flight nothing
     said which rectangle was which — two hues across four quadrants — and,
     since the plane unrolls clockwise into the row, the top pair and the
     bottom pair swap sides and piled up mid-stage.) */
  const pourTiles = useMemo(() => {
    if (!pourOn) return [];
    const [pk, ptx, pty] = wholePose;
    const headTop = headRowY(sh) - headRowH(sh) / 2;
    /* the card, in stage units */
    const cw = pk * sh.headW;
    const ch = pk * headRowH(sh);
    const fs = sh.headSize ?? 17.5;
    /* the deal's order is the geometry's (see pourDealAt): the plane's right
       column first, then its left, and the upper card first in each. The
       city's own quadrant is marked by its tint, not by its turn. */
    const cols = [
      ...new Set(sh.plane.map((sec) => Math.sign(sectorAnchor(sec)[0]))),
    ].sort((a, b) => b - a);
    const order = sh.plane
      .map((sec, i) => {
        const [ax, ay] = sectorAnchor(sec);
        return { i, col: cols.indexOf(Math.sign(ax)), ay };
      })
      .sort((a, b) => a.col - b.col || b.ay - a.ay);
    const dealAt = new Map(order.map((o, n) => [o.i, pourDealAt(n, o.col)]));
    const lastDeal = Math.max(0, ...dealAt.values());
    return sh.plane.map((sec, i) => {
      const pts = sectorPoly(sec).map(
        ([px, py]) => [cxu(px), cyu(py)] as [number, number],
      );
      const sx = Math.min(...pts.map((p) => p[0]));
      const sy = Math.min(...pts.map((p) => p[1]));
      const sw = Math.max(...pts.map((p) => p[0])) - sx;
      const sHt = Math.max(...pts.map((p) => p[1])) - sy;
      const lab = planeLabelAt(sec);
      /* the outer corner, as a fraction of the box — the condense's still
         point (y runs down on the stage, so an upper region anchors at 0) */
      const ox = lab.ax > 0 ? 1 : lab.ax < 0 ? 0 : 0.5;
      const oy = lab.ay > 0 ? 0 : lab.ay < 0 ? 1 : 0.5;
      const cx0 = sx + (sw - cw) * ox;
      const cy0 = sy + (sHt - ch) * oy;
      const ex = ptx + pk * (headX(sh, sec.side) - sh.headW / 2);
      const ey = pty + pk * headTop;
      const dx = ex - cx0;
      const dy = ey - cy0;
      const deal = dealAt.get(i) ?? 0;
      /* the label: the head card's own (mark, name, the two dials), drawn in
         tree coordinates and carried by a pose of its own. At the corner it
         wears the whole-tree pose less the flight still to come, so that once
         dealt it lies exactly on the real card's label. It starts at the
         chart label's size, on the chart label's own edge and baseline. */
      const b = sh.branches.find((br) => br.id === sec.side);
      const name = quadName(sec.side);
      const s0 = 15 / fs;
      let labFrom = "none";
      if (b) {
        const w = name ? fs * 1.3 + 6 + nameWidth(name, fs) : 0;
        const edge =
          lab.anchor === "end"
            ? b.x + w / 2
            : lab.anchor === "start"
              ? b.x - w / 2
              : b.x;
        labFrom = `translate(${(lab.xa - s0 * edge).toFixed(1)}px, ${(lab.y0 - s0 * (headRowY(sh) - 5)).toFixed(1)}px) scale(${s0.toFixed(3)})`;
      }
      return {
        key: `${sec.side}-${i}`,
        side: sec.side,
        own: sec === placeSector,
        branch: b,
        sx,
        sy,
        sw,
        sHt,
        cx0,
        cy0,
        cw,
        ch,
        rx: 6 * pk,
        origin: `${ox * 100}% ${oy * 100}%`,
        shrink: `scale(${(cw / sw).toFixed(4)}, ${(ch / sHt).toFixed(4)})`,
        grow: `scale(${(sw / cw).toFixed(4)}, ${(sHt / ch).toFixed(4)})`,
        dx,
        dy,
        labFrom,
        labTo: `translate(${(ptx - dx).toFixed(1)}px, ${(pty - dy).toFixed(1)}px) scale(${pk.toFixed(3)})`,
        deal,
        launch: pourLaunch(deal),
        /* the rewind is the deal's film run backwards at its own speed — the
           card that landed last is the first to lift, and the gaps that kept
           the flights apart on the way out keep them apart on the way home —
           and every quadrant opens out together once the last card is back
           in its corner */
        back: ((lastDeal - deal) * POUR.backFlight) / POUR.flight,
      };
    });
  }, [pourOn, sh, wholePose, placeSector]);
  /* a branch head's label, in tree coordinates. One drawing for the head card
     and for the hand-off's tile that becomes it, so the card that is dealt
     and the card it lands on cannot drift apart. A quadrant head leads with
     the landing's mark and the city type, centred as one pair, and the two
     dials that define it ride underneath as the sections' stat-chip icons
     (the shock it is stays in the chart's corner and the rail's copy). */
  const headLabel = (b: (typeof sh.branches)[number]) => {
    const name = quadName(b.id);
    const fs = sh.headSize ?? 17.5;
    if (!name)
      return (b.titleLines ?? [b.title]).map((line, li, all) => (
        <text
          key={li}
          x={b.x}
          y={HEAD_Y + 5 - (all.length - 1) * 9 + li * 18}
          textAnchor="middle"
          fontSize={fs}
          fill={TREE_SIDE_COLOR[b.id]}
        >
          {line}
        </text>
      ));
    const mark = fs * 1.3;
    const gap = 6;
    const x0 = b.x - (mark + gap + nameWidth(name, fs)) / 2;
    return (
      <>
        <QuadMark
          side={b.id}
          x={x0}
          y={HEAD_Y - 5 - mark * 0.78}
          size={mark}
          color={TREE_SIDE_COLOR[b.id]}
        />
        <text
          x={x0 + mark + gap}
          y={HEAD_Y - 5}
          textAnchor="start"
          fontSize={fs}
          fill={TREE_SIDE_COLOR[b.id]}
        >
          {name}
        </text>
        <QuadMetrics side={b.id} x={b.x} y={HEAD_Y + 13} />
      </>
    );
  };
  /* when a head takes over from its tile: once it has landed, not before —
     the flight's last stretch is a slow settle into the slot, so a head that
     came up even a tenth of a second early stood a card's edge below its
     tile. The tile starts to go at the same moment (nv-pour-land). */
  const pourLandAt = (side: string): number | undefined => {
    const t = pourTiles.find((p) => p.side === side);
    return t ? t.launch + POUR.flight : undefined;
  };

  /* ---------- which way the pour is flying ----------
     The hand-off is a CROSSING, not a stop: it plays forward as the walk
     enters the tree phase and rewinds as it leaves. Keyed to the crossing
     rather than to the tree beat, so scrolling back up from a later stop —
     which lands on the tree beat with the tree already standing — does not
     replay a flight the reader has already watched, and scrolling off the
     top of the beat flies the heads back onto the chart instead of cutting
     them. */
  /* when the last card of the deal leaves, from the first */
  const lastDeal = Math.max(0, ...pourTiles.map((t) => t.deal));
  /* how long the whole crossing owns the stage — the backstop that takes the
     tiles off it: forward, the last card dealt has landed and handed over;
     backward, the last card is home, every quadrant has opened out, and the
     group has cross-faded into the chart (0.55s — that fade only starts once
     the last tile is home, see `pourHome`) */
  const pourMs = (pourLaunch(lastDeal) + POUR.flight + POUR.land) * 1000 + 80;
  /* when the rewind's quadrants open out: the last card is back */
  const expandAt = (lastDeal / POUR.flight + 1) * POUR.backFlight;
  const backMs = (expandAt + POUR.expand + 0.55) * 1000 + 100;
  const [pourRun, setPourRun] = useState<{ dir: 1 | -1; id: number } | null>(
    null,
  );
  /* the rewind's hand-off point: every tile is back on its quadrant. The
     chart waits for it before the rest of it fades in, so the quadrants
     arrive first and the plane is rebuilt around them rather than under
     them. Counted off the tiles' own animation ends rather than timed, so
     the CSS keeps sole ownership of the pace. */
  const [pourHome, setPourHome] = useState(false);
  const homeCount = useRef(0);
  const onTileHome = (e: AnimationEvent<SVGGElement>) => {
    if (e.animationName !== "nv-pour-home") return;
    if (++homeCount.current >= pourTiles.length) setPourHome(true);
  };
  const prevStepRef = useRef(step);
  useEffect(() => {
    const was = prevStepRef.current >= TREE_BEAT;
    prevStepRef.current = step;
    const now = step >= TREE_BEAT;
    if (!pourOn || was === now) return;
    homeCount.current = 0;
    setPourHome(false);
    setPourRun((r) => ({ dir: now ? 1 : -1, id: (r?.id ?? 0) + 1 }));
  }, [step, pourOn]);
  /* the tiles leave the stage when their flight is over: forward, the heads
     have taken their entrance; backward, the chart has its quadrants back.
     This also backstops the rewind — if the tiles' animation never runs (an
     instant navigation kills it) no landing is ever counted, and clearing
     the run is what lets the chart back on stage */
  useEffect(() => {
    if (!pourRun) return;
    const t = setTimeout(
      () => setPourRun(null),
      pourRun.dir < 0 ? backMs : pourMs,
    );
    return () => clearTimeout(t);
  }, [pourRun, pourMs, backMs]);
  /* the chart holds off while its quadrants are still in the air */
  const pourHold = !!pourRun && pourRun.dir < 0 && !pourHome;
  /* the chart-phase zoom is a transform on the whole svg, so it can only
     spend the stage's own vertical headroom — past that it overlaps the head
     and the rail (the narrow layouts are height-bound, with none) */
  const chartScale =
    step < TREE_BEAT
      ? Math.min(
          1.24,
          1 + Math.max(0, 1 - stageScale) * 0.4,
          stageHeadroom,
        )
      : 1;
  const treeZoomCap = Math.min(4.8, 2.4 + Math.max(0, 1 - stageScale) * 2.2);

  /* ---------- where a leaf card actually sits ----------
     Everything that points at a leaf — the route glow, the walking dot,
     the badges — goes through here, so no mode can disagree about it. */
  const leafBox = useCallback(
    (id: string) => {
      const l = leaves.find((v) => v.id === id);
      return {
        x: l?.x ?? sh.rootX,
        w: l?.w ?? 120,
        lines: l?.lines ?? [""],
        size: sh.leafSize,
      };
    },
    [leaves, sh],
  );
  const altById = useMemo(
    () => new Map(treeNodes(sh.variant).map((n) => [n.id, n])),
    [sh],
  );

  const onSelectRef = useRef(onSelectPath);
  onSelectRef.current = onSelectPath;

  /* ---------- per-element emphasis ----------
     steps 5–7: the walk — the city's route full, everything else muted;
     step 8: the choice — hover/selection lights, the rest recedes */
  /* where the tree is fully drawn from the start, reveal order can no longer
     imply progress — the lit set follows the dot instead: the branch from the
     moment the quadrant names it, the leaf only once fork two has resolved
     (a walk that lit its leaf on the tree beat would answer fork two before
     asking it) */
  const cityPath = useMemo(
    () =>
      new Set<string>(
        step < LEAF_BEAT
          ? ["root", citySide]
          : ["root", citySide, suggLeaf],
      ),
    [step, citySide, suggLeaf],
  );
  /* from the choice beat on the whole tree is on show: the diagnosed route
     stays lit, and the rest dims rather than mutes */
  const keep = useMemo(() => new Set<string>(["root", ...suggAlt]), [suggAlt]);
  const status = (id: string): { g: string; lit: boolean } => {
    if (step < litFrom) return { g: "", lit: false };
    if (step < CHOICE_BEAT)
      return cityPath.has(id)
        ? { g: "", lit: true }
        : { g: " nv-mute", lit: false };
    if (keep.has(id)) return { g: "", lit: true };
    return { g: " nv-dim", lit: false };
  };

  const on = (b: boolean) => "nv-fade" + (b ? " on" : "");

  /* ---------- the reveal gates ----------
     The beat is the gate everywhere; a camera ride ALSO waits for the
     camera to pull up to a rank's station, so the fork logic fades in as
     the dot arrives at it rather than the moment the scroll lands on the
     stop (the ride effect below reports the arrivals). */
  const arrivedAt = (k: number) => !rideOn || rideArrived >= k;
  const gFork1 = treeUpFront || (step >= fork1At && arrivedAt(1));
  /* the pour lands the head cards a beat early — the tiles become them; the
     edges still wait for fork one's answer */
  const gHeads = gFork1 || (pourOn && step >= TREE_BEAT);
  const gFork2 = treeUpFront || (step >= FORK2_BEAT && arrivedAt(2));
  const gLeaf = treeUpFront || (step >= LEAF_BEAT && arrivedAt(3));
  /* the landing furniture — badges, the walked route's glow — waits for
     the arrival too */
  const gLand = step >= LEAF_BEAT && arrivedAt(3);
  /* on the hand-off beat everything below the root waits for the pour's
     tiles to land — the heads by their own class, the edges and the ranks
     under them by this one — so the tree grows out of the poured heads
     rather than hanging in the air before they arrive (the zoomed walk is
     the telling where those ranks are already on at this beat) */
  const pourWait = pourOn && step === TREE_BEAT ? " nv-pour-wait" : "";

  /* everything the study modes' drawings need to agree with the walk */
  const vp: WalkViewProps = {
    sh,
    gates: {
      tree: treeUpFront || step >= TREE_BEAT,
      fork1: gFork1,
      fork2: gFork2,
      leaf: gLeaf,
      choice: step >= CHOICE_BEAT,
    },
    landed: gLand,
    stationIdx: stationFor(step),
    forks2,
    cityForks,
    cityShort,
    citySide,
    suggLeaf,
    status,
    medPop: pc(med.pop),
    medCost: pc(medCost),
  };

  /* ---------- the walking dot ----------
     Between tree stations the dot doesn't fly point-to-point — it WALKS the
     tree, tracing the elbow route through each card. CSS transitions can only
     cut straight lines between transforms, so the walk is driven imperatively:
     one polyline (the city's full route, root → head → fork two → leaf) with
     each station a point along it, and a rAF tween that moves the dot by arc
     length. Off-tree moves (the chart steps, chart → root) stay straight. */
  const walk = useMemo(() => {
    const pts: [number, number][] = [
      [sh.rootX, DOT_ROOT_Y],
      [sh.rootX, ROOT_BUS],
      [headX(sh, citySide), ROOT_BUS],
      [headX(sh, citySide), HEAD_BOT + DOT_BELOW_HEAD],
      ...(cityForks
        ? ([
            [headX(sh, citySide), DOT_FORK2_Y],
            [headX(sh, citySide), LEAF_BUS],
            [leafBox(suggLeaf).x, LEAF_BUS],
            [leafBox(suggLeaf).x, DOT_LEAF_Y],
          ] as [number, number][])
        : []),
    ];
    const aw = arcWalk(pts);
    /* station arcs: root, below-the-head, the second fork, the leaf. A
       branch that stops at its head has only the first two, so its later
       beats hold the dot at the head it already reached rather than
       inventing stations. */
    return {
      at: aw.at,
      total: aw.total,
      stations: cityForks
        ? [0, aw.cum[3], aw.cum[4], aw.cum[7]]
        : [0, aw.total, aw.total, aw.total],
    };
  }, [sh, cityForks, citySide, suggLeaf, HEAD_BOT, leafBox]);

  /* the sideways ride steers by the sideways tree's own route */
  const sideArc = useMemo(
    () => arcWalk(sideRoute(sh, citySide, suggLeaf)),
    [sh, citySide, suggLeaf],
  );

  const travelerRef = useRef<SVGGElement>(null);
  const focusRef = useRef<SVGGElement>(null);
  const sideFocusRef = useRef<SVGGElement>(null);
  const sideDotRef = useRef<SVGGElement>(null);
  const dyRef = useRef(dy);
  dyRef.current = dy;
  const posRef = useRef<[number, number] | null>(null);
  const arcRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const [ux, uy] = placeSpot;

  /* a city switch mid-walk re-derives the route — snap rather than tween
     between two different cities' stories (declared before the mover, so the
     reset lands first) */
  useLayoutEffect(() => {
    posRef.current = null;
  }, [cityShort, fit]);

  useLayoutEffect(() => {
    const g = travelerRef.current;
    if (!g) return;
    /* while the camera ride owns the tree phase it moves the dot itself —
       two writers on one transform would fight */
    if (rideOn && step >= TREE_BEAT) return;
    /* the guided walk has no root stop: fork one is answered on the tree
       beat, so the dot goes straight to its branch head — riding the pour's
       tiles down where the hand-off plays */
    const arc = step < TREE_BEAT ? null : walk.stations[stationFor(step)];
    const target: [number, number] =
      arc != null
        ? walk.at(arc)
        : step <= DIAL1_BEAT
          ? [cxu(ux), cyu(-1)]
          : [cxu(ux), cyu(uy)];
    const set = ([x, y]: [number, number]) => {
      g.setAttribute("transform", `translate(${x},${y})`);
      posRef.current = [x, y];
    };
    cancelAnimationFrame(rafRef.current);
    if (
      posRef.current == null ||
      document.documentElement.dataset.jzInstant === "1"
    ) {
      set(target);
      arcRef.current = arc;
      return;
    }
    const from = posRef.current;
    const fromArc = arcRef.current;
    /* walk the polyline only when both ends are on it; otherwise glide */
    const along = arc != null && fromArc != null;
    const dist = along
      ? Math.abs(arc - fromArc)
      : Math.hypot(target[0] - from[0], target[1] - from[1]);
    const dur = Math.min(1250, 420 + dist * 1.1);
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = easeCubicInOut(p);
      if (along) {
        const a = fromArc + (arc - fromArc) * e;
        arcRef.current = a;
        set(walk.at(a));
      } else {
        arcRef.current = null;
        set([
          from[0] + (target[0] - from[0]) * e,
          from[1] + (target[1] - from[1]) * e,
        ]);
      }
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else arcRef.current = arc;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, walk, ux, uy, rideOn, stationFor]);

  /* ---------- the camera rides (fit: "ride" / "sideride") ----------
     STEPPED, not scrubbed: the camera's target is the current stop's
     station on the route, and moving to the next stop plays the travel as
     an animation — the damped arc walks the polyline through every elbow
     on the way, so forks arrive and the branch not taken slides off the
     frame's edge. The scroll itself is free — a gesture may rest anywhere
     in the track, and the camera simply plays to whichever stop that is.
     The choice stop opens back out to the whole tree. Driven imperatively
     on an idle-stopping rAF loop; the group's own 0.9s transition is
     disabled for the duration. */
  const stepRef = useRef(step);
  stepRef.current = step;
  /* the camera's state survives re-renders AND effect re-subscriptions — a
     stop change must be ANIMATED from wherever the camera is, never
     re-seeded at the target. The focus area is read through a ref for the
     same reason: in the short flow it changes size when the hero panel
     arrives at the second stop, and that shift is damped like everything
     else rather than re-running the effect. */
  const camRef = useRef({
    init: false,
    a: 0,
    cx: 0,
    cy: 0,
    k: 0,
    dx: 0,
    dy: 0,
    fx: 0,
    fy: 0,
    /* the springs' velocities — the arc's, the centre's, the zoom's (in
       log space) — so a re-aim mid-move carries its momentum */
    va: 0,
    vcx: 0,
    vcy: 0,
    vk: 0,
    /* the hand-off: when the ride took the dot over, and where the chart
       had left it — the entrance below is timed and placed off these */
    enterT: 0,
    fromX: 0,
    fromY: 0,
  });
  const focusIntoRef = useRef(focusInto);
  focusIntoRef.current = focusInto;
  /* the loop's starter, kept where a step change can reach it (below) */
  const kickRef = useRef<(() => void) | null>(null);
  /* a change of WORLD — mode, tree, city — is the one time it may cut */
  useEffect(() => {
    camRef.current.init = false;
  }, [rideOn, sideRideMode, sh, cityShort]);
  useEffect(() => {
    if (!rideOn) return;
    const g = sideRideMode ? sideFocusRef.current : focusRef.current;
    const dotEl = sideRideMode ? sideDotRef.current : travelerRef.current;
    if (!g) return;
    const track = trackRef.current!;
    const scroller = track.closest(".pages") as HTMLElement | null;
    const route = sideRideMode ? sideArc : walk;
    /* the camera stations sit ON the route (card centres, sideways); the
       DOT parks at the walk's rests once it has arrived, so it never sits
       covering a card's title */
    const stationArcs = sideRideMode
      ? cityForks
        ? [0, sideArc.cum[4], sideArc.cum[5], sideArc.cum[8]]
        : [0, sideArc.total, sideArc.total, sideArc.total]
      : walk.stations;
    const rests: [number, number][] = sideRideMode
      ? sideRests(sh, citySide, suggLeaf)
      : walk.stations.map((a) => walk.at(a));
    /* reading zoom per station; the sideways tree is airier, so its ride
       stays a step wider to keep neighbours in frame. Smaller screens
       deserve a stronger zoom so the tree does not sit too tiny in the
       framed view. */
    const STOP_ZOOM = sideRideMode
      ? [1.35, 1.6, 1.65, 1.5].map((z) => z * (1 + (1 - stageScale) * 0.8))
      : [1.45, 1.75, 1.8, 1.55].map((z) => z * (1 + (1 - stageScale) * 0.8));
    const wb = sideRideMode ? sideBox(sh, forks2) : wholeBox(sh);
    const wcx = (wb[0] + wb[2]) / 2;
    const wcy = (wb[1] + wb[3]) / 2;
    g.style.transition = "none";
    const st = camRef.current;
    /* the reveal gates read the arrivals — only re-render when one fires */
    const bumpArrived = (v: number) => {
      if (arrivedRef.current !== v) {
        arrivedRef.current = v;
        setRideArrived(v);
      }
    };
    let raf = 0;
    let running = false;
    let last = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.06, (now - last) / 1000) || 0.016;
      last = now;
      const stp = stepRef.current;
      if (stp < TREE_BEAT) {
        /* still on the chart beats: the tree group holds home, and the dot's
           opacity goes back to the stylesheet's */
        g.style.transform = "none";
        if (dotEl) {
          dotEl.style.opacity = "";
          dotEl.style.transition = "";
        }
        st.init = false;
        running = false;
        bumpArrived(0);
        return;
      }
      const sIdx = stationFor(stp);
      /* the stops that frame the whole tree: the choice — and the walk's
         opening stop, the hand-off, which the next gesture zooms in from */
      const wholeStop = (stp >= CHOICE_BEAT && forks2) || stp <= TREE_BEAT;
      const arcT = stationArcs[sIdx];
      const [ix0, iy0, ix1, iy1] = focusIntoRef.current;
      const fcxT = (ix0 + ix1) / 2;
      const fcyT = (iy0 + iy1) / 2;
      /* the whole-tree stops are capped at 1.5, so the pour's tiles —
         computed against that pose — land on the heads */
      const kFit = fitScale(wb, focusIntoRef.current, 1.5);
      /* the reading zoom comes from how much tree each stop should show
         (ZOOM_FRAME_W), so it is a real step in from the whole-tree fit on
         any stage; the small-stage rides keep their per-station table */
      const onPhone = phoneRef.current;
      const frameW = onPhone ? ZOOM_FRAME_W_PHONE : ZOOM_FRAME_W;
      const biasY = onPhone ? ZOOM_BIAS_Y_PHONE : ZOOM_BIAS_Y;
      const stopK = (i: number) =>
        !sideRideMode
          ? Math.min(
              onPhone ? ZOOM_CAP_PHONE : ZOOM_CAP,
              Math.max(kFit * 1.3, (ix1 - ix0) / frameW[i]),
            )
          : STOP_ZOOM[i];
      /* a branch that stops at its head has two rests, not four: the stops
         past its head all park the dot beside the head (the sideways drawing
         clamps the same way), never at the fork or leaf it does not have */
      const lastRest = cityForks ? 3 : 1;
      const restAt = (i: number) => rests[Math.min(i, lastRest)];
      /* a fresh camera opens AT its stop — the centre is seeded once the
         target is known below — rather than drifting in from the route */
      const fresh = !st.init;
      if (fresh) {
        st.init = true;
        /* the walk enters the tree ON the hand-off beat, with its branch
           already chosen — so it does not pop onto that branch, it walks in
           from the root while the pour carries its quadrant to the same
           head. Every other stop opens parked at its station. */
        st.a = stp === TREE_BEAT ? 0 : arcT;
        st.enterT = now;
        [st.fromX, st.fromY] = posRef.current ?? rests[0];
        st.k = wholeStop ? kFit : stopK(sIdx);
        [st.dx, st.dy] = restAt(sIdx);
        st.fx = fcxT;
        st.fy = fcyT;
        st.va = st.vcx = st.vcy = st.vk = 0;
      }
      /* ---------- the entrance (the hand-off beat) ----------
         The dot used to be handed from the chart to the tree in one frame:
         the ride took it over at the root while it was still sitting on the
         pizza chart, so it was seen leaping from its quadrant to the root
         and then setting off — a jump and a walk, neither of which was the
         quadrant becoming the branch. Now it is three movements and no jump:
           1. the dot fades OUT where the chart left it, as the tiles lift;
           2. it waits, unseen, at the root while the tiles land on the heads;
           3. it fades in at the root and walks down to the branch its own
              quadrant just became.
         The chart's own dot is gone by then, so nothing is seen twice, and
         the walk begins only once there is a tree to walk. Elsewhere in the
         ride the spring runs as before. */
      const entering = stp === TREE_BEAT && sIdx === 1;
      const sinceEnter = (now - st.enterT) / 1000;
      const HOLD_S = 0.3; // the fade-out at the chart spot
      /* the hand-off — the dot appears at the root just after the root
         question does, which is as the last card of the deal slots in (the
         pour's own clock); with no pour there are only the heads' fades to
         wait for */
      const WAIT_S = pourOn ? pourAfter(lastDeal) + 0.2 : 0.85;
      const FADE_S = 0.35; // the fade-in at the root
      let entrance: "out" | "wait" | "in" | "walk" | null = null;
      if (entering && sinceEnter < HOLD_S) entrance = "out";
      else if (entering && sinceEnter < WAIT_S) entrance = "wait";
      else if (entering && sinceEnter < WAIT_S + FADE_S) entrance = "in";
      else if (entering && sinceEnter < WAIT_S + FADE_S + 1.4)
        entrance = "walk";
      if (dotEl) {
        /* the stylesheet eases the traveller's opacity over 0.6s (its
           between-stop fades want that); these writes land every frame and
           must not be eased on top, or the fade-out lags behind the tiles
           and the dot is still ghosting in while it walks */
        dotEl.style.transition = entrance ? "none" : "";
        dotEl.style.opacity =
          entrance === "out"
            ? String(1 - sinceEnter / HOLD_S)
            : entrance === "wait"
              ? "0"
              : entrance === "in"
                ? String(Math.min(1, (sinceEnter - WAIT_S) / FADE_S))
                : "";
      }
      /* the arc draws up to the station along the path — this is the ride:
         on a spring, so the dot sets off gently and eases in to the station
         rather than lurching off at full speed. During the entrance it holds
         at the root, fully visible, before it sets off — the reader should
         see the city AT the root question before they see it answer it. */
      if (entrance === "out" || entrance === "wait" || entrance === "in") {
        st.a = 0;
        st.va = 0;
      } else {
        [st.a, st.va] = smoothDamp(st.a, arcT, st.va, dt);
      }
      /* the pull-up report: within the leg's last stretch the rank's
         reveal fires, so its cards finish fading in as the dot arrives.
         Scrolling back drops the mark with the stop, so a re-approach
         reveals on arrival again. The report is a state change — a full
         re-render of the stage, one long frame — so the walk, whose tree is
         already whole and reads only the LANDING's arrival (the badge),
         reports that one alone, and only once the dot has all but stopped,
         so the frame it costs never lands mid-flight. */
      const near = 20;
      const reached =
        Math.abs(arcT - st.a) < near
          ? sIdx
          : Math.min(arrivedRef.current, sIdx);
      bumpArrived(reached < 3 ? 0 : reached);
      const [px, py] = route.at(st.a);
      /* The dot. The sideways rests live BELOW the cards, off the route
         that runs along the card centreline, so the sideways dot does not
         ride the route — it runs straight between the rests of whichever
         leg the arc is on (the pair of stations the arc lies between, read
         off the arc itself so a ride back down a leg retraces it at the
         camera's pace instead of jumping to the near rest). */
      const remain = Math.abs(arcT - st.a);
      const arrived = remain < 14;
      let leg = 0;
      while (leg < lastRest && st.a > stationArcs[leg + 1]) leg++;
      const legA = stationArcs[leg];
      const legB = stationArcs[Math.min(leg + 1, lastRest)];
      const legProgress =
        legB > legA
          ? Math.max(0, Math.min(1, (st.a - legA) / (legB - legA)))
          : 1;
      const [rx1, ry1] = restAt(leg);
      const [rx2, ry2] = restAt(leg + 1);
      const [rxS, ryS] = restAt(sIdx);
      const dxT = sideRideMode
        ? rx1 + (rx2 - rx1) * legProgress
        : arrived
          ? rxS
          : px;
      const dyT = sideRideMode
        ? ry1 + (ry2 - ry1) * legProgress
        : arrived
          ? ryS
          : py;
      /* The camera. On the small-stage ride it rides the route itself, dot
         and all. The sideways route's elbows would swing it up to the
         centreline and back down on every leg — a visible lurch on the
         first fork, whose leg runs a whole row's height — so sideways it
         tracks the dot's own straight run instead, biased a little toward
         the cards above. The walk aims at the STATION and pans
         straight to it while the dot walks the elbows: the camera has no
         corners to turn, and the dot, on the same spring, stays inside the
         frame for the whole leg. */
      const k = wholeStop ? kFit : stopK(sIdx);
      /* the walk keeps its frame inside the tree's box, as a map viewer
         would: an outer branch sits off-centre in the frame rather than
         dragging half a frame of empty stage in beside it */
      const zoomCx = (x: number) => {
        const hw = (ix1 - ix0) / (2 * k);
        return wb[2] - wb[0] <= 2 * hw
          ? wcx
          : Math.max(wb[0] + hw, Math.min(wb[2] - hw, x));
      };
      const cx = wholeStop ? wcx : sideRideMode ? (dxT + px) / 2 : zoomCx(rxS);
      const cy = wholeStop
        ? wcy
        : sideRideMode
          ? dyT - 24
          : ryS + biasY[sIdx];
      if (fresh) {
        st.cx = cx;
        st.cy = cy;
      }
      /* pan and zoom ride the same spring as the walk, so the three arrive
         together; the zoom eases in log space, so a step in and the step
         back out feel like the same move played in reverse */
      [st.cx, st.vcx] = smoothDamp(st.cx, cx, st.vcx, dt);
      [st.cy, st.vcy] = smoothDamp(st.cy, cy, st.vcy, dt);
      const [lk, vk] = smoothDamp(Math.log(st.k), Math.log(k), st.vk, dt);
      st.k = Math.exp(lk);
      st.vk = vk;
      const ff = 1 - Math.exp(-dt * 5);
      st.fx += (fcxT - st.fx) * ff;
      st.fy += (fcyT - st.fy) * ff;
      g.style.transform = `translate(${(st.fx - st.k * st.cx).toFixed(2)}px, ${(
        st.fy -
        st.k * st.cy
      ).toFixed(2)}px) scale(${st.k.toFixed(4)})`;
      const fd = 1 - Math.exp(-dt * 11);
      /* the dot's own scale, for the one phase that needs it (below) */
      let dotK = 1;
      if (entrance === "out") {
        /* fading out on the chart: hold the chart spot exactly. The spot is
           a STAGE position and the dot lives inside the group this frame has
           just posed, so it is written through the pose's inverse, size and
           all — written raw (as it was until Sept 2026) the pose carried it
           off as it faded: Boston's dot slid out of Fortress and went out
           over Magnet, on the one beat that is about which quadrant is
           whose. The smoother is seeded at the root by the next phase, so
           the fade-in starts THERE. */
        dotK = 1 / st.k;
        st.dx = (st.fromX - (st.fx - st.k * st.cx)) * dotK;
        st.dy = (st.fromY - (st.fy - st.k * st.cy)) * dotK;
      } else if (entrance === "wait" || entrance === "in") {
        [st.dx, st.dy] = rests[0];
      } else {
        st.dx += (dxT - st.dx) * fd;
        st.dy += (dyT - st.dy) * fd;
      }
      dotEl?.setAttribute(
        "transform",
        `translate(${st.dx.toFixed(1)},${st.dy.toFixed(1)})` +
          (dotK !== 1 ? ` scale(${dotK.toFixed(4)})` : ""),
      );
      if (
        entrance === null &&
        Math.abs(arcT - st.a) < 0.4 &&
        Math.abs(st.va) < 1 &&
        Math.hypot(cx - st.cx, cy - st.cy) < 0.3 &&
        Math.hypot(st.vcx, st.vcy) < 1 &&
        Math.hypot(dxT - st.dx, dyT - st.dy) < 0.3 &&
        Math.hypot(fcxT - st.fx, fcyT - st.fy) < 0.3 &&
        Math.abs(k - st.k) < 0.0015 &&
        Math.abs(st.vk) < 0.002
      ) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    kickRef.current = kick;
    kick();
    return () => {
      cancelAnimationFrame(raf);
      kickRef.current = null;
      target.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      g.style.transform = "";
      g.style.transition = "";
    };
  }, [
    rideOn,
    sideRideMode,
    walk,
    sideArc,
    beats,
    sh,
    forks2,
    cityForks,
    stationFor,
    pourOn,
    lastDeal,
  ]);

  /* A scroll event wakes the loop, but the step it lands on is committed
     by React AFTER that frame's callbacks — so a single event (one instant
     jump: a keyboard page, a scrollbar click, a deep link) could wake the
     loop while it still read the chart phase, let it idle out, and leave
     the tree unposed with nothing to wake it again. A stream of wheel
     events masked this. The committed step wakes it too. */
  useEffect(() => {
    kickRef.current?.();
  }, [step]);

  /* the rides are NOT scroll-snapped (Sept 2026): a gesture that comes to
     rest between two stops stays where it stopped — the stage still reads
     the committed stop, and the camera plays to it, but the page never
     glides out from under the reader's hand. */

  /* ---------- instrument scales (the city's fork-two chart) ---------- */
  /* supply: the same plane with home-value growth on the Y axis */
  /* the hero panel belonged to the shortened walk, which read its
     instruments off a full-height panel beside a tree eased aside; that
     telling came off with the user-flow switch (Sept 2026), so the walk
     always uses the standard inset. The geometry stays below as a study. */
  const sideInst = sideLayout;
  const heroInst = false;
  const compactRailInset = !sideInst && !heroInst && stageScale < 0.86;
  const inset = sideInst ? INSET_SIDE : heroInst ? INSET_HERO : INSET;
  const compactRailSquare = Math.min(inset.w - 84, inset.h - 138);
  /* the plane's left edge leaves room for its axis furniture, read from
     the panel's 14-unit margin outward: the rotated y label (12px, ~9 deep
     plus ~3 of descender), ~10 clear, then the tick labels ("+12%" at the
     15px .jz-ms-tick, ~35 wide) ending hzTickGap short of the axis — see
     hzTickX and hzLabX. The right edges stay where they were, so the plane
     gives up the room on its left (Sept 2026: at the old 34 the label ran
     through the ticks). */
  const hzTickGap = heroInst || sideInst ? 8 : 4;
  const hzLeft = inset.x + 71 + hzTickGap;
  const hz = sideInst
    ? { x: hzLeft, y: inset.y + 58, w: inset.x + inset.w - 36 - hzLeft, h: 230 }
    : heroInst
      ? { x: hzLeft, y: inset.y + 56, w: inset.x + inset.w - 34 - hzLeft, h: 330 }
      : compactRailInset
        ? { x: hzLeft, y: inset.y + 54, w: inset.x + inset.w - 28 - hzLeft, h: 252 }
        : { x: hzLeft, y: inset.y + 58, w: inset.x + inset.w - 36 - hzLeft, h: 230 };
  const hzTickX = hz.x - hzTickGap;
  const hzLabX = hzTickX - 48;
  /* the re-axed plane is CENTRED ON ITS MEDIANS, so the price cut — the
     fork — sits mid-height and the two halves it splits get equal room, and
     the population median stays where fork one drew it. Its reach is
     measured off the data (metros.ts): wide enough for the metro field and
     for the admin cities, which sit off the metro median by construction. */
  const ZSPAN = PRICE_SPAN;
  /* gridlines at whole percents inside the plane, about four of them */
  const zTicks = (() => {
    const lo = medCost - ZSPAN.home;
    const hi = medCost + ZSPAN.home;
    const step = ZSPAN.home > 5 ? 4 : ZSPAN.home > 2.5 ? 2 : 1;
    const out: number[] = [];
    for (
      let t = Math.ceil((lo + step * 0.25) / step) * step;
      t < hi - step * 0.25;
      t += step
    )
      out.push(t);
    return out;
  })();
  const zy = (z: number) =>
    hz.y + hz.h - ((z - (medCost - ZSPAN.home)) / (2 * ZSPAN.home)) * hz.h;
  const zx = (p: number) =>
    hz.x + ((p - (med.pop - ZSPAN.pop)) / (2 * ZSPAN.pop)) * hz.w;
  /* the plane carries the whole metro field behind the city, the way the
     pizza chart does — so the half the city lands in is read against
     something. Both series run past the frame's ends, so the cloud is
     clamped just inside the rim rather than drawn outside it. */
  const zclamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  const zxc = (p: number) =>
    zx(zclamp(p, med.pop - ZSPAN.pop * 0.97, med.pop + ZSPAN.pop * 0.97));
  const zyc = (z: number) =>
    zy(zclamp(z, medCost - ZSPAN.home * 0.97, medCost + ZSPAN.home * 0.97));
  /* demand: the same pizza plane, with the metro promoted on it */
  const pz = sideInst
    ? { x: inset.x + 66, y: inset.y + 92, s: 220 }
    : heroInst
      ? { x: inset.x + 56, y: inset.y + 96, s: 280 }
      : compactRailInset
        ? {
            x: inset.x + (inset.w - compactRailSquare) / 2,
            y: inset.y + 54,
            s: compactRailSquare,
          }
        : { x: inset.x + 66, y: inset.y + 92, s: 220 };
  const pzx = (u: number) => pz.x + ((u + 1) / 2) * pz.s;
  const pzy = (u: number) => pz.y + ((1 - u) / 2) * pz.s;

  /* ---------- rail copy ----------
     Placeholder throughout (Sept 2026): each step's caption says, in a
     line, what its copy will cover, and no more. The numbers and the
     reasoning that used to be spelled out here belong to the instrument on
     the stage, not to the caption. Every body is bracketed, which Body
     renders as a placeholder; the kickers stay, since they are the steps'
     labels rather than their prose. */
  const stepCopy: { kicker: string; body: string }[] = [
    {
      /* the intro (Sept 2026): what the section does, before anything
         draws — the one caption that says a little more, since it is the
         reader's way in */
      kicker: "Where is your constraint?",
      body: "[placeholder: how this section works. two readings place your city on the pizza chart. the quadrant it lands in picks a branch of the diagnostic tree. the walk follows your city down the tree to one ending, and the analysis below reads that ending.]",
    },
    {
      kicker: "Dial one: people",
      body: "[placeholder: population change, against the median metro]",
    },
    {
      kicker: "Dial two: pay",
      body: "[placeholder: wage change, against the median metro]",
    },
    {
      kicker: "The metro around it",
      body: "[placeholder: the metro joins the plane]",
    },
    {
      kicker: "The benchmark",
      body: "[placeholder: the median metro, and the field around it]",
    },
    {
      /* which region of the plane the city landed in — the shape's to say,
         since it is the shape that cuts the plane */
      kicker: sh.planeCopy.kicker,
      body: "[placeholder: which quadrant the city is in]",
    },
    {
      /* the tree beat answers fork one too (the guided walk's only telling
         of it) */
      kicker: "How we diagnose the constraint",
      body: "[placeholder: the chart becomes the tree. the root question is answered by the quadrant.]",
    },
    {
      /* the root question as its own stop: the zoomed walk's (overwritten
         below); the other flows never land on this beat */
      kicker: "The root question",
      body: "[placeholder: the root question]",
    },
    {
      /* fork one as its own stop: the shortened walk's (overwritten below);
         the guided walk skips this beat */
      kicker: "Fork one: demand or supply",
      body: "[placeholder: fork one, answered by the quadrant]",
    },
    {
      kicker: !forks2
        ? "No second fork on the tree"
        : !cityForks
          ? "No second fork on this branch"
          : "Fork two: one more comparison",
      body: !forks2
        ? "[placeholder: this tree stops at the quadrant]"
        : !cityForks
          ? "[placeholder: no second fork on this branch]"
          : "[placeholder: fork two, answered by the inset]",
    },
    {
      kicker: "Where we think you are",
      body: "[placeholder: the landing, and where it leads]",
    },
    {
      kicker: `The ${numberWord(endings)} diagnoses`,
      body: "[placeholder: the endings, and the one the data argues for]",
    },
  ];

  /* the tree-first tellings' fork-two stop names the instrument that swaps
     into the inset; what it says stays the same placeholder */
  const forkTwoInstrument = {
    /* named for the instrument that swaps into the inset */
    kicker: !cityForks
      ? "No second fork on this branch"
      : demandFork
        ? "Fork two: the metro's read"
        : "Fork two: the price axis",
    body: !cityForks
      ? "[placeholder: no second fork on this branch]"
      : demandFork
        ? "[placeholder: fork two. metro population growth vs the median metro]"
        : "[placeholder: fork two. home-value growth vs the median]",
  };
  /* the tree half's stops: the hand-off, fork one read off the quadrant,
     fork two on its own instrument, then back out to the endings */
  stepCopy[TREE_BEAT] = {
    kicker: "How we diagnose the constraint",
    body: "[placeholder: the chart becomes the tree. its four quadrants are the four branches.]",
  };
  stepCopy[FORK1_BEAT] = {
    kicker: "Fork one: the quadrant",
    body: "[placeholder: fork one, answered by the quadrant]",
  };
  stepCopy[FORK2_BEAT] = forkTwoInstrument;
  stepCopy[CHOICE_BEAT] = {
    kicker: `Back out: the ${numberWord(endings)} diagnoses`,
    body: "[placeholder: the endings, and the one the data argues for]",
  };

  /* ---------- the text column ----------
     One block per stop, in the tool's own scrolly grammar (v3's .ct-step):
     a counter, the beat's title, the geography it reads, and the caption.
     The closing block also names the diagnosed route and points at the
     section that follows. */
  const trailPath = suggAlt;
  const trailSide = sideOfPath(trailPath);
  /* which geography a beat reads — the badge the tool hangs on a step's
     title. The dials and the plane read the admin city; the metro beat and
     a demand shock's second fork read the MSA; the intro, the benchmark and
     the closing name none. */
  const geoFor = (beat: number): "city" | "metro" | null => {
    if (beat === INTRO_BEAT || beat === BENCH_BEAT || beat >= CHOICE_BEAT)
      return null;
    if (beat === MSA_BEAT) return "metro";
    /* fork two is ASKED on its own stop and READ on the landing, where its
       instrument now sits (`carriesPanel`) — so both name the geography that
       instrument reads, or the landing's badge says "admin" over a panel
       about the metro */
    if (beat === FORK2_BEAT || beat === LEAF_BEAT)
      return demandFork ? "metro" : "city";
    return "city";
  };
  /* which stops carry an instrument panel under their caption. Fork one is
     read on the pizza chart, on its own stop. Fork two's instrument — the
     same plane re-marked or re-axed — waits for the LANDING (Sept 2026, the
     user's call): the stop that ASKS fork two shows the fork alone, and the
     stop that answers it shows what it was read on, so the figure arrives
     with the verdict it supports rather than a stop ahead of it. The
     back-out carries none: it closes on the whole tree, and an instrument
     for one fork under a stop about every ending was a leftover.
     A property of the BEAT, never of the step in view — a block's room has
     to be the same whether or not it is the one lit (see the panel's box,
     below), so this may decide what a block reserves as well as what it
     shows. */
  const carriesPanel = (beat: number) =>
    beat === insetAt || beat === LEAF_BEAT;
  const insetExtra = heroInst ? 28 : 24;
  const quadTone = (side: string): keyof typeof TREE_SIDE_COLOR => {
    if (side === "demandpos" || side === "demandneg") return "demand";
    if (side === "supplypos" || side === "supplyneg") return "supply";
    return side as keyof typeof TREE_SIDE_COLOR;
  };
  const quadInset = sh.id === "quad" || sh.id === "quad2";

  /* ---------- render ---------- */
  return (
    <div
      className="jz-scrolly nv-scrolly nv-grid"
      ref={trackRef}
      style={{ "--nv-stop": `${stopVh}vh` } as CSSProperties}
    >
      {/* ---------- the text column ----------
          the tool's scrolly grammar (Metro Industries, Economic
          Fundamentals): the steps stack down the left and scroll past the
          sticky figure, the one in view at full strength and the rest
          dimmed — so the reader sees where the walk is going before it gets
          there. Each block is exactly one stop of scroll tall, which is
          what keeps the block in view and the stop it drives in step. The
          dimming is continuous with the scroll (--nv-lit, written by the
          scroll effect), not a flip at the stop boundary. */}
      <div className="ct-steps nv-steps" ref={stepsRef}>
        {beats.map((beat, i) => {
          const copy = stepCopy[beat];
          const isOn = i === stepIdx;
          const last = i === beats.length - 1;
          const geo = geoFor(beat);
          return (
            <div
              key={beat}
              className={"ct-step nv-step" + (isOn ? " is-on" : "")}
              aria-current={isOn ? "step" : undefined}
            >
              {/* the counter names the section it counts, the way the
                  tool's rails do ("Metro Industries 1/3"): the name quiet,
                  the count in ink (v3's .ct-count) */}
              <div className="ct-eyebrow">
                Constraints Diagnosis{" "}
                <b className="ct-count">
                  {i + 1}/{beats.length}
                </b>
              </div>
              <h2>{copy.kicker}</h2>
              {geo && <GeoBadge geo={geo} cityShort={cityShort} />}
              {/* the closing block names the diagnosed route */}
              {last && beat >= LEAF_BEAT && (
                <div className="fig-trail nv-trail">
                  {["root", ...trailPath].map((id, j) => (
                    <Fragment key={id}>
                      {j > 0 && <span className="crumb-sep">›</span>}
                      <span
                        style={{
                          color:
                            TREE_SIDE_COLOR[id === "root" ? "root" : trailSide],
                        }}
                      >
                        {id === "root"
                          ? "The growth question"
                          : altById.get(id)?.title}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
              {copy.body && (
                <p className="lede">
                  <Body text={copy.body} />
                </p>
              )}
              {/* the instrument a fork is read on, under the caption that
                  reads it — the way the first section keeps its chart in
                  the text column. Only the block in view carries it: the
                  panel shows whichever instrument the CURRENT beat asks
                  for, which a dimmed neighbour has no business showing.
                  Its ROOM, though, is held on every block that can carry
                  one: the blocks are flex-centred at a fixed height, so a
                  panel that mounted only on the block in view re-centred
                  that block's caption by half the panel's height at every
                  stop boundary, and the column read as snapping to the
                  stage's stops. The box keeps the panel's aspect ratio
                  empty or full, at the column's full width, so the text
                  scrolls like a page and the panel simply appears beneath
                  it; a block that needs more than one stop for it grows,
                  and the scroll→stop effect above reads the blocks. */}
              {carriesPanel(beat) && (
                <div
                  className="nv-step-inst"
                  aria-hidden="true"
                  style={{
                    aspectRatio: `${inset.w} / ${inset.h + insetExtra}`,
                  }}
                >
                  {isOn && (
                    <svg
                      viewBox={`${inset.x} ${inset.y} ${inset.w} ${inset.h + insetExtra}`}
                    >
                      <use href="#nv-inset-panel-def" />
                    </svg>
                  )}
                </div>
              )}
              {last && (
                <div className="jz-next show nv-next">
                  <span className="jz-next-k">Up Next</span>
                  <span
                    className="jz-next-name"
                    style={{ color: TREE_SIDE_COLOR[nextSide] }}
                  >
                    {branchSectionName(nextSide)} →
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="jz-sticky nv-stage" ref={stageRef}>
        {/* no control row (Sept 2026): the stage's only switch was the
            user-flow study, and the zoomed walk is the section now — so the
            stage keeps the full height the bar used to take. */}
        <div className="jz-body">
          <div className="jz-stagewrap">
            <svg
              ref={svgRef}
              className={
                "jz-svg nv-svg" +
                /* sideways draws its own tree, so the authored one (and, at
                   tree beats, its traveller) leaves the stage */
                (sideLayout ? " nv-hidetree" : "") +
                (sideLayout && step >= TREE_BEAT ? " nv-hidedot" : "")
              }
              viewBox={`${-sx} ${-dy} ${W + 2 * sx} ${H + 2 * dy}`}
              role="img"
              aria-label={`${cityShort} walks the diagnostic tree: two dials place it on the pizza chart, and each fork is answered with its own numbers until it lands on a diagnosis`}
              style={{
                transform:
                  step < TREE_BEAT && stageScale < 1
                    ? `scale(${chartScale})`
                    : undefined,
                transformOrigin: "50% 50%",
                transition: "transform 0.6s ease",
              }}
            >
              {/* ============ the intro: what the section does ============
                  Three placeholders in a row — the chart, the tree, the
                  analysis — on an otherwise empty stage, so the first stop
                  introduces the walk instead of starting it. */}
              <g className={"nv-intro " + on(step === INTRO_BEAT)}>
                <defs>
                  <marker
                    id="nv-intro-head"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto"
                  >
                    <path
                      d="M0,0.5 L7,4 L0,7.5"
                      fill="none"
                      stroke="#9aa8ad"
                      strokeWidth="1.4"
                    />
                  </marker>
                </defs>
                <text
                  className="nv-intro-k"
                  x={W / 2}
                  y={168}
                  textAnchor="middle"
                >
                  How This Section Works
                </text>
                {INTRO_PARTS.map((part, i) => (
                  <g key={part.id} transform={`translate(${W / 2 + (i - 1) * 330} 330)`}>
                    <rect
                      className="nv-intro-box"
                      x={-130}
                      y={-100}
                      width={260}
                      height={150}
                      rx={10}
                    />
                    <g className="nv-intro-ico" transform="translate(0 -46)">
                      {part.icon}
                    </g>
                    <text
                      className="nv-intro-t"
                      x={0}
                      y={28}
                      textAnchor="middle"
                    >
                      {part.title}
                    </text>
                    <text className="nv-ph" x={0} y={78} textAnchor="middle">
                      {part.ph}
                    </text>
                    {i < 2 && (
                      <path
                        className="nv-intro-arrow"
                        d="M140,-25 h44"
                        markerEnd="url(#nv-intro-head)"
                      />
                    )}
                  </g>
                ))}
              </g>

              {/* ============ scene A: the chart, built dial by dial ============ */}
              <g
                className={
                  "nv-chart" + (step >= TREE_BEAT || pourHold ? " off" : "")
                }
              >
                {/* the plane's tints — it reads at once; yours marked. Drawn
                    as sector polygons rather than quadrant blocks, since a
                    shape may cut the plane on the diagonals instead of on
                    the axes; for the quadrants the polygon IS the block. */}
                {sh.plane.map((sec, i) => (
                  <polygon
                    key={`quad-${i}`}
                    className={
                      "nv-quad" +
                      (step >= PLANE_BEAT ? " on" : "") +
                      (step >= PLANE_BEAT && sec === placeSector ? " sel" : "")
                    }
                    points={sectorPoly(sec)
                      .map(([px, py]) => `${cxu(px)},${cyu(py)}`)
                      .join(" ")}
                    fill={TREE_SIDE_COLOR[sec.side]}
                    stroke={TREE_SIDE_COLOR[sec.side]}
                  />
                ))}
                {/* a surface gap along any cut the axes don't already draw, so
                    neighbouring regions never touch */}
                {planeCuts(sh).map((deg) => {
                  const [rx, ry] = rayExit(deg);
                  return (
                    <line
                      key={`cut-${deg}`}
                      className={"nv-cut" + (step >= PLANE_BEAT ? " on" : "")}
                      x1={cxu(0)}
                      y1={cyu(0)}
                      x2={cxu(rx)}
                      y2={cyu(ry)}
                    />
                  );
                })}
                {/* and each region's stretch of the outer edge, in its branch's
                    colour at full strength — the fills are too pale to tell
                    apart, so the rim is what actually names the region */}
                {planeNeedsRim(sh) &&
                  sh.plane.map((sec, i) => (
                    <polyline
                      key={`rim-${i}`}
                      className={"nv-rim" + (step >= PLANE_BEAT ? " on" : "")}
                      points={sectorRim(sec)
                        .map(([px, py]) => `${cxu(px)},${cyu(py)}`)
                        .join(" ")}
                      stroke={TREE_SIDE_COLOR[sec.side]}
                      strokeDasharray={sideDash(sec.side)}
                    />
                  ))}
                {/* gridlines + ticks: x from step 0, y joins at step 1 */}
                <g className={on(step >= DIAL2_BEAT)}>
                  {[-1, -0.5, 0.5, 1].map((t) => (
                    <line
                      key={`gx${t}`}
                      className="jz-ms-grid"
                      x1={cxu(t)}
                      x2={cxu(t)}
                      y1={cyu(1)}
                      y2={cyu(-1)}
                    />
                  ))}
                  {[-1, -0.5, 0.5, 1].map((t) => (
                    <line
                      key={`gy${t}`}
                      className="jz-ms-grid"
                      x1={cxu(-1)}
                      x2={cxu(1)}
                      y1={cyu(t)}
                      y2={cyu(t)}
                    />
                  ))}
                  {[-1, -0.5, 0.5, 1].map((t) => (
                    <text
                      key={`ty${t}`}
                      className="jz-ms-tick"
                      x={cxu(-1) - 12}
                      y={cyu(t) + 4}
                      textAnchor="end"
                    >
                      {`${med.wage + t * METRO_SPAN.wage > 0 ? "+" : ""}${(med.wage + t * METRO_SPAN.wage).toFixed(1)}%`}
                    </text>
                  ))}
                  <line
                    className="jz-ms-axisline"
                    x1={cxu(-1)}
                    x2={cxu(-1)}
                    y1={cyu(1)}
                    y2={cyu(-1)}
                  />
                  {/* 64 clears the tick labels (right-aligned 12 in from
                      the axis, ~39 wide at 15px) by the same ~8 the x-axis
                      title keeps below its ticks; at 50 the rotated title
                      ran through the "+5.6%" and "+3.4%" labels */}
                  {/* the mark turns with the title (Sept 2026, the user's
                      call — upright beside vertical text read as a stray
                      glyph), so the pair sits in ONE rotated frame and takes
                      the x axis's spacing: mark, gap, title, centred together
                      on the axis, the mark's box on the title's cap line */}
                  <g transform="rotate(-90)">
                    <MetricMark
                      what="pay"
                      className="jz-ms-axmark"
                      x={-CQ.cy - (AX_MARK + AX_GAP + axTitleW(WAGE_AXIS)) / 2}
                      y={cxu(-1) - 64 - 6 - AX_MARK / 2}
                      size={AX_MARK}
                    />
                    <text
                      className="jz-ms-title"
                      x={-CQ.cy + (AX_MARK + AX_GAP) / 2}
                      y={cxu(-1) - 64}
                      textAnchor="middle"
                    >
                      {WAGE_AXIS}
                    </text>
                  </g>
                </g>
                <g className={on(step >= DIAL1_BEAT)}>
                  {[-1, -0.5, 0.5, 1].map((t) => (
                    <text
                      key={`tx${t}`}
                      className="jz-ms-tick"
                      x={cxu(t)}
                      y={cyu(-1) + 22}
                      textAnchor="middle"
                    >
                      {`${med.pop + t * METRO_SPAN.pop > 0 ? "+" : ""}${(med.pop + t * METRO_SPAN.pop).toFixed(1)}%`}
                    </text>
                  ))}
                  <line
                    className="jz-ms-axisline"
                    x1={cxu(-1)}
                    x2={cxu(1)}
                    y1={cyu(-1)}
                    y2={cyu(-1)}
                  />
                  <MetricMark
                    what="people"
                    className="jz-ms-axmark"
                    x={cxu(0) - (AX_MARK + AX_GAP + axTitleW(POP_AXIS)) / 2}
                    y={cyu(-1) + AX_TITLE_DY - 6 - AX_MARK / 2}
                    size={AX_MARK}
                  />
                  <text
                    className="jz-ms-title"
                    x={cxu(0) - (AX_MARK + AX_GAP + axTitleW(POP_AXIS)) / 2 + AX_MARK + AX_GAP}
                    y={cyu(-1) + AX_TITLE_DY}
                    textAnchor="start"
                  >
                    {POP_AXIS}
                  </text>
                </g>
                {/* the backdrop field + nameplate, from the benchmark on */}
                <g className={on(step >= BENCH_BEAT)} opacity={0.55}>
                  {METROS.map((m, i) => {
                    const [ux, uy] = metroUnit(m);
                    return (
                      <circle
                        key={i}
                        className="jz-ms-dot"
                        cx={cxu(ux)}
                        cy={cyu(uy)}
                        r={dotR(m.size) * 0.85}
                      />
                    );
                  })}
                </g>
                <text
                  className={"nv-captitle " + on(step >= BENCH_BEAT)}
                  x={cxu(-1)}
                  y={cyu(1) - 26}
                >
                  {`${cityShort.toUpperCase()} AGAINST ${METROS.length} US METROS · ${DATA_WINDOW_LABEL}`}
                </text>
                {/* the wider metro: the city's MSA joins the plane — hollow,
                    so the city's own dot (the traveller) stays the
                    protagonist; its label takes whichever side has room */}
                <g className={on(step >= MSA_BEAT)}>
                  {msa ? (
                    (() => {
                      const [mux, muy] = metroUnit(msa);
                      const left = mux > 0.55;
                      const lx = cxu(mux) + (left ? -12 : 12);
                      return (
                        <g>
                          <circle
                            cx={cxu(mux)}
                            cy={cyu(muy)}
                            r={7}
                            fill="#fff"
                            stroke="var(--ink)"
                            strokeWidth={2}
                          />
                          <text
                            className="nv-lab"
                            x={lx}
                            y={cyu(muy) - 5}
                            textAnchor={left ? "end" : "start"}
                            fontSize={13.5}
                            fontWeight={700}
                            fill="var(--ink)"
                          >
                            {`${cityShort} MSA`}
                          </text>
                          {metroStatsRows(msa).map((row, i) => (
                            <text
                              key={row}
                              className="nv-ph"
                              x={lx}
                              y={cyu(muy) + 10 + i * 13}
                              textAnchor={left ? "end" : "start"}
                            >
                              {row}
                            </text>
                          ))}
                        </g>
                      );
                    })()
                  ) : (
                    <text
                      className="nv-ph"
                      x={cxu(0.55)}
                      y={cyu(-0.82)}
                      textAnchor="middle"
                    >
                      {`[no ${cityShort} metro data yet — its MSA would join here]`}
                    </text>
                  )}
                </g>
                {/* the benchmark: the median crosshair, named in place */}
                <g className={on(step >= BENCH_BEAT)}>
                  <line
                    className="jz-ms-median"
                    x1={cxu(0)}
                    x2={cxu(0)}
                    y1={cyu(1)}
                    y2={cyu(-1)}
                  />
                  <line
                    className="jz-ms-median"
                    x1={cxu(-1)}
                    x2={cxu(1)}
                    y1={cyu(0)}
                    y2={cyu(0)}
                  />
                  <text
                    className="jz-ms-typical"
                    x={cxu(0)}
                    y={cyu(1) - 8}
                    textAnchor="middle"
                  >
                    {`Typical population growth ${pc(med.pop)}`}
                  </text>
                  <text
                    className="jz-ms-typical"
                    x={cxu(1) - 8}
                    y={cyu(0) - 8}
                    textAnchor="end"
                  >
                    {`Typical wage growth ${pc(med.wage)}`}
                  </text>
                </g>
                {/* edge readings — the lesson the plane teaches. Each sits
                    where its sector meets the edge, which for a quadrant is
                    the corner these labels have always used. */}
                {sh.plane.map((sec, i) => {
                  /* a quadrant reads as its city type: the name, the two
                     dials as the sections' stat-chip icons, and the shock as
                     a caption (the geometry is planeLabelAt's — the hand-off
                     grows its cards out of these same spots) */
                  const { anchor, xa, ya, y0 } = planeLabelAt(sec);
                  const name = quadName(sec.side);
                  return (
                    <g
                      key={`lab-${i}`}
                      className={on(step >= PLANE_BEAT) + " nv-qlab"}
                    >
                      {name ? (
                        <>
                          {/* the landing's mark on the corner side of the
                              name, the text keeping the corner's edge */}
                          <QuadMark
                            side={sec.side}
                            x={anchor === "end" ? xa - 22 - 6 - nameWidth(name, 15) : xa}
                            y={y0 - 17}
                            size={22}
                            color={TREE_SIDE_COLOR[sec.side]}
                          />
                          <text
                            className="nv-tag"
                            x={anchor === "end" ? xa : xa + 22 + 6}
                            y={y0}
                            textAnchor={anchor}
                            fill={TREE_SIDE_COLOR[sec.side]}
                          >
                            {name}
                          </text>
                          <QuadMetrics
                            side={sec.side}
                            x={xa}
                            y={y0 + 17}
                            align={anchor}
                          />
                          <text
                            className="nv-lab-shock"
                            x={xa}
                            y={y0 + 42}
                            textAnchor={anchor}
                          >
                            {quadShock(sec.side)}
                          </text>
                        </>
                      ) : (
                        <>
                          <text
                            className="nv-lab"
                            x={xa}
                            y={ya}
                            textAnchor={anchor}
                          >
                            {sec.sub}
                          </text>
                          <text
                            className="nv-tag"
                            x={xa}
                            y={ya + 18}
                            textAnchor={anchor}
                            fill={TREE_SIDE_COLOR[sec.side]}
                          >
                            {sec.tag}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* ============ scene B: the tree the dot walks ============
                  One group, so the shortened walk can pose it: enlarged and
                  centred while it is the only thing on stage, easing home to
                  the left when the first instrument arrives. The inset stays
                  outside — it is the thing being made room for. */}
              <g
                className="nv-treewrap"
                style={
                  {
                    /* focus mode frames the tree itself, on the inner group
                     below — the two must not both pose it */
                    transform:
                      focusMode || sideLayout || rideOn
                        ? "none"
                        : step >= TREE_BEAT
                          ? wholeFit
                          : TREE_HOME_POSE,
                    transition: "transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)",
                    /* the hand-off's clock, for everything that waits on the
                     deal (.nv-pour-wait) */
                    ...(pourOn
                      ? {
                          "--pour-after": `${pourAfter(lastDeal)}s`,
                          "--pour-land-d": `${POUR.land}s`,
                        }
                      : null),
                  } as CSSProperties
                }
              >
                <g
                  className="nv-focus"
                  ref={focusRef}
                  style={{
                    /* not before the tree beat: until then the traveller inside
                     this group is positioned in full-stage CHART coordinates,
                     and framing the tree would drag it off the pizza chart.
                     In ride mode the transform is written imperatively by
                     the ride effect — React must not manage the key. */
                    transform: rideMode
                      ? undefined
                      : focusMode && step >= TREE_BEAT
                        ? fitTransform(frame, intoFor(frame), treeZoomCap)
                        : "none",
                  }}
                >
                  {/* the walked route's glow, from the landing on */}
                  <g className={on(gLand)}>
                    <path
                      className="tree-home"
                      stroke={TREE_SIDE_COLOR[citySide]}
                      d={elbow(
                        sh.rootX,
                        ROOT_BOT + 4,
                        ROOT_BUS,
                        headX(sh, citySide),
                        HEAD_TOP - 6,
                      )}
                    />
                    {/* head → leaf as ONE path: with no card between them the
                        stem and the elbow meet end to end, and two separate
                        strokes would double their round caps at the join */}
                    <path
                      className="tree-home"
                      stroke={TREE_SIDE_COLOR[citySide]}
                      d={
                        cityForks
                          ? `M${headX(sh, citySide)},${HEAD_BOT + 4} V${FORK2_Y} ` +
                            elbow(
                              headX(sh, citySide),
                              FORK2_Y,
                              LEAF_BUS,
                              leafBox(suggLeaf).x,
                              LEAF_TOP - 6,
                            )
                          : ""
                      }
                    />
                  </g>

                  {/* edges: root → heads */}
                  {sh.branches.map((b) => {
                    const st = status(b.id);
                    const neg = sideDash(b.id) != null;
                    return (
                      <g
                        key={`re-${b.id}`}
                        className={
                          on(gFork1) +
                          st.g +
                          /* on the hand-off beat the edges wait for the
                             tiles to land before drawing */
                          pourWait
                        }
                      >
                        <path
                          className={
                            "nv-edge" +
                            (neg ? " neg" : "") +
                            (gFork1 ? " on" : "") +
                            (st.lit ? " lit" : "")
                          }
                          stroke={TREE_SIDE_COLOR[b.id]}
                          pathLength={neg ? undefined : 1}
                          d={elbow(
                            sh.rootX,
                            ROOT_BOT + 2,
                            ROOT_BUS,
                            b.x,
                            HEAD_TOP - 4,
                          )}
                        />
                        {/* a quadrant head carries its two dials itself,
                            so its edge goes unlabelled */}
                        {!quadName(b.id) && (
                          <text
                            className="nv-elab"
                            x={b.x}
                            y={ROOT_BUS - 7}
                            textAnchor="middle"
                            fill={TREE_SIDE_COLOR[b.id]}
                          >
                            {b.edge}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* stems: head → the second fork's row */}
                  {sh.branches
                    .filter((b) => b.leaves.length > 0)
                    .map((b) => {
                      const st = status(b.id);
                      /* a negative shock is dashed the whole way down, not
                         just on its first edge — the sign belongs to the
                         branch, so every rank of it carries the same line */
                      const neg = sideDash(b.id) != null;
                      return (
                        <path
                          key={`st-${b.id}`}
                          className={
                            "nv-edge" +
                            (neg ? " neg" : "") +
                            (gFork2 ? " on" : "") +
                            (st.lit ? " lit" : "") +
                            st.g +
                            pourWait
                          }
                          stroke={TREE_SIDE_COLOR[b.id]}
                          pathLength={neg ? undefined : 1}
                          d={`M${b.x},${HEAD_BOT + 2} V${FORK2_Y}`}
                        />
                      );
                    })}

                  {/* edges: the second fork's row → leaves. Unlabelled (Sept 2026
                      revision): with the question cards gone, the answers that
                      used to ride these buses went too — the rail carries the
                      fork's logic */}
                  {sh.branches.flatMap((b) =>
                    b.leaves.map((l) => {
                      const st = status(l.id);
                      const box = leafBox(l.id);
                      const neg = sideDash(b.id) != null;
                      return (
                        <g
                          key={`le-${l.id}`}
                          className={on(gLeaf) + st.g + pourWait}
                        >
                          <path
                            className={
                              "nv-edge" +
                              (neg ? " neg" : "") +
                              (gLeaf ? " on" : "") +
                              (st.lit ? " lit" : "")
                            }
                            stroke={TREE_SIDE_COLOR[b.id]}
                            pathLength={neg ? undefined : 1}
                            d={elbow(
                              b.x,
                              FORK2_Y,
                              LEAF_BUS,
                              box.x,
                              LEAF_TOP - 4,
                            )}
                          />
                        </g>
                      );
                    }),
                  )}

                  {/* ============ the city itself: one dot walks the whole story ============
                  Positioned imperatively (the walk tween above); it sits UNDER
                  the cards, so mid-walk it slips through each question box. */}
                  <g
                    ref={travelerRef}
                    className={
                      "jz-placedot nv-traveler" +
                      (step === LEAF_BEAT ? " pulse" : "") +
                      (step === INTRO_BEAT ? " nv-hide" : "")
                    }
                  >
                    <circle className="halo" r={9} />
                    <circle className="core" r={step >= TREE_BEAT ? 7 : 8} />
                    {/* axis mode: the first dial's reading, above the dot */}
                    <g className={on(step === DIAL1_BEAT)}>
                      <text x={0} y={-30} textAnchor="middle">
                        {cityShort}
                      </text>
                      <text className="stats" x={0} y={-13} textAnchor="middle">
                        {placeStats[0]}
                      </text>
                    </g>
                    {/* plane mode: name + both dials, riding right of the dot */}
                    <g className={on(step >= DIAL2_BEAT && step < TREE_BEAT)}>
                      <text x={14} y={-12}>
                        {cityShort}
                      </text>
                      {placeStats.map((s, i) => (
                        <text key={i} className="stats" x={14} y={6 + i * 17}>
                          {s}
                        </text>
                      ))}
                    </g>
                    {/* tree mode: just the name, close by */}
                    <text
                      className={"nv-travname " + on(step >= TREE_BEAT)}
                      x={13}
                      y={4}
                    >
                      {cityShort}
                    </text>
                  </g>

                  {/* the root question card. On the hand-off it waits with the
                      edges: it stands where the chart's top edge was, which is
                      where the upper quadrants condense — and the question
                      arriving over a row that is already dealt is the order
                      the tree is read in (these four are what it chooses
                      between) */}
                  <g
                    className={
                      on(step >= TREE_BEAT) + status("root").g + pourWait
                    }
                  >
                    <text
                      className="nv-captitle"
                      x={sh.rootX}
                      y={ROOT_ROW.y - 28}
                      textAnchor="middle"
                    >
                      {`THE GROWTH QUESTION, ASKED OF ${cityShort.toUpperCase()}`}
                    </text>
                    <g className="nv-card nv-q">
                      <rect
                        x={sh.rootX - sh.rootW / 2}
                        y={ROOT_ROW.y - ROOT_ROW.h / 2}
                        width={sh.rootW}
                        height={ROOT_ROW.h}
                        rx={6}
                        stroke="#8a867e"
                      />
                      <text
                        className="nv-qq"
                        x={sh.rootX}
                        y={ROOT_ROW.y + 4.5}
                        textAnchor="middle"
                        fill="var(--ink)"
                      >
                        {sh.rootQuestion}
                      </text>
                    </g>
                  </g>

                  {/* branch heads */}
                  {sh.branches.map((b) => {
                    const st = status(b.id);
                    return (
                      <g
                        key={`hd-${b.id}`}
                        className={
                          on(gHeads) + st.g + (pourOn ? " nv-pour-head" : "")
                        }
                        /* each head comes up under its own tile, as it lands */
                        style={
                          pourOn
                            ? ({
                                "--pour-land": `${pourLandAt(b.id) ?? 0}s`,
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        <g className={"nv-card" + (st.lit ? " lit" : "")}>
                          <rect
                            x={b.x - sh.headW / 2}
                            y={HEAD_TOP}
                            width={sh.headW}
                            height={HEAD_H}
                            rx={6}
                            stroke={TREE_SIDE_COLOR[b.id]}
                            strokeDasharray={sideDash(b.id)}
                          />
                          {headLabel(b)}
                        </g>
                      </g>
                    );
                  })}

                  {/* leaves */}
                  {sh.branches.flatMap((b) =>
                    b.leaves.map((l) => {
                      const st = status(l.id);
                      const box = leafBox(l.id);
                      return (
                        <g
                          key={`lf-${l.id}`}
                          className={on(gLeaf) + st.g + pourWait}
                        >
                          <g
                            className={
                              "nv-card nv-leaf" + (st.lit ? " lit" : "")
                            }
                          >
                            <rect
                              x={box.x - box.w / 2}
                              y={LEAF_ROW.y - sh.leafH / 2}
                              width={box.w}
                              height={sh.leafH}
                              rx={6}
                              stroke={TREE_SIDE_COLOR[b.id]}
                            />
                            {/* the shape authors the line breaks: a narrow row
                            wraps the long titles rather than shrinking the
                            card past the type it has to hold */}
                            {box.lines.map((line, i) => (
                              <text
                                key={i}
                                x={box.x}
                                y={
                                  LEAF_ROW.y +
                                  5 -
                                  (box.lines.length - 1) * 8 +
                                  i * 16
                                }
                                textAnchor="middle"
                                fontSize={box.size}
                                fill={TREE_SIDE_COLOR[b.id]}
                              >
                                {line}
                              </text>
                            ))}
                          </g>
                        </g>
                      );
                    }),
                  )}

                  {/* the personal badge: the data-driven read. The tree never
                      marks a pick — that is the sandbox's job (see nextSide). */}
                  <g className={on(gLand)}>
                    {(() => {
                      const badge = (
                        leaf: string,
                        label: string,
                        color: string,
                        drop = 0,
                      ) => {
                        /* one badge row for every ending: a head that stops
                       early (the positive demand shock) gets its badge on the
                       same row as the leaves', under its empty column — up
                       beside the head it would sit on the neighbours' edge
                       labels */
                        const y = landingY(sh) + 38 + drop;
                        /* the pill renders "↑ " + label in 13px caps with 1.2px
                       tracking — size for the FULL string, plus real margins,
                       so the words never crowd the rounded ends */
                        const w = (label.length + 2) * 7.8 + 30;
                        /* centred on the leaf it points at; the stage-band
                       clamp only steps in where centring would push the pill
                       off the stage's edge */
                        const at = endingX(sh, leaf);
                        const cx = badgeCX(at, w);
                        return (
                          <g key={`${leaf}-${label}`} className="jz-youare">
                            <rect
                              x={cx - w / 2}
                              y={y - 13}
                              width={w}
                              height={26}
                              rx={13}
                              fill={color}
                            />
                            <text x={cx} y={y} textAnchor="middle" dy="0.34em">
                              ↑ {label}
                            </text>
                          </g>
                        );
                      };
                      const out = [
                        badge(
                          suggLeaf,
                          "where we think you are",
                          TREE_SIDE_COLOR[citySide],
                        ),
                      ];
                      return out;
                    })()}
                  </g>
                </g>
              </g>

              {/* ---------- the quadrant pour (transition study) ----------
                  mounted for the length of one crossing, in whichever
                  direction the reader crossed; the id remounts the group so
                  a direction flip mid-flight restarts rather than resumes */}
              {pourRun && (
                <g
                  key={pourRun.id}
                  className={
                    "nv-pour" +
                    (pourRun.dir < 0 ? " back" : "") +
                    (pourHome ? " home" : "")
                  }
                  onAnimationEnd={onTileHome}
                  style={
                    {
                      "--pour-condense": `${POUR.condense}s`,
                      "--pour-flight": `${pourRun.dir < 0 ? POUR.backFlight : POUR.flight}s`,
                      "--pour-land-d": `${POUR.land}s`,
                      "--pour-expand": `${POUR.expand}s`,
                      "--pour-expand-at": `${expandAt}s`,
                    } as CSSProperties
                  }
                >
                  {/* drawn last-dealt first, so a card in flight passes IN
                      FRONT of one still waiting in its corner: straight paths
                      leave one brush between them — the first card's corner
                      across the corner of the card waiting beside it, some
                      10×7px for a frame or two — and a moving card sliced by
                      a still one is the version of that the eye catches */}
                  {[...pourTiles].sort((a, b) => b.deal - a.deal).map((t) => {
                    const color = TREE_SIDE_COLOR[t.side];
                    return (
                      <g
                        key={t.key}
                        className={"nv-pour-tile" + (t.own ? " own" : "")}
                        style={
                          {
                            "--pour-launch": `${pourRun.dir < 0 ? t.back : t.launch}s`,
                            "--pour-dx": `${t.dx.toFixed(1)}px`,
                            "--pour-dy": `${t.dy.toFixed(1)}px`,
                            "--pour-origin": t.origin,
                            "--pour-shrink": t.shrink,
                            "--pour-grow": t.grow,
                            "--pour-lab-from": t.labFrom,
                            "--pour-lab-to": t.labTo,
                          } as CSSProperties
                        }
                      >
                        {/* the flight: one straight line from the corner to
                            the slot (the condense happens inside it, before
                            it leaves) */}
                        <g className="nv-pour-fly">
                          {/* two boxes that share every frame's outline —
                                both hold the outer corner still and move their
                                far edges in a straight line — and cross-fade:
                                the quadrant as the chart drew it, and the card
                                at its true size, so its corners and its dashes
                                arrive unscaled */}
                          <rect
                            className="nv-pour-quad"
                            x={t.sx}
                            y={t.sy}
                            width={t.sw}
                            height={t.sHt}
                            fill={color}
                            stroke={color}
                            strokeDasharray={sideDash(t.side)}
                            vectorEffect="non-scaling-stroke"
                          />
                          <rect
                            className="nv-pour-card"
                            x={t.cx0}
                            y={t.cy0}
                            width={t.cw}
                            height={t.ch}
                            rx={t.rx}
                            fill={tintOf(color, t.own ? 0.17 : 0.07)}
                            stroke={color}
                            strokeDasharray={sideDash(t.side)}
                            vectorEffect="non-scaling-stroke"
                          />
                          {t.branch && (
                            <g className="nv-pour-lab nv-card">
                              {headLabel(t.branch)}
                            </g>
                          )}
                        </g>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* the study modes that redraw the tree in full-stage
                  coordinates — poseless, but the sideways ride hangs its
                  own camera group around the drawing */}
              {sideLayout && (
                <g
                  ref={sideFocusRef}
                  className="nv-focus"
                  style={{
                    transform:
                      sideMode && step >= TREE_BEAT
                        ? fitTransform(
                            sideBox(sh, forks2),
                            intoFor(sideBox(sh, forks2)),
                            treeZoomCap,
                          )
                        : undefined,
                  }}
                >
                  <SidewaysTree
                    {...vp}
                    ridden={sideRideMode && step >= TREE_BEAT}
                    dotRef={sideDotRef}
                  />
                </g>
              )}

              {/* ============ the instrument inset (top-right) ============
                  Steps 4–5 keep the PARKED PIZZA CHART here — the root fork
                  is read off it, so it stays in reach while the dot carries
                  that reading down the first edge. Fork two's own instrument
                  is drawn from its beat on, but is SHOWN only on the landing
                  (the text column's `carriesPanel` decides which stops mount
                  this panel at all). */}
              <defs>
                <g
                  id="nv-inset-panel-def"
                  className={
                    on(carriesPanel(step)) +
                    (heroInst ? " nv-inset-hero" : "")
                  }
                >
                  <rect
                    className="nv-inset-panel"
                    x={inset.x}
                    y={inset.y}
                    width={inset.w}
                    height={inset.h}
                    rx={6}
                  />
                  <g className={on(step < FORK2_BEAT)}>
                    <text
                      className="nv-captitle"
                      x={inset.x + 14}
                      y={inset.y + 22}
                    >
                      THE PIZZA CHART · THE ROOT FORK
                    </text>
                    {sh.plane.map((sec, i) => (
                      <polygon
                        key={`rq-${i}`}
                        points={sectorPoly(sec)
                          .map(([px, py]) => `${pzx(px)},${pzy(py)}`)
                          .join(" ")}
                        fill={TREE_SIDE_COLOR[sec.side]}
                        fillOpacity={sec === placeSector ? 0.2 : 0.08}
                        stroke={TREE_SIDE_COLOR[quadTone(sec.side)]}
                        strokeWidth={quadInset ? 2.4 : 1.2}
                        strokeOpacity={quadInset ? 0.95 : 0.6}
                        strokeDasharray={
                          quadInset && sideDash(sec.side)
                            ? sideDash(sec.side)
                            : undefined
                        }
                      />
                    ))}
                    {planeCuts(sh).map((deg) => {
                      const [rx, ry] = rayExit(deg);
                      return (
                        <line
                          key={`rcut-${deg}`}
                          className="nv-cut on"
                          x1={pzx(0)}
                          y1={pzy(0)}
                          x2={pzx(rx)}
                          y2={pzy(ry)}
                        />
                      );
                    })}
                    {planeNeedsRim(sh) &&
                      sh.plane.map((sec, i) => (
                        <polyline
                          key={`rrim-${i}`}
                          className="nv-rim on"
                          points={sectorRim(sec)
                            .map(([px, py]) => `${pzx(px)},${pzy(py)}`)
                            .join(" ")}
                          stroke={TREE_SIDE_COLOR[sec.side]}
                          strokeDasharray={sideDash(sec.side)}
                        />
                      ))}
                    <rect
                      x={pz.x}
                      y={pz.y}
                      width={pz.s}
                      height={pz.s}
                      fill="none"
                      stroke="var(--border)"
                    />
                    {METROS.map((m, i) => {
                      const [mx, my] = metroUnit(m);
                      return (
                        <circle
                          key={`rz-${i}`}
                          cx={pzx(mx)}
                          cy={pzy(my)}
                          r={heroInst ? 2.4 : 1.6}
                          fill="#c8cdd0"
                          opacity={0.45}
                        />
                      );
                    })}
                    <line
                      x1={pzx(0)}
                      x2={pzx(0)}
                      y1={pz.y}
                      y2={pz.y + pz.s}
                      stroke="var(--ink)"
                      strokeWidth={1.2}
                      strokeDasharray="5 4"
                      opacity={0.7}
                    />
                    <line
                      x1={pz.x}
                      x2={pz.x + pz.s}
                      y1={pzy(0)}
                      y2={pzy(0)}
                      stroke="var(--ink)"
                      strokeWidth={1.2}
                      strokeDasharray="5 4"
                      opacity={0.7}
                    />
                    <circle
                      cx={pzx(ux)}
                      cy={pzy(uy)}
                      r={heroInst ? 7 : 5}
                      fill="var(--ink)"
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                    <text
                      className="nv-lab"
                      x={pzx(ux) + 9}
                      y={pzy(uy) - 7}
                      fontSize={13.5}
                      fontWeight={700}
                      fill="var(--ink)"
                    >
                      {cityShort}
                    </text>
                    <text
                      className="nv-axlab"
                      x={pz.x + pz.s / 2}
                      y={pz.y + pz.s + 17}
                      textAnchor="middle"
                    >
                      population growth →
                    </text>
                    <text
                      className="nv-axlab"
                      x={pz.x - 12}
                      y={pz.y + pz.s / 2}
                      textAnchor="middle"
                      transform={`rotate(-90 ${pz.x - 12} ${pz.y + pz.s / 2})`}
                    >
                      wage growth →
                    </text>
                    {/* one line per region. A pair reads as a pair, at either
                      end of the axis; three or more stack down the left. */}
                    {quadInset || compactRailInset
                      ? null
                      : planeBranches(sh).map((sec, i, all) => {
                          const right = all.length === 2 && i === 1;
                          return (
                            <text
                              key={`lg-${i}`}
                              className="nv-elab"
                              x={right ? inset.x + inset.w - 14 : inset.x + 14}
                              y={inset.y + 42 + i * 13}
                              textAnchor={right ? "end" : "start"}
                              fill={TREE_SIDE_COLOR[quadTone(sec.side)]}
                            >
                              {sec.legend}
                            </text>
                          );
                        })}
                  </g>
                  <g className={on(step >= FORK2_BEAT)}>
                    {demandFork ? (
                      /* THE SAME PLANE, A DIFFERENT MARK (the live tool's
                         demand fork): the metro is promoted on the plane
                         fork one was read off, and the only line that
                         matters now is the median POPULATION line — the
                         metro left of it is a labor market that is not
                         growing, so the shortfall is metro-wide; at or right
                         of it, the shortfall is the place's own. The metro's
                         pay is not part of this fork, so the wage median
                         stays drawn but recessive. */
                      <g>
                        <text
                          className="nv-captitle"
                          x={inset.x + 14}
                          y={inset.y + 22}
                        >
                          THE SAME PLANE · THE METRO'S READ
                        </text>
                        {/* the two answers, as the two halves of the plane:
                            the half the metro landed in tinted hardest */}
                        {(
                          [
                            ["metro", pz.x, pzx(0) - pz.x],
                            ["place", pzx(0), pz.x + pz.s - pzx(0)],
                          ] as ["metro" | "place", number, number][]
                        ).map(([half, hx, hw]) => {
                          const here = metroRead?.side === half;
                          return (
                            <rect
                              key={`dh-${half}`}
                              x={hx}
                              y={pz.y}
                              width={hw}
                              height={pz.s}
                              fill={TREE_SIDE_COLOR.demand}
                              fillOpacity={here ? 0.14 : 0.03}
                              stroke={TREE_SIDE_COLOR.demand}
                              strokeOpacity={here ? 0.85 : 0.2}
                              strokeWidth={here ? 2 : 1}
                            />
                          );
                        })}
                        {(
                          [
                            ["metro", "← MSA-wide", pz.x + 6, "start"],
                            [
                              "place",
                              "Admin-specific →",
                              pz.x + pz.s - 6,
                              "end",
                            ],
                          ] as [
                            "metro" | "place",
                            string,
                            number,
                            "start" | "end",
                          ][]
                        ).map(([half, label, lx, anchor]) => (
                          <text
                            key={`dht-${half}`}
                            className="nv-elab"
                            x={lx}
                            y={pz.y + pz.s - 7}
                            textAnchor={anchor}
                            fill={TREE_SIDE_COLOR.demand}
                            opacity={metroRead?.side === half ? 1 : 0.5}
                            fontWeight={metroRead?.side === half ? 700 : 600}
                          >
                            {label}
                          </text>
                        ))}
                        {METROS.map((m, i) => {
                          const [ux, uy] = metroUnit(m);
                          return (
                            <circle
                              key={`pz-${i}`}
                              cx={pzx(ux)}
                              cy={pzy(uy)}
                              r={heroInst ? 2 : 1.2}
                              fill="#c8cdd0"
                              opacity={0.5}
                            />
                          );
                        })}
                        {/* the wage median: still the plane's, not this
                            fork's */}
                        <line
                          x1={pz.x}
                          x2={pz.x + pz.s}
                          y1={pzy(0)}
                          y2={pzy(0)}
                          stroke="var(--ink)"
                          strokeWidth={1}
                          strokeDasharray="3 4"
                          opacity={0.3}
                        />
                        {/* the median population line IS the fork */}
                        <line
                          x1={pzx(0)}
                          x2={pzx(0)}
                          y1={pz.y - 4}
                          y2={pz.y + pz.s + 4}
                          stroke="var(--ink)"
                          strokeWidth={1.8}
                          strokeDasharray="6 4"
                        />
                        <text className="nv-ph" x={pzx(0) + 5} y={pz.y + 12}>
                          {`median ${pc(med.pop)}`}
                        </text>
                        {/* the place stays on the plane, receded: fork one
                            was about it, this one is about its metro */}
                        <circle
                          cx={pzx(ux)}
                          cy={pzy(uy)}
                          r={heroInst ? 5 : 3.6}
                          fill="#fff"
                          stroke="var(--ink)"
                          strokeWidth={1.4}
                          opacity={0.75}
                        />
                        {/* its label sits ABOVE the dot: the metro's label
                            runs to the right of a dot that is often its
                            neighbour, and the y-axis label owns the left */}
                        <text
                          className="nv-lab"
                          x={Math.max(
                            pz.x + cityShort.length * 3.2 + 4,
                            pzx(ux),
                          )}
                          y={pzy(uy) - 9}
                          textAnchor="middle"
                          fontSize={11.5}
                          fontWeight={500}
                          fill="var(--ink-soft)"
                        >
                          {cityShort}
                        </text>
                        {msa ? (
                          <g>
                            {/* the promoted mark: a ring under the dot, the
                                way the live tool's spotlight grows it */}
                            <circle
                              cx={pzx(metroUnit(msa)[0])}
                              cy={pzy(metroUnit(msa)[1])}
                              r={heroInst ? 13 : 10}
                              fill={TREE_SIDE_COLOR.demand}
                              fillOpacity={0.12}
                              stroke={TREE_SIDE_COLOR.demand}
                              strokeOpacity={0.5}
                            />
                            <circle
                              cx={pzx(metroUnit(msa)[0])}
                              cy={pzy(metroUnit(msa)[1])}
                              r={heroInst ? 7 : 5}
                              fill="var(--ink)"
                              stroke="#fff"
                              strokeWidth={1.5}
                            />
                            {/* only the population dial decides, so only it
                                rides the label — beside the figure it is
                                read against, as on the live tree's edge */}
                            {[`${cityShort} MSA`, `pop ${pc(msa.pop)}`].map(
                              (line, li) => (
                                <text
                                  key={`msal-${li}`}
                                  className="nv-lab"
                                  x={pzx(metroUnit(msa)[0]) + 13}
                                  y={pzy(metroUnit(msa)[1]) - 10 + li * 14}
                                  fontSize={li === 0 ? 13.5 : 12}
                                  fontWeight={li === 0 ? 700 : 500}
                                  fill="var(--ink)"
                                >
                                  {line}
                                </text>
                              ),
                            )}
                          </g>
                        ) : (
                          <text
                            className="nv-ph"
                            x={inset.x + inset.w / 2}
                            y={pz.y + pz.s / 2}
                            textAnchor="middle"
                          >
                            {`[no ${cityShort} metro data yet]`}
                          </text>
                        )}
                        <text
                          className="nv-axlab"
                          x={pz.x + pz.s / 2}
                          y={pz.y + pz.s + 17}
                          textAnchor="middle"
                        >
                          population growth →
                        </text>
                        <text
                          className="nv-axlab"
                          x={pz.x - 12}
                          y={pz.y + pz.s / 2}
                          textAnchor="middle"
                          transform={`rotate(-90 ${pz.x - 12} ${pz.y + pz.s / 2})`}
                        >
                          wage growth →
                        </text>
                        {/* the two numbers the fork turned on, and — once
                            landed — the metro's own quadrant, which says
                            why it is growing or not */}
                        {metroRead && (
                          <text className="nv-ph" x={pz.x} y={pz.y + pz.s + 34}>
                            {`${pc(metroRead.popCagr)} vs ${pc(metroRead.popMedian)}` +
                              (step >= LEAF_BEAT
                                ? ` · the metro's own read: ${quadName(metroRead.metroQuad)}`
                                : "")}
                          </text>
                        )}
                      </g>
                    ) : (
                      /* THE SAME PLANE, A DIFFERENT AXIS (the live tool's
                         supply fork): population growth stays on x and the
                         split lines stay put, but the Y axis moves from pay
                         to price growth. "Supply shock" is a statement about
                         population × pay and does not survive the swap, so
                         the re-axed plane is a TWO-way split: at or above
                         the median → Housing, below it → Amenities. */
                      <g>
                        <text
                          className="nv-captitle"
                          x={inset.x + 14}
                          y={inset.y + 22}
                        >
                          THE SAME PLANE · PRICE ON THE Y AXIS
                        </text>
                        {(["cost", "amenity"] as const).map((half) => {
                          const top = half === "cost";
                          const y0 = top ? hz.y : zy(medCost);
                          const h = top
                            ? zy(medCost) - hz.y
                            : hz.y + hz.h - zy(medCost);
                          const here = priceRead?.side === half;
                          const col = TREE_SIDE_COLOR.supply;
                          return (
                            <g key={`ps-${half}`}>
                              <rect
                                x={hz.x}
                                y={y0}
                                width={hz.w}
                                height={h}
                                fill={col}
                                fillOpacity={here ? 0.14 : 0.03}
                                stroke={col}
                                strokeOpacity={here ? 0.85 : 0.2}
                                strokeWidth={here ? 2 : 1}
                              />
                            </g>
                          );
                        })}
                        {METROS.map(
                          (m, i) =>
                            /* a metro Zillow has no series for is on the
                               pay plane and not on this one */
                            m.home != null && (
                              <circle
                                key={`hzm-${i}`}
                                cx={zxc(m.pop)}
                                cy={zyc(m.home)}
                                r={heroInst ? 2 : 1.4}
                                fill="#c8cdd0"
                                opacity={0.5}
                              />
                            ),
                        )}
                        {zTicks.map((t) => (
                          <g key={`hzt-${t}`}>
                            <line
                              className="jz-ms-grid"
                              x1={hz.x}
                              x2={hz.x + hz.w}
                              y1={zy(t)}
                              y2={zy(t)}
                            />
                            <text
                              className="jz-ms-tick"
                              x={hzTickX}
                              y={zy(t) + 4}
                              textAnchor="end"
                              fontSize={11}
                            >
                              {`+${t}%`}
                            </text>
                          </g>
                        ))}
                        <line
                          x1={hz.x}
                          x2={hz.x + hz.w}
                          y1={zy(medCost)}
                          y2={zy(medCost)}
                          stroke="var(--ink)"
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                        />
                        {/* the population median stays where fork one drew it
                            — the split lines stay put, only the Y axis
                            moved — but it is not this fork's line */}
                        <line
                          x1={zx(med.pop)}
                          x2={zx(med.pop)}
                          y1={hz.y}
                          y2={hz.y + hz.h}
                          stroke="var(--ink)"
                          strokeWidth={1}
                          strokeDasharray="3 4"
                          opacity={0.3}
                        />
                        <text
                          className="nv-ph"
                          x={hz.x + 2}
                          y={zy(medCost) - 8}
                        >
                          {`median ${pc(medCost)}`}
                        </text>
                        {/* the price cut IS the fork: at or above it routes
                            to Housing, below it to Amenities */}
                        <text
                          className="nv-elab"
                          x={hz.x + hz.w - 2}
                          y={zy(medCost) - 8}
                          textAnchor="end"
                          fill={TREE_SIDE_COLOR.supply}
                          opacity={priceRead?.side === "cost" ? 1 : 0.6}
                        >
                          above → Housing
                        </text>
                        <text
                          className="nv-elab"
                          x={hz.x + hz.w - 2}
                          y={zy(medCost) + 17}
                          textAnchor="end"
                          fill={TREE_SIDE_COLOR.supply}
                          opacity={priceRead?.side === "amenity" ? 1 : 0.6}
                        >
                          below → Amenities
                        </text>
                        {cost && place ? (
                          <g>
                            <circle
                              cx={zx(place.pop)}
                              cy={zy(cost.growth)}
                              r={heroInst ? 7 : 5}
                              fill="var(--ink)"
                              stroke="#fff"
                              strokeWidth={1.5}
                            />
                            {(() => {
                              /* always ABOVE the dot: below the price cut
                                 the dot sits in the bottom row, where a label
                                 under it would leave the plane. A dot close to
                                 the cut lifts its label clear of the cut's own
                                 labels, and one in the right of the plane
                                 centres it, clamped inside the panel. */
                              const dotX = zx(place.pop);
                              const dotY = zy(cost.growth);
                              const cutY = zy(medCost);
                              const nearCut = Math.abs(dotY - cutY) < 26;
                              const half = (cityShort.length + 9) * 3.9;
                              const centred =
                                nearCut || dotX > hz.x + hz.w * 0.5;
                              return (
                                <text
                                  className="nv-lab"
                                  x={
                                    centred
                                      ? Math.max(
                                          hz.x + half,
                                          Math.min(hz.x + hz.w - half, dotX),
                                        )
                                      : dotX + 9
                                  }
                                  y={
                                    nearCut
                                      ? Math.min(dotY, cutY) - 26
                                      : dotY - 9
                                  }
                                  textAnchor={centred ? "middle" : "start"}
                                  fontSize={13.5}
                                  fontWeight={700}
                                  fill="var(--ink)"
                                >
                                  {`${cityShort} ${pc(cost.growth)}`}
                                </text>
                              );
                            })()}
                          </g>
                        ) : (
                          <text
                            className="nv-ph"
                            x={inset.x + inset.w / 2}
                            y={zy(medCost) + 44}
                            textAnchor="middle"
                          >
                            {`[no ${cityShort} home-value series yet]`}
                          </text>
                        )}
                        <text
                          className="nv-axlab"
                          x={hz.x + hz.w / 2}
                          y={hz.y + hz.h + 17}
                          textAnchor="middle"
                        >
                          population growth →
                        </text>
                        <text
                          className="nv-axlab"
                          x={hzLabX}
                          y={hz.y + hz.h / 2}
                          textAnchor="middle"
                          transform={`rotate(-90 ${hzLabX} ${hz.y + hz.h / 2})`}
                        >
                          home-value growth →
                        </text>
                        {/* the two numbers the fork turned on, as the live
                            tree carries them on the fork's edge */}
                        <text className="nv-ph" x={hz.x} y={hz.y + hz.h + 34}>
                          {(priceRead
                            ? `${pc(priceRead.costCagr)} vs ${pc(priceRead.costMedian)} · `
                            : "") +
                            `${priceRead?.grain === "metro" ? "metro" : "city"} level, ${DATA_WINDOW_LABEL}`}
                        </text>
                      </g>
                    )}
                  </g>
                </g>
              </defs>
            </svg>
            {/* no minimap (Sept 2026): the zoomed walk used to keep a
                schematic of the whole tree in the corner while the stage
                showed one branch of it. The tree section now shows the
                stage alone. */}
          </div>
        </div>
      </div>

      {/* the top bar's two steps: same anchors as the compact flow, placed
          so a jump lands the way the tab does — the step's caption centred
          on the stage's line (the top one's rule is in figures.css). The
          bottom one centres the tree stop's block (the blocks above it are
          text, one stop each), so "How we diagnose" lands on the tree with
          the stage pinned. */}
      <section id="page-constraints" className="jz-anchor jz-anchor-top" />
      <section
        id="page-constraints-diagnose"
        className="jz-anchor"
        style={{
          top: `calc(var(--nv-padtop) + ${diagStop + 0.5} * var(--nv-stop) - var(--nv-line))`,
          height: `${stopVh}vh`,
        }}
      />
    </div>
  );
}
