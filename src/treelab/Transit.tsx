/**
 * Style study 09 — the metro. The tree as a Beck-style transit diagram:
 * two lines leave The Growth Question — the blue Demand line and the gold
 * Supply line — bending at 45° like a proper subway map, branching at
 * interchange rings, ending at seven termini with route codes. Little
 * trains run four of the routes on a loop (SMIL animateMotion). Hovering
 * a station lights its route from the origin and posts the announcement
 * under the map. Legend box, title placard, terminus ticks — the whole
 * transit-authority apparatus.
 */

import { useMemo, useState } from "react";
import { byId, GIST, pathTo, SHORT, type TNode } from "./model";
import { prefersReducedMotion } from "./useInView";

const W = 1020;
const H = 560;

const BLUE = "#1a5a8e";
const GOLD = "#b07d1e";
const INK = "#221e19";

type Pt = [number, number];

/** station coordinates, hand-placed on the 45° grid */
const ST: Record<string, Pt> = {
  root: [95, 280],
  demand: [310, 200],
  newact: [500, 130],
  coord: [700, 130],
  existing: [460, 270],
  external: [700, 270],
  inputs: [580, 330],
  horizontal: [820, 330],
  vertical: [820, 390],
  supply: [310, 360],
  col: [460, 430],
  housing: [820, 430],
  transport: [820, 490],
  amen: [700, 360],
};

/** track geometry per edge (keyed by the child), parent station → child station */
/** the shared trunk out of the origin runs as two parallel tracks */
const EDGES: Record<string, Pt[]> = {
  demand: [[95, 274], [150, 274], [230, 200], [310, 200]],
  newact: [[310, 200], [360, 200], [430, 130], [500, 130]],
  coord: [[500, 130], [700, 130]],
  existing: [[310, 200], [380, 270], [460, 270]],
  external: [[460, 270], [700, 270]],
  inputs: [[460, 270], [520, 330], [580, 330]],
  horizontal: [[580, 330], [820, 330]],
  vertical: [[580, 330], [640, 390], [820, 390]],
  supply: [[95, 286], [150, 286], [230, 360], [310, 360]],
  col: [[310, 360], [380, 430], [460, 430]],
  housing: [[460, 430], [820, 430]],
  transport: [[460, 430], [520, 490], [820, 490]],
  amen: [[310, 360], [700, 360]],
};

const TERMINUS_CODE: Record<string, string> = {
  coord: "D1",
  external: "D2",
  horizontal: "D3",
  vertical: "D4",
  housing: "S1",
  transport: "S2",
  amen: "S3",
};

/** which stations render as interchange rings (fork points) */
const INTERCHANGE = new Set(["demand", "supply", "existing", "inputs", "col"]);

/** label offset + anchor per station, tuned against the geometry */
const LABEL: Record<string, { dx: number; dy: number; anchor: "start" | "middle" | "end" }> = {
  root: { dx: 0, dy: 34, anchor: "middle" },
  demand: { dx: 0, dy: -16, anchor: "middle" },
  newact: { dx: 0, dy: -16, anchor: "middle" },
  existing: { dx: -2, dy: -16, anchor: "middle" },
  inputs: { dx: -14, dy: -12, anchor: "end" },
  supply: { dx: -14, dy: -14, anchor: "end" },
  col: { dx: -14, dy: -16, anchor: "end" },
  coord: { dx: 38, dy: 4, anchor: "start" },
  external: { dx: 38, dy: 4, anchor: "start" },
  horizontal: { dx: 38, dy: 4, anchor: "start" },
  vertical: { dx: 38, dy: 4, anchor: "start" },
  housing: { dx: 38, dy: 4, anchor: "start" },
  transport: { dx: 38, dy: 4, anchor: "start" },
  amen: { dx: 38, dy: 4, anchor: "start" },
};

function roundedPath(pts: Pt[], r = 16): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const v1: Pt = [x1 - x0, y1 - y0];
    const v2: Pt = [x2 - x1, y2 - y1];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${x1 - (v1[0] / l1) * rr},${y1 - (v1[1] / l1) * rr}`;
    d += ` Q${x1},${y1} ${x1 + (v2[0] / l2) * rr},${y1 + (v2[1] / l2) * rr}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]},${last[1]}`;
}

/** full route root → leaf as one path (for the trains) */
function routePath(leaf: string): string {
  const pts: Pt[] = [];
  for (const n of pathTo(leaf).slice(1)) {
    const seg = EDGES[n.id];
    for (const p of pts.length ? seg.slice(1) : seg) pts.push(p);
  }
  return roundedPath(pts);
}

const TRAINS: { leaf: string; dur: number; begin: string }[] = [
  { leaf: "coord", dur: 15, begin: "0s" },
  { leaf: "vertical", dur: 19, begin: "-7s" },
  { leaf: "housing", dur: 17, begin: "-3s" },
  { leaf: "amen", dur: 12, begin: "-9s" },
];

function lineColor(n: TNode): string {
  return n.side === "supply" ? GOLD : BLUE;
}

export function Transit() {
  const [hov, setHov] = useState<string | null>(null);
  const reduced = useMemo(prefersReducedMotion, []);
  const litPath = hov ? pathTo(hov).map((n) => n.id) : null;
  const lit = (id: string) => !litPath || litPath.includes(id);
  const cap = hov ? byId[hov] : null;

  return (
    <div className="tl-transit">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="The decision tree drawn as a metro map: a blue Demand line and a gold Supply line leave The Growth Question, branch at interchanges, and end at seven terminus stations. Trains run along the routes."
      >
        {/* frame */}
        <rect x={10} y={10} width={W - 20} height={H - 20} rx={14} fill="#ffffff"
          stroke="#d8d3c8" strokeWidth={1.4} />
        <rect x={16} y={16} width={W - 32} height={H - 32} rx={10} fill="none"
          stroke="#ece8df" strokeWidth={1} />

        {/* tracks — each with a white casing so later lines bridge earlier
            ones at crossings, the classic metro-map move */}
        {Object.entries(EDGES).map(([child, pts]) => (
          <g key={child} className="tr-track" opacity={lit(child) ? 1 : 0.16}>
            <path d={roundedPath(pts)} fill="none" stroke="#ffffff" strokeWidth={13.5}
              strokeLinecap="round" strokeLinejoin="round" />
            <path d={roundedPath(pts)} fill="none" stroke={lineColor(byId[child])}
              strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}

        {/* trains */}
        {!reduced &&
          TRAINS.map(({ leaf, dur, begin }) => (
            <g key={leaf} className="tr-train" opacity={lit(leaf) ? 1 : 0.15}>
              <g>
                <rect x={-11} y={-5.5} width={22} height={11} rx={4.5}
                  fill={lineColor(byId[leaf])} stroke="#ffffff" strokeWidth={1.6} />
                <circle cx={-4} cy={0} r={1.6} fill="#ffffff" opacity={0.9} />
                <circle cx={4} cy={0} r={1.6} fill="#ffffff" opacity={0.9} />
                <animateMotion dur={`${dur}s`} begin={begin} repeatCount="indefinite"
                  rotate="auto" path={routePath(leaf)} />
              </g>
            </g>
          ))}

        {/* stations */}
        {Object.keys(ST).map((id) => {
          const n = byId[id];
          const [x, y] = ST[id];
          const { dx, dy, anchor } = LABEL[id];
          const code = TERMINUS_CODE[id];
          const col = lineColor(n);
          return (
            <g
              key={id}
              className="tr-station"
              opacity={lit(id) ? 1 : 0.25}
              onMouseEnter={() => setHov(id)}
              onMouseLeave={() => setHov(null)}
            >
              <circle cx={x} cy={y} r={17} fill="transparent" />
              {code ? (
                <>
                  {/* terminus: perpendicular tick + route chip */}
                  <line x1={x} y1={y - 11} x2={x} y2={y + 11} stroke={col}
                    strokeWidth={7} strokeLinecap="round" />
                  <rect x={x + 14} y={y - 8} width={19} height={16} rx={3.5} fill={col} />
                  <text x={x + 23.5} y={y + 3.5} className="tr-code">
                    {code}
                  </text>
                </>
              ) : id === "root" ? (
                <>
                  <circle cx={x} cy={y} r={11} fill="#ffffff" stroke={INK} strokeWidth={2.6} />
                  <circle cx={x} cy={y} r={4.5} fill={INK} />
                </>
              ) : INTERCHANGE.has(id) ? (
                <circle cx={x} cy={y} r={7} fill="#ffffff" stroke={INK} strokeWidth={2.6} />
              ) : (
                <circle cx={x} cy={y} r={4.8} fill="#ffffff" stroke={col} strokeWidth={2.4} />
              )}
              <text
                x={x + dx}
                y={y + dy}
                textAnchor={anchor}
                className={`tr-label${code ? " tr-label-terminus" : ""}${id === "root" ? " tr-label-root" : ""}`}
              >
                {id === "root" ? "The Growth Question" : SHORT[id]}
              </text>
            </g>
          );
        })}

        {/* title placard */}
        <g className="tr-title">
          <text x={44} y={58} className="tr-title-main">
            Growth Diagnostics Transit Map
          </text>
          <text x={44} y={78} className="tr-title-sub">
            FIG. 27 NETWORK · ALL SERVICE LOCAL · NOT TO SCALE
          </text>
        </g>

        {/* legend */}
        <g className="tr-legend">
          <rect x={786} y={30} width={196} height={86} rx={8} fill="#ffffff"
            stroke="#d8d3c8" strokeWidth={1.2} />
          <text x={800} y={51} className="tr-legend-head">
            CITY LINES
          </text>
          <line x1={800} y1={64} x2={836} y2={64} stroke={BLUE} strokeWidth={7} strokeLinecap="round" />
          <text x={846} y={68} className="tr-legend-item">
            Demand line
          </text>
          <line x1={800} y1={84} x2={836} y2={84} stroke={GOLD} strokeWidth={7} strokeLinecap="round" />
          <text x={846} y={88} className="tr-legend-item">
            Supply line
          </text>
          <circle cx={806} cy={102} r={5} fill="#fff" stroke={INK} strokeWidth={2} />
          <text x={846} y={106} className="tr-legend-item">
            Interchange
          </text>
        </g>
      </svg>

      <p className="tl-transit-caption" aria-live="polite">
        {cap ? (
          <>
            <b style={{ color: cap.side === "supply" ? "#785312" : cap.side === "demand" ? BLUE : INK }}>
              {cap.id === "root" ? "Origin: The Growth Question" : `Next stop: ${SHORT[cap.id]}`}
            </b>{" "}
            — {GIST[cap.id]}
          </>
        ) : (
          "Hover a station to light its route from the origin."
        )}
      </p>
    </div>
  );
}
