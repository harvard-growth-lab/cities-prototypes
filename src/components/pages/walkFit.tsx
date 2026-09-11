/** The two pieces the walk's small-stage modes need on screen: a readout of
 *  how hard the stage is squeezing the tree, and the minimap that gives back
 *  the context "follow the path" zooms away from.
 *
 *  Both are deliberately dumb — they take geometry and draw it. What the
 *  frame should be at a given beat is walkShapes' job (wholeBox / rootBox /
 *  branchBox / fitTransform); what mode is on is the section's. */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { TREE_SIDE_COLOR, sideHollow, type TreeSide } from "../../data/figures";
import {
  headRowH,
  headRowY,
  landingX,
  landingY,
  shapeBand,
  shapeExtent,
  type WalkShape,
} from "./walkShapes";
import { sideGeometry } from "./walkVariants";

/* the stage the tree is authored against */
const W = 1180;
const H = 640;

/** The smallest type on the tree, at the size it will actually RENDER: the
 *  stage is a fixed viewBox scaled to whatever width it gets, so every font
 *  size on it is multiplied by that scale. Below this the leaf labels stop
 *  being readable and a whole-tree fit is the wrong answer — which makes
 *  this floor the line the section's responsiveness keys on: a resize that
 *  crosses it wakes the small-stage switch and swaps the remembered answer
 *  onto the stage (see ConstraintNarrative). */
export const LEGIBLE_PX = 11;

/** watch the stage and report the scale its viewBox is being drawn at */
export function useStageScale(ref: RefObject<SVGSVGElement | null>) {
  const [scale, setScale] = useState(1);
  const seen = useRef(1);
  /* a LAYOUT effect: the first paint already decides whether the stage is
     tight, and measuring after paint would flash the whole tree for a frame
     before the responsive answer lands */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (!w) return;
      const k = w / W;
      /* a threshold, not a continuous read — re-rendering the whole stage on
         every pixel of a drag would cost more than it tells anyone */
      if (Math.abs(k - seen.current) > 0.02) {
        seen.current = k;
        setScale(k);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

/** How much taller the stage is than its viewBox needs at the width it has:
 *  the headroom a chart-phase zoom can spend without leaving the stage. The
 *  zoom is a transform on the whole svg, so on a height-bound stage (the
 *  narrow layouts, where the rail sits under it) any zoom at all runs into
 *  the head above and the rail below — there the headroom is exactly 1. */
export function useStageHeadroom(ref: RefObject<SVGSVGElement | null>) {
  const [room, setRoom] = useState(1);
  const seen = useRef(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      /* a ratio, so the chart-phase transform already on the element
         cancels out of it */
      const { width: w, height: h } = el.getBoundingClientRect();
      if (!w || !h) return;
      const k = Math.max(1, h / ((w * H) / W));
      if (Math.abs(k - seen.current) > 0.02) {
        seen.current = k;
        setRoom(k);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return room;
}

/** a media query, live: the section's narrow layout is a CSS breakpoint, and
 *  the stage geometry that layout implies has to follow the same line */
export function useMediaQuery(query: string) {
  const [on, setOn] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useLayoutEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return on;
}

/** Where the rail's instrument sits over the stage, in px: how far in from
 *  the stage's left edge its right edge reaches, and how far up from the
 *  stage's bottom its top does. Both zero while it is off (display: none)
 *  or docked beside the stage rather than over it. Measured against the
 *  stage's WRAPPER, which the chart-phase zoom transform never touches. */
export function useChartOverlap(
  stageRef: RefObject<SVGSVGElement | null>,
  chartRef: RefObject<HTMLDivElement | null>,
): [number, number] {
  const [v, setV] = useState<[number, number]>([0, 0]);
  const seen = useRef<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    const stage = stageRef.current?.parentElement;
    const chart = chartRef.current;
    if (!stage || !chart) return;
    const measure = () => {
      const s = stage.getBoundingClientRect();
      const c = chart.getBoundingClientRect();
      const strip = c.width ? Math.max(0, c.right - s.left) : 0;
      const overlap = c.width ? Math.max(0, s.bottom - c.top) : 0;
      if (
        Math.abs(strip - seen.current[0]) > 1 ||
        Math.abs(overlap - seen.current[1]) > 1
      ) {
        seen.current = [strip, overlap];
        setV([strip, overlap]);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(chart);
    return () => ro.disconnect();
  }, [stageRef, chartRef]);
  return v;
}

/** how small the smallest label on this shape's tree is actually rendering,
 *  and whether that is past the point where fitting the whole tree works */
export function StageFit({
  scale,
  smallest,
  onPick,
}: {
  scale: number;
  /** the shape's smallest authored font size */
  smallest: number;
  /** offered when the whole-tree fit is on despite the squeeze — absent
   *  once a small-stage answer is already on stage, where the button would
   *  be selling the reader what they have */
  onPick?: () => void;
}) {
  const px = smallest * scale;
  const tight = px < LEGIBLE_PX;
  return (
    <div className={"nv-fitread" + (tight ? " tight" : "")}>
      {tight && onPick && (
        <button className="nv-fitread-go" onClick={onPick}>
          zoom instead
        </button>
      )}
    </div>
  );
}

/** The whole tree at a glance: one dot per card, the elbows between them, the
 *  walked route lit, and a frame showing what the stage is currently looking
 *  at. This is what makes zooming acceptable — the reader never loses the map
 *  of where they are in the diagnostic, which is the tree's other job. */
/** a box in stage/tree coords → the minimap's own units (x, y, w, h),
 *  clipped to the map — so the camera rides can draw what they see */
export type MiniFrameMap = (
  box: [number, number, number, number],
) => [number, number, number, number];

export function BranchMinimap({
  shape,
  route,
  frame,
  show,
  orientation = "vertical",
  live = false,
  liveFrameRef,
  mapRef,
}: {
  shape: WalkShape;
  /** the walked descent — its branch, and its leaf where there is one */
  route: string[];
  /** the focus frame in tree coords, or null while the whole tree is framed */
  frame: [number, number, number, number] | null;
  show: boolean;
  orientation?: "vertical" | "sideways";
  /** a camera ride is looking at the tree: the frame is then drawn by the
   *  ride itself, every animation frame, through `liveFrameRef` and the
   *  mapping handed back on `mapRef` */
  live?: boolean;
  liveFrameRef?: RefObject<SVGRectElement | null>;
  mapRef?: RefObject<MiniFrameMap | null>;
}) {
  const [bx0, bx1] = shapeBand(shape);
  const [by0, by1] = shapeExtent(shape);
  const pad = 6;
  const S = 168;
  const k = Math.min((S - pad * 2) / (bx1 - bx0), (96 - pad * 2) / (by1 - by0));
  const mx = (x: number) => pad + (x - bx0) * k;
  const my = (y: number) => pad + (y - by0) * k;
  const on = new Set(route);
  const headY = headRowY(shape) + headRowH(shape) / 2;
  const forks2 = shape.branches.some((b) => b.leaves.length > 0);

  const sideMap = (() => {
    const n = Math.max(1, shape.branches.length);
    const top = 14;
    const bottom = 82;
    const step = n > 1 ? (bottom - top) / (n - 1) : 0;
    const root: [number, number] = [22, 48];
    const headX = forks2 ? 86 : 122;
    const leafX = 146;
    const rowY = (i: number) => top + i * step;
    const headByBranch = new Map<string, [number, number]>();
    const leafById = new Map<string, [number, number]>();
    shape.branches.forEach((b, bi) => {
      const y = rowY(bi);
      headByBranch.set(b.id, [headX, y]);
      if (!forks2 || b.leaves.length === 0) return;
      const spread = Math.min(11, 4 + b.leaves.length * 1.2);
      const lstep =
        b.leaves.length > 1 ? (spread * 2) / (b.leaves.length - 1) : 0;
      b.leaves.forEach((l, li) => {
        leafById.set(l.id, [leafX, y - spread + li * lstep]);
      });
    });
    return { root, headByBranch, leafById };
  })();

  /* stage → map. The vertical map is the tree to scale; the sideways one
     is a schematic, so its map runs piecewise through the landmarks the
     schematic keeps — root, head column, leaf column, and the row spread. */
  const toMini: MiniFrameMap = (box) => {
    let x0: number, y0: number, x1: number, y1: number;
    if (orientation === "sideways") {
      const g = sideGeometry(shape, forks2);
      const headMx = forks2 ? 86 : 122;
      const sx = (x: number) => {
        const k1 = (headMx - sideMap.root[0]) / Math.max(1, g.headX - g.rootX);
        const k2 = forks2
          ? (146 - headMx) / Math.max(1, g.leafX - g.headX)
          : k1;
        return x <= g.headX
          ? sideMap.root[0] + (x - g.rootX) * k1
          : headMx + (x - g.headX) * k2;
      };
      const ky = g.half > 0 ? 34 / g.half : 0.1;
      const sy = (y: number) => 48 + (y - g.cy) * ky;
      [x0, y0, x1, y1] = [sx(box[0]), sy(box[1]), sx(box[2]), sy(box[3])];
    } else {
      [x0, y0, x1, y1] = [mx(box[0]), my(box[1]), mx(box[2]), my(box[3])];
    }
    const cx0 = Math.max(0, Math.min(S, x0));
    const cy0 = Math.max(0, Math.min(96, y0));
    const cx1 = Math.max(0, Math.min(S, x1));
    const cy1 = Math.max(0, Math.min(96, y1));
    return [cx0, cy0, Math.max(0, cx1 - cx0), Math.max(0, cy1 - cy0)];
  };
  if (mapRef) mapRef.current = toMini;
  const frameBox = frame ? toMini(frame) : null;

  return (
    <div className={"nv-mini" + (show ? " show" : "")} aria-hidden={!show}>
      <svg viewBox={`0 0 ${S} 96`}>
        {orientation === "sideways"
          ? shape.branches.map((b) => {
              const lit = on.has(b.id);
              const c = TREE_SIDE_COLOR[b.id];
              const neg = sideHollow(b.id);
              const at = sideMap.headByBranch.get(b.id) ?? [86, 48];
              return (
                <g key={b.id} opacity={lit ? 1 : 0.32}>
                  <path
                    d={`M${sideMap.root[0]},${sideMap.root[1]} H44 V${at[1]} H${at[0]}`}
                    fill="none"
                    stroke={c}
                    strokeWidth={lit ? 1.6 : 1}
                    strokeDasharray={neg ? "3 2.2" : undefined}
                  />
                  <circle
                    cx={at[0]}
                    cy={at[1]}
                    r={lit ? 3.4 : 2.4}
                    fill={neg ? "#fff" : c}
                    stroke={c}
                    strokeWidth={neg ? 1.4 : 0}
                  />
                  {b.leaves.map((l) => {
                    const lp = sideMap.leafById.get(l.id) ?? [146, at[1]];
                    return (
                      <g key={l.id}>
                        <path
                          d={`M${at[0]},${at[1]} H132 V${lp[1]} H${lp[0]}`}
                          fill="none"
                          stroke={c}
                          strokeWidth={on.has(l.id) ? 1.6 : 0.8}
                          opacity={on.has(l.id) ? 1 : 0.6}
                        />
                        <circle
                          cx={lp[0]}
                          cy={lp[1]}
                          r={on.has(l.id) ? 3.4 : 2}
                          fill={c}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })
          : shape.branches.map((b) => {
              const lit = on.has(b.id);
              const c = TREE_SIDE_COLOR[b.id];
              /* a negative shock's branch is broken here too — the pattern
             shrinks with the map, and its head dot draws hollow */
              const neg = sideHollow(b.id);
              return (
                <g key={b.id} opacity={lit ? 1 : 0.32}>
                  <path
                    d={`M${mx(shape.rootX)},${my(28)} V${my(60)} H${mx(b.x)} V${my(headY)}`}
                    fill="none"
                    stroke={c}
                    strokeWidth={lit ? 1.6 : 1}
                    strokeDasharray={neg ? "3 2.2" : undefined}
                  />
                  <circle
                    cx={mx(b.x)}
                    cy={my(headY)}
                    r={lit ? 3.4 : 2.4}
                    fill={neg ? "#fff" : c}
                    stroke={c}
                    strokeWidth={neg ? 1.4 : 0}
                  />
                  {b.leaves.map((l) => (
                    <g key={l.id}>
                      <path
                        d={`M${mx(b.x)},${my(headY)} V${my(landingY(shape) - 26)} H${mx(l.x)} V${my(landingY(shape))}`}
                        fill="none"
                        stroke={c}
                        strokeWidth={on.has(l.id) ? 1.6 : 0.8}
                        opacity={on.has(l.id) ? 1 : 0.6}
                      />
                      <circle
                        cx={mx(l.x)}
                        cy={my(landingY(shape))}
                        r={on.has(l.id) ? 3.4 : 2}
                        fill={c}
                      />
                    </g>
                  ))}
                </g>
              );
            })}
        {/* the root */}
        <circle
          cx={orientation === "sideways" ? sideMap.root[0] : mx(shape.rootX)}
          cy={orientation === "sideways" ? sideMap.root[1] : my(28)}
          r={3}
          fill="#1a2226"
        />
        {/* where the city ended up */}
        {route.length > 0 && (
          <circle
            className="nv-mini-you"
            cx={
              orientation === "sideways"
                ? ((route.length > 1
                    ? sideMap.leafById.get(route[route.length - 1])
                    : sideMap.headByBranch.get(route[0]))?.[0] ??
                  sideMap.root[0])
                : mx(landingX(shape, route))
            }
            cy={
              orientation === "sideways"
                ? ((route.length > 1
                    ? sideMap.leafById.get(route[route.length - 1])
                    : sideMap.headByBranch.get(route[0]))?.[1] ??
                  sideMap.root[1])
                : my(landingY(shape))
            }
            r={5.5}
            fill="none"
            stroke={TREE_SIDE_COLOR[route[0] as TreeSide] ?? "#1a2226"}
          />
        )}
        {/* what the stage is looking at: the focus frame, or — on a ride —
            whatever the camera shows, written by the ride each frame */}
        {frameBox && (
          <rect
            className="nv-mini-frame"
            x={frameBox[0]}
            y={frameBox[1]}
            width={frameBox[2]}
            height={frameBox[3]}
            rx={3}
          />
        )}
        {live && !frameBox && (
          <rect ref={liveFrameRef} className="nv-mini-frame" rx={3} />
        )}
      </svg>
    </div>
  );
}

/** Reports whether `ref`'s element is on screen inside the tool's scroller
 *  (`.pages`): true while any of it shows inside the root (shrunk by
 *  `rootMargin`, if given), false once it has left. The first reading
 *  arrives on mount. The callback is read through a ref, so a new function
 *  each render does not re-arm the observer. Used by the walks to say when
 *  their pinned stage — the tree — has scrolled away, which is what lets
 *  the analysis's schematic float up. */
export function useInScroller(
  ref: RefObject<Element | null>,
  onChange: ((inView: boolean) => void) | undefined,
  rootMargin?: string,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => cb.current?.(e.isIntersecting)),
      { root: el.closest(".pages"), rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
}

/** When the walk's stage counts as gone: not at its last pixel — the tree is
 *  drawn above the stage's foot, so by the time the box has fully left the
 *  reader has been looking at the analysis for a while — but once only its
 *  bottom quarter is still in the scroller, which is about when the leaf row
 *  goes. One number to tune; the analysis's schematic floats up when the
 *  stage has crossed it, and drops the moment it comes back. */
export const STAGE_GONE_MARGIN = "-25% 0px 0px 0px";
