import { useMemo } from "react";
import { stratify, tree as d3tree, type HierarchyPointNode } from "d3-hierarchy";
import {
  TREE_NODES,
  TREE_SIDE_COLOR,
  type TreeNodeData,
  type TreeSide,
} from "../../data/figures";
import { branchSectionName } from "../../data/content";

/* The third City Constraints step. Empty for now — its name and the
   "where you are" schematic follow the branch picked on the diagnostic tree
   in the previous step. */

type MiniNode = HierarchyPointNode<TreeNodeData>;

const MV = { w: 396, h: 178, pad: { top: 26, right: 14, bottom: 10, left: 14 } };

const OFF_LINK = "#d5dbdd";
const OFF_DOT = "#c8d1d3";

function sideOf(n: MiniNode): TreeSide {
  const top = n.ancestors().find((a) => a.depth === 1);
  return top ? (top.data.id as TreeSide) : "root";
}

/** the whole tree in miniature: dots + elbows, the selected descent lit */
function DiagSchematic({ path }: { path: string[] }) {
  const nodes = useMemo(() => {
    const built = stratify<TreeNodeData>()
      .id((d) => d.id)
      .parentId((d) => d.parent)(TREE_NODES);
    return d3tree<TreeNodeData>().size([
      MV.w - MV.pad.left - MV.pad.right,
      MV.h - MV.pad.top - MV.pad.bottom,
    ])(built).descendants() as MiniNode[];
  }, []);

  const on = new Set(["root", ...path]);
  const root = nodes[0];
  const here = nodes.find((n) => n.data.id === path[path.length - 1]);
  /* lit links painted after (over) the grey ones */
  const linked = [...nodes.filter((n) => n.parent)].sort(
    (a, b) => Number(on.has(a.data.id)) - Number(on.has(b.data.id)),
  );
  const elbow = (n: MiniNode) => {
    const p = n.parent as MiniNode;
    return `M${p.x},${p.y} V${(p.y + n.y) / 2} H${n.x} V${n.y}`;
  };

  return (
    <svg
      className="ba-mini"
      viewBox={`0 0 ${MV.w} ${MV.h}`}
      role="img"
      aria-label="Schematic of the diagnostic tree with your selected branch highlighted"
    >
      <g transform={`translate(${MV.pad.left},${MV.pad.top})`}>
        {linked.map((n) => (
          <path
            key={n.data.id}
            className={"ba-link" + (on.has(n.data.id) ? " on" : "")}
            d={elbow(n)}
            stroke={on.has(n.data.id) ? TREE_SIDE_COLOR[sideOf(n)] : OFF_LINK}
          />
        ))}
        {nodes.map((n) => (
          <circle
            key={n.data.id}
            cx={n.x}
            cy={n.y}
            r={on.has(n.data.id) ? 5 : 3.5}
            fill={on.has(n.data.id) ? TREE_SIDE_COLOR[sideOf(n)] : OFF_DOT}
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
              className="ba-lab"
              x={n.x + (n.x < root.x ? -11 : 11)}
              y={n.y + 3.5}
              textAnchor={n.x < root.x ? "end" : "start"}
              fill={on.has(n.data.id) ? TREE_SIDE_COLOR[sideOf(n)] : "#9aa6aa"}
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
}: {
  cityShort: string;
  /** the descent picked on the diagnostic tree (ids below the root) */
  branchPath: string[];
}) {
  const side = branchPath[0] === "demand" ? ("demand" as const) : ("supply" as const);
  const titleOf = useMemo(() => new Map(TREE_NODES.map((n) => [n.id, n.title])), []);

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
          <span className="ba-kicker">Where you are in the diagnostic</span>
          <DiagSchematic path={branchPath} />
          <div className="fig-trail ba-trail">
            {branchPath.map((id, i) => (
              <span key={id}>
                {i > 0 && <b>›</b>}
                <span style={{ color: TREE_SIDE_COLOR[side] }}>{titleOf.get(id)}</span>
              </span>
            ))}
            <span className="ba-here-chip" style={{ background: TREE_SIDE_COLOR[side] }}>
              you are here
            </span>
          </div>
          <p className="ba-note">
            <span className="ph">
              [picked on the tree in City Constraints — click a different node there to switch]
            </span>
          </p>
        </aside>
      </div>
    </section>
  );
}
