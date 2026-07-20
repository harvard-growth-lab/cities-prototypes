/**
 * Figure 27 as an orienting mini-map: the whole tree, the live path lit
 * in gold, cleared suspects struck through, everything else dim. Click a
 * node to read its case (via onSelect).
 *
 * Walking mode: pass `choices` (the ids on offer at the current fork) to
 * spotlight one level at a time — the path and the two candidate branches
 * stay at full strength, candidates get a dashed gold ring and become the
 * only clickable nodes, and the rest of the tree recedes.
 */

import { FIG27_NODES, type TreeNodeData } from "../content/figures";

/** manual layout — fractions of width per node, rows by depth */
const POS: Record<string, { fx: number; row: number }> = {
  root: { fx: 0.5, row: 0 },
  demand: { fx: 0.26, row: 1 },
  supply: { fx: 0.76, row: 1 },
  existing: { fx: 0.14, row: 2 },
  newact: { fx: 0.40, row: 2 },
  col: { fx: 0.63, row: 2 },
  amen: { fx: 0.90, row: 2 },
  external: { fx: 0.07, row: 3 },
  inputs: { fx: 0.23, row: 3 },
  coord: { fx: 0.40, row: 3 },
  housing: { fx: 0.55, row: 3 },
  transport: { fx: 0.72, row: 3 },
};

export function MiniTree({
  path = [],
  ruledOut = [],
  selected = null,
  onSelect,
  choices,
  height = 250,
}: {
  path?: string[];
  ruledOut?: string[];
  selected?: string | null;
  onSelect?: (n: TreeNodeData) => void;
  /** ids choosable at the current fork — enables walking mode */
  choices?: string[];
  height?: number;
}) {
  const W = 800;
  const H = height;
  const rowY = (row: number) => 26 + (row * (H - 52)) / 3;

  const nodeAt = (id: string) => {
    const p = POS[id];
    return { x: p.fx * W, y: rowY(p.row) };
  };

  const onPath = (id: string) => path.includes(id);
  const walking = choices != null;
  const isChoice = (id: string) => (choices?.includes(id) ?? false);
  // In walking mode only the path and the live fork stay at full strength.
  const inFocus = (id: string) => !walking || onPath(id) || isChoice(id);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Figure 27 decision tree mini-map with the diagnosed branch highlighted."
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* links */}
      {FIG27_NODES.filter((n) => n.parent).map((n) => {
        const a = nodeAt(n.parent!);
        const b = nodeAt(n.id);
        const lit = onPath(n.id) && onPath(n.parent!);
        const candidate = walking && isChoice(n.id) && onPath(n.parent!);
        return (
          <path
            key={`l-${n.id}`}
            d={`M${a.x},${a.y + 11} C${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2} ${b.x},${b.y - 11}`}
            fill="none"
            stroke={lit || candidate ? "#c98500" : "#d8d4cc"}
            strokeWidth={lit ? 2 : candidate ? 1.6 : 1.2}
            strokeDasharray={candidate ? "4 4" : undefined}
            opacity={lit || candidate || !walking ? 1 : 0.35}
          />
        );
      })}

      {/* nodes */}
      {FIG27_NODES.map((n) => {
        const { x, y } = nodeAt(n.id);
        const lit = onPath(n.id);
        const out = ruledOut.includes(n.id);
        const isSel = selected === n.id;
        const choice = isChoice(n.id);
        const clickable = onSelect && (walking ? choice : true);
        return (
          <g
            key={n.id}
            onClick={clickable ? () => onSelect(n) : undefined}
            style={{ cursor: clickable ? "pointer" : "default" }}
            opacity={inFocus(n.id) ? 1 : 0.3}
          >
            {/* dashed halo marks the branches on offer at this fork */}
            {choice && (
              <circle
                cx={x}
                cy={y}
                r={14}
                fill="none"
                stroke="#c98500"
                strokeWidth={1.6}
                strokeDasharray="3 3"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={choice ? 8 : isSel ? 8 : 6}
              fill={lit ? "#e8b84b" : choice ? "#fdf9ef" : out ? "#f4f1ea" : "#cfc9bd"}
              stroke={lit || choice ? "#c98500" : isSel ? "#7a746a" : "#9a9389"}
              strokeWidth={lit || choice || isSel ? 2 : 1.2}
            />
            <text
              x={x}
              y={y + (choice ? 28 : 22)}
              fontSize={walking ? 12.5 : 11.5}
              textAnchor="middle"
              fill={lit ? "#9a6712" : choice ? "#6b4d10" : out ? "#9a9389" : "#6b655c"}
              fontWeight={lit || choice ? 600 : 400}
              textDecoration={out ? "line-through" : undefined}
            >
              {n.title}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
