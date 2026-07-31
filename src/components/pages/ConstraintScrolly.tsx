import { useEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { easeCubicInOut } from "d3-ease";
import { stratify, tree as d3tree, type HierarchyNode } from "d3-hierarchy";
import {
  QUADRANTS,
  TREE_NODES,
  TREE_SIDE_COLOR,
  type QuadrantDef,
  type TreeNodeData,
  type TreeSide,
} from "../../data/figures";
import { wrapText } from "../../lib/wrapText";

/* The two City Constraints pages merged into one scroll-driven sequence: a
   sticky stage holds both scenes — the quadrant chart ("Where is your
   constraint?") and the decision tree ("How we diagnose the constraint") —
   and scrolling scrubs the transition between them. Every frame is a pure
   function of scroll progress, so scrolling back rewinds the animation.
   Invisible anchor sections keep the rail's two steps working. */

const W = 1180;
const H = 640;

/* scene A: the chart square, centred on the stage */
const CQ = { cx: W / 2, cy: 316, r: 270 };

/* scene B: the tidy tree */
const TM = { left: 60, top: 36 };
const T_W = 1060;
const T_H = 516;
const LABEL_W = 176;
const ROOT_LABEL_W = 520;
const BUS_DROP = 26;

/* dock variant: where the minimap lands and how small it gets */
const DOCK = { k: 0.22, x: 6, y: 2 };

/* camera + spotlight variants */
const CAM_SCALE = 1.85;
const SPOT_RADIUS = 150;
const SPOT_BOOST = 1.1;

type Node = HierarchyNode<TreeNodeData> & { x: number; y: number };
type Variant = "dock" | "fold" | "dot" | "camera" | "spot";
type Phase = "chart" | "tree";

const VARIANTS: { id: Variant; label: string; hint: string }[] = [
  { id: "dock", label: "Dock & trace", hint: "The chart tucks into a corner; the tree traces the path." },
  { id: "fold", label: "Quadrants fold", hint: "The quadrants fold into the branch each one argues for." },
  { id: "dot", label: "Follow the dot", hint: "Your city's dot walks off the chart and down the tree." },
  { id: "camera", label: "Camera walk", hint: "The camera dives into your quadrant, walks the path close-up, then pulls back to the full tree." },
  { id: "spot", label: "Spotlight", hint: "The full tree never leaves the screen; a reading lens enlarges each step as it passes." },
];

/** where the heading/card flip from chart-talk to tree-talk, per variant */
const PHASE_SPLIT: Record<Variant, number> = {
  dock: 0.38,
  fold: 0.44,
  dot: 0.3,
  camera: 0.18,
  spot: 0.18,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** which side of the tree a node hangs off — depth-1 ancestor decides */
function sideOf(n: HierarchyNode<TreeNodeData>): TreeSide {
  const top = n.ancestors().find((a) => a.depth === 1);
  return top ? (top.data.id as TreeSide) : "root";
}

function displayTitle(n: Node) {
  return n.depth === 0 ? "The growth question" : n.data.title;
}

export function ConstraintScrolly({ cityShort }: { cityShort: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const scene = useRef<any>(null);
  const renderRef = useRef<(p: number) => void>(() => {});
  const pRef = useRef(0);

  const [variant, setVariant] = useState<Variant>("dock");
  const [phase, setPhase] = useState<Phase>("chart");
  const [quad, setQuad] = useState<QuadrantDef["id"]>("q1");
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const quadRef = useRef(quad);
  quadRef.current = quad;

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

  const qDef = QUADRANTS.find((q) => q.id === quad)!;

  /* ---------- build both scenes, then define the scrubbed frame ---------- */
  useEffect(() => {
    const svg = select(svgRef.current!);
    svg.selectAll("*").remove();

    const cx = (v: number) => CQ.cx + v * CQ.r;
    const cy = (v: number) => CQ.cy - v * CQ.r;

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
        .append("path")
        .attr("d", "M0 0 L10 5 L0 10 z")
        .attr("fill", TREE_SIDE_COLOR[side]);
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
      .append("path")
      .attr("d", "M0 0 L10 5 L0 10 z")
      .attr("fill", "var(--teal)");

    /* ----- scene B: the tree ----- */
    const gTree = svg
      .append("g")
      .attr("opacity", 0)
      .style("pointer-events", "none");
    const plot = gTree.append("g").attr("transform", `translate(${TM.left},${TM.top})`);
    /* the spotlight lens sits under everything else in the tree */
    const halo = plot
      .append("circle")
      .attr("class", "jz-halo")
      .attr("r", SPOT_RADIUS)
      .attr("opacity", 0);
    const gLinks = plot.append("g");
    const gNodes = plot.append("g");

    const tnodes = root.descendants() as Node[];
    const nodes = gNodes
      .selectAll<SVGGElement, Node>("g.tree-node")
      .data(tnodes, (d) => d.data.id)
      .join("g")
      .attr("class", (d) => `tree-node side-${sideOf(d)}${d.depth <= 1 ? " lead" : ""} dim`)
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

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

    const bounds = new Map<string, { top: number; bottom: number }>();
    nodes.each(function (d) {
      const text = select(this).select<SVGTextElement>("text.tree-label");
      const lines = text.node()!.childElementCount || 1;
      const shift = -((lines - 1) * 1.25) / 2;
      text.attr("dy", `${shift + 0.32}em`);
      const first = text.node()!.firstElementChild as SVGTSpanElement | null;
      if (first) first.setAttribute("dy", `${shift + 0.32}em`);
      const bb = text.node()!.getBBox();
      bounds.set(d.data.id, { top: bb.y - 6, bottom: bb.y + bb.height + 6 });
    });

    const parents = tnodes.filter((d) => d.children?.length) as Node[];
    const busY = new Map<string, number>();
    parents.forEach((p) => {
      const y0 = p.y + (bounds.get(p.data.id)?.bottom ?? 0);
      const topmostChild = Math.min(
        ...p.children!.map((c) => (c as Node).y + (bounds.get(c.data.id)?.top ?? 0)),
      );
      busY.set(p.data.id, Math.min(y0 + BUS_DROP, topmostChild - 10));
    });

    const stems = gLinks
      .selectAll<SVGPathElement, Node>("path.tree-stem")
      .data(parents, (d) => d.data.id)
      .join("path")
      .attr("class", "tree-stem dim")
      .attr("stroke", (d) => TREE_SIDE_COLOR[sideOf(d)])
      .attr("d", (d) => {
        const y0 = d.y + (bounds.get(d.data.id)?.bottom ?? 0);
        return `M${d.x},${y0} V${busY.get(d.data.id)}`;
      });

    const links = gLinks
      .selectAll<SVGPathElement, Node>("path.tree-link")
      .data(tnodes.filter((d) => d.parent) as Node[], (d) => d.data.id)
      .join("path")
      .attr("class", "tree-link dim")
      .attr("stroke", (d) => TREE_SIDE_COLOR[sideOf(d)])
      .attr("marker-end", (d) => `url(#jz-arrow-${sideOf(d)})`)
      .attr("d", (d) => {
        const p = d.parent as Node;
        const y1 = d.y + (bounds.get(d.data.id)?.top ?? 0) - 4;
        return `M${p.x},${busY.get(p.data.id)} H${d.x} V${y1}`;
      });

    const linkLen = new Map<string, number>();
    links.each(function (d) {
      linkLen.set(d.data.id, (this as SVGPathElement).getTotalLength());
    });

    const pos = new Map<string, { x: number; y: number }>();
    tnodes.forEach((d) => pos.set(d.data.id, { x: d.x + TM.left, y: d.y + TM.top }));

    /* ----- scene A: the quadrant chart, on top ----- */
    const gChart = svg.append("g").attr("class", "jz-chart");

    const quads = gChart
      .selectAll<SVGGElement, QuadrantDef>("g.jz-quad")
      .data(QUADRANTS)
      .join("g")
      .attr("class", "jz-quad")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => d.shock)
      .on("click", (_e, d) => clickQuadRef.current(d.id))
      .on("keydown", (e: KeyboardEvent, d) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          clickQuadRef.current(d.id);
        }
      });

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
      .attr("y", (d) => cy(d.dy * 0.5) - 16)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
      .text((d) => d.shock);
    quads
      .append("text")
      .attr("class", "jz-sub")
      .attr("x", (d) => cx(d.dx * 0.5))
      .attr("y", (d) => cy(d.dy * 0.5) + 8)
      .attr("text-anchor", "middle")
      .text((d) => d.sub);
    quads
      .append("text")
      .attr("class", "jz-tag")
      .attr("x", (d) => cx(d.dx * 0.5))
      .attr("y", (d) => cy(d.dy * 0.5) + 31)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => TREE_SIDE_COLOR[d.side])
      .text((d) => `→ ${d.side === "demand" ? "labor demand" : "labor supply"} branch`);

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

    /* the city dot: rides inside the chart for dock/fold/camera/spot, walks
       the stage on its own layer for the dot variant */
    const q1 = QUADRANTS[0];
    const dot = (variant === "dot" ? svg : gChart)
      .append("g")
      .attr("class", "jz-dot")
      .attr("transform", `translate(${cx(q1.spot[0])},${cy(q1.spot[1])})`);
    dot.append("circle").attr("class", "halo").attr("r", 9);
    dot.append("circle").attr("class", "core").attr("r", 8);
    dot.append("text").attr("x", 15).attr("y", 5).text(cityShort);

    scene.current = {
      gChart,
      gTree,
      gAxes,
      quads,
      dot,
      halo,
      nodes,
      links,
      stems,
      pos,
      linkLen,
      cx,
      cy,
    };

    /* ----- the scrubbed frame: everything is a function of p ----- */
    renderRef.current = (p: number) => {
      const sc = scene.current;
      if (!sc) return;
      const q = QUADRANTS.find((x) => x.id === quadRef.current)!;
      const ids = q.path;
      const n = ids.length;
      const stops = [
        sc.pos.get("root")!,
        ...ids.map((id: string) => sc.pos.get(id)!),
      ] as { x: number; y: number }[];

      let chartT = "translate(0,0) scale(1)";
      let chartO = 1;
      let axesO = 1;
      let dotO = 1;
      let treeO = 0;
      let treeT = "translate(0,0) scale(1)";
      let chartPE = true;
      let dotPos = { x: sc.cx(q.spot[0]), y: sc.cy(q.spot[1]) };
      let pulse = false;
      let quadFrame: ((d: QuadrantDef, el: SVGGElement) => void) | null = null;
      let focus: { x: number; y: number } | null = null;
      let focusBoost = 0;
      let haloO = 0;
      let linkProg: (j: number) => number = () => 0;
      let rootLit = false;

      if (variant === "dock") {
        const t = easeCubicInOut(seg(p, 0.02, 0.32));
        const ox = CQ.cx - CQ.r - 66;
        const oy = CQ.cy - CQ.r - 30;
        const k = lerp(1, DOCK.k, t);
        chartT = `translate(${lerp(ox, DOCK.x, t) - k * ox},${lerp(oy, DOCK.y, t) - k * oy}) scale(${k})`;
        treeO = seg(p, 0.22, 0.42);
        const dr = seg(p, 0.4, 0.96);
        linkProg = (j) => clamp01(dr * n - j);
        rootLit = dr > 0.02;
      } else if (variant === "fold") {
        axesO = 1 - seg(p, 0.02, 0.18);
        dotO = axesO;
        /* the tree surfaces first, so the panels land on visible branches */
        const t = easeCubicInOut(seg(p, 0.08, 0.5));
        quadFrame = (d, el) => {
          const c = { x: sc.cx(d.dx * 0.5), y: sc.cy(d.dy * 0.5) };
          const target = sc.pos.get(d.side)!;
          const k = lerp(1, 0.1, t);
          const tx = lerp(c.x, target.x, t) - k * c.x;
          const ty = lerp(c.y, target.y - 34, t) - k * c.y;
          const o = d.id === q.id ? 1 - seg(p, 0.5, 0.6) : 1 - seg(p, 0.38, 0.5);
          select(el).attr("transform", `translate(${tx},${ty}) scale(${k})`).attr("opacity", o);
        };
        chartPE = p < 0.15;
        treeO = seg(p, 0.12, 0.32);
        const dr = seg(p, 0.55, 0.96);
        linkProg = (j) => clamp01(dr * n - j);
        rootLit = dr > 0.02;
      } else if (variant === "dot") {
        chartO = 1 - seg(p, 0.03, 0.22);
        chartPE = chartO > 0.3;
        treeO = seg(p, 0.1, 0.3);
        const walk = [
          dotPos,
          { x: stops[0].x, y: stops[0].y - 28 },
          ...stops.slice(1).map((s) => ({ x: s.x, y: s.y - 26 })),
        ];
        const legs = walk.length - 1;
        const f = seg(p, 0.12, 0.9) * legs;
        const i = Math.min(Math.floor(f), legs - 1);
        const local = easeCubicInOut(clamp01(f - i));
        dotPos = {
          x: lerp(walk[i].x, walk[i + 1].x, local),
          y: lerp(walk[i].y, walk[i + 1].y, local),
        };
        pulse = f >= legs - 0.001;
        linkProg = (j) => clamp01(f - (j + 1));
        rootLit = f >= 1;
      } else if (variant === "camera") {
        /* dive into the chosen quadrant, walk the path zoomed-in, pull back */
        const qc = { x: sc.cx(q.dx * 0.5), y: sc.cy(q.dy * 0.5) };
        const zi = easeCubicInOut(seg(p, 0.04, 0.18));
        const s0 = lerp(1, 2.4, zi);
        chartT = `translate(${qc.x - s0 * qc.x},${qc.y - s0 * qc.y}) scale(${s0})`;
        chartO = 1 - seg(p, 0.1, 0.2);
        chartPE = p < 0.08;
        treeO = seg(p, 0.12, 0.22);
        const m = stops.length - 1;
        const f = seg(p, 0.2, 0.72) * m;
        const i = Math.min(Math.floor(f), m - 1);
        const local = easeCubicInOut(clamp01(f - i));
        let center = {
          x: lerp(stops[i].x, stops[i + 1].x, local),
          y: lerp(stops[i].y, stops[i + 1].y, local),
        };
        let s = CAM_SCALE;
        const pb = easeCubicInOut(seg(p, 0.76, 0.96));
        if (pb > 0) {
          center = { x: lerp(center.x, W / 2, pb), y: lerp(center.y, H / 2, pb) };
          s = lerp(CAM_SCALE, 1, pb);
        }
        treeT = `translate(${W / 2 - s * center.x},${H / 2 - s * center.y}) scale(${s})`;
        linkProg = (j) => clamp01(f - j);
        rootLit = p > 0.19;
      } else {
        /* spotlight: the whole tree stays on screen; a lens walks the path */
        chartO = 1 - seg(p, 0.04, 0.18);
        chartPE = chartO > 0.3;
        treeO = seg(p, 0.08, 0.2);
        const m = stops.length - 1;
        const f = seg(p, 0.2, 0.88) * m;
        const i = Math.min(Math.floor(f), m - 1);
        const local = easeCubicInOut(clamp01(f - i));
        focus = {
          x: lerp(stops[i].x, stops[i + 1].x, local),
          y: lerp(stops[i].y, stops[i + 1].y, local),
        };
        const settle = easeCubicInOut(seg(p, 0.9, 1));
        focusBoost = SPOT_BOOST * (1 - settle);
        haloO = treeO * (1 - settle) * 0.9;
        linkProg = (j) => clamp01(f - j);
        rootLit = p > 0.19;
      }

      /* ---- apply the frame ---- */
      sc.gChart
        .attr("transform", chartT)
        .attr("opacity", chartO)
        .style("pointer-events", chartPE ? null : "none");
      sc.gAxes.attr("opacity", axesO);
      sc.gTree.attr("transform", treeT).attr("opacity", treeO);

      sc.quads.each(function (this: SVGGElement, d: QuadrantDef) {
        if (quadFrame) quadFrame(d, this);
        else select(this).attr("transform", "translate(0,0) scale(1)").attr("opacity", 1);
      });
      sc.quads.classed("sel", (d: QuadrantDef) => d.id === quadRef.current);

      sc.dot
        .attr("transform", `translate(${dotPos.x},${dotPos.y})`)
        .attr("opacity", variant === "fold" ? dotO : 1)
        .classed("pulse", pulse);

      sc.halo
        .attr("cx", focus ? focus.x - TM.left : -500)
        .attr("cy", focus ? focus.y - TM.top : -500)
        .attr("fill", TREE_SIDE_COLOR[q.side])
        .attr("opacity", haloO);

      sc.links.each(function (this: SVGPathElement, d: Node) {
        const j = ids.indexOf(d.data.id);
        const el = select(this);
        if (j < 0) {
          el.classed("lit", false)
            .classed("dim", true)
            .attr("stroke-dasharray", null)
            .attr("stroke-dashoffset", null)
            .attr("marker-end", `url(#jz-arrow-${sideOf(d)})`);
          return;
        }
        const lp = linkProg(j);
        const len = sc.linkLen.get(d.data.id)!;
        el.classed("lit", lp > 0)
          .classed("dim", false)
          .attr("stroke-dasharray", `${len} ${len}`)
          .attr("stroke-dashoffset", len * (1 - lp))
          .attr("marker-end", lp >= 0.98 ? `url(#jz-arrow-${sideOf(d)})` : null);
      });

      sc.stems.each(function (this: SVGPathElement, d: Node) {
        const childOnPath = (d.children ?? []).find((c) => ids.includes(c.data.id));
        const j = childOnPath ? ids.indexOf(childOnPath.data.id) : -1;
        const lit = j >= 0 && linkProg(j) > 0;
        select(this).classed("lit", lit).classed("dim", !lit);
      });

      sc.nodes.each(function (this: SVGGElement, d: Node) {
        const j = ids.indexOf(d.data.id);
        const lit = d.data.id === "root" ? rootLit : j >= 0 && linkProg(j) >= 0.97;
        let transform = `translate(${d.x},${d.y})`;
        if (focus && focusBoost > 0) {
          const pt = sc.pos.get(d.data.id)!;
          const dist = Math.hypot(pt.x - focus.x, pt.y - focus.y);
          const k = 1 + focusBoost * Math.exp(-((dist / SPOT_RADIUS) ** 2));
          if (k > 1.005) transform += ` scale(${k})`;
        }
        select(this).classed("lit", lit).classed("dim", !lit).attr("transform", transform);
      });
    };

    renderRef.current(pRef.current);

    return () => {
      svg.selectAll("*").interrupt();
    };
  }, [variant, cityShort, root, byId]);

  /* quadrant click: switches the what-if, re-renders the current frame */
  const clickQuadRef = useRef<(id: QuadrantDef["id"]) => void>(() => {});
  clickQuadRef.current = (id) => {
    if (id === quadRef.current) return;
    setQuad(id);
    quadRef.current = id;
    renderRef.current(pRef.current);
  };

  /* ---------- scroll scrubbing ---------- */
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
      pRef.current = p;
      renderRef.current(p);
      setPhase(p < PHASE_SPLIT[variantRef.current] ? "chart" : "tree");
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

  const switchVariant = (v: Variant) => {
    setVariant(v);
    setPhase(pRef.current < PHASE_SPLIT[v] ? "chart" : "tree");
  };

  const Ph = ({ text }: { text: string }) => (
    <span className="ph">{text.replace(/\{city\}/g, cityShort)}</span>
  );

  const trail = ["root", ...qDef.path].map((id) => byId.get(id)!);
  const leaf = trail[trail.length - 1];

  return (
    <div className="jz-scrolly" ref={trackRef}>
      <div className="jz-sticky">
        <div className="jz-head">
          <div className="jz-titles">
            <span className="eyebrow">City Constraints</span>
            <div className="jz-h2s">
              <h2 className={phase === "chart" ? "on" : ""}>Where is your constraint?</h2>
              <h2 className={phase === "tree" ? "on" : ""}>How we diagnose the constraint</h2>
            </div>
          </div>
          <div className="jz-modes-col">
            <div className="fig-modes" role="tablist" aria-label="Transition prototypes">
              {VARIANTS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={variant === v.id}
                  className={variant === v.id ? "on" : ""}
                  onClick={() => switchVariant(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <span className="fig-mode-hint">
              Scroll: {VARIANTS.find((v) => v.id === variant)!.hint}
            </span>
          </div>
        </div>

        <div className="jz-stagewrap">
          <svg
            ref={svgRef}
            className="jz-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Scroll-driven transition from the labor-market quadrant chart to the diagnostic decision tree"
          />
        </div>

        <div className="fig-detail shown jz-card">
          <div className="jz-cardrow">
            <span className="fig-kicker">
              {phase === "chart"
                ? quad === "q1"
                  ? `Where ${cityShort} lands`
                  : "What-if scenario"
                : `Default path · ${qDef.shock.toLowerCase()}`}
            </span>
            <div className="fig-trail">
              {trail.map((n, i) => (
                <span key={n.data.id}>
                  {i > 0 && <b>›</b>}
                  <span style={{ color: TREE_SIDE_COLOR[sideOf(n)] }}>{displayTitle(n)}</span>
                </span>
              ))}
            </div>
          </div>
          <p className="fig-detail-body">
            {phase === "chart" ? (
              <Ph text={qDef.note} />
            ) : (
              <Ph
                text={`[what to verify at each step before accepting the ${leaf.data.title.toLowerCase()} diagnosis — ___ tests, ___ data]`}
              />
            )}
            <span className="jz-hint">
              {phase === "chart"
                ? " Click a quadrant for a what-if · scroll to trace ↓"
                : " Scroll back up to return to the chart ↑"}
            </span>
          </p>
        </div>
      </div>

      {/* invisible anchors so the rail's two steps still track and navigate */}
      <section id="page-constraints" className="jz-anchor jz-anchor-top" />
      <section id="page-constraints-diagnose" className="jz-anchor jz-anchor-bottom" />
    </div>
  );
}
