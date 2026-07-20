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

import { FIG27_NODES, FIG27_ROOT_QUESTION, type TreeNodeData } from "./content/figures";

/** manual layout — fractions of width per node, rows by depth, mirroring
 *  Figure 27's left-to-right order (diversification left, existing right) */
const POS: Record<string, { fx: number; row: number }> = {
  root: { fx: 0.5, row: 0 },
  demand: { fx: 0.27, row: 1 },
  supply: { fx: 0.76, row: 1 },
  newact: { fx: 0.12, row: 2 },
  existing: { fx: 0.35, row: 2 },
  col: { fx: 0.63, row: 2 },
  amen: { fx: 0.88, row: 2 },
  coord: { fx: 0.11, row: 3 },
  external: { fx: 0.27, row: 3 },
  inputs: { fx: 0.445, row: 3 },
  housing: { fx: 0.615, row: 3 },
  transport: { fx: 0.78, row: 3 },
  horizontal: { fx: 0.36, row: 4 },
  vertical: { fx: 0.53, row: 4 },
};

/** Label lines per node — long figure labels wrap as they do in the figure.
 *  The root is special-cased: it shows the figure's question, above the node. */
const LINES: Record<string, string[]> = {
  newact: ["Low diversification into", "new activities"],
  existing: ["Low growth of", "existing industries"],
  coord: ["Coordination", "problems"],
};
const linesOf = (n: TreeNodeData) => LINES[n.id] ?? [n.title];

/** The root question, split near its midpoint at a word break. */
const ROOT_LINES = (() => {
  const cut = FIG27_ROOT_QUESTION.lastIndexOf(" ", Math.ceil(FIG27_ROOT_QUESTION.length / 2));
  return [FIG27_ROOT_QUESTION.slice(0, cut), FIG27_ROOT_QUESTION.slice(cut + 1)];
})();

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
  // top pad holds the two root-question lines; bottom pad the row-4 labels
  const rowY = (row: number) => 48 + (row * (H - 88)) / 4;

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
        const parent = FIG27_NODES.find((p) => p.id === n.parent)!;
        const a = nodeAt(n.parent!);
        const b = nodeAt(n.id);
        const lit = onPath(n.id) && onPath(n.parent!);
        const candidate = walking && isChoice(n.id) && onPath(n.parent!);
        // start below the parent's label block so links never cross its text
        // (the root's label sits above the node, so its links start at the dot)
        const startY =
          n.parent === "root" ? a.y + 11 : a.y + 34 + 13 * (linesOf(parent).length - 1);
        return (
          <path
            key={`l-${n.id}`}
            d={`M${a.x},${startY} C${a.x},${(startY + b.y) / 2} ${b.x},${(startY + b.y) / 2} ${b.x},${b.y - 11}`}
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
            {n.id === "root"
              ? ROOT_LINES.map((line, i) => (
                  <text
                    key={i}
                    x={x}
                    y={y - 34 + i * 13}
                    fontSize={11.5}
                    textAnchor="middle"
                    fill="#6b655c"
                  >
                    {line}
                  </text>
                ))
              : linesOf(n).map((line, i) => (
                  <text
                    key={i}
                    x={x}
                    y={y + (choice ? 28 : 22) + i * 13}
                    fontSize={walking ? 12.5 : 11.5}
                    textAnchor="middle"
                    fill={lit ? "#9a6712" : choice ? "#6b4d10" : out ? "#9a9389" : "#6b655c"}
                    fontWeight={lit || choice ? 600 : 400}
                    textDecoration={out ? "line-through" : undefined}
                  >
                    {line}
                  </text>
                ))}
          </g>
        );
      })}
    </svg>
  );
}
