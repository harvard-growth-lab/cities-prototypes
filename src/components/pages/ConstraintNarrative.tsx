import {
  Fragment,
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
  CONSTRAINT_FLOWS,
  DEFAULT_CONSTRAINT_FLOW,
  PLACEHOLDER_BRANCHES,
  TREE_SIDE_COLOR,
  TREE_SIDE_LABEL,
  convertPath,
  diagnose,
  quadLeaf,
  sideDash,
  sideOfPath,
  treeNodes,
  type BranchSide,
  type ConstraintFlow,
  type TreeVariant,
} from "../../data/figures";
import {
  BranchMinimap,
  LEGIBLE_PX,
  StageFit,
  type MiniFrameMap,
  useChartOverlap,
  useMediaQuery,
  useStageHeadroom,
  useStageScale,
} from "./walkFit";
import {
  SidewaysTree,
  sideBox,
  sideRests,
  sideRoute,
  type WalkViewProps,
} from "./walkVariants";
import {
  DOT_LEAF_Y,
  DOT_QCARD_Y,
  DOT_ROOT_Y,
  LEAF_BUS,
  LEAF_ROW,
  QCARD_ROW,
  ROOT_BUS,
  ROOT_ROW,
  WALK_SHAPES,
  hasLeaves,
  headRowH,
  headRowY,
  headX,
  landingX,
  landingY,
  leafSide,
  DOT_BELOW_HEAD,
  branchBox,
  fitPose,
  fitScale,
  fitTransform,
  DEFAULT_WALK_SHAPE,
  numberWord,
  planeBranches,
  planeCuts,
  planeNeedsRim,
  FIT_MODES,
  rayExit,
  sectorAnchor,
  sectorRim,
  sectorAt,
  sectorPoly,
  badgeCX,
  shapeLeaves,
  walkShape,
  wholeBox,
  type FitMode,
  type WalkShapeId,
} from "./walkShapes";
import {
  DATA_WINDOW_LABEL,
  METROS,
  METRO_MEDIANS,
  METRO_SPAN,
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

     0  dial one: people        the x axis draws; the dot sits on it
     1  dial two: pay           the plane completes; the dot lifts to its spot
     2  the metro               the city's MSA joins it, a hollow dot beside
     3  the benchmark           the median crosshair + the grey field around it
     4  reading the plane       the regions the shape cuts it into; yours marked
     5  the tree begins         the chart parks; the dot carries to the root
     6  fork one                the dot drops to its side, on its own numbers
     7  fork two + instrument   the side's question, read on its own chart
     8  the landing             the dot reaches its leaf — where we think you are
     9  four leaves, four cities  the other samples land; click to re-pick

   Every number on the walk is real (metros.ts / diagnose()); a city without
   data walks the fallback read behind bracketed placeholders. The tree is
   always the alt structure (two forks define the story); a leaf pick converts
   to whichever structure the app is on. */

const W = 1180;
const H = 640;

/* the chart square, centred on the stage (same geometry as the compact flow,
   so swapping flows keeps the chart where the eye left it) */
const CQ = { cx: W / 2, cy: 316, r: 278 };
const cxu = (v: number) => CQ.cx + v * CQ.r;
const cyu = (v: number) => CQ.cy - v * CQ.r;

/* ---------- the step schedule ----------
   Both guided flows are cut from the same ten BEATS, and every gate in the
   render below is keyed on the beat rather than on the scroll stop. What a
   flow chooses is which beats get a stop: a stop landing on a later beat
   reveals the skipped ones with it, and the traveller covers the extra
   stations in one move — a shorter walk loses scrolling, not animation. */
/* The chart half's beats: the two dials are 0 and 1; after them the metro
   joins the plane, then the benchmark, then the plane's reading. The tree
   half's beats follow, named as well since the schedules below are written
   in them. */
/** the city's MSA joins the plane beside the city's own dot */
const MSA_BEAT = 2;
/** the benchmark: the median crosshair and the grey field */
const BENCH_BEAT = 3;
/** reading the plane: the regions the shape cuts it into, yours marked */
const PLANE_BEAT = 4;
/** the tree opens: the chart parks into the inset, the root card arrives */
const TREE_BEAT = 5;
/** fork one is answered: the branch heads and the edges down to them */
const FORK1_BEAT = 6;
/** fork two is asked: the question cards, and the inset swaps instrument */
const FORK2_BEAT = 7;
/** the leaves arrive and the traveller lands on the diagnosed one */
const LEAF_BEAT = 8;
/** the four diagnoses — the only beat that hands the pick to the reader */
const CHOICE_BEAT = 9;

const FULL_BEATS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
/* "short" is a different telling, not just fewer stops: the chart never runs
   full-stage. Three stops, all of them tree beats — the whole tree up front
   with the city's dot at the root, the pizza chart arriving beside it to
   answer fork one, the second instrument swapping in to answer fork two and
   land the dot. The reveals that pace the guided walk's tree are simply
   forced on from the first stop, and the choice beat never comes: in this
   telling the route opens at the END of the analysis section, not on the
   tree. */
const SHORT_BEATS = [TREE_BEAT, FORK1_BEAT, LEAF_BEAT];
/* a camera ride steps the tree station by station, so the shortened flow's
   ride un-folds fork two into its own stop — four gestures: the root, fork
   one, fork two, the landing (a one-fork tree keeps the three) */
const RIDE_SHORT_BEATS = [TREE_BEAT, FORK1_BEAT, FORK2_BEAT, LEAF_BEAT];
const beatsFor = (flow: ConstraintFlow) =>
  flow === "short" ? SHORT_BEATS : FULL_BEATS;

/* ~40vh of scroll per stop (the compact flow's rate) + the sticky stage */
const STEP_VH = 40;
const trackVh = (stops: number) => stops * STEP_VH + 100;

/* the shortened walk's opening pose: the whole tree slightly enlarged and
   centred on the stage; the next stop eases it back home to the left,
   making room for the instrument inset. Derived from the tree's extents
   (x 19–749, y 56–509) against the 1180×640 stage — 1.3 is the largest
   scale that keeps the badge row on it. */
const TREE_OPENING_POSE = "translate(91px, -47px) scale(1.3)";
const TREE_HOME_POSE = "translate(0px, 0px) scale(1)";
/* the full walk's tree phase is not a fixed pose: the whole tree is FITTED
   to the room the stage gives it (see `wholeFit` below), so it fills a
   narrow stage's width and sits centred on a wide one instead of leaving
   the stage's right quarter empty. It only applies from TREE_BEAT: during
   the chart beats the traveller dot inside this wrap is positioned in
   full-stage chart coordinates, which must not be scaled. */
/* the shortened walk's instrument stops give the INSTRUMENT the stage: the
   tree eases down toward context size on the left while the hero panel
   takes the right. 0.94 is the largest scale that keeps the badge row clear
   of the (narrowed) hero panel's left edge. */
const TREE_ASIDE_POSE = "translate(0px, -8px) scale(1.16)";

const med = METRO_MEDIANS;
const pc = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%/yr`;

/* the grey backdrop field, sized like the compact flow's metro field */
const maxSize = Math.max(...METROS.map((m) => m.size));
const dotR = (s: number) => 1.3 + 10.7 * Math.sqrt(s / maxSize);

/* ---------- tree geometry (no cohort stacks — one dot walks it) ----------
   Which cards the tree carries, and where they sit, comes from the SHAPE
   (walkShapes.ts) — the row heights below are what every shape shares. The
   question cards are deliberately the SMALLEST boxes on the tree: the fork
   logic is connective tissue, and the answers (heads, leaves) are what the
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
const QCARD_TOP = QCARD_ROW.y - QCARD_ROW.h / 2;
const QCARD_BOT = QCARD_ROW.y + QCARD_ROW.h / 2;

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

/* ---------- the flow switch (also mounted by the compact flow) ---------- */

export function FlowSwitch({
  flow,
  onFlowChange,
}: {
  flow: ConstraintFlow;
  onFlowChange: (f: ConstraintFlow) => void;
}) {
  return (
    <div className="jz-modes show">
      <span className="jz-modes-k">User flow</span>
      <div className="jz-seg" role="group" aria-label="Section user flow">
        {CONSTRAINT_FLOWS.map((f) => (
          <button
            key={f.id}
            className={"jz-segbtn" + (flow === f.id ? " on" : "")}
            aria-pressed={flow === f.id}
            title={f.about}
            onClick={() => onFlowChange(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <span className="jz-modes-hint">
        {CONSTRAINT_FLOWS.find((f) => f.id === flow)?.hint}
      </span>
    </div>
  );
}

/* ---------- the variants disclosure ----------
   The team's revision (Sept 2026) settled the section on one telling: the
   guided walk over the four-quadrant tree. The switches that pick a DIFFERENT
   telling — which flow, which tree shape (and, on the compact flow, which
   structure) — are studies now, so each header folds them away behind this
   one control and only the responsiveness switch keeps the header row. The
   button face carries the current settings so the state is legible without
   opening it, and marks itself when a setting is off the default. */

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

/* ---------- the small-stage switch (guided walks only) ----------
   A third axis again, and a different question from either of the others:
   not what the tree IS or how it is told, but what to do when the stage is
   too small to draw it whole. See FIT_MODES for what each answer does.
   And the switch is live only while that question is: on a stage wide
   enough to draw the tree whole there is nothing for the answers to do,
   so the pills wait disabled and the hint says what would wake them. */

export function FitSwitch({
  fit,
  onFitChange,
  tight,
}: {
  fit: FitMode;
  onFitChange: (f: FitMode) => void;
  /** the stage is actually squeezing the tree (its smallest card title is
   *  rendering under the LEGIBLE_PX floor) */
  tight: boolean;
}) {
  return (
    <div className="jz-modes show">
      <span className="jz-modes-k">Responsiveness</span>
      <div className="jz-seg" role="group" aria-label="Responsive behaviour">
        {FIT_MODES.map((m) => (
          <button
            key={m.id}
            className={"jz-segbtn" + (fit === m.id ? " on" : "")}
            aria-pressed={fit === m.id}
            disabled={!tight}
            title={m.about}
            onClick={() => onFitChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="jz-modes-hint">
        {tight
          ? FIT_MODES.find((m) => m.id === fit)?.hint
          : `Wide enough for the whole tree — these wake when the stage squeezes its smallest title under ${LEGIBLE_PX}px`}
      </span>
    </div>
  );
}

/* ---------- the tree-shape switch (guided walks only) ----------
   A separate control from the flow switch above, because it is a separate
   question: the flow decides how the section is TOLD, the shape decides how
   many branches the tree it tells has. Only the walks mount it — the initial
   draft's tree is solved by d3 from the app-wide structure, and carries its
   own "Structure" control for that. */

export function ShapeSwitch({
  shape,
  onShapeChange,
}: {
  shape: WalkShapeId;
  onShapeChange: (s: WalkShapeId) => void;
}) {
  return (
    <div className="jz-modes show">
      <span className="jz-modes-k">Tree shape</span>
      <div className="jz-seg" role="group" aria-label="Tree shape">
        {WALK_SHAPES.map((sp) => (
          <button
            key={sp.id}
            className={"jz-segbtn" + (shape === sp.id ? " on" : "")}
            aria-pressed={shape === sp.id}
            title={sp.about}
            onClick={() => onShapeChange(sp.id)}
          >
            {sp.label}
          </button>
        ))}
      </div>
      <span className="jz-modes-hint">
        {WALK_SHAPES.find((sp) => sp.id === shape)?.hint}
      </span>
    </div>
  );
}

/* ---------- the chart→tree transition switch (guided walk studies) ----------
   A third axis beside flow and shape: not what the tree IS or how the walk
   is told, but how the pizza chart is SEEN to become the tree — the hand-off
   the quadrants make into the branches. Each option is a study; "fade" is
   the shipped behaviour. The studies play on the full guided walk's
   whole-tree fit (the rides and sideways modes redraw the tree their own
   way, and the short flow opens tree-first). */

export type TreeTransition = "fade" | "pour";

export const TREE_TRANSITIONS: {
  id: TreeTransition;
  label: string;
  hint: string;
  about: string;
}[] = [
  {
    id: "fade",
    label: "Park & fade",
    hint: "The chart parks into the inset; the tree draws in place",
    about:
      "The shipped hand-off: the full-stage chart fades out, the parked inset keeps the quadrants, and the tree fades in fork by fork",
  },
  {
    id: "pour",
    label: "Quadrant pour",
    hint: "Each region detaches and flies onto its branch card",
    about:
      "As the chart dissolves, each tinted region detaches, flies down the stage and lands exactly where its branch head fades in — the quadrants ARE the branches",
  },
];

export function TransitionSwitch({
  transition,
  onTransitionChange,
}: {
  transition: TreeTransition;
  onTransitionChange: (t: TreeTransition) => void;
}) {
  return (
    <div className="jz-modes show">
      <span className="jz-modes-k">Chart → tree</span>
      <div
        className="jz-seg"
        role="group"
        aria-label="Chart to tree transition"
      >
        {TREE_TRANSITIONS.map((t) => (
          <button
            key={t.id}
            className={"jz-segbtn" + (transition === t.id ? " on" : "")}
            aria-pressed={transition === t.id}
            title={t.about}
            onClick={() => onTransitionChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <span className="jz-modes-hint">
        {TREE_TRANSITIONS.find((t) => t.id === transition)?.hint}
      </span>
    </div>
  );
}

/* ------------------------------ the scrolly ------------------------------ */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function ConstraintNarrative({
  cityShort,
  country,
  selectedPath,
  onSelectPath,
  onPhaseInView,
  variant,
  flow,
  onFlowChange,
  shape,
  onShapeChange,
  routePinned,
}: {
  cityShort: string;
  country: string;
  /** the descent picked for the next section, on the APP's structure */
  selectedPath: string[];
  onSelectPath: (path: string[]) => void;
  onPhaseInView: (pageId: string) => void;
  /** the app-wide tree structure — leaf picks convert into it */
  variant: TreeVariant;
  flow: ConstraintFlow;
  onFlowChange: (f: ConstraintFlow) => void;
  /** how many branches the walk's tree has — its own axis, see walkShapes */
  shape: WalkShapeId;
  onShapeChange: (s: WalkShapeId) => void;
  /** hold the app's pick on the diagnosed route (the shortened walk, until
   *  the analysis section below has been read to its end) */
  routePinned: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onPhaseRef = useRef(onPhaseInView);
  onPhaseRef.current = onPhaseInView;
  /* the scroll STOP; `step` below is the BEAT it lands on, and everything
     that renders reads the beat (see the schedule at the top of the file) */
  const [stepIdx, setStepIdx] = useState(0);
  const [hoverLeaf, setHoverLeaf] = useState<string | null>(null);
  /* how far a camera ride has PULLED UP: the highest station the camera
     has arrived at under the current stop. The reveal gates read it so a
     rank's cards fade in as the dot reaches them, not the moment the
     scroll lands; outside the rides it is ignored. Written by the ride
     effect's loop. */
  const [rideArrived, setRideArrived] = useState(0);
  const arrivedRef = useRef(0);
  /* How the tree meets a stage smaller than the one it was drawn for — in
     two parts, because WHICH answer is the reader's call but WHETHER one is
     needed is the stage's. While the whole tree renders over the legibility
     floor the section stays on the plain fit and the small-stage switch
     sleeps; a resize that squeezes it under swaps the remembered answer in,
     and a resize back out swaps it away again. Local to the section —
     nothing downstream reads it. */
  /* the remembered small-stage answer — always one the switch OFFERS, so the
     switch can never show an empty selection (FIT_MODES is the menu; a mode
     the type knows but the menu does not must not be the default) */
  const [smallFit, setSmallFit] = useState<FitMode>(FIT_MODES[1].id);
  /* which hand-off study the chart→tree beat plays — see TREE_TRANSITIONS */
  const [transition, setTransition] = useState<TreeTransition>("fade");
  const svgRef = useRef<SVGSVGElement>(null);
  const stageScale = useStageScale(svgRef);
  const stageHeadroom = useStageHeadroom(svgRef);
  /* the narrow layout (≤920px) lays the instrument OVER the stage's bottom-
     left corner instead of beside it, so the stage can run down to the
     caption — and opens the viewBox to the height that buys (see `dy`) */
  const narrow = useMediaQuery("(max-width: 920px)");
  const railChartRef = useRef<HTMLDivElement>(null);
  const [chartStripPx, chartOverlapPx] = useChartOverlap(svgRef, railChartRef);
  /* a small-stage answer picked on a narrow window is for that window:
     widening back out returns the stage to the whole tree */
  const wasNarrow = useRef(narrow);
  useEffect(() => {
    if (wasNarrow.current && !narrow) setSmallFit("fit");
    wasNarrow.current = narrow;
  }, [narrow]);
  const short = flow === "short";
  /* the tree this walk tells: its branches, its cards and where they sit.
     Everything below reads the tree from here rather than from constants, so
     a shape switch is a data swap and nothing else. */
  const sh = walkShape(shape);
  const leaves = useMemo(() => shapeLeaves(sh), [sh]);
  /* how many endings the structure has: its leaves, or — where it forks once
     — its branch heads, which are the endings */
  const endings = leaves.length || sh.branches.length;
  /* the leaf row is the one rank whose height varies with the shape — the
     narrow shapes wrap their titles onto a second line */
  const LEAF_TOP = LEAF_ROW.y - sh.leafH / 2;
  /* the head row and the rows below it move with the shape: a structure that
     forks once has no question or leaf row, so its heads drop down the stage
     and carry the diagnosis themselves */
  const forks2 = hasLeaves(sh);
  /* the squeeze reading everything responsive keys on: the smallest CARD
     title (not the 11px edge labels — the titles are what a reader has to
     read to use the tree) at the scale the stage is actually drawing */
  const smallestCard = Math.min(sh.leafSize || 99, sh.headSize ?? 17.5);
  const tight = smallestCard * stageScale < LEGIBLE_PX;
  const fit: FitMode = tight
    ? FIT_MODES.some((m) => m.id === smallFit)
      ? smallFit
      : FIT_MODES[1].id
    : "fit";
  const focusMode = fit === "focus";
  const sideMode = fit === "side";
  const rideMode = fit === "ride";
  const sideRideMode = fit === "sideride";
  /* the two axes the last two modes combine: which tree is drawn, and
     whether the camera rides it */
  const sideLayout = sideMode || sideRideMode;
  const rideOn = rideMode || sideRideMode;
  /* the transition studies play only where the hand-off actually happens on
     the open stage: the full walk's whole-tree fit */
  const pourOn = transition === "pour" && !short && fit === "fit";
  /* the shortened flow opens on the whole tree — except under a camera
     ride, which REVEALS the tree as it travels: a ride's gates pace by the
     beat in every flow, and a stop that lands on a later beat still brings
     the skipped ranks in with it */
  const treeUpFront = short && !rideOn;
  /* the stops this telling gets — a ride on the shortened flow adds the
     fork-two stop the flow otherwise folds into the landing */
  const beats = useMemo(
    () => (short && rideOn && forks2 ? RIDE_SHORT_BEATS : beatsFor(flow)),
    [short, rideOn, forks2, flow],
  );
  const step = beats[Math.min(stepIdx, beats.length - 1)];
  const HEAD_Y = headRowY(sh);
  const HEAD_H = headRowH(sh);
  const HEAD_TOP = HEAD_Y - HEAD_H / 2;
  const HEAD_BOT = HEAD_Y + HEAD_H / 2;
  /* the stop where the rail's second step ("How we diagnose") takes over:
     the guided walk flips when its four chart stops end; the shortened walk
     opens on the whole tree, so everything past that pose is diagnosis */
  const diagStop = short ? 1 : TREE_BEAT;

  /* ---------- scroll → step (same mechanism as the compact flow) ---------- */
  useEffect(() => {
    const track = trackRef.current!;
    const scroller = track.closest(".pages") as HTMLElement | null;
    let ticking = false;
    const update = () => {
      ticking = false;
      const sTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const sH = scroller ? scroller.clientHeight : window.innerHeight;
      const r = track.getBoundingClientRect();
      const total = r.height - sH;
      const p = total > 0 ? clamp01((sTop - r.top) / total) : 0;
      const s = Math.min(beats.length - 1, Math.floor(p * beats.length));
      setStepIdx(s);
      const mid = sTop + sH / 2;
      if (r.top <= mid && r.bottom >= mid)
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
    update();
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [beats, diagStop]);

  useEffect(() => {
    if (step < CHOICE_BEAT) setHoverLeaf(null);
  }, [step]);
  /* a shape switch rebuilds the tree under the pointer — a hovered leaf from
     the other shape must not be re-asserted against the new one */
  useEffect(() => setHoverLeaf(null), [sh]);

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

  const planeRead = placeSector?.read ?? placeSector?.sub ?? "";
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
      return [side, quadLeaf(side, cityShort, country)];
    }
    return forks2
      ? convertPath(dx.path, sh.variant)
      : [placeSector?.side ?? "supply"];
  }, [forks2, dx, sh, placeSector, cityShort, country]);
  const citySide = sideOfPath(suggAlt);
  const suggLeaf = suggAlt[suggAlt.length - 1];
  /* the app's pick may live on the other structure — read it on this one.
     The alias that carries a pick across structures cannot recover a shock's
     SIGN, so on the forked quadrant tree an app path that merely mirrors the
     suggestion reads AS the suggestion — otherwise the sign the conversion
     guesses would manufacture a "you selected this path" no one chose. */
  const selAlt = useMemo(() => {
    if (
      sh.variant === "quad2" &&
      convertPath(suggAlt, variant).join("/") === selectedPath.join("/")
    )
      return suggAlt;
    return convertPath(selectedPath, sh.variant);
  }, [selectedPath, sh, suggAlt, variant]);
  const selLeaf = selAlt[selAlt.length - 1];
  const selSide = sideOfPath(selAlt);
  const isDefaultPath = selAlt.join("/") === suggAlt.join("/");
  /* which FAMILY of instrument the walked branch's second fork reads: the
     demand shocks (whatever their sign) read the MSA pizza chart, the supply
     shocks the housing scatter */
  const demandFork =
    citySide === "demand" ||
    citySide === "demandpos" ||
    citySide === "demandneg";
  /* the fork-two legend, per branch — the alt tree's own wording where the
     instrument is unchanged, bracketed placeholders where the spec's reading
     is not settled yet */
  const demandLegend: [string, string] =
    citySide === "demandneg"
      ? ["[MSA weak too → Regional (MSA)]", "[MSA healthy → Local (admin)]"]
      : citySide === "demandpos"
        ? [
            "[people outrun pay → housing risk]",
            "[pay outruns people → no risk]",
          ]
        : ["← below · Metro-wide", "above · Place-specific →"];
  /* what the landing says on the forked quadrant tree — the supply forks
     reuse the alt housing reason verbatim; the demand forks read differently
     and the positive-demand diagonal has no settled rule, so those stay
     bracketed */
  const quadLandCopy =
    citySide === "supplypos" || citySide === "supplyneg"
      ? dx.derived
        ? dx.steps[1].reason
        : `[no ${cityShort} data yet — the fallback leaf is marked]`
      : citySide === "demandneg"
        ? `[the MSA pizza chart read: ${suggLeaf === "dn-local" ? "the MSA holds up while the admin slips — a local (admin) shock" : "the MSA reads weak too — a regional (MSA) shock"}]`
        : `[the diagonal read: ${suggLeaf === "dp-housing" ? "the MSA sits on the people-outrun-pay side — housing is a potential constraint" : "the MSA sits on the pay-outruns-people side — housing looks clear"}]`;

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
  const intoFor = useCallback(
    (
      box: [number, number, number, number],
    ): [number, number, number, number] => {
      const k = stageScale || 1;
      const above: [number, number, number, number] = [
        24,
        18 - dy,
        W - 24,
        H - 18 + dy - (narrow ? chartOverlapPx / k : 0),
      ];
      const beside: [number, number, number, number] = [
        24 + (narrow ? (chartStripPx + 16) / k : 0),
        18 - dy,
        W - 24,
        H - 18 + dy,
      ];
      return fitScale(box, above, 99) >= fitScale(box, beside, 99)
        ? above
        : beside;
    },
    [narrow, dy, stageScale, chartOverlapPx, chartStripPx],
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
  /* ---------- the pour tiles (transition study) ----------
     Start: each plane sector's bounding box on the full-stage chart. End:
     the branch head card it becomes, run through the whole-tree pose the
     treewrap is easing into — both in stage coordinates, so one CSS
     transform flies a tile from its quadrant onto its card while the pose
     settles underneath (any mid-flight drift has landed by arrival). */
  const pourTiles = useMemo(() => {
    if (!pourOn) return [];
    const [pk, ptx, pty] = wholePose;
    const headTop = headRowY(sh) - headRowH(sh) / 2;
    return sh.plane.map((sec, i) => {
      const pts = sectorPoly(sec).map(
        ([px, py]) => [cxu(px), cyu(py)] as [number, number],
      );
      const sx = Math.min(...pts.map((p) => p[0]));
      const sy = Math.min(...pts.map((p) => p[1]));
      const sw = Math.max(...pts.map((p) => p[0])) - sx;
      const sHt = Math.max(...pts.map((p) => p[1])) - sy;
      const ex = ptx + pk * (headX(sh, sec.side) - sh.headW / 2);
      const ey = pty + pk * headTop;
      return {
        key: `${sec.side}-${i}`,
        side: sec.side,
        sx,
        sy,
        sw,
        sHt,
        to: `translate(${(ex - sx).toFixed(1)}px, ${(ey - sy).toFixed(1)}px) scale(${((pk * sh.headW) / sw).toFixed(3)}, ${((pk * headRowH(sh)) / sHt).toFixed(3)})`,
        delay: i * 0.09,
      };
    });
  }, [pourOn, sh, wholePose]);
  /* the static poses centre the tree in the authored 640; in the opened
     viewBox "centred" puts its foot over the instrument's corner, so they
     are lifted by dy, back to the top of the stage */
  const lift = dy ? `translate(0px, ${-dy.toFixed(1)}px) ` : "";
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

  /* The tree is never an interactive chooser in any flow. The shortened walk
     already disables selection and hover, and the guided/compact walks should
     keep the tree as a read-only route rather than letting the user pick a
     branch from the diagram itself. */
  const leafPickable = false;

  const onSelectRef = useRef(onSelectPath);
  onSelectRef.current = onSelectPath;
  useEffect(() => {
    if (!routePinned) return;
    /* compared on the APP's structure, not on the alt reading of it: the
       write lands in that space, so this settles after one pass whatever
       the cross-structure conversion does to a path */
    const target = convertPath(suggAlt, variant);
    if (selectedPath.join("/") !== target.join("/"))
      onSelectRef.current(target);
  }, [routePinned, selectedPath, suggAlt, variant]);

  const pickLeaf = (leaf: string) => {
    if (!leafPickable) return;
    const side = leafSide(sh, leaf);
    onSelectPath(convertPath([side, leaf], variant));
  };

  /* ---------- per-element emphasis ----------
     steps 5–7: the walk — the city's route full, everything else muted;
     step 8: the choice — hover/selection lights, the rest recedes */
  /* in the shortened walk the tree is fully drawn from the start, so reveal
     order can no longer imply progress — the lit set follows the dot instead,
     admitting the leaf only once fork two has resolved */
  const cityPath = useMemo(
    () =>
      new Set<string>(
        short && step < LEAF_BEAT
          ? ["root", citySide]
          : ["root", citySide, suggLeaf],
      ),
    [short, step, citySide, suggLeaf],
  );
  /* the selection lights and survives dimming only where the tree forked
     twice: a one-fork walk offers no pick, and its "selection" is the app's
     path through a lossy alias (demand → demandpos …) — lighting it would
     mark a branch no one chose (see the badge below, same reasoning) */
  const keep = useMemo(
    () => new Set<string>(["root", ...suggAlt, ...(forks2 ? selAlt : [])]),
    [suggAlt, selAlt, forks2],
  );
  const status = (id: string): { g: string; lit: boolean } => {
    if (step < FORK1_BEAT) return { g: "", lit: false };
    if (step < CHOICE_BEAT)
      return cityPath.has(id)
        ? { g: "", lit: true }
        : { g: " nv-mute", lit: false };
    const active = hoverLeaf
      ? new Set<string>(["root", leafSide(sh, hoverLeaf), hoverLeaf])
      : new Set<string>(["root", ...(forks2 ? selAlt : suggAlt)]);
    if (active.has(id)) return { g: "", lit: true };
    return { g: keep.has(id) ? "" : " nv-dim", lit: false };
  };

  const phase: "chart" | "tree" = stepIdx < diagStop ? "chart" : "tree";
  const on = (b: boolean) => "nv-fade" + (b ? " on" : "");
  /* show the tree schematic only when the stage is zoomed into part of the
     tree; if the whole tree is visible, the schematic is redundant */
  const wholeTreeVisible =
    step < TREE_BEAT ||
    fit === "fit" ||
    fit === "side" ||
    (focusMode && (step < LEAF_BEAT || (step >= CHOICE_BEAT && forks2))) ||
    (rideOn && step >= CHOICE_BEAT && forks2);
  const showTreeSchematic =
    step >= TREE_BEAT && (focusMode || rideOn) && !wholeTreeVisible;

  /* ---------- the reveal gates ----------
     The beat is the gate everywhere; a camera ride ALSO waits for the
     camera to pull up to a rank's station, so the fork logic fades in as
     the dot arrives at it rather than the moment the scroll lands on the
     stop (the ride effect below reports the arrivals). */
  const arrivedAt = (k: number) => !rideOn || rideArrived >= k;
  const gFork1 = treeUpFront || (step >= FORK1_BEAT && arrivedAt(1));
  /* the pour lands the head cards a beat early — the tiles become them; the
     edges still wait for fork one's answer */
  const gHeads = gFork1 || (pourOn && step >= TREE_BEAT);
  const gFork2 = treeUpFront || (step >= FORK2_BEAT && arrivedAt(2));
  const gLeaf = treeUpFront || (step >= LEAF_BEAT && arrivedAt(3));
  /* the landing furniture — badges, the walked route's glow — waits for
     the arrival too */
  const gLand = step >= LEAF_BEAT && arrivedAt(3);

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
    stationIdx: Math.min(Math.max(step - TREE_BEAT, 0), 3),
    forks2,
    cityShort,
    citySide,
    suggLeaf,
    selLeaf,
    selSide,
    isDefaultPath,
    leafPickable,
    pickLeaf,
    setHoverLeaf,
    status,
    medPop: pc(med.pop),
    medCost: pc(medCost),
  };

  /* ---------- the walking dot ----------
     Between tree stations the dot doesn't fly point-to-point — it WALKS the
     tree, tracing the elbow route through each card. CSS transitions can only
     cut straight lines between transforms, so the walk is driven imperatively:
     one polyline (the city's full route, root → head → question → leaf) with
     each station a point along it, and a rAF tween that moves the dot by arc
     length. Off-tree moves (the chart steps, chart → root) stay straight. */
  const walk = useMemo(() => {
    const pts: [number, number][] = [
      [sh.rootX, DOT_ROOT_Y],
      [sh.rootX, ROOT_BUS],
      [headX(sh, citySide), ROOT_BUS],
      [headX(sh, citySide), HEAD_BOT + DOT_BELOW_HEAD],
      ...(forks2
        ? ([
            [headX(sh, citySide), DOT_QCARD_Y],
            [headX(sh, citySide), LEAF_BUS],
            [leafBox(suggLeaf).x, LEAF_BUS],
            [leafBox(suggLeaf).x, DOT_LEAF_Y],
          ] as [number, number][])
        : []),
    ];
    const aw = arcWalk(pts);
    /* station arcs: root, below-the-head, facing-the-question, the leaf. A
       one-fork tree has only the first two, so its later beats hold the dot
       at the head it already reached rather than inventing stations. */
    return {
      at: aw.at,
      total: aw.total,
      stations: forks2
        ? [0, aw.cum[3], aw.cum[4], aw.cum[7]]
        : [0, aw.total, aw.total, aw.total],
    };
  }, [sh, forks2, citySide, suggLeaf, HEAD_BOT, leafBox]);

  /* the sideways ride steers by the sideways tree's own route */
  const sideArc = useMemo(
    () => arcWalk(sideRoute(sh, citySide, suggLeaf, forks2)),
    [sh, citySide, suggLeaf, forks2],
  );

  const travelerRef = useRef<SVGGElement>(null);
  const focusRef = useRef<SVGGElement>(null);
  const sideFocusRef = useRef<SVGGElement>(null);
  const sideDotRef = useRef<SVGGElement>(null);
  /* the minimap's frame while a ride is on: the ride draws what its camera
     sees, every animation frame, through these */
  const miniRectRef = useRef<SVGRectElement>(null);
  const miniMapRef = useRef<MiniFrameMap | null>(null);
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
    const arc =
      step < TREE_BEAT ? null : walk.stations[Math.min(step - TREE_BEAT, 3)];
    const target: [number, number] =
      arc != null
        ? walk.at(arc)
        : step === 0
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
  }, [step, walk, ux, uy, rideOn]);

  /* ---------- the camera rides (fit: "ride" / "sideride") ----------
     STEPPED, not scrubbed: the camera's target is the current stop's
     station on the route, and moving to the next stop plays the travel as
     an animation — the damped arc walks the polyline through every elbow
     on the way, so forks arrive and the branch not taken slides off the
     frame's edge. (The scroll itself is snapped to stops by the effect
     below, so the two stay in step.) The choice stop opens back out to the
     whole tree. Driven imperatively on an idle-stopping rAF loop; the
     group's own 0.9s transition is disabled for the duration. */
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
  });
  const focusIntoRef = useRef(focusInto);
  focusIntoRef.current = focusInto;
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
      ? forks2
        ? [0, sideArc.cum[4], sideArc.cum[5], sideArc.cum[8]]
        : [0, sideArc.total, sideArc.total, sideArc.total]
      : walk.stations;
    const rests: [number, number][] = sideRideMode
      ? sideRests(sh, citySide, suggLeaf, forks2)
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
        /* still on the chart beats: the tree group holds home */
        g.style.transform = "none";
        st.init = false;
        running = false;
        bumpArrived(0);
        return;
      }
      const sIdx = Math.min(Math.max(stp - TREE_BEAT, 0), 3);
      const wholeStop = stp >= CHOICE_BEAT && forks2;
      const arcT = stationArcs[sIdx];
      const [ix0, iy0, ix1, iy1] = focusIntoRef.current;
      const fcxT = (ix0 + ix1) / 2;
      const fcyT = (iy0 + iy1) / 2;
      const kFit = fitScale(wb, focusIntoRef.current, 2.4);
      /* a one-fork tree has two rests, not four: the stops past its head
         all park the dot beside the head (the sideways drawing clamps the
         same way), never at the question or leaf columns it does not have */
      const lastRest = forks2 ? 3 : 1;
      const restAt = (i: number) => rests[Math.min(i, lastRest)];
      if (!st.init) {
        st.init = true;
        st.a = arcT;
        const [sx, sy] = route.at(arcT);
        st.cx = sx;
        st.cy = sy;
        st.k = wholeStop ? kFit : STOP_ZOOM[sIdx];
        [st.dx, st.dy] = restAt(sIdx);
        st.fx = fcxT;
        st.fy = fcyT;
      }
      /* the arc chases the station along the path — this is the ride */
      st.a += (arcT - st.a) * (1 - Math.exp(-dt * 3.1));
      /* the pull-up report: within the leg's last stretch the rank's
         reveal fires, so its cards finish fading in as the dot arrives.
         Scrolling back drops the mark with the stop, so a re-approach
         reveals on arrival again. */
      bumpArrived(
        Math.abs(arcT - st.a) < 130 ? sIdx : Math.min(arrivedRef.current, sIdx),
      );
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
      /* The camera. Along the vertical tree it rides the route itself. The
         sideways route's elbows would swing it up to the centreline and back
         down on every leg — a visible lurch on the first fork, whose leg
         runs a whole row's height — so sideways it tracks the dot's own
         straight run instead, biased a little toward the cards above. */
      const cx = wholeStop ? wcx : sideRideMode ? (dxT + px) / 2 : px;
      const cy = wholeStop ? wcy : sideRideMode ? dyT - 24 : py;
      const k = wholeStop ? kFit : STOP_ZOOM[sIdx];
      const f = 1 - Math.exp(-dt * 9);
      st.cx += (cx - st.cx) * f;
      st.cy += (cy - st.cy) * f;
      st.k += (k - st.k) * (1 - Math.exp(-dt * 4.2));
      const ff = 1 - Math.exp(-dt * 5);
      st.fx += (fcxT - st.fx) * ff;
      st.fy += (fcyT - st.fy) * ff;
      g.style.transform = `translate(${(st.fx - st.k * st.cx).toFixed(2)}px, ${(
        st.fy -
        st.k * st.cy
      ).toFixed(2)}px) scale(${st.k.toFixed(4)})`;
      /* the minimap's frame: the stage's viewBox pulled back through the
         camera into tree coords, then onto the map */
      const miniRect = miniRectRef.current;
      const miniMap = miniMapRef.current;
      if (miniRect && miniMap) {
        const tx = st.fx - st.k * st.cx;
        const ty = st.fy - st.k * st.cy;
        const vdy = dyRef.current;
        const [mx0, my0, mw, mh] = miniMap([
          (0 - tx) / st.k,
          (-vdy - ty) / st.k,
          (W - tx) / st.k,
          (H + vdy - ty) / st.k,
        ]);
        miniRect.setAttribute("x", mx0.toFixed(1));
        miniRect.setAttribute("y", my0.toFixed(1));
        miniRect.setAttribute("width", mw.toFixed(1));
        miniRect.setAttribute("height", mh.toFixed(1));
      }
      const fd = 1 - Math.exp(-dt * 11);
      st.dx += (dxT - st.dx) * fd;
      st.dy += (dyT - st.dy) * fd;
      dotEl?.setAttribute(
        "transform",
        `translate(${st.dx.toFixed(1)},${st.dy.toFixed(1)})`,
      );
      if (
        Math.abs(arcT - st.a) < 0.4 &&
        Math.hypot(cx - st.cx, cy - st.cy) < 0.3 &&
        Math.hypot(dxT - st.dx, dyT - st.dy) < 0.3 &&
        Math.hypot(fcxT - st.fx, fcyT - st.fy) < 0.3 &&
        Math.abs(k - st.k) < 0.0015
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
    kick();
    return () => {
      cancelAnimationFrame(raf);
      target.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      g.style.transform = "";
      g.style.transition = "";
    };
  }, [rideOn, sideRideMode, walk, sideArc, beats, sh, forks2]);

  /* ---------- ride scroll snapping ----------
     The rides are stepped for the reader too: when a scroll gesture comes
     to rest anywhere inside the track, the page glides to the nearest
     stop's centre — every gesture ends ON a station, never between two.
     A new gesture cancels the glide and wins. */
  useEffect(() => {
    if (!rideOn) return;
    const track = trackRef.current!;
    const scroller = track.closest(".pages") as HTMLElement | null;
    if (!scroller) return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let animating = false;
    const cancelGlide = () => {
      cancelAnimationFrame(raf);
      animating = false;
    };
    const glideTo = (top: number) => {
      const from = scroller.scrollTop;
      const dist = top - from;
      if (Math.abs(dist) < 3) return;
      const dur = Math.min(750, 260 + Math.abs(dist) * 0.55);
      const t0 = performance.now();
      animating = true;
      const tick = (now: number) => {
        if (!animating) return;
        const q = Math.min(1, (now - t0) / dur);
        scroller.scrollTop = from + dist * easeCubicInOut(q);
        if (q < 1) raf = requestAnimationFrame(tick);
        else animating = false;
      };
      raf = requestAnimationFrame(tick);
    };
    const snap = () => {
      const sH = scroller.clientHeight;
      const trackTop =
        track.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      const total = track.offsetHeight - sH;
      if (total <= 0) return;
      const p = (scroller.scrollTop - trackTop) / total;
      /* only while the sticky stage is engaged — entering and leaving the
         section must never be hijacked */
      if (p <= 0.001 || p >= 0.999) return;
      const n = beats.length;
      const kIdx = Math.min(n - 1, Math.max(0, Math.round(p * n - 0.5)));
      glideTo(trackTop + ((kIdx + 0.5) / n) * total);
    };
    const onScroll = () => {
      if (animating) return;
      clearTimeout(idle);
      idle = setTimeout(snap, 150);
    };
    const interrupt = () => cancelGlide();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", interrupt, { passive: true });
    scroller.addEventListener("touchstart", interrupt, { passive: true });
    return () => {
      clearTimeout(idle);
      cancelGlide();
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", interrupt);
      scroller.removeEventListener("touchstart", interrupt);
    };
  }, [rideOn, beats]);

  /* ---------- instrument scales (the city's fork-two chart) ---------- */
  /* supply: home-value growth vs the typical metro */
  /* the shortened walk reads its instruments off the hero panel. The
     sideways tree's leaf column lives where the hero panel would sit, so
     those modes drop the instrument back to the standard inset. */
  const sideInst = sideLayout;
  const heroInst = short && !sideLayout;
  const compactRailInset = !sideInst && !heroInst && stageScale < 0.86;
  const standardInset = !sideInst && !heroInst && !compactRailInset;
  const inset = sideInst ? INSET_SIDE : heroInst ? INSET_HERO : INSET;
  const compactRailSquare = Math.min(inset.w - 84, inset.h - 138);
  const hz = sideInst
    ? { x: inset.x + 52, y: inset.y + 58, w: inset.w - 88, h: 230 }
    : heroInst
      ? { x: inset.x + 50, y: inset.y + 56, w: inset.w - 84, h: 330 }
      : compactRailInset
        ? { x: inset.x + 44, y: inset.y + 54, w: inset.w - 72, h: 252 }
        : { x: inset.x + 62, y: inset.y + 58, w: inset.w - 98, h: 230 };
  const zy = (z: number) => hz.y + hz.h - ((z - 2) / 11) * hz.h; // 2…13 %/yr
  const zx = (p: number) => hz.x + ((p + 1.5) / 2.5) * hz.w; // −1.5…+1.0 %/yr
  /* demand: the metro's population dial on the same pizza plane */
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

  /* ---------- rail copy ---------- */
  const stepCopy: { kicker: string; body: string }[] = [
    {
      kicker: "Dial one: people",
      body: place
        ? `Is ${cityShort} gaining people, or losing them? ${pc(place.pop)}.`
        : `Is ${cityShort} gaining people, or losing them? [sample spot]`,
    },
    {
      kicker: "Dial two: pay",
      body: place
        ? `Wages: ${pc(place.wage)}. Two dials place ${cityShort} on the plane.`
        : `Wages, the second dial. [sample spot]`,
    },
    {
      kicker: "The metro around it",
      body: msa
        ? `The wider metro — the ${cityShort} MSA — joins the plane: ${pc(msa.pop)} · ${pc(msa.wage)}.`
        : `The wider metro would join the plane here. [no ${cityShort} metro data yet]`,
    },
    {
      kicker: "The benchmark",
      body: `The crosshair: the typical US metro (${pc(med.pop)} · ${pc(med.wage)}). The grey field: everyone else.`,
    },
    {
      /* what the plane divides into, and which region the city landed in —
         both the shape's to say, since it is the shape that cuts the plane */
      kicker: sh.planeCopy.kicker,
      body:
        `${sh.planeCopy.lead} ` +
        (place
          ? `${cityShort}: ${planeRead}.`
          : `[no ${cityShort} data yet — the sample spot reads as ${planeRead}]`),
    },
    {
      kicker: "The tree begins",
      body: `The chart parks aside. Question one: same side of the medians?`,
    },
    {
      kicker: "Fork one: demand or supply",
      body: dx.derived
        ? dx.steps[0].reason
        : `[no ${cityShort} data yet — the walk shows the fallback read]`,
    },
    {
      kicker: forks2
        ? "Fork two: one more comparison"
        : "No second fork on the tree",
      body: !forks2
        ? `This tree stops at the quadrant — [each shock's second question, and its themes, are asked in the analysis section below].`
        : citySide === "demandneg"
          ? `Fork two: local or regional? The inset reads the MSA pizza chart — its population change against its wage change.`
          : citySide === "demandpos"
            ? `Fork two: is housing a potential constraint? [read from which side of the quadrant's diagonal the MSA falls on].`
            : demandFork
              ? `Fork two: is the metro growing? The inset reads it against ${pc(med.pop)}.`
              : `Fork two: what does being there cost? The inset reads home values against ${pc(medCost)}.`,
    },
    {
      kicker: "Where we think you are",
      body: !forks2
        ? `${cityShort} sits in the ${planeRead} quadrant, and on this tree that is the branch — ${TREE_SIDE_LABEL[citySide]}. [its second question is asked in the analysis below]`
        : sh.variant === "quad2"
          ? quadLandCopy
          : dx.derived
            ? dx.steps[1].reason
            : `[no ${cityShort} data yet — the fallback leaf is marked]`,
    },
    { kicker: `The ${numberWord(endings)} diagnoses`, body: "" },
  ];

  /* the shortened walk swaps the telling, not just the count — no full-stage
     chart phase — so each stop's copy carries the instrument AND the answer
     this city reads off it */
  if (short) {
    stepCopy[TREE_BEAT] = rideOn
      ? {
          /* a ride doesn't open on the whole tree — it reveals the forks
             as the camera reaches them */
          kicker: "The walk begins at the root",
          body: `${cityShort} starts at the root question; the ride reveals each fork as it arrives — and each is answered by an instrument, not a guess.`,
        }
      : {
          kicker: "The whole tree, up front",
          body: `The entire diagnostic: ${sh.forkOneLine}. ${cityShort} starts at the root — each fork is answered by an instrument, not a guess.`,
        };
    stepCopy[FORK1_BEAT] = {
      kicker: "Fork one: the pizza chart",
      body:
        `The tree makes room for the pizza chart. ${sh.planeCopy.lead} ` +
        (dx.derived
          ? dx.steps[0].reason
          : `[no ${cityShort} data yet — the walk shows the fallback read]`),
    };
    const forkTwoSwap = {
      kicker: !demandFork
        ? "Fork two: the housing chart"
        : citySide === "demandneg" || citySide === "demandpos"
          ? "Fork two: the MSA pizza chart"
          : "Fork two: the population dial",
      body:
        (!demandFork
          ? `The instrument swaps to the housing chart — home values against the typical metro's ${pc(medCost)}. `
          : citySide === "demandneg"
            ? `The instrument swaps to the MSA pizza chart — the metro's population change against its wage change. `
            : citySide === "demandpos"
              ? `The instrument swaps to the MSA pizza chart — [which side of the quadrant's diagonal does the MSA fall on?]. `
              : `The instrument swaps to the population dial — the metro against the median (${pc(med.pop)}). `) +
        (sh.variant === "quad2"
          ? quadLandCopy
          : dx.derived
            ? dx.steps[1].reason
            : `[no ${cityShort} data yet — the fallback leaf is marked]`),
    };
    if (rideOn && forks2) {
      /* the ride un-folds fork two into its own stop, so the swap copy
         moves there and the landing stop keeps the arrival */
      stepCopy[FORK2_BEAT] = forkTwoSwap;
      stepCopy[LEAF_BEAT] = {
        kicker: "Where we think you are",
        body:
          sh.variant === "quad2"
            ? quadLandCopy
            : dx.derived
              ? dx.steps[1].reason
              : `[no ${cityShort} data yet — the fallback leaf is marked]`,
      };
    } else {
      stepCopy[LEAF_BEAT] = !forks2
        ? {
            kicker: "One fork, and the tree is walked",
            body: `No second instrument up here: the pizza chart answered the only question this tree asks. ${cityShort} sits in the ${planeRead} quadrant — ${TREE_SIDE_LABEL[citySide]}. [the shock's second question follows in the analysis]`,
          }
        : forkTwoSwap;
    }
  }

  /* ---------- rail caption ---------- */
  /* one dot per SCROLL STOP — the shortened walk shows three, not nine */
  const railDots = (
    <span className="jz-dots">
      {beats.map((_, i) => (
        <i
          key={i}
          className={i === stepIdx ? "on" : i < stepIdx ? "done" : ""}
        />
      ))}
    </span>
  );
  const kickerColor =
    step >= LEAF_BEAT
      ? TREE_SIDE_COLOR[
          step >= CHOICE_BEAT && hoverLeaf
            ? leafSide(sh, hoverLeaf)
            : step >= CHOICE_BEAT && forks2
              ? selSide
              : citySide
        ]
      : step >= FORK1_BEAT
        ? TREE_SIDE_COLOR[citySide]
        : undefined;
  /* the closing panel: the trail, and what happens next. The guided walk
     reaches it on the choice beat; the shortened walk has no choice beat, so
     it closes on its last stop instead */
  const closing = stepIdx === beats.length - 1 && step >= LEAF_BEAT;
  /* the trail names whatever the tree is lighting. In the shortened walk the
     tree is a statement of the diagnosis rather than a control, and it stays
     lit on the diagnosed route even after the analysis below has been given
     the choice — so the crumb follows the diagnosis there, and the reader's
     own pick is the analysis section's story to tell. A one-fork tree is in
     the same position whatever the flow: it never offered a pick, so its
     crumb follows the landing too. */
  const trailPath = flow === "short" || !forks2 ? suggAlt : selAlt;
  const trailSide = sideOfPath(trailPath);
  const caption = !closing ? (
    <>
      <div className="jz-cap-kickrow">
        <span className="fig-kicker" style={{ color: kickerColor }}>
          {stepCopy[step].kicker}
        </span>
        {railDots}
      </div>
      <p className="jz-cap-body">
        <Body text={stepCopy[step].body} />
      </p>
    </>
  ) : (
    <>
      <div className="jz-cap-kickrow">
        <span className="fig-kicker" style={{ color: kickerColor }}>
          {stepCopy[step].kicker}
        </span>
        {railDots}
      </div>
      {flow === "short" && (
        <p className="jz-cap-body">
          <Body text={stepCopy[step].body} />
        </p>
      )}
      <div className="fig-trail">
        {["root", ...trailPath].map((id, i) => (
          <Fragment key={id}>
            {i > 0 && <span className="crumb-sep">›</span>}
            <span
              style={{
                color: TREE_SIDE_COLOR[id === "root" ? "root" : trailSide],
              }}
            >
              {id === "root" ? "The growth question" : altById.get(id)?.title}
            </span>
          </Fragment>
        ))}
      </div>
      <p className="jz-cap-body">
        {forks2 ? "Two questions" : "One question"}, {numberWord(endings)}{" "}
        diagnoses —{" "}
        {flow === "short" || !forks2 || isDefaultPath ? (
          `${cityShort}'s numbers argue for the lit path.`
        ) : (
          <Body
            text={`[your pick — the data-driven default remains ${altById.get(suggLeaf)?.title.toLowerCase()}]`}
          />
        )}
      </p>
      <p className="jz-cap-body">
        <Body
          text={
            flow === "short"
              ? "[the other three stay closed — the end of the analysis below is where the route opens]"
              : ""
          }
        />
      </p>
    </>
  );
  const insetShown = short ? step >= FORK1_BEAT : step >= TREE_BEAT;
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
      className="jz-scrolly nv-scrolly"
      ref={trackRef}
      style={{
        height: `${trackVh(beats.length) * (rideOn ? 1.7 : 1)}vh`,
      }}
    >
      <div className="jz-sticky">
        <div className="jz-head">
          <div className="jz-titles">
            <span className="eyebrow">City Constraints</span>
            <div className="jz-h2s">
              <h2 className={phase === "chart" ? "on" : ""}>
                Where is your constraint?
              </h2>
              <h2 className={phase === "tree" ? "on" : ""}>
                How we diagnose the constraint
              </h2>
            </div>
          </div>
          {/* the header row's right edge keeps ONE live control — the
              responsiveness switch, the only choice the revision left open.
              The flow and shape studies stay a click away in the variants
              disclosure beside it. */}
          <div className="jz-switches">
            <FitSwitch fit={fit} onFitChange={setSmallFit} tight={tight} />
            <VariantOptions
              face={`${CONSTRAINT_FLOWS.find((f) => f.id === flow)?.label} · ${
                WALK_SHAPES.find((s) => s.id === shape)?.label
              }`}
              changed={
                flow !== DEFAULT_CONSTRAINT_FLOW ||
                shape !== DEFAULT_WALK_SHAPE ||
                transition !== "fade"
              }
            >
              <FlowSwitch flow={flow} onFlowChange={onFlowChange} />
              <ShapeSwitch shape={shape} onShapeChange={onShapeChange} />
              <TransitionSwitch
                transition={transition}
                onTransitionChange={setTransition}
              />
            </VariantOptions>
          </div>
        </div>

        <div className="jz-body">
          <div className="jz-stagewrap">
            <svg
              ref={svgRef}
              className={
                "jz-svg nv-svg" +
                /* sideways draws its own tree, so the authored one (and, at
                   tree beats, its traveller) leaves the stage */
                (sideLayout ? " nv-hidetree" : "") +
                (sideLayout && (short || step >= TREE_BEAT)
                  ? " nv-hidedot"
                  : "")
              }
              viewBox={`0 ${-dy} ${W} ${H + 2 * dy}`}
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
              {/* ============ scene A: the chart, built dial by dial ============ */}
              <g
                className={
                  "nv-chart" + (short || step >= TREE_BEAT ? " off" : "")
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
                <g className={on(step >= 1)}>
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
                  <text
                    className="jz-ms-title"
                    transform="rotate(-90)"
                    x={-CQ.cy}
                    y={cxu(-1) - 50}
                    textAnchor="middle"
                  >
                    {`Average wage growth (annual rate, ${DATA_WINDOW_LABEL})`}
                  </text>
                </g>
                <g className={on(step >= 0)}>
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
                  <text
                    className="jz-ms-title"
                    x={cxu(0)}
                    y={cyu(-1) + 44}
                    textAnchor="middle"
                  >
                    {`Population growth (annual rate, ${DATA_WINDOW_LABEL})`}
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
                  const [ax, ay] = sectorAnchor(sec);
                  const anchor = ax > 0 ? "end" : ax < 0 ? "start" : "middle";
                  const xa = cxu(ax) + (ax > 0 ? -14 : ax < 0 ? 14 : 0);
                  /* a sector centred on the x axis has no corner to sit in —
                     its pair of lines straddles the axis at the edge instead */
                  const ya =
                    ay > 0 ? cyu(ay) + 26 : ay < 0 ? cyu(ay) - 36 : cyu(0) - 7;
                  return (
                    <g key={`lab-${i}`} className={on(step >= PLANE_BEAT)}>
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
                style={{
                  /* focus mode frames the tree itself, on the inner group
                     below — the two must not both pose it */
                  transform:
                    focusMode || sideLayout || rideOn
                      ? "none"
                      : short
                        ? stepIdx === 0
                          ? TREE_OPENING_POSE
                          : lift + TREE_ASIDE_POSE
                        : step >= TREE_BEAT
                          ? wholeFit
                          : TREE_HOME_POSE,
                  transition: "transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
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
                    <path
                      className="tree-home"
                      stroke={TREE_SIDE_COLOR[citySide]}
                      d={
                        forks2
                          ? `M${headX(sh, citySide)},${HEAD_BOT + 4} V${QCARD_TOP - 6}`
                          : ""
                      }
                    />
                    <path
                      className="tree-home"
                      stroke={TREE_SIDE_COLOR[citySide]}
                      d={
                        forks2
                          ? elbow(
                              headX(sh, citySide),
                              QCARD_BOT + 4,
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
                      <g key={`re-${b.id}`} className={on(gFork1) + st.g}>
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
                        <text
                          className="nv-elab"
                          x={b.x}
                          y={ROOT_BUS - 7}
                          textAnchor="middle"
                          fill={TREE_SIDE_COLOR[b.id]}
                        >
                          {b.edge}
                        </text>
                      </g>
                    );
                  })}

                  {/* stems: head → sub-question */}
                  {sh.branches
                    .filter((b) => b.leaves.length > 0)
                    .map((b) => {
                      const st = status(b.id);
                      return (
                        <path
                          key={`st-${b.id}`}
                          className={
                            "nv-edge" +
                            (gFork2 ? " on" : "") +
                            (st.lit ? " lit" : "") +
                            st.g
                          }
                          stroke={TREE_SIDE_COLOR[b.id]}
                          pathLength={1}
                          d={`M${b.x},${HEAD_BOT + 2} V${QCARD_TOP - 4}`}
                        />
                      );
                    })}

                  {/* edges: sub-question → leaves */}
                  {sh.branches.flatMap((b) =>
                    b.leaves.map((l) => {
                      const st = status(l.id);
                      const box = leafBox(l.id);
                      return (
                        <g key={`le-${l.id}`} className={on(gLeaf) + st.g}>
                          <path
                            className={
                              "nv-edge" +
                              (gLeaf ? " on" : "") +
                              (st.lit ? " lit" : "")
                            }
                            stroke={TREE_SIDE_COLOR[b.id]}
                            pathLength={1}
                            d={elbow(
                              b.x,
                              QCARD_BOT + 2,
                              LEAF_BUS,
                              box.x,
                              LEAF_TOP - 4,
                            )}
                          />
                          <text
                            className="nv-elab"
                            x={box.x}
                            y={LEAF_BUS - 7}
                            textAnchor="middle"
                            fill={TREE_SIDE_COLOR[b.id]}
                          >
                            {l.edge}
                          </text>
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
                      (step === LEAF_BEAT ? " pulse" : "")
                    }
                  >
                    <circle className="halo" r={9} />
                    <circle className="core" r={step >= TREE_BEAT ? 7 : 8} />
                    {/* axis mode: the first dial's reading, above the dot */}
                    <g className={on(step === 0)}>
                      <text x={0} y={-30} textAnchor="middle">
                        {cityShort}
                      </text>
                      <text className="stats" x={0} y={-13} textAnchor="middle">
                        {placeStats[0]}
                      </text>
                    </g>
                    {/* plane mode: name + both dials, riding right of the dot */}
                    <g className={on(step >= 1 && step < TREE_BEAT)}>
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

                  {/* the root question card */}
                  <g className={on(step >= TREE_BEAT) + status("root").g}>
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
                        rx={9}
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
                      >
                        <g className={"nv-card" + (st.lit ? " lit" : "")}>
                          <rect
                            x={b.x - sh.headW / 2}
                            y={HEAD_TOP}
                            width={sh.headW}
                            height={HEAD_H}
                            rx={8}
                            stroke={TREE_SIDE_COLOR[b.id]}
                            strokeDasharray={sideDash(b.id)}
                          />
                          {(b.titleLines ?? [b.title]).map((line, li, all) => (
                            <text
                              key={li}
                              x={b.x}
                              y={HEAD_Y + 5 - (all.length - 1) * 9 + li * 18}
                              textAnchor="middle"
                              fontSize={sh.headSize ?? 17.5}
                              fill={TREE_SIDE_COLOR[b.id]}
                            >
                              {line}
                            </text>
                          ))}
                        </g>
                      </g>
                    );
                  })}

                  {/* the two sub-question cards; only the walked side names its
                  instrument — the other's never opens */}
                  {sh.branches
                    .filter((b) => b.leaves.length > 0)
                    .map((b) => {
                      const st = status(b.id);
                      const lines = b.question({
                        medPop: pc(med.pop),
                        medCost: pc(medCost),
                      });
                      return (
                        <g key={`q-${b.id}`} className={on(gFork2) + st.g}>
                          <g
                            className={"nv-card nv-q" + (st.lit ? " lit" : "")}
                          >
                            <rect
                              x={b.x - sh.qcardW / 2}
                              y={QCARD_ROW.y - QCARD_ROW.h / 2}
                              width={sh.qcardW}
                              height={QCARD_ROW.h}
                              rx={9}
                              stroke={TREE_SIDE_COLOR[b.id]}
                            />
                            {lines.map((line, i) => (
                              <text
                                key={i}
                                className="nv-qq"
                                x={b.x}
                                y={QCARD_ROW.y - 4 + i * 12}
                                textAnchor="middle"
                                fill={TREE_SIDE_COLOR[b.id]}
                              >
                                {line}
                              </text>
                            ))}
                            {b.id === citySide && (
                              <text
                                className={
                                  "nv-qread " + on(!short || step >= LEAF_BEAT)
                                }
                                x={b.x}
                                y={QCARD_ROW.y + 17}
                                textAnchor="middle"
                                fill="var(--teal)"
                              >
                                read: the inset chart ↗
                              </text>
                            )}
                          </g>
                        </g>
                      );
                    })}

                  {/* leaves */}
                  {sh.branches.flatMap((b) =>
                    b.leaves.map((l) => {
                      const st = status(l.id);
                      const box = leafBox(l.id);
                      /* a placeholder branch has no analysis section behind it —
                     it draws, it does not pick */
                      const clickable =
                        leafPickable && !PLACEHOLDER_BRANCHES.has(b.id);
                      const picked = leafPickable && l.id === selLeaf;
                      return (
                        <g key={`lf-${l.id}`} className={on(gLeaf) + st.g}>
                          <g
                            className={
                              "nv-card nv-leaf" +
                              (st.lit ? " lit" : "") +
                              (clickable ? " clickable" : "") +
                              (picked ? " picked" : "")
                            }
                            onMouseEnter={() => clickable && setHoverLeaf(l.id)}
                            onMouseLeave={() => setHoverLeaf(null)}
                            onClick={() => clickable && pickLeaf(l.id)}
                          >
                            <rect
                              x={box.x - box.w / 2}
                              y={LEAF_ROW.y - sh.leafH / 2}
                              width={box.w}
                              height={sh.leafH}
                              rx={8}
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

                  {/* the personal badges: the data-driven read + a differing pick */}
                  <g className={on(gLand)}>
                    {(() => {
                      const badge = (
                        leaf: string,
                        label: string,
                        color: string,
                        drop = 0,
                      ) => {
                        const y = landingY(sh) + 38 + drop;
                        /* the pill renders "↑ " + label in 13px caps with 1.2px
                       tracking — size for the FULL string, plus real margins,
                       so the words never crowd the rounded ends */
                        const w = (label.length + 2) * 7.8 + 30;
                        /* centred on the leaf it points at; the stage-band
                       clamp only steps in where centring would push the pill
                       off the stage's edge */
                        const at = forks2
                          ? leafBox(leaf).x
                          : landingX(sh, [leaf]);
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
                      /* only where the tree actually forked twice: a one-fork
                       walk offers no pick, and its "selection" is only the
                       app's path converted through a lossy alias (demand →
                       demandpos …), so comparing it to the chart-derived
                       landing manufactures a difference no one chose */
                      if (step >= CHOICE_BEAT && forks2 && !isDefaultPath) {
                        const collide =
                          Math.abs(
                            (forks2
                              ? leafBox(selLeaf).x
                              : landingX(sh, [selLeaf])) -
                              (forks2
                                ? leafBox(suggLeaf).x
                                : landingX(sh, [suggLeaf])),
                          ) < 240;
                        out.push(
                          badge(
                            selLeaf,
                            "you selected this path",
                            TREE_SIDE_COLOR[selSide],
                            collide ? 34 : 0,
                          ),
                        );
                      }
                      return out;
                    })()}
                  </g>
                </g>
              </g>

              {/* ---------- the quadrant pour (transition study) ----------
                  mounted only across the hand-off beats, so scrolling back
                  in replays the flight */}
              {pourOn && step >= TREE_BEAT && step <= FORK1_BEAT && (
                <g className="nv-pour">
                  {pourTiles.map((t) => (
                    <g
                      key={t.key}
                      className="nv-pour-tile"
                      style={
                        {
                          "--pour-to": t.to,
                          animationDelay: `${t.delay}s`,
                        } as CSSProperties
                      }
                    >
                      <rect
                        x={t.sx}
                        y={t.sy}
                        width={t.sw}
                        height={t.sHt}
                        rx={10}
                        fill={TREE_SIDE_COLOR[t.side]}
                        stroke={TREE_SIDE_COLOR[t.side]}
                        strokeDasharray={sideDash(t.side)}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
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
                      sideMode && (short || step >= TREE_BEAT)
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
                    ridden={sideRideMode && (short || step >= TREE_BEAT)}
                    dotRef={sideDotRef}
                  />
                </g>
              )}

              {/* ============ the instrument inset (top-right) ============
                  Steps 4–5 keep the PARKED PIZZA CHART here — the root fork
                  is read off it, so it stays in reach while the dot carries
                  that reading down the first edge. Fork two then swaps in
                  its own instrument. */}
              <defs>
                <g
                  id="nv-inset-panel-def"
                  className={
                    on(short ? step >= FORK1_BEAT : step >= TREE_BEAT) +
                    (heroInst ? " nv-inset-hero" : "")
                  }
                >
                  <rect
                    className="nv-inset-panel"
                    x={inset.x}
                    y={inset.y}
                    width={inset.w}
                    height={inset.h}
                    rx={10}
                  />
                  <g className={on(step <= FORK1_BEAT)}>
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
                      /* the metro's dial, on the same pizza plane */
                      <g>
                        <text
                          className="nv-captitle"
                          x={inset.x + 14}
                          y={inset.y + 22}
                        >
                          THE MSA PIZZA CHART · THE DEMAND FORK
                        </text>
                        <rect
                          x={pz.x}
                          y={pz.y}
                          width={pz.s}
                          height={pz.s}
                          fill="none"
                          stroke="var(--border)"
                        />
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
                        <line
                          x1={pzx(0)}
                          x2={pzx(0)}
                          y1={pz.y - 4}
                          y2={pz.y + pz.s + 4}
                          stroke="var(--ink)"
                          strokeWidth={1.6}
                          strokeDasharray="6 4"
                        />
                        {(citySide === "demandpos" ||
                          citySide === "demandneg") && (
                          /* the quadrant forks read the FULL MSA plane, so
                             the wage median joins the population median */
                          <line
                            x1={pz.x - 4}
                            x2={pz.x + pz.s + 4}
                            y1={pzy(0)}
                            y2={pzy(0)}
                            stroke="var(--ink)"
                            strokeWidth={1.6}
                            strokeDasharray="6 4"
                          />
                        )}
                        {citySide === "demandpos" && (
                          /* the spec's diagonal: which side of it the MSA
                             falls on decides the housing-risk fork */
                          <line
                            x1={pzx(-1)}
                            y1={pzy(-1)}
                            x2={pzx(1)}
                            y2={pzy(1)}
                            stroke={TREE_SIDE_COLOR.demand}
                            strokeWidth={1.4}
                            strokeDasharray="3 3"
                            opacity={0.8}
                          />
                        )}
                        {msa ? (
                          <g>
                            <circle
                              cx={pzx(metroUnit(msa)[0])}
                              cy={pzy(metroUnit(msa)[1])}
                              r={heroInst ? 7 : 5}
                              fill="var(--ink)"
                              stroke="#fff"
                              strokeWidth={1.5}
                            />
                            <text
                              className="nv-lab"
                              x={pzx(metroUnit(msa)[0]) + 9}
                              y={pzy(metroUnit(msa)[1]) - 7}
                              fontSize={13.5}
                              fontWeight={700}
                              fill="var(--ink)"
                            >
                              {`${cityShort} MSA ${pc(msa.pop)}`}
                            </text>
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
                        <text
                          className="nv-elab"
                          x={inset.x + 14}
                          y={inset.y + 42}
                          fill={TREE_SIDE_COLOR.demand}
                        >
                          {demandLegend[0]}
                        </text>
                        <text
                          className="nv-elab"
                          x={inset.x + 14}
                          y={inset.y + 55}
                          textAnchor="start"
                          fill={TREE_SIDE_COLOR.demand}
                        >
                          {demandLegend[1]}
                        </text>
                      </g>
                    ) : (
                      /* the housing read: one value against one threshold */
                      <g>
                        <text
                          className="nv-captitle"
                          x={inset.x + 14}
                          y={inset.y + 22}
                        >
                          THE HOUSING SCATTER · THE SUPPLY FORK
                        </text>
                        {[4, 8, 12].map((t) => (
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
                              x={standardInset ? hz.x - 1 : hz.x - 8}
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
                        <text
                          className="nv-ph"
                          x={hz.x + 2}
                          y={zy(medCost) - 8}
                        >
                          {`typical metro ${pc(medCost)}`}
                        </text>
                        <text
                          className="nv-elab"
                          x={hz.x + hz.w - 2}
                          y={zy(medCost) - 8}
                          textAnchor="end"
                          fill={TREE_SIDE_COLOR.supply}
                        >
                          faster → Housing
                        </text>
                        <text
                          className="nv-elab"
                          x={hz.x + hz.w - 2}
                          y={zy(medCost) + 18}
                          textAnchor="end"
                          fill={TREE_SIDE_COLOR.supply}
                          opacity={0.75}
                        >
                          slower → Amenities
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
                            <text
                              className="nv-lab"
                              x={zx(place.pop) + 9}
                              y={
                                zy(cost.growth) +
                                (cost.growth > medCost ? -8 : 14)
                              }
                              fontSize={13.5}
                              fontWeight={700}
                              fill="var(--ink)"
                            >
                              {`${cityShort} ${pc(cost.growth)}`}
                            </text>
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
                        <text className="nv-ph" x={hz.x} y={hz.y + hz.h + 32}>
                          {`home values at the city level, ${DATA_WINDOW_LABEL}`}
                        </text>
                      </g>
                    )}
                  </g>
                </g>
              </defs>
            </svg>
            {/* what the frame is leaving out, and how hard the stage is
                squeezing the tree. The minimap is the answer to zooming: the
                reader keeps the map even when the stage only shows a branch
                of it. */}
            <BranchMinimap
              shape={sh}
              route={forks2 ? suggAlt : [citySide]}
              frame={focusMode && showTreeSchematic ? frame : null}
              show={showTreeSchematic}
              orientation={sideLayout ? "sideways" : "vertical"}
              live={rideOn}
              liveFrameRef={miniRectRef}
              mapRef={miniMapRef}
            />
            {!sideLayout && !rideMode && (
              <StageFit
                scale={stageScale}
                smallest={smallestCard}
                /* the escape is offered only while the reader HOLDS the
                   whole-tree fit against the squeeze — in any other mode a
                   small-stage answer is already on stage */
                onPick={
                  fit === "fit" ? () => setSmallFit(FIT_MODES[1].id) : undefined
                }
              />
            )}
          </div>

          <aside
            className={"jz-rail" + (insetShown ? " with-inset" : "")}
            /* the narrow layout sizes the chart box by height, to the
               PANEL's proportions (they differ between the hero and the
               standard one) — and indents the caption past it, so both
               children read these. The viewBox's breathing room under the
               panel is hung below the box, so the panel's bottom edge is
               the box's. */
            style={
              {
                "--inset-ratio": inset.w / inset.h,
                "--inset-slack": (inset.h + insetExtra) / inset.h,
              } as CSSProperties
            }
          >
            <div
              ref={railChartRef}
              className={"jz-railchart" + (insetShown ? " show" : "")}
              aria-hidden={!insetShown}
            >
              <svg
                viewBox={`${inset.x} ${inset.y} ${inset.w} ${inset.h + insetExtra}`}
              >
                <use href="#nv-inset-panel-def" />
              </svg>
            </div>
            <div className="jz-railtext">{caption}</div>
            <div
              className={"jz-next" + (step >= LEAF_BEAT ? " show" : "")}
              aria-hidden={step < LEAF_BEAT}
            >
              <span className="jz-next-k">Up next</span>
              <span
                className="jz-next-name"
                style={{ color: TREE_SIDE_COLOR[selSide] }}
              >
                {branchSectionName(selSide)} →
              </span>
              <span className="ph">
                {flow === "short"
                  ? "[the tree stays on the diagnosis — the route opens at the end of the analysis]"
                  : ""}
              </span>
            </div>
          </aside>
        </div>
      </div>

      {/* the rail's two steps: same anchors as the compact flow */}
      <section id="page-constraints" className="jz-anchor jz-anchor-top" />
      <section
        id="page-constraints-diagnose"
        className="jz-anchor"
        style={{
          top: `${STEP_VH * (diagStop + 0.25)}vh`,
          height: `${STEP_VH}vh`,
        }}
      />
    </div>
  );
}
