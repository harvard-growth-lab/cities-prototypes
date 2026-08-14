import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { easeCubicInOut } from "d3-ease";
import {
  CONSTRAINT_FLOWS,
  QUADRANTS,
  TREE_SIDE_COLOR,
  convertPath,
  diagnose,
  treeNodes,
  type ConstraintFlow,
  type TreeVariant,
} from "../../data/figures";
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
     2  the benchmark           the median crosshair + the grey field around it
     3  reading the quadrant    together → demand, apart → supply; yours marked
     4  the tree begins         the chart parks; the dot carries to the root
     5  fork one                the dot drops to its side, on its own numbers
     6  fork two + instrument   the side's question, read on its own chart
     7  the landing             the dot reaches its leaf — where we think you are
     8  four leaves, four cities  the other samples land; click to re-pick

   Every number on the walk is real (metros.ts / diagnose()); a city without
   data walks the fallback read behind bracketed placeholders. The tree is
   always the alt structure (two forks define the story); a leaf pick converts
   to whichever structure the app is on. */

const W = 1180;
const H = 640;

/* the chart square, centred on the stage (same geometry as the compact flow,
   so swapping flows keeps the chart where the eye left it) */
const CQ = { cx: W / 2, cy: 316, r: 268 };
const cxu = (v: number) => CQ.cx + v * CQ.r;
const cyu = (v: number) => CQ.cy - v * CQ.r;

const STEPS = 9;
/* ~40vh of scroll per step (the compact flow's rate) + the sticky stage */
const TRACK_VH = STEPS * 40 + 100;
/* the second rail step ("How we diagnose") lands just past the phase flip:
   this offset / (TRACK_VH − 100) must sit a little above 4 / STEPS */
const ANCHOR_BOTTOM_VH = 170;

type Side = "demand" | "supply";
type LeafId = "metrowide" | "placespec" | "col" | "amen";

const med = METRO_MEDIANS;
const pc = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%/yr`;

/* the grey backdrop field, sized like the compact flow's metro field */
const maxSize = Math.max(...METROS.map((m) => m.size));
const dotR = (s: number) => 1.3 + 10.7 * Math.sqrt(s / maxSize);

/* ---------- tree geometry (no cohort stacks — one dot walks it) ---------- */

const ROOT = { x: 405, y: 84, w: 348, h: 40 };
const HEAD = { w: 152, h: 32, y: 188 };
const HEAD_X: Record<Side, number> = { demand: 205, supply: 605 };
const QCARD = { w: 252, h: 52, y: 300 };
const LEAF = { h: 30, y: 420 };
const LEAF_DEFS: { id: LeafId; x: number; w: number; side: Side; title: string }[] = [
  { id: "metrowide", x: 105, w: 172, side: "demand", title: "Metro-wide shock" },
  { id: "placespec", x: 305, w: 188, side: "demand", title: "Place-specific shock" },
  { id: "col", x: 505, w: 152, side: "supply", title: "Cost of living" },
  { id: "amen", x: 685, w: 128, side: "supply", title: "Amenities" },
];
const LEAF_X = Object.fromEntries(LEAF_DEFS.map((l) => [l.id, l.x])) as Record<
  LeafId,
  number
>;
const INSET = { x: 792, y: 30, w: 368, h: 250 };

/** elbow path: straight drop, bus across, straight drop */
const elbow = (x0: number, y0: number, busY: number, x1: number, y1: number) =>
  `M${x0},${y0} V${busY} H${x1} V${y1}`;

const ROOT_BOT = ROOT.y + ROOT.h / 2;
const ROOT_BUS = 132;
const HEAD_TOP = HEAD.y - HEAD.h / 2;
const HEAD_BOT = HEAD.y + HEAD.h / 2;
const QCARD_TOP = QCARD.y - QCARD.h / 2;
const QCARD_BOT = QCARD.y + QCARD.h / 2;
const LEAF_BUS = 368;
const LEAF_TOP = LEAF.y - LEAF.h / 2;
/* where the walking dot rests at each station: under the root question,
   below its branch head, facing the sub-question, then at its leaf */
const DOT_AT_ROOT: [number, number] = [ROOT.x, 120];
const DOT_HEAD_Y = 222;
const DOT_QCARD_Y = 258;
const DOT_LEAF_Y = 458;

const EDGE_LABEL: Record<string, string> = {
  demand: "yes — together",
  supply: "no — apart",
  metrowide: "yes — below",
  placespec: "no — at or above",
  col: "yes — faster",
  amen: "no — slower",
};

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
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onPhaseRef = useRef(onPhaseInView);
  onPhaseRef.current = onPhaseInView;
  const [step, setStep] = useState(0);
  const [hoverLeaf, setHoverLeaf] = useState<LeafId | null>(null);

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
      const s = Math.min(STEPS - 1, Math.floor(p * STEPS));
      setStep(s);
      const mid = sTop + sH / 2;
      if (r.top <= mid && r.bottom >= mid)
        onPhaseRef.current(
          s <= 3 ? "page-constraints" : "page-constraints-diagnose",
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
  }, []);

  useEffect(() => {
    if (step < 8) setHoverLeaf(null);
  }, [step]);

  /* ---------- the city's own read (real numbers where they exist) ---------- */
  const place = useMemo(() => homePlace(cityShort), [cityShort]);
  const msa = useMemo(() => homeMsa(cityShort), [cityShort]);
  const cost = useMemo(() => placeCost(cityShort), [cityShort]);
  const medCost = countryMedians(country).cost;
  const placeSpot = place ? metroUnit(place) : ([-0.72, 0.82] as [number, number]);
  const placeStats = place
    ? metroStatsRows(place)
    : [`[no ${cityShort} data yet — sample spot]`];

  const dx = useMemo(() => diagnose(cityShort, country), [cityShort, country]);
  const suggAlt = dx.path;
  const citySide = (suggAlt[0] as Side) ?? "supply";
  const suggLeaf = suggAlt[suggAlt.length - 1] as LeafId;
  /* the app's pick may live on the other structure — read it on this one */
  const selAlt = useMemo(() => convertPath(selectedPath, "alt"), [selectedPath]);
  const selLeaf = selAlt[selAlt.length - 1] as LeafId;
  const selSide = (selAlt[0] as Side) ?? "supply";
  const isDefaultPath = selAlt.join("/") === suggAlt.join("/");
  const altById = useMemo(
    () => new Map(treeNodes("alt").map((n) => [n.id, n])),
    [],
  );

  const pickLeaf = (leaf: LeafId) => {
    if (step < 8) return;
    const side = LEAF_DEFS.find((l) => l.id === leaf)!.side;
    onSelectPath(convertPath([side, leaf], variant));
  };

  /* ---------- per-element emphasis ----------
     steps 5–7: the walk — the city's route full, everything else muted;
     step 8: the choice — hover/selection lights, the rest recedes */
  const cityPath = useMemo(
    () => new Set<string>(["root", citySide, suggLeaf]),
    [citySide, suggLeaf],
  );
  const keep = useMemo(
    () => new Set<string>(["root", ...suggAlt, ...selAlt]),
    [suggAlt, selAlt],
  );
  const status = (id: string): { g: string; lit: boolean } => {
    if (step < 5) return { g: "", lit: false };
    if (step < 8)
      return cityPath.has(id) ? { g: "", lit: true } : { g: " nv-mute", lit: false };
    const active = hoverLeaf
      ? new Set<string>([
          "root",
          LEAF_DEFS.find((l) => l.id === hoverLeaf)!.side,
          hoverLeaf,
        ])
      : new Set<string>(["root", ...selAlt]);
    if (active.has(id)) return { g: "", lit: true };
    return { g: keep.has(id) ? "" : " nv-dim", lit: false };
  };

  const phase: "chart" | "tree" = step <= 3 ? "chart" : "tree";
  const on = (b: boolean) => "nv-fade" + (b ? " on" : "");

  /* ---------- the walking dot ----------
     Between tree stations the dot doesn't fly point-to-point — it WALKS the
     tree, tracing the elbow route through each card. CSS transitions can only
     cut straight lines between transforms, so the walk is driven imperatively:
     one polyline (the city's full route, root → head → question → leaf) with
     each station a point along it, and a rAF tween that moves the dot by arc
     length. Off-tree moves (the chart steps, chart → root) stay straight. */
  const walk = useMemo(() => {
    const pts: [number, number][] = [
      DOT_AT_ROOT,
      [ROOT.x, ROOT_BUS],
      [HEAD_X[citySide], ROOT_BUS],
      [HEAD_X[citySide], DOT_HEAD_Y],
      [HEAD_X[citySide], DOT_QCARD_Y],
      [HEAD_X[citySide], LEAF_BUS],
      [LEAF_X[suggLeaf], LEAF_BUS],
      [LEAF_X[suggLeaf], DOT_LEAF_Y],
    ];
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
    /* station arcs: root, below-the-head, facing-the-question, the leaf */
    return { at, stations: [0, cum[3], cum[4], cum[7]] };
  }, [citySide, suggLeaf]);

  const travelerRef = useRef<SVGGElement>(null);
  const posRef = useRef<[number, number] | null>(null);
  const arcRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const [ux, uy] = placeSpot;

  /* a city switch mid-walk re-derives the route — snap rather than tween
     between two different cities' stories (declared before the mover, so the
     reset lands first) */
  useLayoutEffect(() => {
    posRef.current = null;
  }, [cityShort]);

  useLayoutEffect(() => {
    const g = travelerRef.current;
    if (!g) return;
    const arc =
      step <= 3
        ? null
        : walk.stations[Math.min(step - 4, 3)];
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
  }, [step, walk, ux, uy]);

  /* ---------- instrument scales (the city's fork-two chart) ---------- */
  /* supply: home-value growth vs the typical metro */
  const hz = { x: INSET.x + 46, y: INSET.y + 58, w: INSET.w - 78, h: 140 };
  const zy = (z: number) => hz.y + hz.h - ((z - 2) / 11) * hz.h; // 2…13 %/yr
  const zx = (p: number) => hz.x + ((p + 1.5) / 2.5) * hz.w; // −1.5…+1.0 %/yr
  /* demand: the metro's population dial on the same pizza plane */
  const pz = { x: INSET.x + 36, y: INSET.y + 38, s: 160 };
  const pzx = (u: number) => pz.x + ((u + 1) / 2) * pz.s;
  const pzy = (u: number) => pz.y + ((1 - u) / 2) * pz.s;

  /* ---------- rail copy ---------- */
  const together = place
    ? (place.pop < med.pop) === (place.wage < med.wage)
    : null;
  const stepCopy: { kicker: string; body: string }[] = [
    {
      kicker: "Dial one: people",
      body: place
        ? `Population growth — is ${cityShort} gaining people, or losing them? ${cityShort} proper: ${pc(place.pop)} over ${DATA_WINDOW_LABEL}. Dial one of two.`
        : `Population growth — is ${cityShort} gaining people, or losing them? [no ${cityShort} data yet — a sample spot stands in]`,
    },
    {
      kicker: "Dial two: pay",
      body: place
        ? `Wage growth — has the work been paying better, or worse? ${cityShort}: ${pc(place.wage)}. The two dials together place it on the plane.`
        : `Wage growth — the second dial. The two together place ${cityShort} on the plane. [sample spot]`,
    },
    {
      kicker: "The benchmark",
      body: `Alone, the spot means little. The typical US metro grew ${pc(med.pop)} · ${pc(med.wage)} — the crosshair — and the grey field is every other US metro. ${cityShort} reads against them.`,
    },
    {
      kicker: "Reading the quadrant",
      body:
        `Dials moving together point at demand — the pull of the work itself. Dials moving apart point at supply — the place. ` +
        (together === null
          ? `[no ${cityShort} data yet — the sample spot reads as apart]`
          : `${cityShort}'s moved ${together ? "together" : "apart"}.`),
    },
    {
      kicker: "The tree begins",
      body: `The chart parks to the side — a diagnosis is the order you ask questions in. ${cityShort} carries its two dials to question one: same side of the medians?`,
    },
    {
      kicker: "Fork one: demand or supply",
      body: dx.derived
        ? dx.steps[0].reason
        : `[no ${cityShort} data yet — the walk shows the fallback read]`,
    },
    {
      kicker: "Fork two: one more comparison",
      body:
        citySide === "demand"
          ? `The demand fork asks about the wider labor market: is the metro's population growth below the median (${pc(med.pop)})? ${cityShort}'s own dot can't answer that — the inset reads its metro.`
          : `The supply fork asks what being there costs: are home values climbing faster than the typical metro's ${pc(medCost)}? The jobs plane can't answer that — the inset swaps the instrument.`,
    },
    {
      kicker: "Where we think you are",
      body: dx.derived
        ? dx.steps[1].reason
        : `[no ${cityShort} data yet — the fallback leaf is marked]`,
    },
    { kicker: "The four diagnoses", body: "" },
  ];

  /* ---------- rail caption ---------- */
  const railDots = (
    <span className="jz-dots">
      {stepCopy.map((_, i) => (
        <i key={i} className={i === step ? "on" : i < step ? "done" : ""} />
      ))}
    </span>
  );
  const kickerColor =
    step >= 7
      ? TREE_SIDE_COLOR[
          step >= 8 && hoverLeaf
            ? LEAF_DEFS.find((l) => l.id === hoverLeaf)!.side
            : step >= 8
              ? selSide
              : citySide
        ]
      : step >= 5
        ? TREE_SIDE_COLOR[citySide]
        : undefined;
  const caption =
    step < 8 ? (
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
        <div className="fig-trail">
          {["root", ...selAlt].map((id, i) => (
            <Fragment key={id}>
              {i > 0 && <span className="crumb-sep">›</span>}
              <span
                style={{
                  color: TREE_SIDE_COLOR[id === "root" ? "root" : selSide],
                }}
              >
                {id === "root" ? "The growth question" : altById.get(id)?.title}
              </span>
            </Fragment>
          ))}
        </div>
        <p className="jz-cap-body">
          Two questions, four possible diagnoses.{" "}
          {isDefaultPath ? (
            `${cityShort}'s numbers argue for the lit path.`
          ) : (
            <Body
              text={`[your pick — the data-driven default remains ${altById.get(suggLeaf)?.title.toLowerCase()}]`}
            />
          )}
        </p>
        <p className="jz-cap-body">
          <Body text="[click an end leaf to follow a different path instead]" />
        </p>
      </>
    );

  /* ---------- render ---------- */
  return (
    <div
      className="jz-scrolly nv-scrolly"
      ref={trackRef}
      style={{ height: `${TRACK_VH}vh` }}
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
            <FlowSwitch flow={flow} onFlowChange={onFlowChange} />
          </div>
          {/* no style pills here: this flow's chart and tree are one fixed
              design; the experiments live on the compact flow */}
        </div>

        <div className="jz-body">
          <div className="jz-stagewrap">
            <svg
              className="jz-svg nv-svg"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`${cityShort} walks the diagnostic tree: two dials place it on the pizza chart, and each fork is answered with its own numbers until it lands on a diagnosis`}
            >
              {/* ============ scene A: the chart, built dial by dial ============ */}
              <g className={"nv-chart" + (step >= 4 ? " off" : "")}>
                {/* quadrant tints — the whole plane reads at once; yours marked */}
                {QUADRANTS.map((q) => (
                  <rect
                    key={q.id}
                    className={
                      "nv-quad" +
                      (step >= 3 ? " on" : "") +
                      (step >= 3 &&
                      q.dx === (placeSpot[0] >= 0 ? 1 : -1) &&
                      q.dy === (placeSpot[1] >= 0 ? 1 : -1)
                        ? " sel"
                        : "")
                    }
                    x={q.dx === 1 ? cxu(0) : cxu(-1)}
                    y={q.dy === 1 ? cyu(1) : cyu(0)}
                    width={CQ.r}
                    height={CQ.r}
                    fill={TREE_SIDE_COLOR[q.side]}
                    stroke={TREE_SIDE_COLOR[q.side]}
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
                    y={cyu(-1) + 48}
                    textAnchor="middle"
                  >
                    {`Population growth (annual rate, ${DATA_WINDOW_LABEL})`}
                  </text>
                </g>
                {/* the backdrop field + nameplate, from the benchmark on */}
                <g className={on(step >= 2)} opacity={0.55}>
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
                  className={"nv-captitle " + on(step >= 2)}
                  x={cxu(-1)}
                  y={cyu(1) - 26}
                >
                  {`${cityShort.toUpperCase()} AGAINST ${METROS.length} US METROS · ${DATA_WINDOW_LABEL}`}
                </text>
                {/* the benchmark: the median crosshair, named in place */}
                <g className={on(step >= 2)}>
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
                {/* quadrant corner readings — the together/apart lesson */}
                {QUADRANTS.map((q) => {
                  const right = q.dx === 1;
                  const xa = right ? cxu(1) - 14 : cxu(-1) + 14;
                  const ya = q.dy === 1 ? cyu(1) + 26 : cyu(-1) - 36;
                  return (
                    <g key={`lab-${q.id}`} className={on(step >= 3)}>
                      <text
                        className="nv-lab"
                        x={xa}
                        y={ya}
                        textAnchor={right ? "end" : "start"}
                      >
                        {q.sub}
                      </text>
                      <text
                        className="nv-tag"
                        x={xa}
                        y={ya + 18}
                        textAnchor={right ? "end" : "start"}
                        fill={TREE_SIDE_COLOR[q.side]}
                      >
                        {q.side === "demand"
                          ? "together → demand"
                          : "apart → supply"}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* ============ scene B: the tree the dot walks ============ */}

              {/* the walked route's glow, from the landing on */}
              <g className={on(step >= 7)}>
                <path
                  className="tree-home"
                  stroke={TREE_SIDE_COLOR[citySide]}
                  d={elbow(ROOT.x, ROOT_BOT + 4, ROOT_BUS, HEAD_X[citySide], HEAD_TOP - 6)}
                />
                <path
                  className="tree-home"
                  stroke={TREE_SIDE_COLOR[citySide]}
                  d={`M${HEAD_X[citySide]},${HEAD_BOT + 4} V${QCARD_TOP - 6}`}
                />
                <path
                  className="tree-home"
                  stroke={TREE_SIDE_COLOR[citySide]}
                  d={elbow(
                    HEAD_X[citySide],
                    QCARD_BOT + 4,
                    LEAF_BUS,
                    LEAF_X[suggLeaf],
                    LEAF_TOP - 6,
                  )}
                />
              </g>

              {/* edges: root → heads */}
              {(["demand", "supply"] as Side[]).map((side) => {
                const st = status(side);
                return (
                  <g key={`re-${side}`} className={on(step >= 5) + st.g}>
                    <path
                      className={
                        "nv-edge" + (step >= 5 ? " on" : "") + (st.lit ? " lit" : "")
                      }
                      stroke={TREE_SIDE_COLOR[side]}
                      pathLength={1}
                      d={elbow(ROOT.x, ROOT_BOT + 2, ROOT_BUS, HEAD_X[side], HEAD_TOP - 4)}
                    />
                    <text
                      className="nv-elab"
                      x={HEAD_X[side]}
                      y={ROOT_BUS - 7}
                      textAnchor="middle"
                      fill={TREE_SIDE_COLOR[side]}
                    >
                      {EDGE_LABEL[side]}
                    </text>
                  </g>
                );
              })}

              {/* stems: head → sub-question */}
              {(["demand", "supply"] as Side[]).map((side) => {
                const st = status(side);
                return (
                  <path
                    key={`st-${side}`}
                    className={
                      "nv-edge" +
                      (step >= 6 ? " on" : "") +
                      (st.lit ? " lit" : "") +
                      st.g
                    }
                    stroke={TREE_SIDE_COLOR[side]}
                    pathLength={1}
                    d={`M${HEAD_X[side]},${HEAD_BOT + 2} V${QCARD_TOP - 4}`}
                  />
                );
              })}

              {/* edges: sub-question → leaves */}
              {LEAF_DEFS.map((l) => {
                const st = status(l.id);
                return (
                  <g key={`le-${l.id}`} className={on(step >= 7) + st.g}>
                    <path
                      className={
                        "nv-edge" + (step >= 7 ? " on" : "") + (st.lit ? " lit" : "")
                      }
                      stroke={TREE_SIDE_COLOR[l.side]}
                      pathLength={1}
                      d={elbow(HEAD_X[l.side], QCARD_BOT + 2, LEAF_BUS, l.x, LEAF_TOP - 4)}
                    />
                    <text
                      className="nv-elab"
                      x={l.x}
                      y={LEAF_BUS - 7}
                      textAnchor="middle"
                      fill={TREE_SIDE_COLOR[l.side]}
                    >
                      {EDGE_LABEL[l.id]}
                    </text>
                  </g>
                );
              })}

              {/* ============ the city itself: one dot walks the whole story ============
                  Positioned imperatively (the walk tween above); it sits UNDER
                  the cards, so mid-walk it slips through each question box. */}
              <g
                ref={travelerRef}
                className={"jz-placedot nv-traveler" + (step === 7 ? " pulse" : "")}
              >
                <circle className="halo" r={9} />
                <circle className="core" r={step >= 4 ? 7 : 8} />
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
                <g className={on(step >= 1 && step <= 3)}>
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
                <text className={"nv-travname " + on(step >= 4)} x={13} y={4}>
                  {cityShort}
                </text>
              </g>

              {/* the root question card */}
              <g className={on(step >= 4) + status("root").g}>
                <text
                  className="nv-captitle"
                  x={ROOT.x}
                  y={ROOT.y - 28}
                  textAnchor="middle"
                >
                  {`THE GROWTH QUESTION, ASKED OF ${cityShort.toUpperCase()}`}
                </text>
                <g className="nv-card nv-q">
                  <rect
                    x={ROOT.x - ROOT.w / 2}
                    y={ROOT.y - ROOT.h / 2}
                    width={ROOT.w}
                    height={ROOT.h}
                    rx={9}
                    stroke="#8a867e"
                  />
                  <text
                    className="nv-qq"
                    x={ROOT.x}
                    y={ROOT.y + 4.5}
                    textAnchor="middle"
                    fill="var(--ink)"
                  >
                    population × wages — same side of the medians?
                  </text>
                </g>
              </g>

              {/* branch heads */}
              {(["demand", "supply"] as Side[]).map((side) => {
                const st = status(side);
                return (
                  <g key={`hd-${side}`} className={on(step >= 5) + st.g}>
                    <g className={"nv-card" + (st.lit ? " lit" : "")}>
                      <rect
                        x={HEAD_X[side] - HEAD.w / 2}
                        y={HEAD.y - HEAD.h / 2}
                        width={HEAD.w}
                        height={HEAD.h}
                        rx={8}
                        stroke={TREE_SIDE_COLOR[side]}
                      />
                      <text
                        x={HEAD_X[side]}
                        y={HEAD.y + 5}
                        textAnchor="middle"
                        fontSize={16}
                        fill={TREE_SIDE_COLOR[side]}
                      >
                        {side === "demand" ? "Labor Demand" : "Labor Supply"}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* the two sub-question cards; only the walked side names its
                  instrument — the other's never opens */}
              {(["demand", "supply"] as Side[]).map((side) => {
                const st = status(side);
                return (
                  <g key={`q-${side}`} className={on(step >= 6) + st.g}>
                    <g className={"nv-card nv-q" + (st.lit ? " lit" : "")}>
                      <rect
                        x={HEAD_X[side] - QCARD.w / 2}
                        y={QCARD.y - QCARD.h / 2}
                        width={QCARD.w}
                        height={QCARD.h}
                        rx={9}
                        stroke={TREE_SIDE_COLOR[side]}
                      />
                      <text
                        className="nv-qq"
                        x={HEAD_X[side]}
                        y={QCARD.y - 6}
                        textAnchor="middle"
                        fill={TREE_SIDE_COLOR[side]}
                      >
                        {side === "demand"
                          ? "metro population growth"
                          : "home values climbing faster"}
                      </text>
                      <text
                        className="nv-qq"
                        x={HEAD_X[side]}
                        y={QCARD.y + 9}
                        textAnchor="middle"
                        fill={TREE_SIDE_COLOR[side]}
                      >
                        {side === "demand"
                          ? `below the median (${pc(med.pop)})?`
                          : `than the typical metro (${pc(medCost)})?`}
                      </text>
                      {side === citySide && (
                        <text
                          className="nv-qread"
                          x={HEAD_X[side]}
                          y={QCARD.y + 22}
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
              {LEAF_DEFS.map((l) => {
                const st = status(l.id);
                const clickable = step >= 8;
                const picked = clickable && l.id === selLeaf;
                return (
                  <g key={`lf-${l.id}`} className={on(step >= 7) + st.g}>
                    <g
                      className={
                        "nv-card nv-leaf" +
                        (st.lit ? " lit" : "") +
                        (clickable ? " clickable" : "") +
                        (picked ? " picked" : "")
                      }
                      onMouseEnter={() => clickable && setHoverLeaf(l.id)}
                      onMouseLeave={() => setHoverLeaf(null)}
                      onClick={() => pickLeaf(l.id)}
                    >
                      <rect
                        x={l.x - l.w / 2}
                        y={LEAF.y - LEAF.h / 2}
                        width={l.w}
                        height={LEAF.h}
                        rx={8}
                        stroke={TREE_SIDE_COLOR[l.side]}
                      />
                      <text
                        x={l.x}
                        y={LEAF.y + 5}
                        textAnchor="middle"
                        fontSize={14.5}
                        fill={TREE_SIDE_COLOR[l.side]}
                      >
                        {l.title}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* the personal badges: the data-driven read + a differing pick */}
              <g className={on(step >= 7)}>
                {(() => {
                  const badge = (
                    leaf: LeafId,
                    label: string,
                    color: string,
                    drop = 0,
                  ) => {
                    const y = DOT_LEAF_Y + 38 + drop;
                    /* the pill renders "↑ " + label in 13px caps with 1.2px
                       tracking — size for the FULL string, plus real margins,
                       so the words never crowd the rounded ends */
                    const w = (label.length + 2) * 7.8 + 30;
                    return (
                      <g key={`${leaf}-${label}`} className="jz-youare">
                        <rect
                          x={LEAF_X[leaf] - w / 2}
                          y={y - 13}
                          width={w}
                          height={26}
                          rx={13}
                          fill={color}
                        />
                        <text
                          x={LEAF_X[leaf]}
                          y={y}
                          textAnchor="middle"
                          dy="0.34em"
                        >
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
                  if (step >= 8 && !isDefaultPath) {
                    const collide =
                      Math.abs(LEAF_X[selLeaf] - LEAF_X[suggLeaf]) < 240;
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

              {/* ============ the instrument inset (top-right) ============
                  Steps 4–5 keep the PARKED PIZZA CHART here — the root fork
                  is read off it, so it stays in reach while the dot carries
                  that reading down the first edge. Fork two then swaps in
                  its own instrument. */}
              <g className={on(step >= 4)}>
                <rect
                  className="nv-inset-panel"
                  x={INSET.x}
                  y={INSET.y}
                  width={INSET.w}
                  height={INSET.h}
                  rx={10}
                />
                <g className={on(step <= 5)}>
                  <text className="nv-captitle" x={INSET.x + 14} y={INSET.y + 22}>
                    THE PIZZA CHART · THE ROOT FORK
                  </text>
                  {QUADRANTS.map((q) => (
                    <rect
                      key={`rq-${q.id}`}
                      x={q.dx === 1 ? pzx(0) : pzx(-1)}
                      y={q.dy === 1 ? pzy(1) : pzy(0)}
                      width={pz.s / 2}
                      height={pz.s / 2}
                      fill={TREE_SIDE_COLOR[q.side]}
                      fillOpacity={
                        q.dx === (ux >= 0 ? 1 : -1) && q.dy === (uy >= 0 ? 1 : -1)
                          ? 0.16
                          : 0.06
                      }
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
                        r={1.2}
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
                    r={5}
                    fill="var(--ink)"
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                  <text
                    className="nv-lab"
                    x={pzx(ux) + 9}
                    y={pzy(uy) - 7}
                    fontSize={12}
                    fontWeight={700}
                    fill="var(--ink)"
                  >
                    {cityShort}
                  </text>
                  <text
                    className="nv-elab"
                    x={pz.x}
                    y={pz.y + pz.s + 18}
                    fill={TREE_SIDE_COLOR.demand}
                  >
                    together → Labor Demand
                  </text>
                  <text
                    className="nv-elab"
                    x={pz.x + pz.s}
                    y={pz.y + pz.s + 34}
                    textAnchor="end"
                    fill={TREE_SIDE_COLOR.supply}
                  >
                    apart → Labor Supply
                  </text>
                </g>
                <g className={on(step >= 6)}>
                {citySide === "demand" ? (
                  /* the metro's dial, on the same pizza plane */
                  <g>
                    <text className="nv-captitle" x={INSET.x + 14} y={INSET.y + 22}>
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
                          r={1.2}
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
                    {msa ? (
                      <g>
                        <circle
                          cx={pzx(metroUnit(msa)[0])}
                          cy={pzy(metroUnit(msa)[1])}
                          r={5}
                          fill="var(--ink)"
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                        <text
                          className="nv-lab"
                          x={pzx(metroUnit(msa)[0]) + 9}
                          y={pzy(metroUnit(msa)[1]) - 7}
                          fontSize={12}
                          fontWeight={700}
                          fill="var(--ink)"
                        >
                          {`${cityShort} MSA ${pc(msa.pop)}`}
                        </text>
                      </g>
                    ) : (
                      <text
                        className="nv-ph"
                        x={INSET.x + INSET.w / 2}
                        y={pz.y + pz.s / 2}
                        textAnchor="middle"
                      >
                        {`[no ${cityShort} metro data yet]`}
                      </text>
                    )}
                    <text
                      className="nv-elab"
                      x={pz.x}
                      y={pz.y + pz.s + 18}
                      fill={TREE_SIDE_COLOR.demand}
                    >
                      ← below · Metro-wide
                    </text>
                    <text
                      className="nv-elab"
                      x={pz.x + pz.s}
                      y={pz.y + pz.s + 34}
                      textAnchor="end"
                      fill={TREE_SIDE_COLOR.demand}
                    >
                      above · Place-specific →
                    </text>
                  </g>
                ) : (
                  /* the housing read: one value against one threshold */
                  <g>
                    <text className="nv-captitle" x={INSET.x + 14} y={INSET.y + 22}>
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
                          x={hz.x - 8}
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
                    <text className="nv-ph" x={hz.x + 2} y={zy(medCost) - 8}>
                      {`typical metro ${pc(medCost)}`}
                    </text>
                    <text
                      className="nv-elab"
                      x={hz.x + hz.w - 2}
                      y={zy(medCost) - 8}
                      textAnchor="end"
                      fill={TREE_SIDE_COLOR.supply}
                    >
                      faster → Cost of living
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
                          r={5}
                          fill="var(--ink)"
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                        <text
                          className="nv-lab"
                          x={zx(place.pop) + 9}
                          y={zy(cost.growth) + (cost.growth > medCost ? -8 : 14)}
                          fontSize={12}
                          fontWeight={700}
                          fill="var(--ink)"
                        >
                          {`${cityShort} ${pc(cost.growth)}`}
                        </text>
                      </g>
                    ) : (
                      <text
                        className="nv-ph"
                        x={INSET.x + INSET.w / 2}
                        y={zy(medCost) + 44}
                        textAnchor="middle"
                      >
                        {`[no ${cityShort} home-value series yet]`}
                      </text>
                    )}
                    <text
                      className="nv-ph"
                      x={hz.x}
                      y={hz.y + hz.h + 32}
                    >
                      {`home values at the city level, ${DATA_WINDOW_LABEL}`}
                    </text>
                  </g>
                )}
                </g>
              </g>

            </svg>
          </div>

          <aside className="jz-rail">
            <div className="jz-railtext">{caption}</div>
            <div
              className={"jz-next" + (step >= 7 ? " show" : "")}
              aria-hidden={step < 7}
            >
              <span className="jz-next-k">Up next</span>
              <span
                className="jz-next-name"
                style={{ color: TREE_SIDE_COLOR[selSide] }}
              >
                {branchSectionName(selSide)} →
              </span>
              <span className="ph">[click a leaf to switch your branch]</span>
            </div>
          </aside>
        </div>
      </div>

      {/* the rail's two steps: same anchors as the compact flow */}
      <section id="page-constraints" className="jz-anchor jz-anchor-top" />
      <section
        id="page-constraints-diagnose"
        className="jz-anchor"
        style={{ top: `${ANCHOR_BOTTOM_VH}vh`, height: "40vh" }}
      />
    </div>
  );
}
