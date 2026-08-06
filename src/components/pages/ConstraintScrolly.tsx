import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { pointer, select, type Selection } from "d3-selection";
import { Delaunay } from "d3-delaunay";
import "d3-transition";
import { easeCubicInOut, easeCubicOut, easeSinInOut } from "d3-ease";
import { stratify, tree as d3tree, type HierarchyNode } from "d3-hierarchy";
import {
  LEAF_THEMES,
  QUADRANTS,
  THEMES,
  TREE_MODES,
  TREE_SIDE_COLOR,
  diagnose,
  suggestedPath,
  treeNodes,
  type QuadrantDef,
  type TreeNodeData,
  type TreeMode,
  type TreeSide,
  type TreeVariant,
} from "../../data/figures";
import { branchSectionName } from "../../data/content";
import {
  METROS,
  METRO_MEDIANS,
  METRO_SPAN,
  homeMsa,
  homePlace,
  metroStatsRows,
  metroUnit,
  peerMetros,
  type MetroDatum,
} from "../../data/metros";
import { wrapText } from "../../lib/wrapText";
import { NodeGlyph, iconArt } from "./treeIcons";

/* The two City Constraints pages as one sticky, STEP-driven sequence.
   Crossing a scroll boundary triggers a timed transition to the next phase
   (rather than scrubbing a continuous animation), which keeps the scroll
   track short:

     step 0  the pizza chart fades in, quadrants labeled
     step 1  + the MSA dot (continuity with the previous section)
     step 2  + the place dot — its quadrant picks the fork in the tree
     step 3  chart docks to the rail minimap; the FULL tree draws itself in,
             arrows flowing top to bottom, labels surfacing as they connect
     step 4  the default path lights up — "where we think you are"

   From step 3 on, hovering any node OR LINK explains it in the rail and
   reflects it on the always-expanded minimap; CLICKING a node picks the
   descent the next step analyses (default: the data-driven read), which
   renames that step Demand/Supply side analysis in the side nav. Layout:
   the narrative and the minimap live in a right rail; the stage keeps the
   rest. A "tree style" toggle cluster in the stage's bottom-left flips the
   styling experiments (node icons / chip cards / curved branches) live. */

const W = 1180;
const H = 640;

/* scene A: the chart square, centred on the stage */
const CQ = { cx: W / 2, cy: 316, r: 268 };

/* scene B: the tidy tree. The top margin clears the root's full dressing —
   chip pad + icon riding above the label — so no styling combo clips at
   the viewBox edge */
const TM = { left: 60, top: 52 };
const T_W = 1060;
const LABEL_W = 250;
const ROOT_LABEL_W = 620;

const STEPS = 5;

/* where the big chart flies when it docks (toward the rail minimap) */
const DOCK = { x: W - 44, y: 140 };

/* the chart phase tightens the viewBox around the chart square (plus its
   frame ticks/titles and the arrow-axis caption), so the pizza uses the
   stage's full width instead of reserving room for the tree; the tree phase
   eases back to the full box while the chart docks */
const CHART_VB = "245 0 810 640";

/* the tree phase mirrors the trick vertically: the stage viewBox grows to
   the stage's own aspect ratio (capped, so level gaps stay readable) and
   the tree lays out taller to fill it — otherwise a laptop's squarer stage
   letterboxes the wide tree into a small band */
const TREE_H_MAX = 900;
/* space kept below the deepest leaves for their badges ("where we think
   you are"), matching the original 640-tall layout */
const TREE_BOTTOM = 88;

/* intro reveal timing: per-depth wave of drawn arrows + surfacing labels.
   The chart's dock ride is longer than a standard step transition, the tree
   starts once the chart is mostly out of the way, and each depth level draws
   slightly longer than the stagger between levels — the overlap keeps the
   cascade reading as one continuous flow instead of stepped waves. */
const CHART_EXIT_MS = 800;
const INTRO_BASE = 520;
const INTRO_LEVEL = 400;
const INTRO_DRAW = 460;
const INTRO_MS = 2600;

/* the two dots follow the SELECTED city: REAL values (metros.ts) for the US
   sample cities, placed on the unit square around the every-metro median
   crosshair; the non-US samples fall back to placeholder spots + bracketed
   stats until their data exists */
interface HomeData {
  msa: MetroDatum | null;
  msaSpot: [number, number];
  placeSpot: [number, number];
  msaStats: string[];
  placeStats: string[];
  peers: MetroDatum[];
  /** the quadrant the place dot lands in — drives the sel/focus marking */
  placeQuad: QuadrantDef;
}
function homeData(cityShort: string): HomeData {
  const msa = homeMsa(cityShort);
  const place = homePlace(cityShort);
  const msaSpot = msa ? metroUnit(msa) : ([0.38, 0.82] as [number, number]);
  const placeSpot = place
    ? metroUnit(place)
    : ([-0.72, 0.82] as [number, number]);
  const ph = [`[no ${cityShort} data yet — sample spot]`];
  return {
    msa,
    msaSpot,
    placeSpot,
    msaStats: msa ? metroStatsRows(msa) : ph,
    placeStats: place ? metroStatsRows(place) : ph,
    peers: peerMetros(cityShort),
    placeQuad: QUADRANTS.find(
      (q) =>
        q.dx === (placeSpot[0] >= 0 ? 1 : -1) &&
        q.dy === (placeSpot[1] >= 0 ? 1 : -1),
    )!,
  };
}

/** tree side → the minimap quadrants it corresponds to. Derived from the
 *  quadrant table rather than listed, so hovering a branch always lights the
 *  quadrants that branch actually comes from — this was hand-written and had
 *  drifted out of step with the fork logic on the two top quadrants. */
const SIDE_QUADS: Record<TreeSide, QuadrantDef["id"][]> = {
  root: [],
  demand: QUADRANTS.filter((q) => q.side === "demand").map((q) => q.id),
  supply: QUADRANTS.filter((q) => q.side === "supply").map((q) => q.id),
};

type Node = HierarchyNode<TreeNodeData> & { x: number; y: number };
type Phase = "chart" | "tree";

const STEP_COPY: { kicker: string; body: string }[] = [
  {
    kicker: "The pizza chart",
    body: "[step 1: introducing the pizza chart to the user. explain how to read it: each quadrant pairs a population move with a wage move, vs the average city]",
  },
  {
    kicker: "Your metro area",
    body: "[step 2: show the MSA on the pizza chart.]",
  },
  {
    kicker: "Your place",
    body: "[step 3: show the user's place on the pizza chart. This quadrant picks the tree fork (except in edge cases, to be clarified later)]",
  },
  {
    kicker: "The diagnostic tree",
    body: "[step 4: introduce the diagnostic tree, which breaks down the growth question into demand and supply. Hover any node or link to read it.]",
  },
  {
    kicker: "Where we think you are",
    body: "Each fork below is one comparison against the typical US metro. Click an end leaf to follow a different path instead, or hover any node to read it.",
  },
];

/* one tiny line icon per step, shown beside the rail kicker */
const STEP_ICONS: React.ReactNode[] = [
  /* the quartered chart */
  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="6.5" cy="6.5" r="5.4" />
    <path d="M6.5 1.1v10.8M1.1 6.5h10.8" />
  </svg>,
  /* the MSA ring */
  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="6.5" cy="6.5" r="5" />
    <circle cx="6.5" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>,
  /* the place pin */
  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6.5 11.9c2.9-3.2 4.4-5.3 4.4-7.2a4.4 4.4 0 1 0-8.8 0c0 1.9 1.5 4 4.4 7.2Z" />
    <circle cx="6.5" cy="4.9" r="1.5" />
  </svg>,
  /* the fork */
  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6.5 1.6v3M6.5 4.6 3 7v3M6.5 4.6 10 7v3" />
    <circle cx="3" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
  </svg>,
  /* the target */
  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="6.5" cy="6.5" r="5.4" />
    <circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" stroke="none" />
  </svg>,
];

/* the stage's styling experiments, flipped live by the toggles parked in the
   tree phase's bottom-left corner. Independent switches, so their combos give
   eight looks; all off = the shipped tree */
type TreeStyle = { icons: boolean; chips: boolean; curved: boolean };
const TREE_STYLE_TOGGLES = [
  ["icons", "node icons"],
  ["chips", "chip cards"],
  ["curved", "curved branches"],
] as const;

/* the pizza chart's styling experiments, same mechanism: toward the v1
   "How is the metro performing?" scatter — a grey field of metros, the
   framed axes with dashed gridlines and a "typical" crosshair, and the
   single-quadrant focus tint */
type ChartStyle = {
  field: boolean;
  frame: boolean;
  /* reduced text: the dots keep their names only (no stat numbers) and the
     quadrant blocks drop the "___ shock" headings — the arrows line and
     branch tag carry the meaning alone */
  reduced: boolean;
  /* where the quadrant text lives. With REAL dot positions the sample
     cities ride the crowded band near the median crosshair, so the compact
     outer-corner block is the default; the big centered text and v1's
     white corner cards remain as experiments */
  labels: "center" | "corner" | "card";
};
const CHART_STYLE_TOGGLES = [
  ["field", "metro field"],
  ["frame", "framed axes"],
  ["reduced", "reduced text"],
] as const;
const CHART_LABEL_TOGGLES = [
  ["center", "centered labels"],
  ["card", "label cards"],
] as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** first sentence only — captions run at full text size, so keep them short */
function firstSentence(s: string) {
  const i = s.indexOf(". ");
  return i > 0 ? s.slice(0, i + 1) : s;
}

/** which side of the tree a node hangs off — depth-1 ancestor decides */
function sideOf(n: HierarchyNode<TreeNodeData>): TreeSide {
  const top = n.ancestors().find((a) => a.depth === 1);
  return top ? (top.data.id as TreeSide) : "root";
}

function displayTitle(n: Node) {
  return n.depth === 0 ? "The growth question" : n.data.title;
}

/* ---------- the always-expanded pizza minimap ---------- */

function MiniMap({
  visible,
  hlSide,
  cityShort,
  home,
  onSideHover,
}: {
  visible: boolean;
  hlSide: TreeSide | null;
  cityShort: string;
  /** the selected city's dots + landing quadrant */
  home: HomeData;
  /** hovering a quadrant emphasises its half of the tree */
  onSideHover: (side: "demand" | "supply" | null) => void;
}) {
  const S = 320;
  const c = S / 2;
  const r = S / 2 - 12;
  const mx = (v: number) => c + v * r;
  const my = (v: number) => c - v * r;
  const hl = hlSide ? SIDE_QUADS[hlSide] : [];
  /* content ends at y = c + r + hover-stroke overhang; crop the empty band
     below without clipping the bottom quads' corners */
  const VH = c + r + 2;
  return (
    <div
      className={"jz-mini" + (visible ? " show" : "")}
      aria-hidden={!visible}
    >
      <svg viewBox={`0 0 ${S} ${VH}`}>
        {QUADRANTS.map((q) => (
          <g key={q.id}>
            <rect
              className={
                "jz-mini-quad" +
                (hl.includes(q.id) ? " hl" : "") +
                (q.id === home.placeQuad.id ? " place" : "")
              }
              x={q.dx === 1 ? mx(0) + 4 : mx(-1)}
              y={q.dy === 1 ? my(1) : my(0) + 4}
              width={r - 4}
              height={r - 4}
              rx={10}
              fill={TREE_SIDE_COLOR[q.side]}
              stroke={TREE_SIDE_COLOR[q.side]}
              onMouseEnter={() => onSideHover(q.side)}
              onMouseLeave={() => onSideHover(null)}
            />
            <text
              className="jz-mini-shock"
              x={mx(q.dx * 0.5)}
              y={my(q.dy * 0.5) - 2}
              textAnchor="middle"
              fill={TREE_SIDE_COLOR[q.side]}
            >
              {q.shock}
            </text>
            <text
              className="jz-mini-sub"
              x={mx(q.dx * 0.5)}
              y={my(q.dy * 0.5) + 16}
              textAnchor="middle"
            >
              {q.sub}
            </text>
          </g>
        ))}
        <line
          className="jz-mini-axis"
          x1={mx(-1)}
          y1={my(0)}
          x2={mx(1)}
          y2={my(0)}
        />
        <line
          className="jz-mini-axis"
          x1={mx(0)}
          y1={my(-1)}
          x2={mx(0)}
          y2={my(1)}
        />
        {/* MSA ring + place dot */}
        <circle
          className="jz-mini-msa"
          cx={mx(home.msaSpot[0])}
          cy={my(home.msaSpot[1])}
          r={7}
        />
        <text
          className="jz-mini-dotlabel"
          x={mx(home.msaSpot[0])}
          y={my(home.msaSpot[1]) + 22}
          textAnchor="middle"
        >
          {cityShort} MSA
        </text>
        <circle
          className="jz-mini-place"
          cx={mx(home.placeSpot[0])}
          cy={my(home.placeSpot[1])}
          r={7}
        />
        <text
          className="jz-mini-dotlabel"
          x={mx(home.placeSpot[0])}
          y={my(home.placeSpot[1]) - 13}
          textAnchor="middle"
        >
          {cityShort}
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------ the scrolly ------------------------------ */

export function ConstraintScrolly({
  cityShort,
  country,
  selectedPath,
  onSelectPath,
  onPhaseInView,
  variant,
  showThemes,
  mode,
  onModeChange,
}: {
  cityShort: string;
  /** the city's country — the forks compare against its median metro */
  country: string;
  /** the descent picked for the next section (ids below the root) */
  selectedPath: string[];
  onSelectPath: (path: string[]) => void;
  /** reports which of the two rail steps the track is on (scroll-spy) */
  onPhaseInView: (pageId: string) => void;
  /** which tree structure the stage shows — shared with the next section */
  variant: TreeVariant;
  /** the themes layer: chip stacks under the alt tree's leaves */
  showThemes: boolean;
  /** the section's top-level structure choice, which the two above derive from */
  mode: TreeMode;
  onModeChange: (m: TreeMode) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onPhaseRef = useRef(onPhaseInView);
  onPhaseRef.current = onPhaseInView;
  const svgRef = useRef<SVGSVGElement>(null);
  const scene = useRef<any>(null);
  const timers = useRef<number[]>([]);

  const [step, setStep] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  /* the hovered theme chip, as leaf + theme (a theme reached from two leaves
     is two chips, so the leaf is part of the identity) */
  const [themeHover, setThemeHover] = useState<{
    leaf: string;
    theme: string;
  } | null>(null);
  /* themes hang off the alt structure's leaves only */
  const themesOn = showThemes && variant === "alt";
  /* the styling experiments; toggling redraws the scene (same path as the
     webfont/layout redraws below) */
  const [treeStyle, setTreeStyle] = useState<TreeStyle>({
    icons: false,
    chips: false,
    curved: false,
  });
  const [chartStyle, setChartStyle] = useState<ChartStyle>({
    field: false,
    frame: false,
    reduced: false,
    labels: "corner",
  });

  /* the selected city's real dots (or placeholder spots) — drives the two
     accent dots, the peer set, and which quadrant reads as "yours" */
  const home = useMemo(() => homeData(cityShort), [cityShort]);
  /* the per-city suggested descent (hardcoded sample): what the tree lights
     up as "where we think you are" */
  const suggPath = useMemo(
    () => suggestedPath(cityShort, variant),
    [cityShort, variant],
  );
  /* the fork-by-fork reasoning behind that suggestion, with the numbers it
     turned on — the rail shows it once the path lights up (step 4) */
  const dx = useMemo(
    () => diagnose(cityShort, country),
    [cityShort, country],
  );
  const suggSide: TreeSide = suggPath[0] === "demand" ? "demand" : "supply";
  /* hovering a minimap quadrant emphasises that half of the tree */
  const [quadHover, setQuadHover] = useState<"demand" | "supply" | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const hoverIdRef = useRef(hover);
  hoverIdRef.current = hover;
  const prevStepRef = useRef(0);
  /* the intro's pointer-unlock runs outside the clearable timer pool, so a
     mid-intro emphasis change can never leave the tree stuck unhoverable */
  const ptrTimer = useRef(0);

  /* text is measured at draw time (badge pill, hit rects, link bounds) — once
     the webfont finishes loading, redraw so nothing is sized to the fallback
     font's metrics. (A counter, not a flag: the hidden-stage redraw below
     bumps it too.) */
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    let on = true;
    (document as { fonts?: FontFaceSet }).fonts?.ready.then(() => {
      if (on) setFontTick((t) => t + 1);
    });
    return () => {
      on = false;
    };
  }, []);

  /* the tree-phase viewBox height, matched to the stage's real aspect so
     the wide tree isn't letterboxed into a small band on squarer (laptop)
     stages; the tree lays out taller to fill it */
  const [treeH, setTreeH] = useState(H);
  useEffect(() => {
    const el = svgRef.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const h = Math.round(
        Math.min(TREE_H_MAX, Math.max(H, (W * r.height) / r.width)),
      );
      setTreeH((p) => (Math.abs(p - h) > 8 ? h : p));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fullVB = `0 0 ${W} ${treeH}`;

  const root = useMemo(() => {
    const built = stratify<TreeNodeData>()
      .id((d) => d.id)
      .parentId((d) => d.parent)(treeNodes(variant));
    /* separation ∝ the labels' rendered widths (wrap measure capped) plus
       chip padding, so wide neighbours — and their chip cards — never
       overlap horizontally in any styling combo.
       With themes on, a LEAF's footprint is its widest evidence chip, not
       its label: "Housing" and "Amenities" are short words carrying chips
       like "Housing supply and prices", so sizing the gap from the label
       alone let those two stacks collide. Chip text is measured for real at
       draw time; here it only has to be estimated, so the per-character
       figure is deliberately generous (7.8 against a measured worst case of
       7.6) — overshooting costs a little slack, undershooting overlaps. */
    /* 34 = the chip's own horizontal padding, 20 = the leading glyph and its
       gap (CHIP_ICO + 6, at draw time) */
    const chipW = (title: string) =>
      Math.max(104, title.length * 7.8 + 34 + 20);
    const estW = (n: { data: TreeNodeData }) => {
      const label = Math.min(n.data.title.length * 10.8, LABEL_W) + 36;
      const themes = themesOn ? (LEAF_THEMES[n.data.id] ?? []) : [];
      if (!themes.length) return label;
      const widest = Math.max(...themes.map((id) => chipW(THEMES[id].title)));
      return Math.max(label, widest + 26);
    };
    const laid = d3tree<TreeNodeData>()
      .size([T_W, treeH - TM.top - TREE_BOTTOM])
      .separation(
        (a, b) =>
          ((a.parent === b.parent ? 1 : 1.15) * (estW(a) + estW(b))) / 2 / 200,
      )(built);
    /* the levels aren't spread evenly: the root row is one line of text, so
       its gap down to the branch heads reads too tall at an equal share —
       pull level 1 up and give the deeper gaps the space (full: 5 levels,
       root → branch heads → … → horizontal/vertical inputs). The alt
       structure is 3 levels; spreading it over the full height would leave
       the two arrows absurdly long, so its rows sit closer together. With
       the themes layer on, the leaf row climbs again to leave room for the
       chip stacks (five deep under Regional Shock) plus the badge row */
    const LEVEL_F =
      variant !== "alt"
        ? [0, 0.2, 0.47, 0.74, 1]
        : themesOn
          ? [0, 0.3, 0.62]
          : [0, 0.42, 0.88];
    laid.each((d) => {
      d.y = LEVEL_F[d.depth] * (treeH - TM.top - TREE_BOTTOM);
    });
    return laid;
  }, [treeH, variant, themesOn]);

  const byId = useMemo(() => {
    const m = new Map<string, Node>();
    root.descendants().forEach((d) => m.set(d.data.id, d as Node));
    return m;
  }, [root]);

  /* a variant switch rebuilds the tree under the pointer — a hover id from
     the other structure must not be re-asserted against the new nodes */
  useEffect(() => {
    hoverIdRef.current = null;
    setHover(null);
    setThemeHover(null);
  }, [variant, themesOn]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /* ---------- step + hover appliers (imperative, over the drawn scene) ---------- */

  /** the root's stem is neutral ink at idle; when a route is emphasised it
   *  takes that route's side colour so the path reads one colour end to end */
  const colorRootStem = (side: TreeSide | null) => {
    scene.current?.stems
      .filter((d: Node) => d.data.id === "root")
      .attr("stroke", TREE_SIDE_COLOR[side ?? "root"]);
  };

  const applyStepRef = useRef<(s: number, animate: boolean) => void>(() => {});
  applyStepRef.current = (s, animate) => {
    const sc = scene.current;
    if (!sc) return;
    /* test hook: the screenshot harness sets this to land on final states */
    if (document.documentElement.dataset.jzInstant === "1") animate = false;
    clearTimers();
    const T = (sel: any) =>
      animate
        ? sel.transition().duration(600).ease(easeCubicInOut)
        : sel.interrupt();
    const entering = s >= 3 && prevStepRef.current <= 2 && animate;

    /* leaving the tree phase invalidates any hover: elements fading out under
       a stationary pointer never fire mouseleave, and a stale hover must not
       be re-asserted when the tree returns */
    if (s <= 2) {
      hoverIdRef.current = null;
      setHover(null);
      setQuadHover(null);
    }

    /* the viewBox rides the phase: tight around the chart while it has the
       stage, easing out to the full box in step with the dock ride */
    const svgSel = select(svgRef.current!);
    (entering
      ? svgSel.transition().duration(CHART_EXIT_MS).ease(easeCubicInOut)
      : T(svgSel)
    ).attr("viewBox", s <= 2 ? CHART_VB : fullVB);

    /* chart: full-size through step 2, docked away from step 3 on. On the
       chart→tree handoff the dock ride runs longer than a standard step
       transition, so the shrink-and-fade and the tree's arrival read as one
       continuous motion */
    if (s <= 2) {
      T(sc.gChart)
        .attr("transform", "translate(0,0) scale(1)")
        .attr("opacity", 1);
    } else {
      const k = 0.12;
      (entering
        ? sc.gChart.transition().duration(CHART_EXIT_MS).ease(easeCubicInOut)
        : T(sc.gChart)
      )
        .attr(
          "transform",
          `translate(${DOCK.x - k * CQ.cx},${DOCK.y - k * CQ.cy}) scale(${k})`,
        )
        .attr("opacity", 0);
    }
    T(sc.msaDot).attr("opacity", s >= 1 ? 1 : 0);
    T(sc.peerDots).attr("opacity", s >= 1 ? 1 : 0);
    T(sc.placeDot).attr("opacity", s >= 2 ? 1 : 0);
    sc.placeDot.classed("pulse", s === 2);
    sc.quads.classed(
      "sel",
      (d: QuadrantDef) => s >= 2 && d.id === sc.placeQuadId,
    );

    /* tree. While the intro cascade draws, the tree ignores the pointer — a
       mouse resting over the stage would otherwise fire a stray hover that
       interrupts the reveal mid-dash */
    window.clearTimeout(ptrTimer.current);
    if (entering) {
      sc.gTree.style("pointer-events", "none");
      ptrTimer.current = window.setTimeout(
        () => sc.gTree.style("pointer-events", "auto"),
        INTRO_MS,
      );
    } else {
      sc.gTree.style("pointer-events", s >= 3 ? "auto" : "none");
    }

    /* base link/node classes: idle for the whole tree */
    const idleTree = () => {
      sc.links
        .classed("lit", false)
        .classed("dim", false)
        .attr("stroke-dasharray", null)
        .attr("stroke-dashoffset", null)
        .attr("marker-end", (d: Node) => `url(#jz-arrow-${sideOf(d)})`);
      sc.stems
        .classed("lit", false)
        .classed("dim", false)
        .attr("stroke-dasharray", null)
        .attr("stroke-dashoffset", null);
      sc.nodes
        .classed("lit", false)
        .classed("dim", false)
        .classed("hovered", false);
      sc.chips
        .classed("lit", false)
        .classed("dim", false)
        .classed("hovered", false);
      colorRootStem(null);
    };
    /* clear any per-element intro state left behind */
    const normalize = () => {
      sc.nodes
        .interrupt()
        .attr("opacity", 1)
        .attr("transform", (d: Node) => `translate(${d.x},${d.y})`);
      sc.links.interrupt().attr("opacity", 1);
      sc.stems.interrupt().attr("opacity", 1);
      sc.gChips.interrupt().attr("opacity", 1);
    };

    if (entering) {
      /* progressive reveal: arrows draw themselves depth by depth, top to
         bottom, and each label surfaces as its arrow arrives */
      sc.gTree.interrupt().attr("opacity", 1);
      idleTree();
      /* labels: root first (as the chart clears the centre), then each level
         surfacing as its arrow arrives, settling with a decelerating ease */
      sc.nodes
        .interrupt()
        .attr("opacity", 0)
        .attr("transform", (d: Node) => `translate(${d.x},${d.y - 8})`)
        .transition()
        .duration(440)
        .delay((d: Node) =>
          d.depth === 0 ? 260 : INTRO_BASE + (d.depth - 1) * INTRO_LEVEL + 280,
        )
        .ease(easeCubicOut)
        .attr("opacity", 1)
        .attr("transform", (d: Node) => `translate(${d.x},${d.y})`);
      /* links: dash-drawn in a wave, one depth level at a time */
      sc.links
        .interrupt()
        .attr("opacity", 1)
        .each(function (this: SVGPathElement, d: Node) {
          const len = this.getTotalLength();
          select(this)
            .attr("marker-end", null)
            .attr("stroke-dasharray", `${len} ${len}`)
            .attr("stroke-dashoffset", len)
            .transition()
            .duration(INTRO_DRAW)
            .delay(INTRO_BASE + (d.depth - 1) * INTRO_LEVEL)
            .ease(easeSinInOut)
            .attr("stroke-dashoffset", 0)
            .on("end", function (this: SVGPathElement) {
              select(this)
                .attr("stroke-dasharray", null)
                .attr("marker-end", `url(#jz-arrow-${sideOf(d)})`);
            });
        });
      /* the themes layer arrives last, once the tree it hangs off has drawn */
      sc.gChips
        .interrupt()
        .attr("opacity", 0)
        .transition()
        .duration(420)
        .delay(INTRO_BASE + 2 * INTRO_LEVEL + 420)
        .ease(easeCubicOut)
        .attr("opacity", 1);
      /* stems: each parent's short drop draws just before its children's links */
      sc.stems
        .interrupt()
        .attr("opacity", 1)
        .each(function (this: SVGPathElement, d: Node) {
          const len = this.getTotalLength();
          select(this)
            .attr("stroke-dasharray", `${len} ${len}`)
            .attr("stroke-dashoffset", len)
            .transition()
            .duration(220)
            .delay(INTRO_BASE + d.depth * INTRO_LEVEL - 220)
            .ease(easeSinInOut)
            .attr("stroke-dashoffset", 0)
            .on("end", function (this: SVGPathElement) {
              select(this).attr("stroke-dasharray", null);
            });
        });
    } else {
      T(sc.gTree).attr("opacity", s >= 3 ? 1 : 0);
      normalize();
      idleTree();
    }

    /* the home marking + path emphasis, delayed until the intro settles.
       The picked box rides the same boundary: crossing 3↔4 adds/removes it */
    applyPicked();
    const introMs = entering ? INTRO_MS : 0;
    if (animate) {
      sc.gHome
        .transition()
        .delay(s >= 4 ? introMs : 0)
        .duration(600)
        .attr("opacity", s >= 4 ? 1 : 0);
    } else {
      sc.gHome.interrupt().attr("opacity", s >= 4 ? 1 : 0);
    }
    if (s >= 4) applyPath(animate, introMs);

    /* a live hover survives step re-application (its emphasis wins until the
       pointer leaves; the exit path re-derives the step state) */
    if (!entering && s >= 3 && hoverIdRef.current)
      applyHoverRef.current(hoverIdRef.current);

    prevStepRef.current = s;
  };

  /** step-4 state: the path the user is on lit; animated = links draw in
   *  sequence, starting after `delay0` (so the tree intro can finish first) */
  const applyPath = (animate: boolean, delay0 = 0) => {
    const sc = scene.current;
    if (document.documentElement.dataset.jzInstant === "1") animate = false;
    const ids = selectedRef.current;
    const pathSide = (ids[0] as TreeSide) ?? "supply";
    /* the data-driven suggestion never dims — its glow + badge must stay
       readable even when the user's pick is the lit path */
    const keep = new Set(["root", ...ids, ...suggPath]);
    const setDims = () => {
      sc.nodes.classed("dim", (d: Node) => !keep.has(d.data.id));
      sc.stems.classed("dim", (d: Node) => !keep.has(d.data.id));
      sc.chips
        .classed("dim", (c: { leaf: string }) => !keep.has(c.leaf))
        .classed("lit", (c: { leaf: string }) => ids.includes(c.leaf));
      sc.links
        .classed(
          "dim",
          (d: Node) =>
            !ids.includes(d.data.id) && !suggPath.includes(d.data.id),
        )
        .attr("stroke-dasharray", null)
        .attr("stroke-dashoffset", null)
        .attr("marker-end", (d: Node) => `url(#jz-arrow-${sideOf(d)})`);
    };
    if (!animate) {
      setDims();
      sc.nodes.classed(
        "lit",
        (d: Node) => d.data.id === "root" || ids.includes(d.data.id),
      );
      sc.stems.classed(
        "lit",
        (d: Node) => d.data.id === "root" || ids.includes(d.data.id),
      );
      sc.links.classed("lit", (d: Node) => ids.includes(d.data.id));
      colorRootStem(pathSide);
      return;
    }
    /* sequential dash-draw down the path */
    const litNode = (id: string) =>
      sc.nodes
        .filter((d: Node) => d.data.id === id)
        .classed("lit", true)
        .classed("dim", false);
    later(() => {
      setDims();
      litNode("root");
      sc.stems.filter((d: Node) => d.data.id === "root").classed("lit", true);
      colorRootStem(pathSide);
    }, delay0);
    ids.forEach((id, i) => {
      later(
        () => {
          const sel = sc.links.filter((d: Node) => d.data.id === id);
          const el = sel.node() as SVGPathElement | null;
          if (!el) return;
          const len = el.getTotalLength();
          /* a node's stem is the drop BELOW it — the start of the next arrow.
             The stem this link flows out of belongs to its parent, so lighting
             `id`'s own stem here would darken it one segment early */
          const parentId = i === 0 ? "root" : ids[i - 1];
          sc.stems
            .filter((d: Node) => d.data.id === parentId)
            .classed("lit", true)
            .classed("dim", false);
          sel
            .classed("lit", true)
            .attr("marker-end", null)
            .attr("stroke-dasharray", `${len} ${len}`)
            .attr("stroke-dashoffset", len)
            .transition()
            .duration(360)
            .ease(easeCubicInOut)
            .attr("stroke-dashoffset", 0)
            .on("end", function (this: SVGPathElement, d: Node) {
              select(this)
                .attr("stroke-dasharray", null)
                .attr("marker-end", `url(#jz-arrow-${sideOf(d)})`);
            });
          later(() => litNode(id), 320);
        },
        delay0 + 150 + i * 450,
      );
    });
  };

  /** hover emphasis (steps 3+): the hovered node's route wins the stage */
  const applyHoverRef = useRef<(id: string | null) => void>(() => {});
  applyHoverRef.current = (id) => {
    const sc = scene.current;
    if (!sc || stepRef.current < 3) return;
    if (!id) {
      applyStepRef.current(stepRef.current, false);
      return;
    }
    clearTimers();
    /* stale id from the other tree structure — nothing to emphasise */
    const hovered = byId.get(id);
    if (!hovered) return;
    const onPath = new Set(hovered.ancestors().map((a) => a.data.id));
    colorRootStem(hovered.depth === 0 ? null : sideOf(hovered));
    /* while another path is hovered, the user's pick AND the data-driven
       suggestion keep their markings and only fall back to idle, not dim */
    const home =
      stepRef.current >= 4
        ? new Set(["root", ...selectedRef.current, ...suggPath])
        : new Set<string>();
    /* settle any in-flight intro animation before emphasising */
    sc.nodes
      .interrupt()
      .attr("opacity", 1)
      .attr("transform", (d: Node) => `translate(${d.x},${d.y})`);
    sc.links.interrupt().attr("opacity", 1);
    sc.stems.interrupt().attr("opacity", 1);
    sc.nodes
      .classed("lit", (d: Node) => onPath.has(d.data.id))
      .classed(
        "dim",
        (d: Node) => !onPath.has(d.data.id) && !home.has(d.data.id),
      )
      .classed("hovered", (d: Node) => d.data.id === id);
    sc.chips
      .classed("lit", (c: { leaf: string }) => onPath.has(c.leaf))
      .classed(
        "dim",
        (c: { leaf: string }) => !onPath.has(c.leaf) && !home.has(c.leaf),
      )
      .classed("hovered", false);
    sc.links
      .classed("lit", (d: Node) => onPath.has(d.data.id))
      .classed(
        "dim",
        (d: Node) => !onPath.has(d.data.id) && !home.has(d.data.id),
      )
      .attr("stroke-dasharray", null)
      .attr("stroke-dashoffset", null)
      .attr("marker-end", (d: Node) => `url(#jz-arrow-${sideOf(d)})`);
    sc.stems
      .classed(
        "lit",
        (d: Node) =>
          onPath.has(d.data.id) &&
          (d.children ?? []).some((c) => onPath.has(c.data.id)),
      )
      .classed(
        "dim",
        (d: Node) =>
          !onPath.has(d.data.id) &&
          !(d.children ?? []).some((c) => home.has(c.data.id)),
      )
      .attr("stroke-dasharray", null)
      .attr("stroke-dashoffset", null);
  };

  const hoverRef = useRef<(id: string | null) => void>(() => {});
  hoverRef.current = (id) => {
    if (stepRef.current < 3) return;
    setHover(id);
  };

  /** theme-chip hover: the leaf's route lights as if the leaf itself were
   *  hovered, and the chip under the pointer takes the emphasis */
  const applyThemeRef = useRef<
    (t: { leaf: string; theme: string } | null) => void
  >(() => {});
  applyThemeRef.current = (t) => {
    const sc = scene.current;
    if (!sc || stepRef.current < 3) return;
    if (!t) {
      sc.chips.classed("hovered", false);
      applyHoverRef.current(hoverIdRef.current);
      return;
    }
    applyHoverRef.current(t.leaf);
    sc.chips.classed(
      "hovered",
      (c: { leaf: string; theme: string }) =>
        c.leaf === t.leaf && c.theme === t.theme,
    );
  };

  /** minimap-quadrant hover: light one whole half of the tree */
  const applyQuadRef = useRef<(side: "demand" | "supply" | null) => void>(
    () => {},
  );
  applyQuadRef.current = (side) => {
    const sc = scene.current;
    if (!sc || stepRef.current < 3) return;
    if (!side) {
      applyHoverRef.current(hoverIdRef.current);
      return;
    }
    clearTimers();
    sc.nodes
      .interrupt()
      .attr("opacity", 1)
      .attr("transform", (d: Node) => `translate(${d.x},${d.y})`);
    sc.links.interrupt().attr("opacity", 1);
    sc.stems.interrupt().attr("opacity", 1);
    const on = (d: Node) => sideOf(d) === side;
    sc.nodes
      .classed("lit", on)
      .classed("dim", (d: Node) => !on(d) && d.depth > 0)
      .classed("hovered", false);
    const chipOn = (c: { leaf: string }) => {
      const n = byId.get(c.leaf);
      return !!n && sideOf(n) === side;
    };
    sc.chips
      .classed("lit", chipOn)
      .classed("dim", (c: { leaf: string }) => !chipOn(c))
      .classed("hovered", false);
    sc.links
      .classed("lit", on)
      .classed("dim", (d: Node) => !on(d))
      .attr("stroke-dasharray", null)
      .attr("stroke-dashoffset", null)
      .attr("marker-end", (d: Node) => `url(#jz-arrow-${sideOf(d)})`);
    sc.stems
      .classed("lit", (d: Node) => on(d) || d.data.id === "root")
      .classed("dim", (d: Node) => !on(d) && d.data.id !== "root")
      .attr("stroke-dasharray", null)
      .attr("stroke-dashoffset", null);
    colorRootStem(side);
  };
  useEffect(() => {
    applyQuadRef.current(quadHover);
  }, [quadHover]);

  /* clicking an END LEAF picks the descent the next section analyses. Inner
     nodes are hover-to-read only — the app needs a full route to a leaf to
     navigate to, so a partial path can never be committed. Picking waits for
     the path phase (step >= 4): while the tree is only being introduced the
     data-driven default hasn't been shown yet, so there is nothing to pick
     against */
  const selectedRef = useRef(selectedPath);
  selectedRef.current = selectedPath;
  const clickRef = useRef<(id: string) => void>(() => {});
  clickRef.current = (id) => {
    if (stepRef.current < 4) return;
    const n = byId.get(id);
    if (!n || n.depth === 0 || n.children?.length) return;
    onSelectPath(
      n
        .ancestors()
        .filter((a) => a.depth >= 1)
        .map((a) => a.data.id)
        .reverse(),
    );
  };
  /* the dashed box belongs to the path phase (step >= 4) — while the tree is
     only being introduced, no leaf reads as picked yet */
  const applyPicked = () => {
    const sel = selectedRef.current;
    const on = stepRef.current >= 4;
    scene.current?.nodes.classed(
      "picked",
      (d: Node) => on && d.data.id === sel[sel.length - 1],
    );
  };
  /* selection changed: move the picked marker, rebuild the badge + underlay,
     and re-derive the current emphasis (keeping any live hover) on top */
  useEffect(() => {
    const sc = scene.current;
    if (!sc) return;
    applyPicked();
    sc.rebuildHome(selectedPath);
    if (stepRef.current >= 3) applyHoverRef.current(hoverIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath]);

  /* ---------- draw both scenes once ---------- */
  useEffect(() => {
    const svg = select(svgRef.current!);
    svg.selectAll("*").remove();

    const cx = (v: number) => CQ.cx + v * CQ.r;
    const cy = (v: number) => CQ.cy - v * CQ.r;

    /* markers overflow their viewport (the default clip shaves the tip's
       anti-aliasing), and the triangle carries a thin same-colour stroke with
       round joins — a bare fill's extreme vertex rasterises into stair-steps
       at fractional pixels; the rounded stroke renders it as a clean point */
    const defs = svg.append("defs");
    (["root", "demand", "supply"] as TreeSide[]).forEach((side) => {
      defs
        .append("marker")
        .attr("id", `jz-arrow-${side}`)
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 9)
        .attr("refY", 5)
        .attr("markerWidth", 5)
        .attr("markerHeight", 5)
        .attr("orient", "auto")
        .attr("overflow", "visible")
        .append("path")
        .attr("d", "M0 0 L10 5 L0 10 z")
        .attr("fill", TREE_SIDE_COLOR[side])
        .attr("stroke", TREE_SIDE_COLOR[side])
        .attr("stroke-width", 1.4)
        .attr("stroke-linejoin", "round");
    });
    defs
      .append("marker")
      .attr("id", "jz-axis-arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 8)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .attr("overflow", "visible")
      .append("path")
      .attr("d", "M0 0 L10 5 L0 10 z")
      .attr("fill", "var(--teal)")
      .attr("stroke", "var(--teal)")
      .attr("stroke-width", 1.4)
      .attr("stroke-linejoin", "round");

    /* ----- scene B: the tree (under the chart) ----- */
    const gTree = svg
      .append("g")
      .attr("opacity", 0)
      .style("pointer-events", "none");
    const plot = gTree
      .append("g")
      .attr("transform", `translate(${TM.left},${TM.top})`);
    const gLinks = plot.append("g");
    const gNodes = plot.append("g");

    const tnodes = root.descendants() as Node[];
    const nodes = gNodes
      .selectAll<SVGGElement, Node>("g.tree-node")
      .data(tnodes, (d) => d.data.id)
      .join("g")
      .attr(
        "class",
        (d) => `tree-node side-${sideOf(d)}${d.depth <= 1 ? " lead" : ""}`,
      )
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    nodes.append("rect").attr("class", "tree-hit").attr("rx", 6);

    nodes
      .append("text")
      .attr("class", "tree-label")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => TREE_SIDE_COLOR[sideOf(d)])
      .text((d) => d.data.title)
      .each(function (d) {
        wrapText(select(this), d.depth === 0 ? ROOT_LABEL_W : LABEL_W);
      });

    const bounds = new Map<
      string,
      { top: number; bottom: number; halfW: number }
    >();
    /* per-node dressing for the styling experiments: an icon riding above the
       label, and/or a tinted chip card enclosing both. The hit rect doubles
       as hover tint and picked outline, so in chip mode it IS the chip's box
       and all three stay aligned */
    const ICO = 20;
    nodes.each(function (d) {
      const text = select(this).select<SVGTextElement>("text.tree-label");
      const lines = text.node()!.childElementCount || 1;
      const shift = -((lines - 1) * 1.25) / 2;
      text.attr("dy", `${shift + 0.32}em`);
      const first = text.node()!.firstElementChild as SVGTSpanElement | null;
      if (first) first.setAttribute("dy", `${shift + 0.32}em`);
      const bb = text.node()!.getBBox();
      let top = bb.y;
      if (treeStyle.icons && iconArt(d.data.id)) {
        top = bb.y - 5 - ICO;
        const ico = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        ico.setAttribute("class", "tree-ico");
        ico.setAttribute("viewBox", "0 0 13 13");
        ico.setAttribute("x", `${-ICO / 2}`);
        ico.setAttribute("y", `${top}`);
        ico.setAttribute("width", `${ICO}`);
        ico.setAttribute("height", `${ICO}`);
        ico.setAttribute("fill", "none");
        ico.setAttribute("stroke", "currentColor");
        ico.setAttribute("stroke-width", "1.4");
        ico.setAttribute("stroke-linecap", "round");
        ico.setAttribute("stroke-linejoin", "round");
        ico.style.color = TREE_SIDE_COLOR[sideOf(d)];
        ico.innerHTML = iconArt(d.data.id)!;
        this.appendChild(ico);
      }
      const pad = treeStyle.chips ? 13 : 10;
      /* the hit rect carries the hover tint and the picked node's dashed
         outline — with icons on it grows upward to enclose the icon too,
         not just the label text */
      const hy = treeStyle.chips
        ? top - 8
        : treeStyle.icons
          ? top - 6
          : bb.y - 7;
      const hh = bb.y + bb.height + (treeStyle.chips ? 8 : 7) - hy;
      select(this)
        .select("rect.tree-hit")
        .attr("rx", treeStyle.chips ? 10 : 6)
        .attr("x", bb.x - pad)
        .attr("y", hy)
        .attr("width", bb.width + pad * 2)
        .attr("height", hh);
      if (treeStyle.chips)
        select(this)
          .insert("rect", "text")
          .attr("class", "tree-chip")
          .attr("x", bb.x - pad)
          .attr("y", hy)
          .attr("width", bb.width + pad * 2)
          .attr("height", hh)
          .attr("rx", 10)
          .attr("fill", TREE_SIDE_COLOR[sideOf(d)])
          .attr("stroke", TREE_SIDE_COLOR[sideOf(d)]);
      /* generous vertical padding: stems and arrows keep their distance from
         the node's content (the hit rect above stays tighter than this) */
      bounds.set(d.data.id, {
        top: (treeStyle.chips ? hy : top) - (treeStyle.chips ? 6 : 13),
        bottom: bb.y + bb.height + (treeStyle.chips ? 14 : 13),
        halfW: bb.width / 2,
      });
    });

    const parents = tnodes.filter((d) => d.children?.length) as Node[];
    /* the fork sits at the vertical midpoint between the parent label and its
       nearest child, so the parent keeps a real stem down to the split instead
       of a bar hugging the label — and the highlighted path traces the same
       stem-then-fork geometry (matching the minimap schematic's elbows) */
    const busY = new Map<string, number>();
    parents.forEach((p) => {
      const y0 = p.y + (bounds.get(p.data.id)?.bottom ?? 0);
      const topmostChild = Math.min(
        ...p.children!.map(
          (c) => (c as Node).y + (bounds.get(c.data.id)?.top ?? 0),
        ),
      );
      let y = Math.max(
        y0 + 12,
        Math.min((y0 + topmostChild) / 2, topmostChild - 12),
      );
      /* the root's drop is capped: at the midpoint it reads overly long on
         tall stages, and the first fork should stay near the question */
      if (p.depth === 0) y = Math.min(y, y0 + 22);
      busY.set(p.data.id, y);
    });

    /* curved mode: one smooth cubic per link, straight from the parent's
       bottom to the child's top — stems collapse to nothing and the fork
       geometry (busY) goes unused. `inset` lifts the endpoint clear of the
       label bound (links stop short of the arrow tip; the home glow shorter
       still, so the tip renders on clean background) */
    const linkD = (d: Node, inset: number) => {
      const p = d.parent as Node;
      const yEnd = d.y + (bounds.get(d.data.id)?.top ?? 0) - inset;
      if (!treeStyle.curved)
        return `M${p.x},${busY.get(p.data.id)} H${d.x} V${yEnd}`;
      const y0 = p.y + (bounds.get(p.data.id)?.bottom ?? 0);
      /* the curve ends a step early and a straight vertical tail finishes the
         run: on wide, shallow hops (root → branch heads) the bend otherwise
         reaches the very tip, and the down-pointing arrowhead reads glued
         sideways onto a near-horizontal curve. The curve's shape ALWAYS
         derives from the link's true endpoint (inset 4) — a larger inset
         only shortens the tail, so the home glow's bend sits exactly under
         the lit link's instead of tracing a slightly different curve */
      const y1 = d.y + (bounds.get(d.data.id)?.top ?? 0) - 4;
      const yc = Math.max(y1 - 12, (y0 + y1) / 2);
      const my = (y0 + yc) / 2;
      return `M${p.x},${y0} C${p.x},${my} ${d.x},${my} ${d.x},${yc} V${Math.max(yc, yEnd)}`;
    };

    const stems = gLinks
      .selectAll<SVGPathElement, Node>("path.tree-stem")
      .data(parents, (d) => d.data.id)
      .join("path")
      .attr("class", "tree-stem")
      .attr("stroke", (d) => TREE_SIDE_COLOR[sideOf(d)])
      .attr("d", (d) => {
        const y0 = d.y + (bounds.get(d.data.id)?.bottom ?? 0);
        return treeStyle.curved
          ? `M${d.x},${y0} V${y0}`
          : `M${d.x},${y0} V${busY.get(d.data.id)}`;
      });

    const links = gLinks
      .selectAll<SVGPathElement, Node>("path.tree-link")
      .data(tnodes.filter((d) => d.parent) as Node[], (d) => d.data.id)
      .join("path")
      .attr("class", "tree-link")
      .attr("stroke", (d) => TREE_SIDE_COLOR[sideOf(d)])
      .attr("marker-end", (d) => `url(#jz-arrow-${sideOf(d)})`)
      .attr("d", (d) => linkD(d, 4));

    /* ----- area-linked hovering: one capture surface over the stage maps
           the pointer to the NEAREST tree node (Voronoi), so hovering needs
           no precise aim and never flickers when crossing from an arrow to a
           label. pointermove-only: browsers re-hit-test when content scrolls
           under a stationary cursor, and that must not steal the step state */
    const delaunay = Delaunay.from(
      tnodes,
      (d) => d.x + TM.left,
      (d) => d.y + TM.top,
    );
    const HOVER_R2 = 120 * 120;
    const targetAt = (event: MouseEvent) => {
      const [px, py] = pointer(event, svg.node());
      const n = tnodes[delaunay.find(px, py)];
      const ddx = n.x + TM.left - px;
      const ddy = n.y + TM.top - py;
      return ddx * ddx + ddy * ddy <= HOVER_R2 ? n.data.id : null;
    };
    /* the leaf-hover tip is built at the END of the draw (it must paint above
       the badge pills); the capture handlers reach it through this late
       binding */
    let moveTip: (e: PointerEvent | null) => void = () => {};
    const capture = gTree
      .append("rect")
      .attr("class", "jz-capture")
      .attr("width", W)
      .attr("height", treeH)
      .on("pointermove", (e: PointerEvent) => {
        hoverRef.current(targetAt(e));
        /* the pointer is over the stage proper, so it is not over a chip —
           clear any theme emphasis the chips left behind */
        setThemeHover(null);
        moveTip(e);
      })
      .on("pointerleave", () => {
        hoverRef.current(null);
        moveTip(null);
      })
      .on("click", (e: MouseEvent) => {
        const id = targetAt(e);
        if (id) clickRef.current(id);
        /* a committed leaf is no longer actionable — drop the tip at once
           rather than waiting for the next pointermove to notice */
        moveTip(null);
      });

    /* ----- the themes layer: under each alt leaf, a stack of chips naming
           the evidence you would read there. Deliberately NOT tree nodes —
           no arrows, a flatter shape, a separate hover — because a theme is
           not another step of the diagnostic but the data behind the leaf
           above it. Every chip is styled identically — where two leaves rest
           on the same underlying data, the themes are NAMED for the question
           each one answers rather than repeated and then marked.
           The chips sit ABOVE the capture rect so they take their own
           pointer events instead of resolving to the nearest tree node. */
    const CHIP_H = 26;
    const CHIP_GAP = 7;
    const CHIP_TOP = 22;
    const CHIP_ICO = 14;
    interface ChipDatum {
      leaf: string;
      theme: string;
      row: number;
    }
    /* the bottom of EACH leaf's own stack — a badge hangs off the leaf it
       marks, so it has to know that leaf's depth, not the deepest one */
    const stackBottom = new Map<string, number>();
    const gChips = gTree
      .append("g")
      .attr("class", "jz-chips")
      .attr("transform", `translate(${TM.left},${TM.top})`);

    const chipData: ChipDatum[] = [];
    if (themesOn)
      Object.entries(LEAF_THEMES).forEach(([leafId, themeIds]) => {
        if (!byId.has(leafId)) return;
        themeIds.forEach((tid, row) =>
          chipData.push({ leaf: leafId, theme: tid, row }),
        );
      });

    const chips = gChips
      .selectAll<SVGGElement, ChipDatum>("g.jz-chip")
      .data(chipData, (d) => `${d.leaf}:${d.theme}`)
      .join("g")
      .attr("class", "jz-chip");

    chips.each(function (d) {
      const n = byId.get(d.leaf)!;
      const color = TREE_SIDE_COLOR[sideOf(n)];
      const art = iconArt(d.theme);
      const g = select(this);
      const t = g
        .append("text")
        .attr("class", "jz-chip-lab")
        .attr("text-anchor", "middle")
        .attr("dy", "0.34em")
        .attr("fill", color)
        .text(THEMES[d.theme].title);
      /* the glyph sits left of the label inside the chip, so the box grows
         by its width and the label shifts right by half of that to keep the
         pair centred on the leaf */
      const lead = art ? CHIP_ICO + 6 : 0;
      const w = Math.max(104, t.node()!.getBBox().width + 34 + lead);
      t.attr("x", lead / 2);
      const y =
        n.y +
        (bounds.get(d.leaf)?.bottom ?? 0) +
        CHIP_TOP +
        d.row * (CHIP_H + CHIP_GAP);
      g.insert("rect", "text")
        .attr("class", "jz-chip-box")
        .attr("x", -w / 2)
        .attr("y", -CHIP_H / 2)
        .attr("width", w)
        .attr("height", CHIP_H)
        .attr("rx", 7)
        .attr("fill", color)
        .attr("stroke", color);
      if (art) {
        const ico = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        ico.setAttribute("class", "jz-chip-ico");
        ico.setAttribute("viewBox", "0 0 13 13");
        ico.setAttribute("x", `${-w / 2 + 11}`);
        ico.setAttribute("y", `${-CHIP_ICO / 2}`);
        ico.setAttribute("width", `${CHIP_ICO}`);
        ico.setAttribute("height", `${CHIP_ICO}`);
        ico.setAttribute("fill", "none");
        ico.setAttribute("stroke", "currentColor");
        ico.setAttribute("stroke-width", "1.4");
        ico.setAttribute("stroke-linecap", "round");
        ico.setAttribute("stroke-linejoin", "round");
        ico.style.color = color;
        ico.innerHTML = art;
        this.appendChild(ico);
      }
      g.attr("transform", `translate(${n.x},${y})`);
      stackBottom.set(
        d.leaf,
        Math.max(stackBottom.get(d.leaf) ?? 0, y + CHIP_H / 2),
      );
    });

    chips
      .on("pointerenter", (_e: PointerEvent, d: ChipDatum) => {
        if (stepRef.current < 3) return;
        setThemeHover({ leaf: d.leaf, theme: d.theme });
        moveTip(null);
      })
      .on("pointerleave", () => setThemeHover(null))
      /* clicking the evidence picks the leaf it hangs off */
      .on("click", (_e: MouseEvent, d: ChipDatum) => clickRef.current(d.leaf));

    /* ----- the marking of the path the user is on: a highlighter underlay
           plus a badge at the picked node. It follows the selected descent
           (default: the data-driven read) and persists while other paths are
           hovered. Each level is ONE continuous stroke (stem + fork + drop),
           so nothing overlaps or notches at the corners; round caps let the
           glow enclose the crisp line's ends while the padded label bounds
           keep it clear of the text. */
    const gHome = plot
      .insert("g", ":first-child")
      .attr("class", "jz-homeg")
      .attr("opacity", 0);
    /* pills live in a separate TOP layer (also .jz-homeg, so opacity
       transitions hit both): in the underlay they'd be painted over by
       strokes and labels */
    const gBadges = plot
      .append("g")
      .attr("class", "jz-homeg")
      .attr("opacity", 0);
    /* a badge hangs under the leaf it marks: below that leaf's own evidence
       stack when themes are on, below its label otherwise. An earlier
       version parked every badge in one row under the DEEPEST stack so the
       pills would line up, but a one-chip leaf then floated its badge a
       hundred-odd px below itself with nothing in between, reading as
       unattached. Alignment is worth less than the badge pointing at its
       own leaf. */
    const badgeY = (n: Node) =>
      (stackBottom.get(n.data.id) ?? 0) > 0
        ? stackBottom.get(n.data.id)! + 26
        : n.y + (bounds.get(n.data.id)?.bottom ?? 0) + 24;

    const rebuildHome = (path: string[]) => {
      gHome.selectAll("*").remove();
      gBadges.selectAll("*").remove();
      /* a badge pill, only under LEAF nodes: a mid-node pick is already
         marked by its dashed outline and lit route, and a side-mounted pill
         collides with same-row labels or the stage edge */
      const mkBadge = (id: string, color: string, label: string, drop = 0) => {
        /* an id from the other tree structure (mid variant-switch) has no
           node here — skip rather than crash; the redraw settles it */
        const n = byId.get(id);
        if (!n || n.children?.length) return n ?? null;
        const badge = gBadges.append("g").attr("class", "jz-youare");
        const badgeText = badge
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.34em")
          .text("↑ " + label);
        const bbb = badgeText.node()!.getBBox();
        badge
          .insert("rect", ":first-child")
          .attr("x", bbb.x - 16)
          .attr("y", bbb.y - 9)
          .attr("width", bbb.width + 32)
          .attr("height", bbb.height + 18)
          .attr("rx", 14)
          .attr("fill", color);
        badge.attr("transform", `translate(${n.x},${badgeY(n) + drop})`);
        return n;
      };

      /* the data-driven suggestion ALWAYS keeps its glow + badge, so the
         original read stays visible while the user picks another path */
      const suggColor = TREE_SIDE_COLOR[suggSide];
      (
        tnodes.filter((d) => d.parent && suggPath.includes(d.data.id)) as Node[]
      ).forEach((d) => {
        const p = d.parent as Node;
        const y0 = p.y + (bounds.get(p.data.id)?.bottom ?? 0);
        /* the final drop stops short of the label bound: the glow's round cap
           ends a few px above the arrowhead's tip, so the point renders on
           clean background instead of over the glow's soft edge */
        const y1 = d.y + (bounds.get(d.data.id)?.top ?? 0) - 11;
        gHome
          .append("path")
          .attr("class", "tree-home")
          .attr("stroke", suggColor)
          .attr(
            "d",
            treeStyle.curved
              ? linkD(d, 11)
              : `M${p.x},${y0} V${busY.get(p.data.id)} H${d.x} V${y1}`,
          );
      });
      const sugg = mkBadge(
        suggPath[suggPath.length - 1],
        suggColor,
        "where we think you are",
      );

      /* a differing pick gets its own badge — its route is the lit one on
         the stage. When the two pills would land on the same row close
         together, the pick's drops a step. The test is on where the BADGES
         sit, not where their leaves do: with themes on, two same-depth
         leaves can carry stacks of different heights and so put their
         badges on quite different rows */
      if (path.join("/") !== suggPath.join("/")) {
        const pickColor = TREE_SIDE_COLOR[(path[0] as TreeSide) ?? "supply"];
        const pn = byId.get(path[path.length - 1]);
        if (!pn) return;
        const collide =
          !!sugg &&
          !pn.children?.length &&
          !sugg.children?.length &&
          Math.abs(badgeY(pn) - badgeY(sugg)) < 30 &&
          Math.abs(pn.x - sugg.x) < 240;
        mkBadge(
          path[path.length - 1],
          pickColor,
          "you selected this path",
          collide ? 40 : 0,
        );
      }
    };

    /* ----- scene A: the pizza chart, on top ----- */
    const gChart = svg.append("g").attr("class", "jz-chart").attr("opacity", 0);

    gChart.classed("style-frame", chartStyle.frame);

    /* framed mode squares the quadrant cards up edge-to-edge (the v1 plot is
       one rectangle split by the crosshair, not four floating cards) */
    const QGAP = chartStyle.frame ? 0 : 8;
    const quads = gChart
      .selectAll<SVGGElement, QuadrantDef>("g.jz-quad")
      .data(QUADRANTS)
      .join("g")
      .attr("class", "jz-quad")
      .classed("place", (d) => d.id === home.placeQuad.id);

    quads
      .append("rect")
      .attr("x", (d) => (d.dx === 1 ? cx(0) + QGAP : cx(-1)))
      .attr("y", (d) => (d.dy === 1 ? cy(1) : cy(0) + QGAP))
      .attr("width", CQ.r - QGAP)
      .attr("height", CQ.r - QGAP)
      .attr("rx", chartStyle.frame ? 0 : 14)
      .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
      .attr("stroke", (d) => TREE_SIDE_COLOR[d.side]);

    /* framed axes (v1 look): dashed gridlines with % ticks, a solid black
       frame on the left and bottom, and a dashed "typical" crosshair named
       in place — replacing the through-the-middle arrow axes. Tick values
       anchor on the sample city's [placeholder] stats */
    if (chartStyle.frame) {
      const gFrame = gChart.append("g");
      [-1, -0.5, 0.5, 1].forEach((t) => {
        gFrame
          .append("line")
          .attr("class", "jz-ms-grid")
          .attr("x1", cx(t))
          .attr("x2", cx(t))
          .attr("y1", cy(1))
          .attr("y2", cy(-1));
        const xv = METRO_MEDIANS.pop + t * METRO_SPAN.pop;
        gFrame
          .append("text")
          .attr("class", "jz-ms-tick")
          .attr("x", cx(t))
          .attr("y", cy(-1) + 22)
          .attr("text-anchor", "middle")
          .text(`${xv > 0 ? "+" : ""}${xv.toFixed(1)}%`);
        gFrame
          .append("line")
          .attr("class", "jz-ms-grid")
          .attr("x1", cx(-1))
          .attr("x2", cx(1))
          .attr("y1", cy(t))
          .attr("y2", cy(t));
        const yv = METRO_MEDIANS.wage + t * METRO_SPAN.wage;
        gFrame
          .append("text")
          .attr("class", "jz-ms-tick")
          .attr("x", cx(-1) - 12)
          .attr("y", cy(t) + 4)
          .attr("text-anchor", "end")
          .text(`${yv > 0 ? "+" : ""}${yv.toFixed(1)}%`);
      });
      gFrame
        .append("line")
        .attr("class", "jz-ms-axisline")
        .attr("x1", cx(-1))
        .attr("x2", cx(-1))
        .attr("y1", cy(1))
        .attr("y2", cy(-1));
      gFrame
        .append("line")
        .attr("class", "jz-ms-axisline")
        .attr("x1", cx(-1))
        .attr("x2", cx(1))
        .attr("y1", cy(-1))
        .attr("y2", cy(-1));
      gFrame
        .append("line")
        .attr("class", "jz-ms-median")
        .attr("x1", cx(0))
        .attr("x2", cx(0))
        .attr("y1", cy(1))
        .attr("y2", cy(-1));
      gFrame
        .append("line")
        .attr("class", "jz-ms-median")
        .attr("x1", cx(-1))
        .attr("x2", cx(1))
        .attr("y1", cy(0))
        .attr("y2", cy(0));
      gFrame
        .append("text")
        .attr("class", "jz-ms-typical")
        .attr("x", cx(0))
        .attr("y", cy(1) - 10)
        .attr("text-anchor", "middle")
        .text("Typical population growth");
      gFrame
        .append("path")
        .attr("class", "jz-ms-typical-mark")
        .attr(
          "d",
          `M${cx(0) - 4} ${cy(1) - 6}L${cx(0) + 4} ${cy(1) - 6}L${cx(0)} ${cy(1)}Z`,
        );
      gFrame
        .append("text")
        .attr("class", "jz-ms-typical")
        .attr("x", cx(1) - 10)
        .attr("y", cy(0) - 8)
        .attr("text-anchor", "end")
        .text("Typical wage growth");
      gFrame
        .append("path")
        .attr("class", "jz-ms-typical-mark")
        .attr(
          "d",
          `M${cx(1)} ${cy(0) - 4}L${cx(1)} ${cy(0) + 4}L${cx(1) - 5} ${cy(0)}Z`,
        );
      gFrame
        .append("text")
        .attr("class", "jz-ms-title")
        .attr("x", cx(0))
        .attr("y", cy(-1) + 48)
        .attr("text-anchor", "middle")
        .text("Population growth (annual rate, 2017–2023)");
      gFrame
        .append("text")
        .attr("class", "jz-ms-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -CQ.cy)
        .attr("y", cx(-1) - 50)
        .attr("text-anchor", "middle")
        .text("Average wage growth (annual rate, 2017–2023)");
    }

    /* the metro field: every real US metro (metros.ts), population-sized
       like v1's employment-sized dots. The home metro and the labeled
       sample peers are drawn as accents elsewhere, so they stay out of the
       grey field */
    const named = new Set([
      ...(home.msa ? [home.msa.name] : []),
      ...home.peers.map((m) => m.name),
    ]);
    const maxSize = Math.max(...METROS.map((m) => m.size));
    const dotR = (s: number) => 1.3 + 10.7 * Math.sqrt(s / maxSize);
    if (chartStyle.field) {
      const gField = gChart.append("g");
      METROS.filter((m) => !named.has(m.name)).forEach((m) => {
        const [ux, uy] = metroUnit(m);
        gField
          .append("circle")
          .attr("class", "jz-ms-dot")
          .attr("cx", cx(ux))
          .attr("cy", cy(uy))
          .attr("r", dotR(m.size));
      });
    }

    /* quadrant labels live above the field dots, so text never gets
       speckled. Centered = the shipped look; the corner modes (after v1's
       quadrant buttons) tuck a compact block just inside each quadrant's
       outer corner so mid-field points never land on text — "card" backs it
       with v1's translucent white card, which stays readable even when the
       field runs beneath it */
    const labMode = chartStyle.labels;
    gChart.classed("lab-side", labMode !== "center");
    const branchTag = (d: QuadrantDef) =>
      `→ ${d.side === "demand" ? "labor demand" : "labor supply"} branch`;
    const qLabels = gChart
      .append("g")
      .selectAll<SVGGElement, QuadrantDef>("g")
      .data(QUADRANTS)
      .join("g");
    if (labMode === "center") {
      /* reduced mode drops the shock heading; the remaining two lines
         recentre on the quadrant */
      if (!chartStyle.reduced)
        qLabels
          .append("text")
          .attr("class", "jz-shock")
          .attr("x", (d) => cx(d.dx * 0.5))
          .attr("y", (d) => cy(d.dy * 0.5) - 14)
          .attr("text-anchor", "middle")
          .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
          .text((d) => d.shock);
      qLabels
        .append("text")
        .attr("class", "jz-sub")
        .attr("x", (d) => cx(d.dx * 0.5))
        .attr("y", (d) => cy(d.dy * 0.5) + (chartStyle.reduced ? -2 : 10))
        .attr("text-anchor", "middle")
        .text((d) => d.sub);
      qLabels
        .append("text")
        .attr("class", "jz-tag")
        .attr("x", (d) => cx(d.dx * 0.5))
        .attr("y", (d) => cy(d.dy * 0.5) + (chartStyle.reduced ? 21 : 33))
        .attr("text-anchor", "middle")
        .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
        .text(branchTag);
    } else {
      qLabels.each(function (d) {
        const g = select(this);
        const right = d.dx === 1;
        const xa = right ? cx(1) - 18 : cx(-1) + 18;
        const anchor = right ? "end" : "start";
        /* every block sits in its quadrant's OUTER-BOTTOM corner (v1's
           bl/br buttons) — unless an accent dot lands inside that spot
           (the data decides where dots go): then it flips to the
           outer-top corner, provided that corner is free */
        const yBottom = (d.dy === 1 ? cy(0) - QGAP : cy(-1)) - 58;
        const yTopAlt = (d.dy === 1 ? cy(1) : cy(0) + QGAP) + 30;
        const wEst = 175;
        const dots = [home.msaSpot, home.placeSpot].map(
          ([sx, sy]) => [cx(sx), cy(sy)] as const,
        );
        const blocked = (top: number) =>
          dots.some(
            ([dxp, dyp]) =>
              dxp >= (right ? xa - wEst : xa) - 14 &&
              dxp <= (right ? xa : xa + wEst) + 14 &&
              dyp >= top - 30 &&
              dyp <= top + 58,
          );
        const yTop = blocked(yBottom) && !blocked(yTopAlt) ? yTopAlt : yBottom;
        /* reduced mode drops the shock heading; the block keeps its bottom
           edge and just loses its top line */
        if (!chartStyle.reduced)
          g.append("text")
            .attr("class", "jz-shock")
            .attr("x", xa)
            .attr("y", yTop)
            .attr("text-anchor", anchor)
            .attr("fill", TREE_SIDE_COLOR[d.side])
            .text(d.shock);
        g.append("text")
          .attr("class", "jz-sub")
          .attr("x", xa)
          .attr("y", yTop + 19)
          .attr("text-anchor", anchor)
          .text(d.sub);
        g.append("text")
          .attr("class", "jz-tag")
          .attr("x", xa)
          .attr("y", yTop + 37)
          .attr("text-anchor", anchor)
          .attr("fill", TREE_SIDE_COLOR[d.side])
          .text(branchTag(d));
        if (labMode === "card") {
          const bb = (this as SVGGElement).getBBox();
          g.insert("rect", ":first-child")
            .attr("class", "jz-qcard")
            .attr("x", bb.x - 12)
            .attr("y", bb.y - 9)
            .attr("width", bb.width + 24)
            .attr("height", bb.height + 18)
            .attr("rx", 6);
        }
      });
    }

    const gAxes = gChart.append("g");
    if (!chartStyle.frame) {
      gAxes
        .append("line")
        .attr("class", "jz-axis")
        .attr("x1", cx(-1) - 14)
        .attr("y1", cy(0))
        .attr("x2", cx(1) + 22)
        .attr("y2", cy(0))
        .attr("marker-end", "url(#jz-axis-arrow)");
      gAxes
        .append("line")
        .attr("class", "jz-axis")
        .attr("x1", cx(0))
        .attr("y1", cy(-1) + 14)
        .attr("x2", cx(0))
        .attr("y2", cy(1) - 22)
        .attr("marker-end", "url(#jz-axis-arrow)");
      gAxes
        .append("text")
        .attr("class", "jz-axis-title")
        .attr("x", cx(1) + 28)
        .attr("y", cy(0) + 4)
        .text("Population growth →");
      gAxes
        .append("text")
        .attr("class", "jz-axis-title")
        .attr("x", cx(0))
        .attr("y", cy(1) - 32)
        .attr("text-anchor", "middle")
        .text("Δ nominal wages ↑");
    }

    /* the other US sample cities, v1 peer-style: a shade above the grey
       field but neutral — only the home city carries an accent. They belong
       to the metro-field experiment (labeled context within the field) and
       arrive with the MSA dot (the "your metro area" step is metro-scale) */
    const peerDots = gChart.append("g").attr("opacity", 0);
    (chartStyle.field ? home.peers : []).forEach((m) => {
      const [ux, uy] = metroUnit(m);
      const pr = Math.max(6, dotR(m.size));
      const gp = peerDots
        .append("g")
        .attr("class", "jz-peerdot")
        .attr("transform", `translate(${cx(ux)},${cy(uy)})`);
      gp.append("circle").attr("r", pr);
      /* labels flip to the left near the right rim, so they never leave
         the plot */
      gp.append("text")
        .attr("x", ux > 0.55 ? -pr - 6 : pr + 6)
        .attr("y", 4)
        .attr("text-anchor", ux > 0.55 ? "end" : "start")
        .text(m.name);
    });

    /* ---- accent-dot labels: with REAL positions the dots land wherever
       the data says, so each stack (name + stat rows) tries a few spots
       around its dot and takes the first that clears the quadrant blocks,
       the frame captions, the peer labels, the other stack and the plot
       bounds. Widths are estimated; obstacles carry their own padding, so
       a losing fallback only ever grazes */
    type Rect = { x: number; y: number; w: number; h: number };
    const obstacles: Rect[] = [];
    const addObstacle = (el: SVGGraphicsElement, pad: number) => {
      const b = el.getBBox();
      obstacles.push({
        x: b.x - pad,
        y: b.y - pad,
        w: b.width + pad * 2,
        h: b.height + pad * 2,
      });
    };
    qLabels.each(function () {
      addObstacle(this, 5);
    });
    gChart
      .selectAll<SVGTextElement, unknown>("text.jz-ms-typical")
      .each(function () {
        addObstacle(this, 4);
      });
    peerDots.selectAll<SVGTextElement, unknown>("text").each(function () {
      addObstacle(this, 4);
    });
    const hit = (r: Rect) =>
      obstacles.some(
        (o) =>
          r.x < o.x + o.w &&
          o.x < r.x + r.w &&
          r.y < o.y + o.h &&
          o.y < r.y + r.h,
      );
    const dotText = (
      g: Selection<SVGGElement, unknown, null, undefined>,
      spot: [number, number],
      name: string,
      rows: string[],
      prefer: (
        | "above"
        | "below"
        | "right"
        | "left"
        | "aboveEnd"
        | "belowEnd"
      )[],
    ) => {
      const px = cx(spot[0]);
      const py = cy(spot[1]);
      const w = Math.max(name.length * 9.3, ...rows.map((s) => s.length * 7.5));
      const n = rows.length + 1;
      const CAND = {
        above: { dx: 14, anchor: "start", top: -15 - (n - 1) * 17 },
        below: { dx: 14, anchor: "start", top: 26 },
        right: { dx: 17, anchor: "start", top: -3 - ((n - 1) * 17) / 2 },
        left: { dx: -17, anchor: "end", top: -3 - ((n - 1) * 17) / 2 },
        /* end-anchored variants extend leftward — the escape hatch for
           dots near the right rim (wide placeholder stacks especially) */
        aboveEnd: { dx: -14, anchor: "end", top: -15 - (n - 1) * 17 },
        belowEnd: { dx: -14, anchor: "end", top: 26 },
      } as const;
      const rectOf = (k: keyof typeof CAND): Rect => {
        const c = CAND[k];
        return {
          x: c.anchor === "start" ? px + c.dx : px + c.dx - w,
          y: py + c.top - 13,
          w,
          h: n * 17 + 4,
        };
      };
      const inPlot = (r: Rect) =>
        r.x >= cx(-1) - 30 &&
        r.x + r.w <= cx(1) + 40 &&
        r.y >= cy(1) - 34 &&
        r.y + r.h <= cy(-1) + 30;
      const pick =
        prefer.find((k) => inPlot(rectOf(k)) && !hit(rectOf(k))) ??
        prefer.find((k) => inPlot(rectOf(k))) ??
        prefer[0];
      const c = CAND[pick];
      g.append("text")
        .attr("x", c.dx)
        .attr("y", c.top)
        .attr("text-anchor", c.anchor)
        .text(name);
      rows.forEach((s, i) =>
        g
          .append("text")
          .attr("class", "stats")
          .attr("x", c.dx)
          .attr("y", c.top + (i + 1) * 17)
          .attr("text-anchor", c.anchor)
          .text(s),
      );
      obstacles.push(rectOf(pick));
    };
    const msaDot = gChart
      .append("g")
      .attr("class", "jz-msadot")
      .attr("opacity", 0)
      .attr(
        "transform",
        `translate(${cx(home.msaSpot[0])},${cy(home.msaSpot[1])})`,
      );
    msaDot.append("circle").attr("class", "ring").attr("r", 9);

    const placeDot = gChart
      .append("g")
      .attr("class", "jz-placedot")
      .attr("opacity", 0)
      .attr(
        "transform",
        `translate(${cx(home.placeSpot[0])},${cy(home.placeSpot[1])})`,
      );
    placeDot.append("circle").attr("class", "halo").attr("r", 9);
    placeDot.append("circle").attr("class", "core").attr("r", 8);

    /* the place dot is the subject, so its stack places first. Reduced
       mode keeps the names and drops the stat rows */
    dotText(
      placeDot,
      home.placeSpot,
      cityShort,
      chartStyle.reduced ? [] : home.placeStats,
      ["above", "right", "left", "below", "aboveEnd", "belowEnd"],
    );
    dotText(
      msaDot,
      home.msaSpot,
      `${cityShort} MSA`,
      chartStyle.reduced ? [] : home.msaStats,
      ["right", "below", "above", "left", "belowEnd", "aboveEnd"],
    );

    /* ----- leaf-hover affordance: a small pill riding the cursor over an
       END LEAF — "this path is selectable". Inner nodes get neither tip nor
       pointer cursor: they are hover-to-read only, and clicks on them do
       nothing */
    const gTip = svg.append("g").attr("class", "jz-seltip").attr("opacity", 0);
    const tipText = gTip
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.34em")
      .text("click to select this path");
    const tbb = tipText.node()!.getBBox();
    const tipRect = gTip
      .insert("rect", ":first-child")
      .attr("x", tbb.x - 12)
      .attr("y", tbb.y - 7)
      .attr("width", tbb.width + 24)
      .attr("height", tbb.height + 14)
      .attr("rx", 12);
    /* the pill hugs the pointer (clamped to the stage) instead of the node,
       so it never collides with the badge pills parked under the leaves */
    const tipHalf = tbb.width / 2 + 16;
    moveTip = (e) => {
      const id = e && targetAt(e);
      const n = id ? byId.get(id) : null;
      const sel = selectedRef.current;
      /* an already-selected leaf gets no tip — clicking it would change
         nothing, and its badge marks it anyway. No tip before the path phase
         either: selection is locked until the default path has been shown */
      const show =
        !!n &&
        stepRef.current >= 4 &&
        !!n.parent &&
        !n.children?.length &&
        n.data.id !== sel[sel.length - 1];
      gTip.attr("opacity", show ? 1 : 0);
      capture.style("cursor", show ? "pointer" : "default");
      if (!show || !e || !n) return;
      const [px, py] = pointer(e, svg.node());
      tipRect.attr("fill", TREE_SIDE_COLOR[sideOf(n)]);
      /* the pill rides above the pointer — unless the hovered leaf sits
         roughly above the cursor (area-linked hover reaches well below a
         label), where it would cover the leaf: then it flips underneath,
         provided that keeps it inside the stage */
      const below = py > n.y + TM.top + 8 && py + 46 < treeH;
      gTip.attr(
        "transform",
        `translate(${Math.max(tipHalf, Math.min(W - tipHalf, px))},${below ? py + 32 : py - 26})`,
      );
    };

    scene.current = {
      gChart,
      gTree,
      gAxes,
      quads,
      placeQuadId: home.placeQuad.id,
      msaDot,
      peerDots,
      placeDot,
      nodes,
      links,
      stems,
      chips,
      gChips,
      /* both marking layers (underlay glow + top-layer pills) at once, so
         every opacity transition in the appliers hits them together */
      gHome: svg.selectAll(".jz-homeg"),
      rebuildHome,
    };
    rebuildHome(selectedRef.current);
    applyPicked();

    /* entry: fade the chart in the first time the stage is on screen */
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          applyStepRef.current(stepRef.current, true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(svgRef.current!);

    /* drawn while the tool is display:none (e.g. behind the landing, or a
       font redraw before the tool was ever entered): every getBBox() above
       measured ZERO, which mis-sizes badge pills, hit rects and the fork
       geometry. Redraw once the stage gets real layout. */
    let ro: ResizeObserver | null = null;
    if (!svgRef.current!.getBoundingClientRect().width) {
      ro = new ResizeObserver(() => {
        if (svgRef.current!.getBoundingClientRect().width) {
          ro!.disconnect();
          setFontTick((t) => t + 1);
        }
      });
      ro.observe(svgRef.current!);
    }

    return () => {
      io.disconnect();
      ro?.disconnect();
      clearTimers();
      window.clearTimeout(ptrTimer.current);
      svg.selectAll("*").interrupt();
    };
  }, [cityShort, home, root, byId, fontTick, treeStyle, chartStyle, themesOn]);

  /* step changes animate */
  useEffect(() => {
    applyStepRef.current(step, true);
  }, [step]);
  useEffect(() => {
    applyHoverRef.current(hover);
  }, [hover]);
  /* after the node-hover effect, so entering a chip (which makes the capture
     rect fire its own leave) settles on the theme emphasis, not the node's */
  useEffect(() => {
    applyThemeRef.current(themeHover);
  }, [themeHover]);

  /* ---------- scroll → step ---------- */
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
      /* both rail steps live inside this one track, so the rail's scroll-spy
         is driven from here: whenever the track spans the viewport midline,
         report the step matching the current phase */
      const mid = sTop + sH / 2;
      if (r.top <= mid && r.bottom >= mid)
        onPhaseRef.current(
          s <= 2 ? "page-constraints" : "page-constraints-diagnose",
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

  /* ---------- caption content ---------- */

  const Ph = ({ text }: { text: string }) => (
    <span className="ph">{text.replace(/\{city\}/g, cityShort)}</span>
  );

  const phase: Phase = step <= 2 ? "chart" : "tree";
  /* on the variant-switch render the hover id may name a node of the OTHER
     structure for one frame (the reset effect runs after render) — treat a
     miss as no hover */
  const hoverNode = hover ? (byId.get(hover) ?? null) : null;
  /* the rail caption follows the tree hover, or the branch head while a
     minimap quadrant is hovered */
  const capNode = hoverNode ?? (quadHover ? byId.get(quadHover)! : null);
  const hlSide = hoverNode ? sideOf(hoverNode) : quadHover;
  const selSide =
    selectedPath[0] === "demand" ? ("demand" as const) : ("supply" as const);
  const isDefaultPath = selectedPath.join("/") === suggPath.join("/");

  /* a hovered theme chip takes the rail over: the theme's own question and
     the data views behind it, plus where else the theme is reached from */
  const hoveredTheme = themeHover ? THEMES[themeHover.theme] : null;
  const themeLeafNode = themeHover ? byId.get(themeHover.leaf) : null;

  const caption = hoveredTheme ? (
    <>
      <div className="jz-cap-kickrow">
        <span
          className="fig-kicker"
          style={{
            color: themeLeafNode
              ? TREE_SIDE_COLOR[sideOf(themeLeafNode)]
              : undefined,
          }}
        >
          Evidence · under {themeLeafNode?.data.title}
        </span>
      </div>
      <p className="jz-cap-title">
        <span
          className="jz-node-ico"
          style={{
            color: themeLeafNode
              ? TREE_SIDE_COLOR[sideOf(themeLeafNode)]
              : undefined,
          }}
          aria-hidden="true"
        >
          <NodeGlyph id={hoveredTheme.id} />
        </span>
        {hoveredTheme.title}
      </p>
      <p className="jz-cap-body">
        <Ph text={hoveredTheme.detail} />
      </p>
      <ul className="jz-cap-inds">
        {hoveredTheme.indicators.map((ind) => (
          <li key={ind}>{ind}</li>
        ))}
      </ul>
      {hoveredTheme.seeAlso && (
        <p className="jz-cap-also">
          You saw this in <strong>{hoveredTheme.seeAlso}</strong>.
        </p>
      )}
    </>
  ) : capNode ? (
    <>
      <div className="jz-cap-kickrow">
        <span
          className="fig-kicker"
          style={{ color: TREE_SIDE_COLOR[sideOf(capNode)] }}
        >
          On the tree ·{" "}
          {sideOf(capNode) === "root" ? "the root" : `${sideOf(capNode)} side`}
        </span>
      </div>
      <p className="jz-cap-title">
        <span
          className="jz-node-ico"
          style={{ color: TREE_SIDE_COLOR[sideOf(capNode)] }}
          aria-hidden="true"
        >
          <NodeGlyph id={capNode.data.id} />
        </span>
        {displayTitle(capNode)}
      </p>
      <p className="jz-cap-body">
        {firstSentence(capNode.data.detail)}{" "}
        {capNode.data.tests ? (
          <em className="jz-cap-tests">
            Test it: {firstSentence(capNode.data.tests)}
          </em>
        ) : (
          <Ph text="[tests: ___ ]" />
        )}
      </p>
    </>
  ) : (
    <>
      <div className="jz-cap-kickrow">
        <span className="fig-kicker">
          <span className="jz-kick-ico" aria-hidden="true">
            {STEP_ICONS[step]}
          </span>
          {step === 4 && !isDefaultPath
            ? "Where you are"
            : STEP_COPY[step].kicker}
        </span>
        <span className="jz-dots">
          {STEP_COPY.map((_, i) => (
            <i key={i} className={i === step ? "on" : i < step ? "done" : ""} />
          ))}
        </span>
      </div>
      {step === 4 && (
        <div className="fig-trail">
          {["root", ...selectedPath].map((id, i) => {
            const n = byId.get(id)!;
            return (
              <Fragment key={id}>
                {i > 0 && <span className="crumb-sep">›</span>}
                <span style={{ color: TREE_SIDE_COLOR[sideOf(n)] }}>
                  {displayTitle(n)}
                </span>
              </Fragment>
            );
          })}
        </div>
      )}
      <p className="jz-cap-body">
        {step === 4 && !isDefaultPath ? (
          <Ph
            text={`[your pick — the data-driven default remains ${byId.get(suggPath[suggPath.length - 1])!.data.title.toLowerCase()}; ___ tests for this node]`}
          />
        ) : STEP_COPY[step].body.startsWith("[") ? (
          <Ph text={STEP_COPY[step].body} />
        ) : (
          STEP_COPY[step].body
        )}
      </p>
      {/* the reasoning behind the lit path: one line per fork, each naming
          the comparison and the numbers that turned it. Only on the alt
          structure — the forks are defined against its two levels */}
      {step === 4 && isDefaultPath && variant === "alt" && dx.derived && (
        <ol className="jz-forks">
          {dx.steps.map((s, i) => (
            <li key={i}>
              <span className="jz-fork-n">{i + 1}</span>
              {s.reason}
            </li>
          ))}
        </ol>
      )}
    </>
  );

  return (
    <div className="jz-scrolly" ref={trackRef}>
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
            {/* The section's top-level choice, deliberately NOT among the
                style pills opposite: each mode is a different proposal for
                how the diagnostic is structured, and the themed one may end
                up shaping how the whole app is navigated. It sits under the
                heading, in the reading column, at the weight that decision
                deserves. */}
            <div
              className={"jz-modes" + (phase === "tree" ? " show" : "")}
              aria-hidden={phase !== "tree"}
            >
              <span className="jz-modes-k">Structure</span>
              <div className="jz-seg" role="group" aria-label="Tree structure">
                {TREE_MODES.map((m) => (
                  <button
                    key={m.id}
                    className={"jz-segbtn" + (mode === m.id ? " on" : "")}
                    aria-pressed={mode === m.id}
                    title={m.about}
                    onClick={() => onModeChange(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="jz-modes-hint">
                {TREE_MODES.find((m) => m.id === mode)?.hint}
              </span>
            </div>
          </div>
          {/* the styling experiments live in the section header, top-right:
              the chart cluster during the chart phase, the tree cluster
              during the tree phase, cross-fading in one grid cell */}
          <div className="jz-varsbox">
            <div
              className={"jz-vars" + (phase === "chart" ? " show" : "")}
              aria-hidden={phase !== "chart"}
            >
              <span className="jz-vars-k">Chart style</span>
              {CHART_STYLE_TOGGLES.map(([key, label]) => (
                <button
                  key={key}
                  className={"jz-var" + (chartStyle[key] ? " on" : "")}
                  aria-pressed={chartStyle[key]}
                  onClick={() =>
                    setChartStyle((v) => ({ ...v, [key]: !v[key] }))
                  }
                >
                  {label}
                </button>
              ))}
              {/* label placement is one-of: the pills act as a radio, both
                  off = the default outer-corner blocks */}
              {CHART_LABEL_TOGGLES.map(([key, label]) => (
                <button
                  key={key}
                  className={
                    "jz-var" + (chartStyle.labels === key ? " on" : "")
                  }
                  aria-pressed={chartStyle.labels === key}
                  onClick={() =>
                    setChartStyle((v) => ({
                      ...v,
                      labels: v.labels === key ? "corner" : key,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className={"jz-vars" + (phase === "tree" ? " show" : "")}
              aria-hidden={phase !== "tree"}
            >
              <span className="jz-vars-k">Tree style</span>
              {TREE_STYLE_TOGGLES.map(([key, label]) => (
                <button
                  key={key}
                  className={"jz-var" + (treeStyle[key] ? " on" : "")}
                  aria-pressed={treeStyle[key]}
                  onClick={() =>
                    setTreeStyle((v) => ({ ...v, [key]: !v[key] }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="jz-body">
          <div className="jz-stagewrap">
            <svg
              ref={svgRef}
              className="jz-svg"
              viewBox={fullVB}
              role="img"
              aria-label="Step-driven transition from the labor-market quadrant chart to the diagnostic decision tree"
            />
          </div>

          <aside className="jz-rail">
            <MiniMap
              visible={step >= 3}
              hlSide={hlSide}
              cityShort={cityShort}
              home={home}
              onSideHover={setQuadHover}
            />
            <div className="jz-railtext">{caption}</div>
            {/* the branch picked on the tree names + feeds the next step.
                Held back until the path phase — it names the default branch,
                which step 3 hasn't revealed yet */}
            <div
              className={"jz-next" + (step >= 4 ? " show" : "")}
              aria-hidden={step < 4}
            >
              <span className="jz-next-k">Up next</span>
              <span
                className="jz-next-name"
                style={{ color: TREE_SIDE_COLOR[selSide] }}
              >
                {branchSectionName(selSide)} →
              </span>
              <span className="ph">[click a node to switch your branch]</span>
            </div>
          </aside>
        </div>
      </div>

      {/* invisible anchors so the rail's two steps still track and navigate */}
      <section id="page-constraints" className="jz-anchor jz-anchor-top" />
      <section
        id="page-constraints-diagnose"
        className="jz-anchor jz-anchor-bottom"
      />
    </div>
  );
}
