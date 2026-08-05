import { Fragment, useMemo, useRef, useState } from "react";
import { pointer } from "d3-selection";
import { Delaunay } from "d3-delaunay";
import { stratify, tree as d3tree, type HierarchyPointNode } from "d3-hierarchy";
import {
  TREE_NODES,
  TREE_SIDE_COLOR,
  completeToLeaf,
  suggestedPath,
  type TreeNodeData,
  type TreeSide,
} from "../../data/figures";
import { branchSectionName } from "../../data/content";

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
  onPick,
  onPreview,
}: {
  path: string[];
  /** the city's suggested descent — keeps its tinted marking */
  suggPath: string[];
  /** the hovered path — lifted to the page, whose text follows it too */
  preview: string[] | null;
  onPick: (path: string[]) => void;
  onPreview: (path: string[] | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, delaunay } = useMemo(() => {
    const built = stratify<TreeNodeData>()
      .id((d) => d.id)
      .parentId((d) => d.parent)(TREE_NODES);
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
  }, []);

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
    return completeToLeaf(n, [path, suggPath])
      .ancestors()
      .filter((a) => a.depth >= 1)
      .map((a) => a.data.id)
      .reverse();
  };
  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const ids = targetPath(e);
    if ((ids?.join("/") ?? null) !== (preview?.join("/") ?? null))
      onPreview(ids);
  };
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
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
      className="ba-mini"
      viewBox={`0 0 ${MV.w} ${MV.h}`}
      role="img"
      aria-label="Schematic of the diagnostic tree with your selected branch highlighted; hover to preview, click to pick a different path"
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

export function BranchAnalysisPage({
  cityShort,
  branchPath,
  onSelectBranch,
}: {
  cityShort: string;
  /** the descent picked on the diagnostic tree (ids below the root) */
  branchPath: string[];
  onSelectBranch: (path: string[]) => void;
}) {
  const side = branchPath[0] === "demand" ? ("demand" as const) : ("supply" as const);
  const titleOf = useMemo(() => new Map(TREE_NODES.map((n) => [n.id, n.title])), []);
  /* the city's hardcoded suggested read (sample) — the tinted route */
  const suggPath = useMemo(() => suggestedPath(cityShort), [cityShort]);
  const suggSide: TreeSide = suggPath[0] === "demand" ? "demand" : "supply";

  /* the schematic's hover preview lives here: the kicker, breadcrumbs and
     chip below follow the path under the pointer, not just the dots */
  const [preview, setPreview] = useState<string[] | null>(null);
  const previewing = !!preview && preview.join("/") !== branchPath.join("/");
  const shown = preview ?? branchPath;
  const shownSide =
    shown[0] === "demand" ? ("demand" as const) : ("supply" as const);

  return (
    <section className="page" id="page-branch-analysis">
      <div className="page-head">
        <span className="eyebrow">City Constraints</span>
        <h2>{branchSectionName(side)}</h2>
      </div>
      <p className="lede">
        <span className="ph">[lead question for the {side}-side analysis of {cityShort}]</span>
      </p>

      <div className="ba-body">
        <div className="placeholder-frame">
          <span className="ph-title">{branchSectionName(side)}</span>
          <span className="ph-sub">
            [tests, data views and narrative for the {side} branch — to come]
          </span>
        </div>

        <aside className="ba-context">
          <span className="ba-kicker">
            {previewing ? "Previewing another path" : "Where you are in the diagnostic"}
          </span>
          <DiagSchematic
            path={branchPath}
            suggPath={suggPath}
            preview={preview}
            onPick={onSelectBranch}
            onPreview={setPreview}
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
          <p className="ba-note">
            <span className="ph">
              [hover the schematic to preview a path, click to make it yours — or click the tree
              in City Constraints]
            </span>
          </p>
        </aside>
      </div>
    </section>
  );
}
