import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DATA_LEVEL_LABEL,
  PLACEHOLDER_BRANCHES,
  QUAD_BRANCH_SPEC,
  TREE_SIDE_COLOR,
  pathModules,
  quadName,
  quadShock,
  sideDash,
  sideOfPath,
  suggestedPath,
  type BranchSide,
  type ModuleDef,
} from "../../data/figures";
import {
  DEFAULT_WALK_SHAPE,
  LEAF_BUS,
  LEAF_ROW,
  ROOT_BUS,
  ROOT_ROW,
  headRowH,
  headRowY,
  headX,
  walkShape,
  type WalkShape,
} from "./walkShapes";
import { NodeGlyph } from "./treeIcons";
import { QuadGlyph, QuadMetrics } from "./quadIcons";
import { EndingAnalysis } from "./BranchAnalysisPage";

/* ---------- the sandbox ----------
   The walk above tells ONE route and the analysis under it reads ONE ending.
   That is the right shape for a guided read and the wrong shape for the
   question every reader asks at the end of one: what about the others?

   So this is not another step in the flow — it is a room off it. It reads
   as a panel dropped onto the page rather than page content (its own ground,
   its own frame, its own label), nothing in it advances the narrative, and
   leaving it untouched costs the reader nothing. Inside, the tree's ENDINGS
   are live: every leaf — and a head that is its own ending — is a target
   that opens its modules, each of which opens to its data points. The root
   and the forks above are drawn but not clickable: the tree is a map of
   endings, not a menu of levels, and a pick is always a whole route.

   The one thing that never moves is the data's own read. Wherever the reader
   wanders, the diagnosed route keeps its halo and its chip, the legend names
   it, and a button walks back to it — so exploring can never be mistaken for
   being re-diagnosed.

   An ending's full analysis opens in here too — under the tree, in the
   panel — rather than re-pointing the analysis section above and sending
   the reader back up to it. That round trip made the page double back on
   itself: the room off the flow was steering the flow. Now nothing the
   reader does in here reaches the section above at all. And once the
   analysis is open it follows the tree: clicking another ending swaps the
   read below along with the modules beside the tree, so the block under
   the tree is always the ending the reader last chose. */

const PAD = 26;
/** the row under the endings that the pick's pill hangs in */
const PICK_ROW = 12;
/** the zoom range: fitted-to-frame at 1, and close enough at the top end to
 *  read a leaf card's own label without the frame losing its parent */
const K_MIN = 0.6;
const K_MAX = 3.2;
/** a drag past this many pixels is a pan, and the click that ends it is not
 *  a pick — otherwise every pan that ends on a card re-picks the card */
const DRAG_PX = 4;

interface View {
  k: number;
  x: number;
  y: number;
}
const FIT: View = { k: 1, x: 0, y: 0 };

/** the drawing's own box, from the shape rather than from constants — a
 *  shape swap moves the cards and the frame follows */
function treeBox(sh: WalkShape): [number, number, number, number] {
  const xs: number[] = [sh.rootX - sh.rootW / 2, sh.rootX + sh.rootW / 2];
  for (const b of sh.branches) {
    xs.push(b.x - sh.headW / 2, b.x + sh.headW / 2);
    for (const l of b.leaves) xs.push(l.x - l.w / 2, l.x + l.w / 2);
  }
  const hasLeaf = sh.branches.some((b) => b.leaves.length);
  return [
    Math.min(...xs) - PAD,
    ROOT_ROW.y - ROOT_ROW.h / 2 - PAD,
    Math.max(...xs) + PAD,
    /* the row under the endings holds the pick's pill, so the fit keeps
       room for it */
    (hasLeaf ? LEAF_ROW.y + sh.leafH / 2 : headRowY(sh) + headRowH(sh) / 2) +
      PAD +
      PICK_ROW,
  ];
}

const elbow = (x1: number, y1: number, bus: number, x2: number, y2: number) =>
  `M${x1},${y1} V${bus} H${x2} V${y2}`;

/** the ending's own label: the leaf card's, or the head's city type */
const endingLabel = (sh: WalkShape, path: string[]): string => {
  const [side, leaf] = path;
  if (!leaf) return quadName(side) ?? side;
  return (
    sh.branches
      .flatMap((b) => b.leaves)
      .find((l) => l.id === leaf)
      ?.lines.join(" ") ?? leaf
  );
};

export function TreeSandboxPage({
  cityShort,
  onInView,
}: {
  cityShort: string;
  /** the analysis section's schematic floats over the viewport, and this
   *  panel is what it would land on — so the sandbox says when it is up and
   *  the float gets out of the way */
  onInView?: (v: boolean) => void;
}) {
  const secRef = useRef<HTMLElement>(null);
  const inViewRef = useRef(onInView);
  inViewRef.current = onInView;
  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    /* "up" once the panel's top is a quarter of the way up the scroller,
       not the moment its first pixel shows — the float should linger over
       the analysis's tail rather than vanish at the first sign of the
       panel, and a quarter is a short fade's worth of overlap */
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => inViewRef.current?.(e.isIntersecting)),
      {
        root: el.closest(".pages"),
        rootMargin: "0px 0px -25% 0px",
        threshold: 0,
      },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      inViewRef.current?.(false);
    };
  }, []);

  const sh = walkShape(DEFAULT_WALK_SHAPE);
  const box = useMemo(() => treeBox(sh), [sh]);
  const [bx0, by0, bx1, by1] = box;
  const W = bx1 - bx0;
  const H = by1 - by0;
  const cx = bx0 + W / 2;
  const cy = by0 + H / 2;

  /* the route the data argues for, on the tree this draws — the one thing
     in here that does not move when the reader does */
  const suggPath = useMemo(
    () => suggestedPath(cityShort, sh.variant),
    [cityShort, sh.variant],
  );
  const suggSide = sideOfPath(suggPath) as BranchSide;
  const suggKey = suggPath.join("/");

  /* the ending the reader is looking at — a leaf, or a head with no leaves
     under it — always a whole route, never a level of the tree. Opens ON
     the diagnosis, so the sandbox shows the same answer the section above
     just gave rather than an empty state — and a city switch re-diagnoses,
     so it re-seeds. */
  const [pick, setPick] = useState<string[]>(suggPath);
  useEffect(() => {
    setPick(suggKey.split("/"));
  }, [suggKey]);
  const pickSide = sideOfPath(pick);
  const pickKey = pick.join("/");
  /* off the diagnosed route — which is when the pick earns its own pill */
  const wandered = pickKey !== suggKey;
  const color = TREE_SIDE_COLOR[pickSide];

  /* the module the reader has opened to its data points — one at a time,
     and a new pick closes it */
  const [openMod, setOpenMod] = useState<string | null>(null);
  useEffect(() => setOpenMod(null), [pickKey]);
  const modules = useMemo(() => pathModules(pick), [pick]);
  const spec = QUAD_BRANCH_SPEC[pickSide];

  /* whether the ending's full analysis is open under the tree. The block is
     a disclosure — the read panel's button opens and shuts it — but WHAT it
     shows is never its own state: it reads the pick, so a click on the tree
     swaps the analysis below along with the modules beside it, and the two
     can never drift. A city switch shuts it, the way it re-seeds the pick. */
  const [readOpen, setReadOpen] = useState(false);
  useEffect(() => setReadOpen(false), [suggKey]);
  const readPath = readOpen ? pick : null;
  const readSide = readOpen ? pickSide : undefined;
  /* the block names its own ending — the tree may be a screen up by the
     time the reader is down here */
  const readLabel = readOpen
    ? (quadName(pickSide) ?? pickSide) +
      (pick.length === 2 ? ` › ${endingLabel(sh, pick)}` : "")
    : "";
  const readRef = useRef<HTMLDivElement>(null);
  /* bring the block into view when the button OPENS it — it renders on the
     tick the button sets it, and this runs after that commit. "nearest"
     rather than "start": a short block slides up under the tree, a long one
     takes the top of the frame, and a block already in view stays put. A
     tree click that swaps the open block does NOT scroll: the reader is up
     on the tree, and the page must not pull away from under them. */
  useEffect(() => {
    if (!readOpen) return;
    readRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [readOpen]);

  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<View>(FIT);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
    null,
  );
  const swallow = useRef(false);
  /* the card under the pointer when it went down. The pick happens on
     pointerUP, not on click: the svg captures the pointer for panning, and a
     captured pointer's click is delivered to the capturing element — the
     svg — never to the card. So the cards carry no click handler at all;
     they say which path they are, and the svg resolves the press. */
  const pressed = useRef<string | null>(null);

  /* the frame may pan, but never off the tree: whichever is narrower — the
     frame or the scaled drawing — must keep a third of itself over the
     other, so there is always something to grab */
  const clampView = useCallback(
    (v: View): View => {
      const lim = (span: number) =>
        (span * (v.k + 1)) / 2 - Math.min(span, span * v.k) * 0.35;
      return {
        k: v.k,
        x: Math.max(-lim(W), Math.min(lim(W), v.x)),
        y: Math.max(-lim(H), Math.min(lim(H), v.y)),
      };
    },
    [W, H],
  );

  const zoomBy = useCallback(
    (mul: number) =>
      setView((v) => {
        const k = Math.min(K_MAX, Math.max(K_MIN, v.k * mul));
        /* zoom about the frame's centre, so the button and the wheel agree
           on what "in" means */
        return clampView({ k, x: v.x * (k / v.k), y: v.y * (k / v.k) });
      }),
    [clampView],
  );

  /* the wheel listener is attached by hand, NOT through onWheel: React
     registers wheel at the root as passive, where preventDefault is a no-op
     — so the zoom would work and take the page's scroll with it */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      /* the pointer is the anchor: what is under the cursor stays under it */
      const px = ((e.clientX - r.left) / r.width) * W + bx0;
      const py = ((e.clientY - r.top) / r.height) * H + by0;
      setView((v) => {
        const k = Math.min(
          K_MAX,
          Math.max(K_MIN, v.k * Math.exp(-e.deltaY * 0.0016)),
        );
        return clampView({
          k,
          x: v.x + (px - cx - v.x) * (1 - k / v.k),
          y: v.y + (py - cy - v.y) * (1 - k / v.k),
        });
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [W, H, bx0, by0, cx, cy, clampView]);

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    /* without this a drag across the panel selects its heading and copy —
       the pointer is a pan handle in here, not a text cursor */
    e.preventDefault();
    swallow.current = false;
    pressed.current =
      (e.target as Element).closest<SVGGElement>(".ts-node")?.dataset.path ??
      null;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_PX)
      swallow.current = true;
    const r = svg.getBoundingClientRect();
    setView((v) =>
      clampView({
        ...v,
        x: d.vx + ((e.clientX - d.x) / r.width) * W,
        y: d.vy + ((e.clientY - d.y) / r.height) * H,
      }),
    );
  };
  const onUp = () => {
    drag.current = null;
    const path = pressed.current;
    pressed.current = null;
    if (path != null && !swallow.current) choose(JSON.parse(path));
  };

  /** an ending was chosen — by pointer or by keyboard. Only endings carry a
   *  path, so a press on the root or a fork resolves to nothing here. */
  const choose = (path: string[]) => {
    if (swallow.current) return;
    if (!path.length || PLACEHOLDER_BRANCHES.has(path[0])) return;
    setPick(path);
  };
  /** the keyboard's click */
  const onKey = (path: string[]) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      swallow.current = false;
      choose(path);
    }
  };

  /** on the route being looked at */
  const onPick = (id: string) => pick.includes(id);
  /** on the route the data argues for */
  const onSugg = (id: string) => suggPath.includes(id);
  /** a card off the picked route recedes — unless the pointer is on it */
  const recedes = (id: string) => !onPick(id) && hover !== id;

  const HEAD_Y = headRowY(sh);
  const HEAD_H = headRowH(sh);
  const HEAD_TOP = HEAD_Y - HEAD_H / 2;
  const HEAD_BOT = HEAD_Y + HEAD_H / 2;
  const LEAF_TOP = LEAF_ROW.y - sh.leafH / 2;
  const suggEnd = suggPath[suggPath.length - 1];
  const suggLeafX = sh.branches
    .flatMap((b) => b.leaves)
    .find((l) => l.id === suggEnd)?.x;

  /** the foot of a long analysis: the tree is a screen or two up by then */
  const backToTree = () =>
    secRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section className="page ts-page" id="page-tree-sandbox" ref={secRef}>
      <div className="ts-panel">
        <div className="ts-head">
          <div className="ts-head-l">
            <span className="ts-badge">Sandbox</span>
            <h2>Explore the rest of the tree</h2>
            <p className="ts-sub">
              <span className="ph">
                [explore other branches of the growth diagnostic tree]
              </span>
            </p>
          </div>
          <div className="ts-tools">
            <button
              type="button"
              className="ts-tool"
              onClick={() => zoomBy(1 / 1.3)}
              title="Zoom out"
              aria-label="Zoom out"
            >
              –
            </button>
            <span className="ts-zoomval">{Math.round(view.k * 100)}%</span>
            <button
              type="button"
              className="ts-tool"
              onClick={() => zoomBy(1.3)}
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="ts-tool wide"
              onClick={() => setView(FIT)}
            >
              Fit
            </button>
          </div>
        </div>

        <div className="ts-body">
          <div className="ts-stage">
            <svg
              ref={svgRef}
              className="ts-svg"
              viewBox={`${bx0} ${by0} ${W} ${H}`}
              role="group"
              aria-label={`The whole diagnostic tree. ${quadName(suggSide) ?? suggSide} is the branch your data argues for; every ending is a button.`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <g
                transform={`translate(${cx + view.x} ${cy + view.y}) scale(${view.k}) translate(${-cx} ${-cy})`}
              >
                {/* the diagnosed route's halo, under everything: it is a
                    property of the tree, not of what the reader clicked */}
                <path
                  className="ts-halo"
                  stroke={TREE_SIDE_COLOR[suggSide]}
                  d={elbow(
                    sh.rootX,
                    ROOT_ROW.y + ROOT_ROW.h / 2,
                    ROOT_BUS,
                    headX(sh, suggSide),
                    HEAD_TOP,
                  )}
                />
                {suggLeafX != null && (
                  <path
                    className="ts-halo"
                    stroke={TREE_SIDE_COLOR[suggSide]}
                    d={elbow(
                      headX(sh, suggSide),
                      HEAD_BOT,
                      LEAF_BUS,
                      suggLeafX,
                      LEAF_TOP,
                    )}
                  />
                )}

                {/* root → heads */}
                {sh.branches.map((b) => (
                  <path
                    key={`e-${b.id}`}
                    className={
                      "ts-edge" +
                      (onPick(b.id) ? " on" : "") +
                      (hover === b.id ? " hov" : "")
                    }
                    stroke={TREE_SIDE_COLOR[b.id]}
                    strokeDasharray={sideDash(b.id) ?? undefined}
                    d={elbow(
                      sh.rootX,
                      ROOT_ROW.y + ROOT_ROW.h / 2,
                      ROOT_BUS,
                      b.x,
                      HEAD_TOP,
                    )}
                  />
                ))}
                {/* head → leaves */}
                {sh.branches.flatMap((b) =>
                  b.leaves.map((l) => (
                    <path
                      key={`le-${l.id}`}
                      className={
                        "ts-edge" +
                        (onPick(l.id) ? " on" : "") +
                        (hover === l.id ? " hov" : "")
                      }
                      stroke={TREE_SIDE_COLOR[b.id]}
                      strokeDasharray={sideDash(b.id) ?? undefined}
                      d={elbow(b.x, HEAD_BOT, LEAF_BUS, l.x, LEAF_TOP)}
                    />
                  )),
                )}

                {/* the root: drawn, not clickable — where every route
                    starts, not a place to go */}
                <g className="ts-still ts-root">
                  <rect
                    className="ts-card"
                    x={sh.rootX - sh.rootW / 2}
                    y={ROOT_ROW.y - ROOT_ROW.h / 2}
                    width={sh.rootW}
                    height={ROOT_ROW.h}
                    rx={6}
                  />
                  <text
                    className="ts-roottext"
                    x={sh.rootX}
                    y={ROOT_ROW.y + 5}
                    textAnchor="middle"
                  >
                    {sh.rootQuestion}
                  </text>
                </g>

                {/* the heads — a fork each, drawn but not clickable, except
                    where the branch carries no leaves and the head is its
                    own ending */}
                {sh.branches.map((b) => {
                  const lit = onPick(b.id);
                  const ending = b.leaves.length === 0;
                  return (
                    <g
                      key={`h-${b.id}`}
                      className={
                        (ending ? "ts-node" : "ts-still") +
                        (lit ? " on" : "") +
                        (recedes(b.id) ? " dim" : "")
                      }
                      role={ending ? "button" : undefined}
                      tabIndex={ending ? 0 : undefined}
                      aria-pressed={ending ? lit : undefined}
                      aria-label={
                        ending
                          ? `${b.title}: ${quadShock(b.id) ?? ""}`
                          : undefined
                      }
                      data-path={ending ? JSON.stringify([b.id]) : undefined}
                      onKeyDown={ending ? onKey([b.id]) : undefined}
                      onPointerEnter={ending ? () => setHover(b.id) : undefined}
                      onPointerLeave={ending ? () => setHover(null) : undefined}
                    >
                      <rect
                        className="ts-card"
                        x={b.x - sh.headW / 2}
                        y={HEAD_TOP}
                        width={sh.headW}
                        height={HEAD_H}
                        rx={8}
                        stroke={TREE_SIDE_COLOR[b.id]}
                        strokeDasharray={sideDash(b.id) ?? undefined}
                      />
                      <text
                        className="ts-headtitle"
                        x={b.x}
                        y={HEAD_Y - 4}
                        textAnchor="middle"
                        fill={TREE_SIDE_COLOR[b.id]}
                        fontSize={sh.headSize}
                      >
                        {b.title}
                      </text>
                      <QuadMetrics
                        side={b.id}
                        x={b.x}
                        y={HEAD_Y + 13}
                        k={0.9}
                      />
                      {onSugg(b.id) && (
                        <ChipMark
                          x={b.x + sh.headW / 2 - 4}
                          y={HEAD_TOP - 7}
                          color={TREE_SIDE_COLOR[b.id]}
                        />
                      )}
                      {ending && lit && wandered && (
                        <PickMark
                          x={b.x}
                          y={HEAD_BOT + 16}
                          color={TREE_SIDE_COLOR[b.id]}
                        />
                      )}
                    </g>
                  );
                })}

                {/* the leaves: the endings */}
                {sh.branches.flatMap((b) =>
                  b.leaves.map((l) => {
                    const lit = onPick(l.id);
                    return (
                      <g
                        key={`l-${l.id}`}
                        className={
                          "ts-node" +
                          (lit ? " on" : "") +
                          (recedes(l.id) ? " dim" : "")
                        }
                        role="button"
                        tabIndex={0}
                        aria-pressed={lit}
                        aria-label={`${b.title} › ${l.lines.join(" ")}`}
                        data-path={JSON.stringify([b.id, l.id])}
                        onKeyDown={onKey([b.id, l.id])}
                        onPointerEnter={() => setHover(l.id)}
                        onPointerLeave={() => setHover(null)}
                      >
                        <rect
                          className="ts-card"
                          x={l.x - l.w / 2}
                          y={LEAF_TOP}
                          width={l.w}
                          height={sh.leafH}
                          rx={8}
                          stroke={TREE_SIDE_COLOR[b.id]}
                          strokeDasharray={sideDash(b.id) ?? undefined}
                        />
                        {l.lines.map((line, li) => (
                          <text
                            key={li}
                            className="ts-leaftitle"
                            x={l.x}
                            y={
                              LEAF_ROW.y +
                              4 +
                              (li - (l.lines.length - 1) / 2) * 13
                            }
                            textAnchor="middle"
                            fill={TREE_SIDE_COLOR[b.id]}
                            fontSize={sh.leafSize}
                          >
                            {line}
                          </text>
                        ))}
                        {onSugg(l.id) && (
                          <ChipMark
                            x={l.x + l.w / 2 - 4}
                            y={LEAF_TOP - 7}
                            color={TREE_SIDE_COLOR[b.id]}
                          />
                        )}
                        {lit && wandered && (
                          <PickMark
                            x={l.x}
                            y={LEAF_TOP + sh.leafH + 16}
                            color={TREE_SIDE_COLOR[b.id]}
                          />
                        )}
                      </g>
                    );
                  }),
                )}
              </g>
            </svg>

            <div className="ts-legend">
              <span className="ts-leg-item">
                <i
                  className="ts-leg-halo"
                  style={{ background: TREE_SIDE_COLOR[suggSide] }}
                />
                what your data argues for
              </span>
              <span className="ts-leg-item">
                <i className="ts-leg-dot" style={{ background: color }} />
                what you are looking at
              </span>
              <span className="ts-leg-hint">
                scroll to zoom · drag to pan · click any ending
              </span>
            </div>
          </div>

          {/* what the picked card holds — the reason to click one at all.
              Three depths: the tree's endings, a branch's endings, an
              ending's modules (each of which opens to its data points). */}
          <aside className="ts-read" aria-live="polite">
            <div className="ts-read-head">
              <span className="ts-read-kicker" style={{ color }}>
                <QuadGlyph side={pickSide} />
                {quadName(pickSide) ?? pickSide}
                {pick.length === 2 && (
                  <>
                    <span className="ts-sep">›</span>
                    {endingLabel(sh, pick)}
                  </>
                )}
              </span>
              {wandered ? (
                <button
                  type="button"
                  className="ts-back"
                  onClick={() => setPick(suggPath)}
                >
                  Back to your read
                </button>
              ) : (
                <span className="ts-yours" style={{ background: color }}>
                  your data&rsquo;s read
                </span>
              )}
            </div>

            {/* what the ending holds: its modules, each opening to its data
                points, under the question this branch of the tree asks */}
            <p className="ts-shock">
              {quadShock(pickSide)}
              {spec ? ` — ${spec.question}` : ""}
            </p>
            <div className="ts-list">
              <span className="ts-kicker">
                {modules.length
                  ? `${modules.length} module${modules.length === 1 ? "" : "s"} at this ending`
                  : "no modules at this ending yet"}
              </span>
              {modules.map((m) => (
                <ModuleRow
                  key={m.id}
                  def={m}
                  color={color}
                  open={openMod === m.id}
                  onToggle={() => setOpenMod((v) => (v === m.id ? null : m.id))}
                />
              ))}
            </div>

            {/* opens the ending's full analysis under the tree — in the
                sandbox, not the section above, so the read arrives where the
                reader already is. A disclosure: it closes what it opened.
                Once open, the block follows the pick on its own. */}
            <button
              type="button"
              className={"ts-open" + (readOpen ? " open" : "")}
              style={{ borderColor: color }}
              aria-expanded={readOpen}
              aria-controls={readOpen ? "ts-analysis" : undefined}
              onClick={() => setReadOpen((v) => !v)}
            >
              {readOpen
                ? "Close this ending's analysis"
                : "Read this ending's analysis"}
              <span className="ts-open-hint">
                {readOpen ? "open below the tree" : "opens below the tree"}
              </span>
            </button>
          </aside>
        </div>

        {/* an ending's full analysis — the same read the section above gives
            it, expanded here under the tree. It reads the pick, so a click
            on the tree swaps it in place; it still names its ending in its
            own head, since the tree may be a screen up by the time the
            reader is down here. */}
        {readPath && readSide && (
          <div
            className="ts-analysis"
            id="ts-analysis"
            ref={readRef}
            role="region"
            aria-label={`Analysis of ${readLabel}`}
          >
            <div className="ts-an-head">
              <div className="ts-an-title">
                <span className="ts-kicker">Analysis</span>
                <span
                  className="ts-read-kicker"
                  style={{ color: TREE_SIDE_COLOR[readSide] }}
                >
                  <QuadGlyph side={readSide} />
                  {quadName(readSide) ?? readSide}
                  {readPath.length === 2 && (
                    <>
                      <span className="ts-sep">›</span>
                      {endingLabel(sh, readPath)}
                    </>
                  )}
                </span>
                {!wandered && (
                  <span
                    className="ts-yours"
                    style={{ background: TREE_SIDE_COLOR[readSide] }}
                  >
                    your data&rsquo;s read
                  </span>
                )}
              </div>
              <button
                type="button"
                className="ts-back"
                onClick={() => setReadOpen(false)}
              >
                Close
              </button>
            </div>
            {/* keyed on the ending: a swap remounts the read fresh rather
                than carrying one ending's opened data point into another */}
            <EndingAnalysis
              key={pickKey}
              cityShort={cityShort}
              path={readPath}
            />
            <div className="ts-an-foot">
              <button type="button" className="ts-back" onClick={backToTree}>
                Back to the tree
              </button>
              <button
                type="button"
                className="ts-back"
                onClick={() => {
                  setReadOpen(false);
                  backToTree();
                }}
              >
                Close the analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** one module at an ending: closed, its name and level and how many data
 *  points; open, the data points themselves — what is there to look at */
function ModuleRow({
  def,
  color,
  open,
  onToggle,
}: {
  def: ModuleDef;
  color: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={"ts-mod" + (open ? " open" : "")}>
      <button
        type="button"
        className="ts-modhead"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="ts-modico" style={{ color }} aria-hidden="true">
          <NodeGlyph id={def.id} />
        </span>
        <span className="ts-modname">{def.title}</span>
        <span className="ts-modlevel">{DATA_LEVEL_LABEL[def.level]}</span>
        <span className="ts-modcount">{def.views.length}</span>
        <span className={"ts-chev" + (open ? " open" : "")} aria-hidden="true">
          <svg viewBox="0 0 10 6">
            <path
              d="M1 1.5 5 4.8 9 1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div className="ts-modbody">
          <p className="ts-modq">
            {def.question ?? (
              <span className="ph">[the question this module answers]</span>
            )}
          </p>
          <ul className="ts-views">
            {def.views.map((v) => (
              <li key={v.name}>
                <span className="ts-viewname">{v.name}</span>
                {(v.signal || v.level) && (
                  <span className="ts-viewmeta">
                    {v.signal && (
                      <Fragment>
                        <b>signal</b> {v.signal}
                      </Fragment>
                    )}
                    {v.level && (
                      <span className="ts-modlevel small">
                        {DATA_LEVEL_LABEL[v.level]}
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** the pill under the ending the reader picked — drawn only off the
 *  diagnosed route, whose own ending already carries its chip. Sized for
 *  its whole label at the chip's type size, so the words clear the ends. */
function PickMark({ x, y, color }: { x: number; y: number; color: string }) {
  const w = 152;
  return (
    <g className="ts-pick" transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-8} width={w} height={16} rx={8} fill={color} />
      <text x={0} y={2.5} textAnchor="middle" fill="#fff">
        ↑ you selected this path
      </text>
    </g>
  );
}

/** the mark that rides the diagnosed route's cards wherever the reader goes */
function ChipMark({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g className="ts-chip" transform={`translate(${x} ${y})`}>
      <rect x={-62} y={-9} width={62} height={15} rx={7.5} fill={color} />
      <text x={-31} y={2} textAnchor="middle" fill="#fff">
        your data
      </text>
    </g>
  );
}
