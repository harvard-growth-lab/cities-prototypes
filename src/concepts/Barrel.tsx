/**
 * Liebig's barrel with a budget (ported from the sandbox lab). Three
 * investments; each raises one stave. The water — the metro's growth —
 * only rises when you raise the SHORTEST stave. Bang-for-buck, made
 * physical. Dressed like every other widget on the page: controls row
 * on top, the toy in the dark film frame, the talking caption below —
 * so the svg speaks the frame's light inks, not the paper's.
 */

import { useMemo, useState } from "react";

interface Stave {
  key: string;
  label: string;
  h: number; // 0–100
  color: string;
}

const START: Stave[] = [
  { key: "exports", label: "Exports", h: 82, color: "#4f95e8" },
  { key: "inputs", label: "Inputs", h: 72, color: "#4f95e8" },
  { key: "housing", label: "Housing", h: 52, color: "#c98500" },
  { key: "transport", label: "Transport", h: 58, color: "#c98500" },
  { key: "amenities", label: "Amenities", h: 30, color: "#e66767" },
];

const TOKENS = 3;
const RAISE = 16;

export function Barrel() {
  const [staves, setStaves] = useState(START);
  const [spent, setSpent] = useState<string[]>([]);

  const water = Math.min(...staves.map((s) => s.h));
  const startWater = Math.min(...START.map((s) => s.h));
  const gain = water - startWater;
  const tokensLeft = TOKENS - spent.length;

  const invest = (key: string) => {
    if (tokensLeft <= 0) return;
    setStaves((ss) => ss.map((s) => (s.key === key ? { ...s, h: Math.min(96, s.h + RAISE) } : s)));
    setSpent((sp) => [...sp, key]);
  };

  const reset = () => {
    setStaves(START);
    setSpent([]);
  };

  const wasted = useMemo(
    () => spent.filter((k) => START.find((s) => s.key === k)!.h > startWater).length,
    [spent, startWater],
  );

  const W = 560;
  const H = 300;
  const bx = 60;
  const by = H - 40;
  const sw = 72;
  const scale = 2.2;

  return (
    <>
      <div className="widget-controls">
        <span className="barrel-tokens" aria-live="polite">
          policy bandwidth{" "}
          <b>
            {Array.from({ length: tokensLeft }, () => "●").join(" ")}
            {tokensLeft > 0 && spent.length > 0 ? " " : ""}
            <span className="spent">{Array.from({ length: spent.length }, () => "○").join(" ")}</span>
          </b>{" "}
          · {tokensLeft} of {TOKENS} left — click a stave to invest
        </span>
        <span className="control-sep" />
        <button className="btn" onClick={reset}>
          Reset
        </button>
      </div>

      <div className="sim-inset barrel-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Liebig's barrel: water at ${water}, limited by the shortest stave.`}>
          {/* water */}
          <rect
            x={bx - 2}
            y={by - water * scale}
            width={staves.length * sw + 4}
            height={water * scale}
            fill="#5d86b8"
            opacity={0.55}
            style={{ transition: "all 0.6s cubic-bezier(.2,.8,.3,1)" }}
          />
          <rect
            x={bx - 2}
            y={by - water * scale}
            width={staves.length * sw + 4}
            height={4}
            fill="#8fb4dc"
            style={{ transition: "all 0.6s cubic-bezier(.2,.8,.3,1)" }}
          />
          {/* staves */}
          {staves.map((s, i) => {
            const x = bx + i * sw;
            const isMin = s.h === water;
            return (
              <g key={s.key} onClick={() => invest(s.key)} style={{ cursor: tokensLeft > 0 ? "pointer" : "default" }}>
                <rect
                  x={x}
                  y={by - s.h * scale}
                  width={sw - 8}
                  height={s.h * scale}
                  fill={i % 2 ? "#4a3a22" : "#544228"}
                  stroke={isMin ? s.color : "none"}
                  strokeWidth={2}
                  style={{ transition: "all 0.5s cubic-bezier(.2,.8,.3,1)" }}
                />
                <rect x={x} y={by - s.h * scale} width={sw - 8} height={6} fill={s.color} style={{ transition: "all 0.5s" }} />
                <text x={x + (sw - 8) / 2} y={by + 16} fontSize={11.5} fill={isMin ? s.color : "#a6a29a"} textAnchor="middle" fontWeight={isMin ? 700 : 400}>
                  {s.label}
                </text>
                <text x={x + (sw - 8) / 2} y={by - s.h * scale - 8} fontSize={11} fill="#8b8a84" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {s.h}
                </text>
                {tokensLeft > 0 && (
                  <text x={x + (sw - 8) / 2} y={by - s.h * scale + 22} fontSize={14} fill="#f4f3ee" textAnchor="middle" opacity={0.75}>
                    +
                  </text>
                )}
              </g>
            );
          })}
          {/* hoops */}
          <rect x={bx - 6} y={by - 34} width={staves.length * sw + 8} height={5} fill="#241c10" rx={2} pointerEvents="none" />
          <rect x={bx - 6} y={by - 58} width={staves.length * sw + 8} height={5} fill="#241c10" rx={2} pointerEvents="none" />
          {/* water gauge */}
          <text x={W - 24} y={by - water * scale + 4} fontSize={13} fill="#ffd76a" textAnchor="end" fontWeight={700} pointerEvents="none" style={{ fontVariantNumeric: "tabular-nums" }}>
            {water}
          </text>
          <text x={W - 24} y={by - water * scale + 18} fontSize={10.5} fill="#a6a29a" textAnchor="end" pointerEvents="none">
            growth level
          </text>
        </svg>
      </div>

      <p className="widget-caption">
        {spent.length === 0 ? (
          <>Spend all three on the export engine and watch the water not move an inch.</>
        ) : gain === 0 ? (
          <>
            {spent.length} investment{spent.length > 1 ? "s" : ""}, zero growth — every token went
            to a stave that wasn't binding. The barrel doesn't care how tall its tallest plank is.
          </>
        ) : wasted > 0 ? (
          <>
            Growth +{gain}: the tokens that hit the shortest stave moved the water; the {wasted}{" "}
            spent elsewhere changed nothing. Sequence matters — fix the binding constraint first.
          </>
        ) : (
          <>
            Growth +{gain} — every token on the binding constraint. That's the whole doctrine:
            scarce bandwidth goes to the shortest stave, and the next-shortest becomes tomorrow's
            diagnosis{water === Math.min(...staves.filter((s) => s.key !== "amenities").map((s) => s.h)) ? " (see who's binding now)" : ""}.
          </>
        )}
      </p>
      <p className="data-note">
        The staves are the things a city needs to grow, drawn at how much room each one has. The
        water is the city's growth — it only ever rises to the shortest stave: the binding
        constraint.
      </p>
    </>
  );
}
