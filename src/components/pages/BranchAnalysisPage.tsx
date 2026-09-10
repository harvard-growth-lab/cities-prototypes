import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pointer } from "d3-selection";
import { Delaunay } from "d3-delaunay";
import {
  stratify,
  tree as d3tree,
  type HierarchyPointNode,
} from "d3-hierarchy";
import {
  DATA_LEVEL_LABEL,
  PLACEHOLDER_BRANCHES,
  QUAD_BRANCH_SPEC,
  TREE_SIDE_COLOR,
  sideDash,
  sideHollow,
  TREE_SIDE_LABEL,
  completeToLeaf,
  pathModules,
  sideOfPath,
  suggestedPath,
  treeNodes,
  type BranchSide,
  type ModuleDef,
  type TreeNodeData,
  type TreeSide,
  type TreeVariant,
} from "../../data/figures";
import { branchSectionName } from "../../data/content";
import { NodeGlyph } from "./treeIcons";

/* The third City Constraints step: the MODULES to look into at the end of
   the branch picked on the diagnostic tree in the previous step — each a
   theme grouping the data points worth reading there — beside the "where
   you are" schematic that follows the pick. The schematic previews paths on
   hover and commits one on click (area-linked, like the big tree). */

type MiniNode = HierarchyPointNode<TreeNodeData>;

const MV = {
  w: 396,
  h: 178,
  pad: { top: 26, right: 14, bottom: 10, left: 14 },
};

/* every element keeps its side colour (grey would break the demand/supply
   encoding); emphasis is carried by opacity alone: lit pick > tinted
   suggestion > faint rest */

function sideOf(n: MiniNode): TreeSide {
  const top = n.ancestors().find((a) => a.depth === 1);
  return top ? (top.data.id as TreeSide) : "root";
}

/** the whole tree in miniature: dots + elbows, the selected descent lit.
 *  Hovering (or clicking) anywhere near a node re-picks that path — always
 *  completed down to a leaf, so the pick is a full navigable route. */
function DiagSchematic({
  path,
  suggPath,
  preview,
  variant,
  onPick,
  onPreview,
  interactive,
}: {
  path: string[];
  /** the city's suggested descent — keeps its tinted marking */
  suggPath: string[];
  /** the hovered path — lifted to the page, whose text follows it too */
  preview: string[] | null;
  /** which tree structure to draw — follows the stage's toggle */
  variant: TreeVariant;
  onPick: (path: string[]) => void;
  onPreview: (path: string[] | null) => void;
  /** false while the section withholds the choice — the schematic still draws
   *  the route, it just stops answering the pointer */
  interactive: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, delaunay } = useMemo(() => {
    const built = stratify<TreeNodeData>()
      .id((d) => d.id)
      .parentId((d) => d.parent)(treeNodes(variant));
    const laid = d3tree<TreeNodeData>()
      .size([
        MV.w - MV.pad.left - MV.pad.right,
        MV.h - MV.pad.top - MV.pad.bottom,
      ])(built)
      .descendants() as MiniNode[];
    return {
      nodes: laid,
      delaunay: Delaunay.from(
        laid,
        (d) => d.x + MV.pad.left,
        (d) => d.y + MV.pad.top,
      ),
    };
  }, [variant]);

  /* hovering only PREVIEWS a path (locally); clicking commits it app-wide.
     Both are area-linked: the pointer maps to the nearest node, no precise
     aim needed. Only FULL routes are pickable — the app needs a leaf to
     navigate to — so an inner node completes down to a leaf, and the hover
     preview shows exactly what a click would commit */
  const targetPath = (
    e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
  ) => {
    const [px, py] = pointer(e.nativeEvent, svgRef.current);
    const n = nodes[delaunay.find(px, py)];
    const ddx = n.x + MV.pad.left - px;
    const ddy = n.y + MV.pad.top - py;
    if (ddx * ddx + ddy * ddy > 36 * 36 || !n.parent) return null;
    const ids = completeToLeaf(n, [path, suggPath])
      .ancestors()
      .filter((a) => a.depth >= 1)
      .map((a) => a.data.id)
      .reverse();
    /* a placeholder branch is drawn but has no analysis to navigate to, so
       it answers the pointer with nothing — same rule the walk's tree uses */
    return PLACEHOLDER_BRANCHES.has(ids[0]) ? null : ids;
  };
  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const ids = targetPath(e);
    if ((ids?.join("/") ?? null) !== (preview?.join("/") ?? null))
      onPreview(ids);
  };
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const ids = targetPath(e);
    if (ids && ids.join("/") !== path.join("/")) onPick(ids);
  };

  const on = new Set(["root", ...path]);
  /* the hovered path previews at its own emphasis, without committing */
  const prev = new Set((preview ?? []).filter((id) => !on.has(id)));
  /* the data-driven suggestion keeps a middle emphasis (tinted, not grey)
     while the pick is elsewhere — "where we think you are" stays readable */
  const sugg = new Set(suggPath.filter((id) => !on.has(id) && !prev.has(id)));
  const root = nodes[0];
  const here = nodes.find((n) => n.data.id === path[path.length - 1]);
  /* paint order: faint, tinted suggestion, hover preview, lit pick on top */
  const rank = (id: string) =>
    on.has(id) ? 3 : prev.has(id) ? 2 : sugg.has(id) ? 1 : 0;
  const linked = [...nodes.filter((n) => n.parent)].sort(
    (a, b) => rank(a.data.id) - rank(b.data.id),
  );
  const elbow = (n: MiniNode) => {
    const p = n.parent as MiniNode;
    return `M${p.x},${p.y} V${(p.y + n.y) / 2} H${n.x} V${n.y}`;
  };

  return (
    <svg
      ref={svgRef}
      className={"ba-mini" + (interactive ? "" : " inert")}
      viewBox={`0 0 ${MV.w} ${MV.h}`}
      role="img"
      aria-label={
        interactive
          ? "Schematic of the diagnostic tree with your selected branch highlighted; hover to preview, click to pick a different path"
          : "Schematic of the diagnostic tree with the diagnosed branch highlighted"
      }
      onPointerMove={handleMove}
      onPointerLeave={() => onPreview(null)}
      onClick={handleClick}
    >
      <g transform={`translate(${MV.pad.left},${MV.pad.top})`}>
        {linked.map((n) => (
          <path
            key={n.data.id}
            className={
              "ba-link" +
              (on.has(n.data.id)
                ? " on"
                : prev.has(n.data.id)
                  ? " preview"
                  : sugg.has(n.data.id)
                    ? " sugg"
                    : " faint")
            }
            d={elbow(n)}
            stroke={TREE_SIDE_COLOR[sideOf(n)]}
            strokeDasharray={sideDash(n.data.id) ? "4 3" : undefined}
          />
        ))}
        {nodes.map((n) => (
          <circle
            key={n.data.id}
            className={
              "ba-dot" +
              (on.has(n.data.id)
                ? ""
                : prev.has(n.data.id)
                  ? " preview"
                  : sugg.has(n.data.id)
                    ? " sugg"
                    : " faint")
            }
            cx={n.x}
            cy={n.y}
            r={
              on.has(n.data.id)
                ? 5
                : prev.has(n.data.id)
                  ? 4.5
                  : sugg.has(n.data.id)
                    ? 4
                    : 3.5
            }
            fill={sideHollow(n.data.id) ? "#fff" : TREE_SIDE_COLOR[sideOf(n)]}
            stroke={TREE_SIDE_COLOR[sideOf(n)]}
            strokeWidth={sideHollow(n.data.id) ? 1.7 : 0}
          />
        ))}
        {here && (
          <circle
            className="ba-here-ring"
            cx={here.x}
            cy={here.y}
            r={9.5}
            stroke={TREE_SIDE_COLOR[sideOf(here)]}
          />
        )}
        <text
          className="ba-lab root"
          x={root.x}
          y={root.y - 11}
          textAnchor="middle"
        >
          The growth question
        </text>
        {/* the two-branch trees label both heads beside their dots; the
            quadrant trees have four heads too close for that, so only the
            branches on the lit route name themselves, centred above their
            dots and clamped to the map — colour and the trail below carry
            the rest */}
        {(() => {
          const heads = nodes.filter((n) => n.depth === 1);
          const crowded = heads.length > 2;
          const innerW = MV.w - MV.pad.left - MV.pad.right;
          return heads
            .filter((n) => !crowded || on.has(n.data.id))
            .map((n) => {
              const hw = n.data.title.length * 3.2;
              const lx = crowded
                ? Math.max(hw, Math.min(innerW - hw, n.x))
                : n.x + (n.x < root.x ? -11 : 11);
              return (
                <text
                  key={n.data.id}
                  className={"ba-lab" + (on.has(n.data.id) ? "" : " faint")}
                  x={lx}
                  y={crowded ? n.y - 11 : n.y + 3.5}
                  textAnchor={
                    crowded ? "middle" : n.x < root.x ? "end" : "start"
                  }
                  fill={TREE_SIDE_COLOR[sideOf(n)]}
                >
                  {n.data.title}
                </text>
              );
            });
        })()}
      </g>
    </svg>
  );
}

/* ---------- the modules: the section's actual skeleton ----------
   Each module reached from the picked ending becomes a block: the question
   it helps answer, the level its data is read at, and a frame per data
   point naming the signal to read off it. Modules are an overview of where
   to look, not a verdict — nothing here says a module IS the constraint. */

function ModuleBlock({
  def,
  color,
  onSeen,
}: {
  def: ModuleDef;
  color: string;
  /** reports the block entering view, for the rail's module list */
  onSeen: (id: string, on: boolean) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = el.closest(".pages") as HTMLElement | null;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => onSeen(def.id, e.isIntersecting)),
      { root: scroller, threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [def.id, onSeen]);

  return (
    <section className="ba-module" id={`module-${def.id}`} ref={ref}>
      <div className="ba-mod-head">
        <span className="ba-mod-ico" style={{ color }} aria-hidden="true">
          <NodeGlyph id={def.id} />
        </span>
        <h3 style={{ color }}>{def.title}</h3>
        <span className="ba-level">{DATA_LEVEL_LABEL[def.level]}</span>
      </div>
      <p className="ba-mod-q">
        {def.question ?? (
          <span className="ph">
            [the question this module helps answer — to come]
          </span>
        )}
      </p>
      <div className="ba-views">
        {def.views.map((v) => (
          <div className="ba-view" key={v.name}>
            <span className="ba-view-name">{v.name}</span>
            <span className="ba-view-ph">[data view — to come]</span>
            {(v.signal || v.level) && (
              <span className="ba-view-meta">
                {v.signal && (
                  <span className="ba-view-signal">
                    <b>Signal</b>
                    {v.signal}
                  </span>
                )}
                {v.level && (
                  <span className="ba-level small">
                    {DATA_LEVEL_LABEL[v.level]}
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* the intro line counts its modules in words — no ending shows more than a
   handful */
const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six"];
const countModules = (n: number) =>
  n === 1 ? "one module" : `${COUNT_WORD[n] ?? n} modules`;

export function BranchAnalysisPage({
  cityShort,
  branchPath,
  onSelectBranch,
  variant,
  showThemes,
  routeHeld = false,
  onReachEnd,
  treePickable = true,
}: {
  cityShort: string;
  /** the descent picked on the diagnostic tree (ids below the root) */
  branchPath: string[];
  onSelectBranch: (path: string[]) => void;
  /** which tree structure the schematic mirrors (the stage's toggle) */
  variant: TreeVariant;
  /** show the modules under the alt tree's leaves instead of the empty
   *  frame — the quadrant trees always carry theirs */
  showThemes: boolean;
  /** the shortened walk withholds the choice of branch until this section has
   *  been read to its end — chart, tree and analysis are one piece there */
  routeHeld?: boolean;
  /** fired when the end of the section comes into view, which is what
   *  releases the hold */
  onReachEnd?: () => void;
  /** whether the tree up in City Constraints is a control too — it is in
   *  every flow but the shortened walk, where this schematic is the only
   *  place a branch can be chosen */
  treePickable?: boolean;
}) {
  const side = sideOfPath(branchPath);
  const titleOf = useMemo(
    () => new Map(treeNodes(variant).map((n) => [n.id, n.title])),
    [variant],
  );
  /* the city's hardcoded suggested read (sample) — the tinted route */
  const suggPath = useMemo(
    () => suggestedPath(cityShort, variant),
    [cityShort, variant],
  );
  const suggSide: TreeSide = sideOfPath(suggPath);

  /* the schematic's hover preview lives here: the kicker, breadcrumbs and
     chip below follow the path under the pointer, not just the dots */
  const [preview, setPreview] = useState<string[] | null>(null);
  /* the structure changed under the preview — its ids may not exist here */
  useEffect(() => setPreview(null), [variant]);
  const previewing = !!preview && preview.join("/") !== branchPath.join("/");
  const shown = preview ?? branchPath;
  const shownSide = sideOfPath(shown);

  /* the modules shown at the picked ending — the section's content. The
     quadrant trees always carry them (the revision made them the section);
     the alt tree carries them when the stage's themes toggle is on, and the
     paper tree has none. */
  const modulesOn =
    variant === "quad" ||
    variant === "quad2" ||
    (showThemes && variant === "alt");
  const modules = useMemo(
    () => (modulesOn ? pathModules(branchPath) : []),
    [modulesOn, branchPath],
  );
  /* the revision spec's per-shock layer: the overarching question (the
     lede) and the fork line */
  const spec = QUAD_BRANCH_SPEC[side as BranchSide];
  /* which module block the reader is in, for the rail's module list */
  const [seenModules, setSeenModules] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const onSeen = useCallback((id: string, on: boolean) => {
    setSeenModules((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  /* the topmost module in view reads as "where you are" */
  const activeModule =
    modules.find((m) => seenModules.has(m.id))?.id ?? null;

  /* ---------- the end of the section ----------
     A held route is released by READING to the end, not by scrolling past
     the top: the sentinel sits after the last block, so it reports only once
     the analysis itself has gone by. The observer exists only while the hold
     does — which both retires it once the choice is given (the release is
     latched a level up, so scrolling back never takes it away) and re-arms it
     if a later flow switch puts the hold back on. A fresh observer reports
     the current state on its first tick, so a reader already sitting at the
     end is released at once rather than made to scroll away and back. */
  const endRef = useRef<HTMLDivElement>(null);
  const onReachRef = useRef(onReachEnd);
  onReachRef.current = onReachEnd;
  useEffect(() => {
    const el = endRef.current;
    if (!routeHeld || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReachRef.current?.();
      },
      { root: el.closest(".pages"), threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [routeHeld]);

  /* narrow screens fold the context card down to its trail; this opens it.
     Wide screens ignore it — the toggle is not even drawn there. */
  const [ctxOpen, setCtxOpen] = useState(false);

  return (
    <section className="page" id="page-branch-analysis">
      <div className="page-head">
        <span className="eyebrow">City Constraints</span>
        <h2>{branchSectionName(side)}</h2>
      </div>
      <p className="lede">
        {spec ? (
          /* the spec's overarching question leads the section; the city's own
             read of it stays a placeholder */
          <>
            {spec.question}{" "}
            <span className="ph">
              [the {TREE_SIDE_LABEL[side]} read of {cityShort} — copy to come]
            </span>
          </>
        ) : (
          <span className="ph">
            [lead question for the {TREE_SIDE_LABEL[side]} analysis of{" "}
            {cityShort}]
          </span>
        )}
      </p>

      <div className="ba-body">
        {modulesOn ? (
          <div className="ba-modules">
            <div className="ba-lead">
              {/* the spec's fork line names how you landed here; a shock
                  with no second layer (the positive demand shock) has none */}
              {spec?.forkLine && (
                <p className="ba-forkline">
                  <span className="ph">
                    [how you landed here: {spec.forkLine}]
                  </span>
                </p>
              )}
              {/* what the modules are, before the first one: an overview of
                  where to look, not a verdict on any of them */}
              <p className="ba-forkline">
                <span className="ph">
                  {modules.length
                    ? `[${countModules(modules.length)} to look into on this branch — an overview of where to look, not a verdict: none of them says the module is definitively the problem]`
                    : "[no modules on this landing yet]"}
                </span>
              </p>
            </div>
            {modules.map((m) => (
              <ModuleBlock
                key={m.id}
                def={m}
                color={TREE_SIDE_COLOR[side]}
                onSeen={onSeen}
              />
            ))}
          </div>
        ) : (
          <div className="placeholder-frame">
            <span className="ph-title">{branchSectionName(side)}</span>
            <span className="ph-sub">
              [tests, data views and narrative for the {TREE_SIDE_LABEL[side]} —
              to come]
            </span>
          </div>
        )}

        <aside className={"ba-context" + (ctxOpen ? " open" : "")}>
          <div className="ba-ctx-head">
            <span className="ba-kicker">
              {previewing
                ? "Previewing another path"
                : "Where you are in the diagnostic"}
            </span>
            <button
              type="button"
              className="ba-ctx-toggle"
              aria-expanded={ctxOpen}
              onClick={() => setCtxOpen((v) => !v)}
            >
              {ctxOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          <DiagSchematic
            path={branchPath}
            suggPath={suggPath}
            preview={preview}
            variant={variant}
            onPick={onSelectBranch}
            onPreview={setPreview}
            interactive={!routeHeld}
          />
          <span className="ba-legend">
            <i style={{ background: TREE_SIDE_COLOR[suggSide] }} />
            tinted = where we think you are
          </span>
          <div className="fig-trail ba-trail">
            {shown.map((id, i) => (
              <Fragment key={id}>
                {i > 0 && <span className="crumb-sep">›</span>}
                <span style={{ color: TREE_SIDE_COLOR[shownSide] }}>
                  {titleOf.get(id)}
                </span>
              </Fragment>
            ))}
            <span
              className="ba-here-chip"
              style={{ background: TREE_SIDE_COLOR[shownSide] }}
            >
              {previewing ? "click to select" : "you are here"}
            </span>
          </div>
          {/* the modules at the picked ending, scroll-spied like the main
              rail one level up — the reader always knows which module they
              are in; the count is its data points */}
          {modulesOn && modules.length > 0 && (
            <div className="ba-modlist">
              <span className="ba-kicker">Modules</span>
              <ul>
                {modules.map((m) => (
                  <li
                    key={m.id}
                    className={m.id === activeModule ? "active" : ""}
                  >
                    <span
                      className="ba-moddot"
                      style={{ background: TREE_SIDE_COLOR[side] }}
                    />
                    <a href={`#module-${m.id}`}>{m.title}</a>
                    <span className="ba-modcount">{m.views.length}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="ba-note">
            <span className="ph">
              {routeHeld
                ? "[the diagnosed route — read the analysis through and the schematic opens at the end]"
                : treePickable
                  ? "[hover the schematic to preview a path, click to make it yours]"
                  : "[hover the schematic to preview a path, click to make it yours]"}
            </span>
          </p>
        </aside>
      </div>

      {/* the shortened walk's exit: the first place the route opens. A quiet
          offer rather than a call to action — the diagnosed read is the main
          road, and most readers should simply finish it. */}
      {!treePickable && (
        <p className="ba-endprompt">
          <span className="ph">
            [that's the {TREE_SIDE_LABEL[side]} read — the diagnosed path. if
            you're curious how another branch tells it, the schematic in the
            sidebar is open now: hover to preview, click to switch]
          </span>
        </p>
      )}

      {/* the end of the section — see the observer above. A hairline rather
          than a zero-height node, which not every engine reports on. */}
      <div ref={endRef} style={{ height: 1 }} aria-hidden="true" />
    </section>
  );
}
