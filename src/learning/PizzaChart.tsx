/**
 * The pizza chart — Figure 31 as one canonical component. The plane of
 * population growth (x) × nominal wage growth (y), cut by the US-metro
 * benchmark crosshair and the ±1 elasticity diagonals into 8 wedges.
 *
 * One component, many moods via props: full interactive (stage 5),
 * bare teaser (stage 3), mini verdict (stage 7), click-to-guess (course),
 * drag-the-dot (lab).
 */

import { useMemo, useRef, useState } from "react";
import {
  FIG31_SCENARIOS,
  wedgePolygon,
  scenarioOf,
  type Fig31Scenario,
  type WedgeId,
} from "../content/figures";
import { archetypeMetros, metroCloud, MEDIANS } from "../data/metros";
import { signed } from "../data/derive";
import { useTip } from "./useTip";

export const PIZZA_X: [number, number] = [-1.5, 3.5];
export const PIZZA_Y: [number, number] = [1.6, 6.4];

export interface PizzaPoint {
  x: number; // pop CAGR %/yr
  y: number; // wage CAGR %/yr
  label: string;
  kind: "msa" | "city" | "guess" | "sim";
}

const KIND_STYLE: Record<PizzaPoint["kind"], { fill: string; r: number }> = {
  msa: { fill: "#e8b84b", r: 9 },
  city: { fill: "#1a5a8e", r: 6 },
  guess: { fill: "#7059d6", r: 7 },
  sim: { fill: "#e8b84b", r: 11 },
};

export function PizzaChart({
  showWedges = true,
  showField = true,
  showCorners = true,
  showDiagonals = true,
  mini = false,
  points = [],
  highlightWedge = null,
  onWedgeHover,
  clickToPlace = false,
  onPlace,
  draggable = false,
  onDrag,
  windowLabel = "2017–2023",
}: {
  showWedges?: boolean;
  showField?: boolean;
  showCorners?: boolean;
  showDiagonals?: boolean;
  mini?: boolean;
  points?: PizzaPoint[];
  highlightWedge?: WedgeId | null;
  onWedgeHover?: (s: Fig31Scenario | null) => void;
  clickToPlace?: boolean;
  onPlace?: (popCagr: number, wageCagr: number) => void;
  draggable?: boolean;
  onDrag?: (popCagr: number, wageCagr: number) => void;
  windowLabel?: string;
}) {
  const W = 800;
  const H = mini ? 420 : 520;
  const M = mini
    ? { t: 14, r: 14, b: 14, l: 14 }
    : { t: 30, r: 26, b: 56, l: 66 };

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverWedge, setHoverWedge] = useState<WedgeId | null>(null);
  const dragging = useRef(false);
  const { show, hide, tipEl } = useTip();

  const sx = (v: number) => M.l + ((v - PIZZA_X[0]) / (PIZZA_X[1] - PIZZA_X[0])) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - PIZZA_Y[0]) / (PIZZA_Y[1] - PIZZA_Y[0])) * (H - M.t - M.b);

  /** viewBox px → data coords, clamped to the plot area */
  const toData = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    const x = PIZZA_X[0] + ((px - M.l) / (W - M.l - M.r)) * (PIZZA_X[1] - PIZZA_X[0]);
    const y = PIZZA_Y[0] + ((H - M.b - py) / (H - M.t - M.b)) * (PIZZA_Y[1] - PIZZA_Y[0]);
    return [
      Math.max(PIZZA_X[0] + 0.05, Math.min(PIZZA_X[1] - 0.05, x)),
      Math.max(PIZZA_Y[0] + 0.05, Math.min(PIZZA_Y[1] - 0.05, y)),
    ];
  };

  const cloud = useMemo(() => metroCloud(), []);

  const wedges = useMemo(
    () =>
      FIG31_SCENARIOS.map((s) => {
        const poly = wedgePolygon(
          s.id,
          [PIZZA_X[0] - MEDIANS.popCagr, PIZZA_X[1] - MEDIANS.popCagr],
          [PIZZA_Y[0] - MEDIANS.wageCagr, PIZZA_Y[1] - MEDIANS.wageCagr],
        );
        const d =
          poly
            .map(
              (p, i) =>
                `${i ? "L" : "M"}${sx(p[0] + MEDIANS.popCagr).toFixed(1)},${sy(p[1] + MEDIANS.wageCagr).toFixed(1)}`,
            )
            .join("") + "Z";
        return { s, d };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mini],
  );

  const mx = sx(MEDIANS.popCagr);
  const my = sy(MEDIANS.wageCagr);

  // ±1 diagonals through the benchmark point, clipped to the domains
  const diag = (slope: 1 | -1) => {
    const cands = [
      PIZZA_X[0],
      PIZZA_X[1],
      MEDIANS.popCagr + (PIZZA_Y[0] - MEDIANS.wageCagr) / slope,
      MEDIANS.popCagr + (PIZZA_Y[1] - MEDIANS.wageCagr) / slope,
    ].sort((a, b) => a - b);
    const xa = Math.max(PIZZA_X[0], cands[1]);
    const xb = Math.min(PIZZA_X[1], cands[2]);
    return {
      x1: sx(xa),
      y1: sy(MEDIANS.wageCagr + slope * (xa - MEDIANS.popCagr)),
      x2: sx(xb),
      y2: sy(MEDIANS.wageCagr + slope * (xb - MEDIANS.popCagr)),
    };
  };
  const dUp = diag(1);
  const dDown = diag(-1);

  const activeWedge = hoverWedge ?? highlightWedge;

  const handleWedgeEnter = (s: Fig31Scenario) => {
    setHoverWedge(s.id);
    onWedgeHover?.(s);
  };
  const handleWedgeLeave = () => {
    setHoverWedge(null);
    onWedgeHover?.(null);
  };

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Figure 31: population growth versus wage growth for US metros, ${windowLabel}, cut into eight diagnostic wedges.`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          cursor: clickToPlace ? "crosshair" : draggable ? "default" : undefined,
          touchAction: draggable ? "none" : undefined,
        }}
        onClick={(e) => {
          if (!clickToPlace || !onPlace) return;
          const d = toData(e);
          if (d) onPlace(d[0], d[1]);
        }}
        onPointerMove={(e) => {
          if (dragging.current && onDrag) {
            const d = toData(e);
            if (d) onDrag(d[0], d[1]);
          }
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {/* wedge fills */}
        {showWedges &&
          wedges.map(({ s, d }) => (
            <path
              key={s.id}
              d={d}
              fill={s.color}
              fillOpacity={activeWedge === s.id ? 0.2 : 0.07}
              stroke={activeWedge === s.id ? s.color : "none"}
              strokeWidth={1.2}
              onMouseEnter={() => handleWedgeEnter(s)}
              onMouseLeave={handleWedgeLeave}
              style={{ transition: "fill-opacity 0.15s" }}
            />
          ))}

        {/* corner shock labels */}
        {showCorners && (
          <>
            <text x={M.l + 8} y={M.t + 16} fontSize={mini ? 15 : 12.5} fill="#4f4a42" fontWeight={600}>
              Negative supply shock
              <tspan x={M.l + 8} dy="1.35em" fontWeight={400} fill="#857e73">
                people slow · pay fast
              </tspan>
            </text>
            <text x={W - M.r - 8} y={M.t + 16} fontSize={mini ? 15 : 12.5} fill="#4f4a42" fontWeight={600} textAnchor="end">
              Positive demand shock
              <tspan x={W - M.r - 8} dy="1.35em" fontWeight={400} fill="#857e73">
                people &amp; pay both fast
              </tspan>
            </text>
            <text x={M.l + 8} y={H - M.b - 26} fontSize={mini ? 15 : 12.5} fill="#4f4a42" fontWeight={600}>
              Negative demand shock
              <tspan x={M.l + 8} dy="1.35em" fontWeight={400} fill="#857e73">
                people &amp; pay both slow
              </tspan>
            </text>
            <text x={W - M.r - 8} y={H - M.b - 26} fontSize={mini ? 15 : 12.5} fill="#4f4a42" fontWeight={600} textAnchor="end">
              Positive supply shock
              <tspan x={W - M.r - 8} dy="1.35em" fontWeight={400} fill="#857e73">
                people fast · pay slow
              </tspan>
            </text>
          </>
        )}

        {/* the metro field */}
        {showField && (
          <g>
            {cloud.map((d, i) => (
              <circle
                key={i}
                cx={sx(Math.max(PIZZA_X[0] + 0.12, Math.min(PIZZA_X[1] - 0.12, d.popCagr)))}
                cy={sy(Math.max(PIZZA_Y[0] + 0.12, Math.min(PIZZA_Y[1] - 0.12, d.wageCagr)))}
                r={1.6 + d.size * 1.6}
                fill="#857e73"
                opacity={0.2}
                pointerEvents="none"
              />
            ))}
            {archetypeMetros.map((m) => (
              <circle
                key={m.name}
                cx={sx(m.popCagr)}
                cy={sy(m.wageCagr)}
                r={3 + m.size * 1.2}
                fill="#857e73"
                opacity={0.55}
                onMouseMove={(e) =>
                  show(
                    e,
                    `${m.name} · ${windowLabel}`,
                    <>
                      People {signed(m.popCagr)}%/yr · pay {signed(m.wageCagr)}%/yr.{" "}
                      {m.reading}
                    </>,
                  )
                }
                onMouseLeave={hide}
              />
            ))}
          </g>
        )}

        {/* benchmark crosshair */}
        <line x1={mx} x2={mx} y1={M.t} y2={H - M.b} stroke="#52514e" strokeDasharray="4 5" />
        <line x1={M.l} x2={W - M.r} y1={my} y2={my} stroke="#52514e" strokeDasharray="4 5" />
        {!mini && (
          <>
            <text x={mx + 5} y={H - M.b - 6} fontSize={10.5} fill="#6f6e69">
              US-metro benchmark
            </text>
            <text x={W - M.r - 4} y={my - 6} fontSize={10.5} fill="#6f6e69" textAnchor="end">
              US-metro benchmark
            </text>
          </>
        )}

        {/* elasticity diagonals */}
        {showDiagonals && (
          <>
            <line {...dUp} stroke="#6a5a35" strokeWidth={1} strokeDasharray="7 6" />
            <line {...dDown} stroke="#6a5a35" strokeWidth={1} strokeDasharray="7 6" />
          </>
        )}

        {/* axes */}
        {!mini && (
          <>
            {[-1, 0, 1, 2, 3].map((v) => (
              <text key={`x${v}`} x={sx(v)} y={H - M.b + 18} fontSize={11} fill="#6f6e69" textAnchor="middle">
                {v}%
              </text>
            ))}
            {[2, 3, 4, 5, 6].map((v) => (
              <text key={`y${v}`} x={M.l - 10} y={sy(v) + 4} fontSize={11} fill="#6f6e69" textAnchor="end">
                {v}%
              </text>
            ))}
            <text x={(M.l + W - M.r) / 2} y={H - 12} fontSize={13} fill="#857e73" textAnchor="middle">
              Population growth, %/yr ({windowLabel}) →
            </text>
            <text
              x={20}
              y={(M.t + H - M.b) / 2}
              fontSize={13}
              fill="#857e73"
              textAnchor="middle"
              transform={`rotate(-90 20 ${(M.t + H - M.b) / 2})`}
            >
              Nominal wage growth, %/yr →
            </text>
          </>
        )}

        {/* named points */}
        {points.map((p) => {
          const st = KIND_STYLE[p.kind];
          const cx = sx(p.x);
          const cy = sy(p.y);
          const isSim = p.kind === "sim";
          return (
            <g
              key={`${p.kind}-${p.label}`}
              onPointerDown={(e) => {
                if (isSim && draggable) {
                  dragging.current = true;
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                }
              }}
              onMouseMove={(e) => {
                if (p.kind === "msa" || p.kind === "city") {
                  const sc = scenarioOf(p.x - MEDIANS.popCagr, p.y - MEDIANS.wageCagr);
                  show(
                    e,
                    `${p.label} · ${windowLabel}`,
                    <>
                      People {signed(p.x)}%/yr · pay {signed(p.y)}%/yr — wedge {sc.id},{" "}
                      {sc.title.toLowerCase()}.
                    </>,
                  );
                }
              }}
              onMouseLeave={hide}
              style={isSim && draggable ? { cursor: "grab" } : undefined}
            >
              {isSim && <circle cx={cx} cy={cy} r={22} fill="rgba(232,184,75,0.14)" />}
              <circle
                cx={cx}
                cy={cy}
                r={st.r}
                fill={st.fill}
                stroke="#ffffff"
                strokeWidth={2.5}
                strokeDasharray={p.kind === "guess" ? "3 2" : undefined}
              />
              {p.label && (
                <text x={cx} y={cy - st.r - 6} fontSize={12.5} fill="#1a1714" fontWeight={600} textAnchor="middle">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tipEl}
    </div>
  );
}

/** The wedge explainer card (used beside/below the chart on hover). */
export function WedgeCard({ s, active }: { s: Fig31Scenario; active?: boolean }) {
  return (
    <div
      className="viz-card"
      style={{
        padding: "12px 14px",
        borderColor: active ? s.color : undefined,
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
        <strong style={{ fontSize: 13.5 }}>
          {s.id} · {s.title}
        </strong>
      </div>
      <div className="note" style={{ marginBottom: 4 }}>
        {s.shock} · {s.elasticity} · {s.quadrant}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{s.blurb}</div>
    </div>
  );
}
