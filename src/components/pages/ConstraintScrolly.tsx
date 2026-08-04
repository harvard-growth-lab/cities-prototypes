import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { pointer, select } from "d3-selection";
import { Delaunay } from "d3-delaunay";
import "d3-transition";
import { easeCubicInOut, easeCubicOut, easeSinInOut } from "d3-ease";
import { stratify, tree as d3tree, type HierarchyNode } from "d3-hierarchy";
import {
  PLACE_QUAD,
  QUADRANTS,
  TREE_NODES,
  TREE_SIDE_COLOR,
  type QuadrantDef,
  type TreeNodeData,
  type TreeSide,
} from "../../data/figures";
import { branchSectionName } from "../../data/content";
import { wrapText } from "../../lib/wrapText";

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
   rest. */

const W = 1180;
const H = 640;

/* scene A: the chart square, centred on the stage */
const CQ = { cx: W / 2, cy: 316, r: 268 };

/* scene B: the tidy tree */
const TM = { left: 60, top: 36 };
const T_W = 1060;
const T_H = 516;
const LABEL_W = 215;
const ROOT_LABEL_W = 620;

const STEPS = 5;

/* where the big chart flies when it docks (toward the rail minimap) */
const DOCK = { x: W - 44, y: 140 };

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

/* the two dots: sample values match the indicator tables in content.ts */
const MSA_SPOT: [number, number] = [0.38, 0.82];
const PLACE_SPOT: [number, number] = [-0.72, 0.82];
const MSA_STATS = "+0.4%/yr pop · +4.5%/yr wages";
const PLACE_STATS = "−0.8%/yr pop · +5.8%/yr wages";

/** tree side → the minimap quadrants it corresponds to */
const SIDE_QUADS: Record<TreeSide, QuadrantDef["id"][]> = {
  root: [],
  demand: ["q2", "q3"],
  supply: ["q1", "q4"],
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
    body: "[step 5: highlight suggested path based on the data. allow user to click an END leaf to pick a different path for the next section — inner nodes are hover-to-read only, so every pick is a full route.]",
  },
];

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
  onSideHover,
}: {
  visible: boolean;
  hlSide: TreeSide | null;
  cityShort: string;
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
                (q.id === PLACE_QUAD.id ? " place" : "")
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
          cx={mx(MSA_SPOT[0])}
          cy={my(MSA_SPOT[1])}
          r={7}
        />
        <text
          className="jz-mini-dotlabel"
          x={mx(MSA_SPOT[0]) + 11}
          y={my(MSA_SPOT[1]) + 4}
        >
          {cityShort} MSA
        </text>
        <circle
          className="jz-mini-place"
          cx={mx(PLACE_SPOT[0])}
          cy={my(PLACE_SPOT[1])}
          r={7}
        />
        <text
          className="jz-mini-dotlabel"
          x={mx(PLACE_SPOT[0]) + 11}
          y={my(PLACE_SPOT[1]) + 4}
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
  selectedPath,
  onSelectPath,
  onPhaseInView,
}: {
  cityShort: string;
  /** the descent picked for the next section (ids below the root) */
  selectedPath: string[];
  onSelectPath: (path: string[]) => void;
  /** reports which of the two rail steps the track is on (scroll-spy) */
  onPhaseInView: (pageId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onPhaseRef = useRef(onPhaseInView);
  onPhaseRef.current = onPhaseInView;
  const svgRef = useRef<SVGSVGElement>(null);
  const scene = useRef<any>(null);
  const timers = useRef<number[]>([]);

  const [step, setStep] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
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

  const root = useMemo(() => {
    const built = stratify<TreeNodeData>()
      .id((d) => d.id)
      .parentId((d) => d.parent)(TREE_NODES);
    return d3tree<TreeNodeData>()
      .size([T_W, T_H])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.35))(built);
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Node>();
    root.descendants().forEach((d) => m.set(d.data.id, d as Node));
    return m;
  }, [root]);

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
    T(sc.placeDot).attr("opacity", s >= 2 ? 1 : 0);
    sc.placeDot.classed("pulse", s === 2);
    sc.quads.classed(
      "sel",
      (d: QuadrantDef) => s >= 2 && d.id === PLACE_QUAD.id,
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
    const keep = new Set(["root", ...ids, ...PLACE_QUAD.path]);
    const setDims = () => {
      sc.nodes.classed("dim", (d: Node) => !keep.has(d.data.id));
      sc.stems.classed("dim", (d: Node) => !keep.has(d.data.id));
      sc.links
        .classed(
          "dim",
          (d: Node) =>
            !ids.includes(d.data.id) && !PLACE_QUAD.path.includes(d.data.id),
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
    const hovered = byId.get(id)!;
    const onPath = new Set(hovered.ancestors().map((a) => a.data.id));
    colorRootStem(hovered.depth === 0 ? null : sideOf(hovered));
    /* while another path is hovered, the user's pick AND the data-driven
       suggestion keep their markings and only fall back to idle, not dim */
    const home =
      stepRef.current >= 4
        ? new Set(["root", ...selectedRef.current, ...PLACE_QUAD.path])
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
     navigate to, so a partial path can never be committed */
  const selectedRef = useRef(selectedPath);
  selectedRef.current = selectedPath;
  const clickRef = useRef<(id: string) => void>(() => {});
  clickRef.current = (id) => {
    if (stepRef.current < 3) return;
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
    nodes.each(function (d) {
      const text = select(this).select<SVGTextElement>("text.tree-label");
      const lines = text.node()!.childElementCount || 1;
      const shift = -((lines - 1) * 1.25) / 2;
      text.attr("dy", `${shift + 0.32}em`);
      const first = text.node()!.firstElementChild as SVGTSpanElement | null;
      if (first) first.setAttribute("dy", `${shift + 0.32}em`);
      const bb = text.node()!.getBBox();
      select(this)
        .select("rect.tree-hit")
        .attr("x", bb.x - 10)
        .attr("y", bb.y - 7)
        .attr("width", bb.width + 20)
        .attr("height", bb.height + 14);
      /* generous vertical padding: stems and arrows keep their distance from
         the label text (the hit rect above stays tighter than this) */
      bounds.set(d.data.id, {
        top: bb.y - 13,
        bottom: bb.y + bb.height + 13,
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
      busY.set(
        p.data.id,
        Math.max(y0 + 12, Math.min((y0 + topmostChild) / 2, topmostChild - 12)),
      );
    });

    const stems = gLinks
      .selectAll<SVGPathElement, Node>("path.tree-stem")
      .data(parents, (d) => d.data.id)
      .join("path")
      .attr("class", "tree-stem")
      .attr("stroke", (d) => TREE_SIDE_COLOR[sideOf(d)])
      .attr("d", (d) => {
        const y0 = d.y + (bounds.get(d.data.id)?.bottom ?? 0);
        return `M${d.x},${y0} V${busY.get(d.data.id)}`;
      });

    const links = gLinks
      .selectAll<SVGPathElement, Node>("path.tree-link")
      .data(tnodes.filter((d) => d.parent) as Node[], (d) => d.data.id)
      .join("path")
      .attr("class", "tree-link")
      .attr("stroke", (d) => TREE_SIDE_COLOR[sideOf(d)])
      .attr("marker-end", (d) => `url(#jz-arrow-${sideOf(d)})`)
      .attr("d", (d) => {
        const p = d.parent as Node;
        const y1 = d.y + (bounds.get(d.data.id)?.top ?? 0) - 4;
        return `M${p.x},${busY.get(p.data.id)} H${d.x} V${y1}`;
      });

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
      .attr("height", H)
      .on("pointermove", (e: PointerEvent) => {
        hoverRef.current(targetAt(e));
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
    const gBadges = plot.append("g").attr("class", "jz-homeg").attr("opacity", 0);
    const rebuildHome = (path: string[]) => {
      gHome.selectAll("*").remove();
      gBadges.selectAll("*").remove();
      /* a badge pill, only under LEAF nodes: a mid-node pick is already
         marked by its dashed outline and lit route, and a side-mounted pill
         collides with same-row labels or the stage edge */
      const mkBadge = (id: string, color: string, label: string, drop = 0) => {
        const n = byId.get(id)!;
        if (n.children?.length) return n;
        const b = bounds.get(n.data.id)!;
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
        badge.attr("transform", `translate(${n.x},${n.y + b.bottom + 24 + drop})`);
        return n;
      };

      /* the data-driven suggestion ALWAYS keeps its glow + badge, so the
         original read stays visible while the user picks another path */
      const suggColor = TREE_SIDE_COLOR[PLACE_QUAD.side];
      (
        tnodes.filter(
          (d) => d.parent && PLACE_QUAD.path.includes(d.data.id),
        ) as Node[]
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
          .attr("d", `M${p.x},${y0} V${busY.get(p.data.id)} H${d.x} V${y1}`);
      });
      const sugg = mkBadge(
        PLACE_QUAD.path[PLACE_QUAD.path.length - 1],
        suggColor,
        "where we think you are",
      );

      /* a differing pick gets its own badge — its route is the lit one on
         the stage. When both badges sit below same-row leaves, the pick's
         drops a step so the pills never collide */
      if (path.join("/") !== PLACE_QUAD.path.join("/")) {
        const pickColor = TREE_SIDE_COLOR[(path[0] as TreeSide) ?? "supply"];
        const pn = byId.get(path[path.length - 1])!;
        const collide =
          !pn.children?.length &&
          !sugg.children?.length &&
          Math.abs(pn.y - sugg.y) < 10 &&
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

    const quads = gChart
      .selectAll<SVGGElement, QuadrantDef>("g.jz-quad")
      .data(QUADRANTS)
      .join("g")
      .attr("class", "jz-quad");

    quads
      .append("rect")
      .attr("x", (d) => (d.dx === 1 ? cx(0) + 8 : cx(-1)))
      .attr("y", (d) => (d.dy === 1 ? cy(1) : cy(0) + 8))
      .attr("width", CQ.r - 8)
      .attr("height", CQ.r - 8)
      .attr("rx", 14)
      .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
      .attr("stroke", (d) => TREE_SIDE_COLOR[d.side]);

    quads
      .append("text")
      .attr("class", "jz-shock")
      .attr("x", (d) => cx(d.dx * 0.5))
      .attr("y", (d) => cy(d.dy * 0.5) - 14)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
      .text((d) => d.shock);
    quads
      .append("text")
      .attr("class", "jz-sub")
      .attr("x", (d) => cx(d.dx * 0.5))
      .attr("y", (d) => cy(d.dy * 0.5) + 10)
      .attr("text-anchor", "middle")
      .text((d) => d.sub);
    quads
      .append("text")
      .attr("class", "jz-tag")
      .attr("x", (d) => cx(d.dx * 0.5))
      .attr("y", (d) => cy(d.dy * 0.5) + 33)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
      .text(
        (d) =>
          `→ ${d.side === "demand" ? "labor demand" : "labor supply"} branch`,
      );

    const gAxes = gChart.append("g");
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

    /* the MSA ring and the place dot (children of the chart, so they dock
       and fade with it) */
    const msaDot = gChart
      .append("g")
      .attr("class", "jz-msadot")
      .attr("opacity", 0)
      .attr("transform", `translate(${cx(MSA_SPOT[0])},${cy(MSA_SPOT[1])})`);
    msaDot.append("circle").attr("class", "ring").attr("r", 9);
    msaDot.append("text").attr("x", 16).attr("y", -2).text(`${cityShort} MSA`);
    msaDot
      .append("text")
      .attr("class", "stats")
      .attr("x", 16)
      .attr("y", 16)
      .text(MSA_STATS);

    const placeDot = gChart
      .append("g")
      .attr("class", "jz-placedot")
      .attr("opacity", 0)
      .attr(
        "transform",
        `translate(${cx(PLACE_SPOT[0])},${cy(PLACE_SPOT[1])})`,
      );
    placeDot.append("circle").attr("class", "halo").attr("r", 9);
    placeDot.append("circle").attr("class", "core").attr("r", 8);
    placeDot.append("text").attr("x", 16).attr("y", -2).text(cityShort);
    placeDot
      .append("text")
      .attr("class", "stats")
      .attr("x", 16)
      .attr("y", 16)
      .text(PLACE_STATS);

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
         nothing, and its badge marks it anyway */
      const show =
        !!n &&
        stepRef.current >= 3 &&
        !!n.parent &&
        !n.children?.length &&
        n.data.id !== sel[sel.length - 1];
      gTip.attr("opacity", show ? 1 : 0);
      capture.style("cursor", show ? "pointer" : "default");
      if (!show || !e || !n) return;
      const [px, py] = pointer(e, svg.node());
      tipRect.attr("fill", TREE_SIDE_COLOR[sideOf(n)]);
      gTip.attr(
        "transform",
        `translate(${Math.max(tipHalf, Math.min(W - tipHalf, px))},${py - 26})`,
      );
    };

    scene.current = {
      gChart,
      gTree,
      gAxes,
      quads,
      msaDot,
      placeDot,
      nodes,
      links,
      stems,
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
  }, [cityShort, root, byId, fontTick]);

  /* step changes animate */
  useEffect(() => {
    applyStepRef.current(step, true);
  }, [step]);
  useEffect(() => {
    applyHoverRef.current(hover);
  }, [hover]);

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
  const hoverNode = hover ? byId.get(hover)! : null;
  /* the rail caption follows the tree hover, or the branch head while a
     minimap quadrant is hovered */
  const capNode = hoverNode ?? (quadHover ? byId.get(quadHover)! : null);
  const hlSide = hoverNode ? sideOf(hoverNode) : quadHover;
  const selSide =
    selectedPath[0] === "demand" ? ("demand" as const) : ("supply" as const);
  const isDefaultPath = selectedPath.join("/") === PLACE_QUAD.path.join("/");

  const caption = capNode ? (
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
      <p className="jz-cap-title">{displayTitle(capNode)}</p>
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
          <Ph text="[your pick — the data-driven default remains housing; ___ tests for this node]" />
        ) : STEP_COPY[step].body.startsWith("[") ? (
          <Ph text={STEP_COPY[step].body} />
        ) : (
          STEP_COPY[step].body
        )}
      </p>
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
          </div>
        </div>

        <div className="jz-body">
          <div className="jz-stagewrap">
            <svg
              ref={svgRef}
              className="jz-svg"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Step-driven transition from the labor-market quadrant chart to the diagnostic decision tree"
            />
          </div>

          <aside className="jz-rail">
            <MiniMap
              visible={step >= 3}
              hlSide={hlSide}
              cityShort={cityShort}
              onSideHover={setQuadHover}
            />
            <div className="jz-railtext">{caption}</div>
            {/* the branch picked on the tree names + feeds the next step */}
            <div
              className={"jz-next" + (step >= 3 ? " show" : "")}
              aria-hidden={step < 3}
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
