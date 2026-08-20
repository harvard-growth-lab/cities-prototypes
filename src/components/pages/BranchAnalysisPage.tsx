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
import { stratify, tree as d3tree, type HierarchyPointNode } from "d3-hierarchy";
import {
  PLACEHOLDER_BRANCHES,
  TREE_SIDE_COLOR,
  TREE_SIDE_LABEL,
  completeToLeaf,
  pathThemes,
  sideOfPath,
  suggestedPath,
  treeNodes,
  type ThemeDef,
  type TreeNodeData,
  type TreeSide,
  type TreeVariant,
} from "../../data/figures";
import { branchSectionName } from "../../data/content";
import { NodeGlyph } from "./treeIcons";

/* The third City Constraints step. Empty for now — its name and the
   "where you are" schematic follow the branch picked on the diagnostic tree
   in the previous step. The schematic previews paths on hover and commits
   one on click (area-linked, like the big tree). */

type MiniNode = HierarchyPointNode<TreeNodeData>;

const MV = { w: 396, h: 178, pad: { top: 26, right: 14, bottom: 10, left: 14 } };

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
    const laid = d3tree<TreeNodeData>().size([
      MV.w - MV.pad.left - MV.pad.right,
      MV.h - MV.pad.top - MV.pad.bottom,
    ])(built).descendants() as MiniNode[];
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
  const sugg = new Set(
    suggPath.filter((id) => !on.has(id) && !prev.has(id)),
  );
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
            fill={TREE_SIDE_COLOR[sideOf(n)]}
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
        <text className="ba-lab root" x={root.x} y={root.y - 11} textAnchor="middle">
          The growth question
        </text>
        {nodes
          .filter((n) => n.depth === 1)
          .map((n) => (
            <text
              key={n.data.id}
              className={"ba-lab" + (on.has(n.data.id) ? "" : " faint")}
              x={n.x + (n.x < root.x ? -11 : 11)}
              y={n.y + 3.5}
              textAnchor={n.x < root.x ? "end" : "start"}
              fill={TREE_SIDE_COLOR[sideOf(n)]}
            >
              {n.data.title}
            </text>
          ))}
      </g>
    </svg>
  );
}

/* ---------- the themes layer: the section's actual skeleton ----------
   Each theme reached from the picked leaf becomes a block of indicator
   frames. Where two leaves rest on the same underlying data, the themes are
   named for the question each one answers, so a block never has to explain
   that it is a repeat of one somewhere else. */

function ThemeBlock({
  theme,
  color,
  onSeen,
}: {
  theme: ThemeDef;
  color: string;
  /** reports the block entering view, for the rail's theme list */
  onSeen: (id: string, on: boolean) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = el.closest(".pages") as HTMLElement | null;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => onSeen(theme.id, e.isIntersecting)),
      { root: scroller, threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [theme.id, onSeen]);

  return (
    <section className="ba-theme" id={`theme-${theme.id}`} ref={ref}>
      <div className="ba-theme-head">
        <span className="ba-theme-ico" style={{ color }} aria-hidden="true">
          <NodeGlyph id={theme.id} />
        </span>
        <h3 style={{ color }}>{theme.title}</h3>
      </div>
      <p className="ba-theme-lede">
        <span className="ph">{theme.detail}</span>
      </p>
      {theme.seeAlso && (
        <p className="ba-theme-see">
          <span className="ph">
            [you already saw this in {theme.seeAlso} — link back rather than
            re-plot]
          </span>
        </p>
      )}
      <div className="ba-inds">
        {theme.indicators.map((ind) => (
          <div className="ba-ind" key={ind}>
            <span className="ba-ind-name">{ind}</span>
            <span className="ph-sub">[data view — to come]</span>
          </div>
        ))}
      </div>
    </section>
  );
}

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
  /** show the themes under the picked leaf instead of the empty frame */
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

  /* the themes hanging off the picked leaf — the section's content when the
     stage's themes toggle is on */
  const themesOn = showThemes && variant === "alt";
  const themes = useMemo(
    () => (themesOn ? pathThemes(branchPath) : []),
    [themesOn, branchPath],
  );
  /* which theme block the reader is in, for the rail's theme list */
  const [seenThemes, setSeenThemes] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const onSeen = useCallback((id: string, on: boolean) => {
    setSeenThemes((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  /* the topmost theme in view reads as "where you are" */
  const activeTheme = themes.find((t) => seenThemes.has(t.id))?.id ?? null;

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

  return (
    <section className="page" id="page-branch-analysis">
      <div className="page-head">
        <span className="eyebrow">City Constraints</span>
        <h2>{branchSectionName(side)}</h2>
      </div>
      <p className="lede">
        <span className="ph">
          [lead question for the {TREE_SIDE_LABEL[side]} analysis of {cityShort}]
        </span>
      </p>

      <div className="ba-body">
        {themesOn ? (
          <div className="ba-themes">
            {themes.map((t) => (
              <ThemeBlock
                key={t.id}
                theme={t}
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

        <aside className="ba-context">
          <span className="ba-kicker">
            {previewing ? "Previewing another path" : "Where you are in the diagnostic"}
          </span>
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
          {/* the themes under the picked leaf, scroll-spied like the main
              rail one level up — the reader always knows which piece of
              evidence they are in */}
          {themesOn && themes.length > 0 && (
            <div className="ba-themelist">
              <span className="ba-kicker">Evidence</span>
              <ul>
                {themes.map((t) => (
                  <li
                    key={t.id}
                    className={t.id === activeTheme ? "active" : ""}
                  >
                    <span
                      className="ba-themedot"
                      style={{ background: TREE_SIDE_COLOR[side] }}
                    />
                    <a href={`#theme-${t.id}`}>{t.title}</a>
                    <span className="ba-themecount">
                      {t.indicators.length}
                    </span>
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
                  ? "[hover the schematic to preview a path, click to make it yours — or click the tree in City Constraints]"
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
            [that's the {TREE_SIDE_LABEL[side]} read — the diagnosed path. if you're
            curious how another branch tells it, the schematic in the sidebar
            is open now: hover to preview, click to switch]
          </span>
        </p>
      )}

      {/* the end of the section — see the observer above. A hairline rather
          than a zero-height node, which not every engine reports on. */}
      <div ref={endRef} style={{ height: 1 }} aria-hidden="true" />
    </section>
  );
}
