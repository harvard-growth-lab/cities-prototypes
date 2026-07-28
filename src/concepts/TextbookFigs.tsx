/**
 * Second take on the seven concepts — the interactive-textbook figures.
 * Same ideas as the pixel toys above, plated the way a textbook would draw
 * them: axes, flows, curves and levers instead of scenes. Every figure is
 * live — sliders, toggles, draggable dots — and every one reuses the
 * validated diagnosis colors and (for the pizza) the Figure-31 content
 * single-sourced in learning/content/figures.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CONSTRAINT_COLORS,
  FIG31_SCENARIOS,
  scenarioOf,
  wedgePolygon,
} from "../learning/content/figures";
import type { Concept } from "./ConceptsPage";

/* ————— shared: a tiny eased tween for numeric arrays ————— */

export function useTweens(target: number[], dur = 550): number[] {
  const [vals, setVals] = useState(target);
  const valsRef = useRef(vals);
  valsRef.current = vals;
  const key = target.join(",");
  useEffect(() => {
    const to = target;
    const from = valsRef.current.slice();
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      from.length !== to.length
    ) {
      setVals(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setVals(from.map((v, i) => v + (to[i] - v) * e));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dur]);
  return vals;
}

const INK3 = "#4f4a42";
const INK4 = "#9a9389";
const GRID = "#e7e1d3";

/* ============================================================
   F1 · population, plotted — the ballot as an index chart
   ============================================================ */

const FEET_SCEN = [
  { key: "star", label: "Star performer", city: 1.5, peers: 0.8, nation: 0.6 },
  { key: "good", label: "Good — could be great", city: 0.9, peers: 1.4, nation: 0.6 },
  { key: "resil", label: "Resilience in decline", city: 0.4, peers: 0.2, nation: 0.8 },
  { key: "crit", label: "Critical challenge", city: -0.5, peers: 0.4, nation: 0.9 },
] as const;

function FigFeet() {
  const [k, setK] = useState<(typeof FEET_SCEN)[number]["key"]>("star");
  const s = FEET_SCEN.find((x) => x.key === k)!;
  const [city, peers, nation] = useTweens([s.city, s.peers, s.nation]);

  const W = 480;
  const H = 252;
  const x0 = 46;
  const x1 = 400;
  const yOf = (v: number) => 206 - ((v - 92) / (116 - 92)) * 182;
  const end = (r: number) => 100 + r * 10;

  const fasterNation = s.city > s.nation;
  const fasterPeers = s.city > s.peers;

  const line = (r: number, color: string, dash?: string, wgt = 2) => (
    <line x1={x0} y1={yOf(100)} x2={x1} y2={yOf(end(r))} stroke={color} strokeWidth={wgt}
      strokeDasharray={dash} strokeLinecap="round" />
  );

  return (
    <>
      <div className="widget-controls">
        {FEET_SCEN.map((sc) => (
          <button key={sc.key} className="btn" aria-pressed={k === sc.key}
            onClick={() => setK(sc.key)}>
            {sc.label}
          </button>
        ))}
      </div>

      <div className="fig-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="An index chart of population over a decade: the city against its peers and the nation. The chosen scenario sets the slopes.">
          {[95, 100, 105, 110, 115].map((v) => (
            <g key={v}>
              <line x1={x0} y1={yOf(v)} x2={x1} y2={yOf(v)} stroke={v === 100 ? "#d8d2c4" : GRID}
                strokeWidth={1} />
              <text x={x0 - 7} y={yOf(v) + 3.5} textAnchor="end" className="fig-axis">
                {v}
              </text>
            </g>
          ))}
          <text x={x0} y={228} className="fig-axis">
            year 0
          </text>
          <text x={x1} y={228} textAnchor="end" className="fig-axis">
            year 10
          </text>
          <text x={x0 - 32} y={16} className="fig-axis">
            population, indexed to 100
          </text>

          {line(nation, "#4f4a42", "5 5", 1.6)}
          {line(peers, "#b3ab9c", undefined, 2)}
          {line(city, "#cc4948", undefined, 2.6)}

          {(
            [
              ["your city", city, "#cc4948", 700],
              ["peer cities", peers, "#8d867a", 500],
              ["the nation", nation, "#4f4a42", 500],
            ] as const
          ).map(([label, r, color, weight]) => (
            <text key={label} x={x1 + 8} y={yOf(end(r)) + 3.5} fontSize={10.5} fill={color}
              fontWeight={weight}>
              {label}
            </text>
          ))}
        </svg>
      </div>

      <p className="widget-caption">
        {k === "star" && "Beating the nation and the peer group at once — people are choosing this city over every alternative."}
        {k === "good" && "Ahead of the nation, behind the peers: growing, but losing the head-to-head races that matter most."}
        {k === "resil" && "Slower than the nation but ahead of a struggling peer group — decline, weathered better than the neighbors."}
        {k === "crit" && "Shrinking while the nation grows: the strongest signal a diagnosis can start from."}
      </p>

      <div className="mini-table2">
        <span className="mt-corner" />
        <span className="mt-col">faster than peers</span>
        <span className="mt-col">slower than peers</span>
        <span className="mt-row">growing faster than the nation</span>
        <span className={`mt-cell is-good${fasterNation && fasterPeers ? " is-active" : ""}`}>
          Star performer
        </span>
        <span className={`mt-cell${fasterNation && !fasterPeers ? " is-active" : ""}`}>
          Good — could be great
        </span>
        <span className="mt-row">growing slower than the nation</span>
        <span className={`mt-cell${!fasterNation && fasterPeers ? " is-active" : ""}`}>
          Resilience in decline
        </span>
        <span className={`mt-cell is-bad${!fasterNation && !fasterPeers ? " is-active" : ""}`}>
          Critical growth challenge
        </span>
      </div>
    </>
  );
}

function FeetThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[60, 105, 150, 195].map((y) => (
        <line key={y} x1={50} y1={y} x2={430} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <line x1={50} y1={195} x2={430} y2={78} stroke="#cc4948" strokeWidth={5} strokeLinecap="round" />
      <line x1={50} y1={195} x2={430} y2={132} stroke="#b3ab9c" strokeWidth={4} strokeLinecap="round" />
      <line x1={50} y1={195} x2={430} y2={158} stroke="#4f4a42" strokeWidth={3}
        strokeDasharray="9 8" strokeLinecap="round" />
      <circle cx={430} cy={78} r={7} fill="#cc4948" />
    </svg>
  );
}

/* ============================================================
   F2 · the deal always ties — spatial equilibrium as bars
   ============================================================ */

const EQ = { baseWage: 34, baseRent: 8, crowd: 40 };
const TOWNS = [
  { name: "Alba", color: "#3987e5" },
  { name: "Bruma", color: "#9085e9" },
] as const;

function FigEquilibrium() {
  const [raise, setRaise] = useState(0);
  const targetShareB = 0.5 + raise / (2 * EQ.crowd);
  const [shareB] = useTweens([targetShareB], 900);
  const moving = Math.abs(shareB - targetShareB) > 0.004;

  const wage = [EQ.baseWage, EQ.baseWage + raise];
  const rent = [EQ.baseRent + EQ.crowd * (1 - shareB), EQ.baseRent + EQ.crowd * shareB];
  const deal = [wage[0] - rent[0], wage[1] - rent[1]];

  const W = 480;
  const H = 250;
  const base = 196;
  const scale = 2.6;
  const centers = [120, 360];

  return (
    <>
      <div className="fig-slider">
        <span>give Bruma a pay raise</span>
        <input type="range" min={0} max={24} step={1} value={raise}
          onChange={(e) => setRaise(Number(e.target.value))} />
        <span className="readout">+{raise}</span>
      </div>

      <div className="fig-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Two towns as pay and rent bars. Raising Bruma's pay pulls people east until rising rents even the deals back out.">
          <line x1={30} y1={base} x2={W - 30} y2={base} stroke="#d8d2c4" strokeWidth={1.4} />

          {TOWNS.map((t, i) => {
            const cx = centers[i];
            const w = wage[i];
            const r = rent[i];
            return (
              <g key={t.name}>
                <rect x={cx - 46} y={base - w * scale} width={38} height={w * scale}
                  fill={t.color} opacity={0.85} rx={3} />
                <rect x={cx + 8} y={base - r * scale} width={38} height={r * scale}
                  fill="#b3ab9c" rx={3} />
                <text x={cx - 27} y={base - w * scale - 7} textAnchor="middle" fontSize={11}
                  fontWeight={700} fill={t.color}>
                  {Math.round(w)}
                </text>
                <text x={cx + 27} y={base - r * scale - 7} textAnchor="middle" fontSize={11}
                  fill={INK3}>
                  {Math.round(r)}
                </text>
                <text x={cx - 27} y={base + 16} textAnchor="middle" className="fig-axis">
                  pay
                </text>
                <text x={cx + 27} y={base + 16} textAnchor="middle" className="fig-axis">
                  rent
                </text>
                <text x={cx} y={base + 36} textAnchor="middle" fontSize={13} fontWeight={700}
                  fill="#2c2823">
                  {t.name} · {Math.round((i === 0 ? 1 - shareB : shareB) * 100)}% of people
                </text>
              </g>
            );
          })}

          {/* the movers */}
          <g opacity={moving ? 1 : 0.15} style={{ transition: "opacity 0.4s" }}>
            <line x1={205} y1={60} x2={275} y2={60} stroke="#c98500" strokeWidth={3}
              strokeDasharray="7 7" className={moving ? "fig-flow" : undefined} />
            <path d="M275,60 l-9,-6 v12 Z" fill="#c98500" />
            <text x={240} y={46} textAnchor="middle" fontSize={10.5} fill="#9a6712"
              fontWeight={600}>
              {moving ? "people moving toward the better deal" : "flows balanced"}
            </text>
          </g>
        </svg>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">Alba's deal · pay − rent</div>
          <div className="value">{deal[0].toFixed(0)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">Bruma's deal · pay − rent</div>
          <div className="value">{deal[1].toFixed(0)}</div>
        </div>
      </div>

      <p className="widget-caption">
        {raise === 0
          ? "Two identical towns, one bridge: the deals tie at rest. Now drag the slider."
          : moving
            ? "Bruma's deal jumped ahead — and every arrival is bidding its rents up."
            : "Settled: rents rose in Bruma (and eased in Alba) until the deals tied again. Bruma keeps the extra people — the advantage is gone."}
      </p>
      <p className="data-note">
        The textbook name is spatial equilibrium: within a country, moving is easy enough that no
        city can stay a better deal for long. A pay gap that persists is buying off some cost —
        rent, commute, or quality of life.
      </p>
    </>
  );
}

function EquilibriumThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={210} x2={440} y2={210} stroke="#d8d2c4" strokeWidth={2} />
      <rect x={80} y={92} width={44} height={118} rx={4} fill="#3987e5" opacity={0.85} />
      <rect x={134} y={140} width={44} height={70} rx={4} fill="#b3ab9c" />
      <rect x={302} y={70} width={44} height={140} rx={4} fill="#9085e9" opacity={0.85} />
      <rect x={356} y={118} width={44} height={92} rx={4} fill="#b3ab9c" />
      <line x1={196} y1={64} x2={282} y2={64} stroke="#c98500" strokeWidth={5} strokeDasharray="10 9" />
      <path d="M284,64 l-13,-9 v18 Z" fill="#c98500" />
    </svg>
  );
}

/* ============================================================
   F3 · one market, two lines — the metro schematic
   ============================================================ */

/** workers: home position, work position, and whether each falls in the city */
const WORKERS = Array.from({ length: 18 }, (_, i) => {
  const homeInCity = i < 7;
  const workInCity = i < 14;
  const home: [number, number] = homeInCity
    ? [258 + (i % 3) * 26, 96 + Math.floor(i / 3) * 22]
    : [72 + (i % 4) * 30, 82 + Math.floor((i - 7) / 4) * 34]; // suburbs, west
  const work: [number, number] = workInCity
    ? [300 + (i % 4) * 22, 150 + Math.floor((i % 8) / 4) * 24]
    : [140 + (i % 4) * 24, 196]; // the hospital strip outside
  return { home, work, homeInCity, workInCity };
});

function FigIsland() {
  const [noon, setNoon] = useState(false);
  const [line, setLine] = useState<"city" | "metro">("city");
  const inCity = WORKERS.filter((w) => (noon ? w.workInCity : w.homeInCity)).length;

  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!noon} onClick={() => setNoon(false)}>
          Count at midnight
        </button>
        <button className="btn" aria-pressed={noon} onClick={() => setNoon(true)}>
          Count at noon
        </button>
        <span className="control-sep" />
        <button className="btn" aria-pressed={line === "city"} onClick={() => setLine("city")}>
          the city line
        </button>
        <button className="btn" aria-pressed={line === "metro"} onClick={() => setLine("metro")}>
          the metro line
        </button>
      </div>

      <div className="fig-frame">
        <svg viewBox="0 0 480 260" role="img"
          aria-label="A schematic metro: a dashed metro boundary around suburbs and a red city line around downtown. Worker dots slide between homes and jobs as the count switches between midnight and noon.">
          {/* metro boundary */}
          <rect x={20} y={30} width={440} height={210} rx={26} fill="none"
            stroke={line === "metro" ? INK3 : "#c9c2b2"} strokeWidth={line === "metro" ? 2.4 : 1.4}
            strokeDasharray="7 7" style={{ transition: "stroke 0.2s" }} />
          <text x={36} y={54} className="fig-axis"
            fontWeight={line === "metro" ? 700 : 400}>
            THE METRO — one labor market
          </text>

          {/* city boundary */}
          <path d="M236,66 L400,58 L432,120 L412,214 L268,222 L226,150 Z" fill="rgba(204,73,72,0.05)"
            stroke={line === "city" ? "#cc4948" : "#dba5a4"} strokeWidth={line === "city" ? 2.4 : 1.6}
            style={{ transition: "stroke 0.2s" }} />
          <text x={402} y={80} className="fig-axis" fill="#cc4948" textAnchor="end"
            fontWeight={line === "city" ? 700 : 400}>
            the city line
          </text>

          {/* suburbs + hospital, outside the line */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${64 + i * 32}, 60)`}>
              <rect width={16} height={11} y={5} fill="#d8d2c4" />
              <path d="M-2,6 L8,-2 L18,6 Z" fill="#b3ab9c" />
            </g>
          ))}
          <rect x={128} y={204} width={64} height={20} fill="#e4ddcf" stroke="#c9c2b2" />
          <text x={160} y={218} textAnchor="middle" fontSize={9} fill={INK3}>
            hospital
          </text>
          {/* towers inside */}
          {[0, 1, 2].map((i) => (
            <rect key={i} x={306 + i * 26} y={96 - i * 10} width={18} height={58 + i * 10}
              fill="#c9c2b2" />
          ))}

          {/* the workers */}
          {WORKERS.map((w, i) => {
            const [x, y] = noon ? w.work : w.home;
            return (
              <g key={i} style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 0.9s cubic-bezier(.4,0,.3,1)" }}>
                <circle r={4} fill={w.workInCity ? "#1a5a8e" : "#c98500"} opacity={0.85} />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">people inside the city line</div>
          <div className="value">
            {inCity} <span style={{ fontSize: 15 }}>of 18</span>
          </div>
        </div>
        <div className="stat-tile sm">
          <div className="label">cross the line every day</div>
          <div className="value">{WORKERS.filter((w) => w.homeInCity !== w.workInCity).length}</div>
        </div>
      </div>

      <p className="widget-caption">
        {noon
          ? "At noon the city holds most of the valley's workers — count now and you count other towns' residents."
          : "At midnight everyone is home, and the city line matches where people sleep — which is exactly why residence counts alone mislead."}{" "}
        The metro boundary is the one the labor market actually respects.
      </p>
    </>
  );
}

function IslandThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={24} y={36} width={432} height={200} rx={26} fill="none" stroke="#b3ab9c"
        strokeWidth={2.5} strokeDasharray="10 9" />
      <path d="M240,70 L400,62 L432,126 L410,214 L270,222 L228,152 Z" fill="rgba(204,73,72,0.06)"
        stroke="#cc4948" strokeWidth={3} />
      {[
        [80, 90], [116, 120], [88, 158], [140, 82], [150, 180],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} fill="#c98500" />
      ))}
      {[
        [300, 120], [336, 150], [372, 118], [318, 178], [366, 186],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} fill="#1a5a8e" />
      ))}
      <line x1={168} y1={128} x2={272} y2={140} stroke={INK4} strokeWidth={3} strokeDasharray="7 7" />
      <path d="M276,140 l-12,-8 v16 Z" fill={INK4} />
    </svg>
  );
}

/* ============================================================
   F4 · the circular flow — exports as oxygen
   ============================================================ */

function FigOxygen() {
  const [jobs, setJobs] = useState(60);
  const [animJobs] = useTweens([jobs], 450);
  const local = animJobs * 1.8;
  const off = jobs === 0;

  const box = (x: number, y: number, w: number, h: number, title: string, sub: string, dim: boolean) => (
    <g opacity={dim ? 0.35 : 1} style={{ transition: "opacity 0.4s" }}>
      <rect x={x} y={y} width={w} height={h} rx={9} fill="var(--paper, #fff)" stroke="#c9c2b2"
        strokeWidth={1.3} />
      <text x={x + w / 2} y={y + 22} textAnchor="middle" fontSize={12.5} fontWeight={700}
        fill="#2c2823">
        {title}
      </text>
      <text x={x + w / 2} y={y + 38} textAnchor="middle" fontSize={9.5} fill={INK3}>
        {sub}
      </text>
    </g>
  );

  const flowW = 1.6 + (animJobs / 100) * 3.4;

  return (
    <>
      <div className="fig-slider">
        <span>export jobs</span>
        <input type="range" min={0} max={100} step={5} value={jobs}
          onChange={(e) => setJobs(Number(e.target.value))} />
        <span className="readout">{jobs}</span>
      </div>

      <div className="fig-frame">
        <svg viewBox="0 0 480 250" role="img"
          aria-label="A circular-flow diagram: money enters from the rest of the world through export firms, is spent through the local economy, and partly leaks back out as imports. The flows thin as export jobs fall.">
          {box(16, 88, 120, 52, "The rest of", "the world · buyers", off)}
          {box(250, 26, 200, 52, "Export firms", "tradables — goods, surgery, lectures", off)}
          {box(250, 168, 200, 52, "The local economy", "shops · services · landlords", off)}

          {/* world → exporters: the oxygen */}
          <path id="fx-in" d="M136,100 C190,92 200,60 246,54" fill="none" stroke="#c98500"
            strokeWidth={flowW + 1} strokeDasharray="7 8"
            className={off ? undefined : "fig-flow"} opacity={off ? 0.25 : 1} />
          <path d="M246,54 l-10,-5 v11 Z" fill="#c98500" opacity={off ? 0.25 : 1} />
          <text x={168} y={52} fontSize={10} fontWeight={700} fill="#9a6712" opacity={off ? 0.4 : 1}>
            $ export earnings
          </text>

          {/* exporters → local: wages */}
          <path d="M350,78 C350,110 350,130 350,164" fill="none" stroke="#1a5a8e"
            strokeWidth={flowW} strokeDasharray="7 8" className={off ? undefined : "fig-flow"}
            opacity={off ? 0.25 : 1} />
          <path d="M350,164 l-6,-10 h12 Z" fill="#1a5a8e" opacity={off ? 0.25 : 1} />
          <text x={360} y={126} fontSize={10} fontWeight={700} fill="#1a5a8e" opacity={off ? 0.4 : 1}>
            wages, spent in town
          </text>

          {/* the multiplier loop */}
          <path d="M456,194 C478,188 478,148 456,142 C444,138 440,150 446,158" fill="none"
            stroke="#199e70" strokeWidth={2.2} strokeDasharray="6 7"
            className={off ? undefined : "fig-flow"} opacity={off ? 0.25 : 1} />
          <text x={478} y={172} fontSize={10} fontWeight={700} fill="#1a6b53" textAnchor="end"
            transform="rotate(-90 472 172)" opacity={off ? 0.4 : 1}>
            ×1.8
          </text>

          {/* imports leak back */}
          <path d="M250,206 C160,214 120,170 92,144" fill="none" stroke={INK4} strokeWidth={1.6}
            strokeDasharray="3 6" opacity={off ? 0.2 : 0.7} />
          <path d="M92,144 l3,11 8,-7 Z" fill={INK4} opacity={off ? 0.2 : 0.7} />
          <text x={148} y={228} fontSize={9.5} fill={INK4} opacity={off ? 0.35 : 1}>
            some of it leaks back out (imports)
          </text>
        </svg>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">export jobs · the oxygen</div>
          <div className="value">{Math.round(animJobs)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">local jobs they support</div>
          <div className="value">{Math.round(local)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">total employment</div>
          <div className="value">{Math.round(animJobs + local)}</div>
        </div>
      </div>

      <p className="widget-caption">
        {off
          ? "Close the export base and the whole loop stops — the barber's customers were dockworkers. This, not the closure itself, is how a city empties."
          : "Every export job's paycheck gets spent down Main Street: in US cities each one supports roughly 1.6–2.5 local jobs. Slide to zero to hold the city's breath."}
      </p>
    </>
  );
}

function OxygenThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={30} y={104} width={120} height={62} rx={10} fill="#fdfcf8" stroke="#c9c2b2" strokeWidth={2} />
      <rect x={270} y={34} width={180} height={62} rx={10} fill="#fdfcf8" stroke="#c9c2b2" strokeWidth={2} />
      <rect x={270} y={174} width={180} height={62} rx={10} fill="#fdfcf8" stroke="#c9c2b2" strokeWidth={2} />
      <path d="M150,120 C210,110 210,74 264,64" fill="none" stroke="#c98500" strokeWidth={7} strokeDasharray="12 11" />
      <path d="M360,96 C360,120 360,146 360,170" fill="none" stroke="#1a5a8e" strokeWidth={6} strokeDasharray="12 11" />
      <path d="M270,210 C180,220 130,180 100,166" fill="none" stroke="#9a9389" strokeWidth={3.5} strokeDasharray="5 9" />
    </svg>
  );
}

/* ============================================================
   F5 · eight slices, one dot — drag the city (Figure 31)
   ============================================================ */

const PZ = { W: 340, H: 340, pad: 34, dom: 10 };

function pzX(v: number) {
  return PZ.pad + ((v + PZ.dom) / (2 * PZ.dom)) * (PZ.W - 2 * PZ.pad);
}
function pzY(v: number) {
  return PZ.H - PZ.pad - ((v + PZ.dom) / (2 * PZ.dom)) * (PZ.H - 2 * PZ.pad);
}

function FigPizza() {
  const [pt, setPt] = useState<[number, number]>([-2.5, 4.5]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scen = scenarioOf(pt[0], pt[1]);

  const dragTo = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * PZ.W;
    const sy = ((e.clientY - r.top) / r.height) * PZ.H;
    const dx = ((sx - PZ.pad) / (PZ.W - 2 * PZ.pad)) * 2 * PZ.dom - PZ.dom;
    const dy = -(((sy - (PZ.H - PZ.pad)) / (PZ.H - 2 * PZ.pad)) * 2 * PZ.dom + PZ.dom);
    setPt([Math.max(-PZ.dom, Math.min(PZ.dom, dx)), Math.max(-PZ.dom, Math.min(PZ.dom, dy))]);
  };

  return (
    <div className="fig-pizza-row">
      <div className="fig-frame fig-pizza-fig">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PZ.W} ${PZ.H}`}
          role="img"
          aria-label="The eight-slice diagnosis plane: change in population against change in wages. Drag the city dot to land in a slice."
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            dragTo(e);
          }}
          onPointerMove={(e) => e.buttons > 0 && dragTo(e)}
          style={{ touchAction: "none", cursor: "crosshair" }}
        >
          {FIG31_SCENARIOS.map((s) => {
            const poly = wedgePolygon(s.id, [-PZ.dom, PZ.dom], [-PZ.dom, PZ.dom]);
            const active = s.id === scen.id;
            return (
              <polygon key={s.id}
                points={poly.map(([x, y]) => `${pzX(x)},${pzY(y)}`).join(" ")}
                fill={s.color} opacity={active ? 0.32 : 0.1}
                style={{ transition: "opacity 0.2s" }} />
            );
          })}
          {/* axes + diagonals */}
          <line x1={pzX(-PZ.dom)} y1={pzY(0)} x2={pzX(PZ.dom)} y2={pzY(0)} stroke={INK4}
            strokeWidth={0.8} strokeDasharray="4 4" />
          <line x1={pzX(0)} y1={pzY(-PZ.dom)} x2={pzX(0)} y2={pzY(PZ.dom)} stroke={INK4}
            strokeWidth={0.8} strokeDasharray="4 4" />
          <line x1={pzX(-PZ.dom)} y1={pzY(-PZ.dom)} x2={pzX(PZ.dom)} y2={pzY(PZ.dom)}
            stroke={INK4} strokeWidth={0.7} strokeDasharray="2 5" />
          <line x1={pzX(-PZ.dom)} y1={pzY(PZ.dom)} x2={pzX(PZ.dom)} y2={pzY(-PZ.dom)}
            stroke={INK4} strokeWidth={0.7} strokeDasharray="2 5" />
          <text x={pzX(PZ.dom) - 2} y={pzY(0) + 14} textAnchor="end" className="fig-axis">
            Δ population →
          </text>
          <text x={pzX(0) + 6} y={pzY(PZ.dom) + 12} className="fig-axis">
            Δ wages ↑
          </text>

          {/* the city */}
          <g style={{ transform: `translate(${pzX(pt[0])}px, ${pzY(pt[1])}px)` }}>
            <circle r={13} fill="var(--paper, #fff)" opacity={0.85} />
            <circle r={6.5} fill="#1a1714" />
            <text y={-18} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1a1714">
              your city
            </text>
          </g>
        </svg>
      </div>

      <div className="fig-pizza-read">
        <span className="wedge-chip">
          <span className="dot" style={{ background: scen.color }} />
          {scen.quadrant} · {scen.elasticity}
        </span>
        <h4>{scen.title}</h4>
        <p className="fig-pizza-blurb">{scen.blurb}</p>
        <p className="fig-pizza-verdict" style={{ color: CONSTRAINT_COLORS[scen.constrained ? (scen.constraint.toLowerCase().includes("supply") ? "supply" : "demand") : "none"] }}>
          {scen.constraint}
        </p>
      </div>
    </div>
  );
}

function PizzaThumb2() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {FIG31_SCENARIOS.map((s) => {
        const poly = wedgePolygon(s.id, [-10, 10], [-10, 10]);
        return (
          <polygon key={s.id}
            points={poly.map(([x, y]) => `${240 + x * 12},${135 - y * 12}`).join(" ")}
            fill={s.color} opacity={s.id === "4f" ? 0.4 : 0.14} />
        );
      })}
      <line x1={120} y1={135} x2={360} y2={135} stroke={INK4} strokeWidth={1.4} strokeDasharray="6 6" />
      <line x1={240} y1={15} x2={240} y2={255} stroke={INK4} strokeWidth={1.4} strokeDasharray="6 6" />
      <circle cx={216} cy={81} r={12} fill="#1a1714" />
      <circle cx={216} cy={81} r={19} fill="none" stroke="#1a1714" strokeWidth={2} opacity={0.35} />
    </svg>
  );
}

/* ============================================================
   F6 · supply meets the boom — the fortress as curves
   ============================================================ */

function FigFortress() {
  const [strict, setStrict] = useState(0.85);
  const [boom, setBoom] = useState(false);

  const m = 0.15 + strict * 2.05; // supply slope
  const inter = (a: number, mm: number) => {
    const h = (a - 10) / (0.5 + mm);
    return [h, 10 + mm * h] as const;
  };
  const [tm, tBoom] = useTweens([m, boom ? 1 : 0], 500);
  const [h0, p0] = inter(60, tm);
  const [h1, p1] = inter(85, tm);
  const dh = Math.round(h1 - h0);
  const dp = Math.round(p1 - p0);

  const W = 480;
  const H = 268;
  const xOf = (h: number) => 52 + (h / 130) * 396;
  const yOf = (p: number) => 218 - (p / 100) * 190;

  // supply endpoints clipped to the frame
  const hTop = Math.min(130, (100 - 10) / tm);
  const dLine = (a: number) => {
    const hEnd = Math.min(130, a / 0.5);
    return { x1: xOf(0), y1: yOf(a), x2: xOf(hEnd), y2: yOf(a - 0.5 * hEnd) };
  };
  const d0 = dLine(60);
  const d1 = dLine(85);

  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!boom} onClick={() => setBoom(false)}>
          Before the boom
        </button>
        <button className="btn gold" aria-pressed={boom} onClick={() => setBoom(true)}>
          Unleash the boom
        </button>
      </div>
      <div className="fig-slider">
        <span>zoning · loose</span>
        <input type="range" min={0} max={1} step={0.05} value={strict}
          onChange={(e) => setStrict(Number(e.target.value))} />
        <span>fortress</span>
      </div>

      <div className="fig-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="A supply-and-demand diagram for housing. A boom shifts demand out; how steep the rules make the supply curve decides whether the boom becomes homes or prices.">
          <line x1={52} y1={218} x2={448} y2={218} stroke="#c9c2b2" strokeWidth={1.4} />
          <line x1={52} y1={218} x2={52} y2={20} stroke="#c9c2b2" strokeWidth={1.4} />
          <text x={448} y={236} textAnchor="end" className="fig-axis">
            homes →
          </text>
          <text x={40} y={26} textAnchor="end" className="fig-axis" transform="rotate(-90 40 26)">
            price →
          </text>

          {/* demand curves */}
          <line {...d0} stroke={INK4} strokeWidth={1.6} strokeDasharray={boom ? "5 5" : undefined}
            style={{ transition: "all 0.3s" }} />
          <text x={d0.x2 - 4} y={d0.y2 - 6} className="fig-axis">
            D · before
          </text>
          <g opacity={tBoom} style={{ transition: "opacity 0.1s" }}>
            <line {...d1} stroke="#cc4948" strokeWidth={2} />
            <text x={d1.x2 - 4} y={d1.y2 - 6} fontSize={10} fontWeight={700} fill="#cc4948">
              D · the boom
            </text>
          </g>

          {/* supply */}
          <line x1={xOf(0)} y1={yOf(10)} x2={xOf(hTop)} y2={yOf(10 + tm * hTop)}
            stroke="#1a5a8e" strokeWidth={2.4} />
          <text x={xOf(hTop) + 4} y={yOf(10 + tm * hTop) + 4} fontSize={10} fontWeight={700}
            fill="#1a5a8e">
            S · what the rules allow
          </text>

          {/* equilibria */}
          <g>
            <circle cx={xOf(h0)} cy={yOf(p0)} r={4.5} fill={INK4} />
            {[
              [xOf(h0), yOf(p0), xOf(h0), 218],
              [xOf(h0), yOf(p0), 52, yOf(p0)],
            ].map(([a, b, c, d], i) => (
              <line key={i} x1={a} y1={b} x2={c} y2={d} stroke={INK4} strokeWidth={0.8}
                strokeDasharray="3 4" opacity={0.6} />
            ))}
          </g>
          <g opacity={tBoom}>
            <circle cx={xOf(h1)} cy={yOf(p1)} r={5.5} fill="#cc4948" />
            <line x1={xOf(h1)} y1={yOf(p1)} x2={xOf(h1)} y2={218} stroke="#cc4948" strokeWidth={0.9}
              strokeDasharray="3 4" opacity={0.7} />
            <line x1={xOf(h1)} y1={yOf(p1)} x2={52} y2={yOf(p1)} stroke="#cc4948" strokeWidth={0.9}
              strokeDasharray="3 4" opacity={0.7} />
          </g>
        </svg>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">where the boom went · homes</div>
          <div className="value">{boom ? `+${dh}` : "—"}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">where the boom went · prices</div>
          <div className="value">{boom ? `+${dp}` : "—"}</div>
        </div>
      </div>

      <p className="widget-caption">
        {!boom
          ? "The same demand shock is coming either way. The slider sets the only thing the city controls: how steeply its rules price each extra home."
          : strict > 0.6
            ? "A fortress supply curve: the boom climbs the wall and becomes prices. High pay here is mostly the price of admission."
            : "A permissive supply curve: the boom slides along it and becomes neighbors. Rents drift; the skyline does the adjusting."}
      </p>
    </>
  );
}

function FortressThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={60} y1={225} x2={440} y2={225} stroke="#c9c2b2" strokeWidth={2.5} />
      <line x1={60} y1={225} x2={60} y2={30} stroke="#c9c2b2" strokeWidth={2.5} />
      <line x1={60} y1={110} x2={360} y2={200} stroke="#9a9389" strokeWidth={3} strokeDasharray="8 7" />
      <line x1={100} y1={62} x2={430} y2={162} stroke="#cc4948" strokeWidth={4} />
      <line x1={60} y1={210} x2={250} y2={38} stroke="#1a5a8e" strokeWidth={4.5} />
      <circle cx={186} cy={96} r={9} fill="#cc4948" />
      <circle cx={150} cy={128} r={6} fill="#9a9389" />
    </svg>
  );
}

/* ============================================================
   F7 · Liebig's bar chart — the binding constraint
   ============================================================ */

const LB_START = [
  { key: "exports", label: "Exports", h: 82, color: "#1a5a8e" },
  { key: "inputs", label: "Inputs", h: 72, color: "#1a5a8e" },
  { key: "housing", label: "Housing", h: 52, color: "#b07d1e" },
  { key: "transport", label: "Transport", h: 58, color: "#b07d1e" },
  { key: "amenities", label: "Amenities", h: 30, color: "#cc4948" },
];
const LB_TOKENS = 3;
const LB_RAISE = 16;

function FigBarrel() {
  const [bars, setBars] = useState(LB_START);
  const [spent, setSpent] = useState<string[]>([]);
  const water = Math.min(...bars.map((b) => b.h));
  const start = Math.min(...LB_START.map((b) => b.h));
  const gain = water - start;
  const left = LB_TOKENS - spent.length;
  const [animWater] = useTweens([water]);

  const invest = (key: string) => {
    if (left <= 0) return;
    setBars((bs) => bs.map((b) => (b.key === key ? { ...b, h: Math.min(96, b.h + LB_RAISE) } : b)));
    setSpent((sp) => [...sp, key]);
  };

  const W = 480;
  const H = 262;
  const base = 212;
  const scale = 1.85;
  const bw = 54;
  const bx = (i: number) => 54 + i * 72;

  return (
    <>
      <div className="widget-controls">
        <span className="barrel-tokens" aria-live="polite">
          policy bandwidth{" "}
          <b>
            {Array.from({ length: left }, () => "●").join(" ")}
            {left > 0 && spent.length > 0 ? " " : ""}
            <span className="spent">{Array.from({ length: spent.length }, () => "○").join(" ")}</span>
          </b>{" "}
          · click a bar to invest
        </span>
        <span className="control-sep" />
        <button className="btn" onClick={() => { setBars(LB_START); setSpent([]); }}>
          Reset
        </button>
      </div>

      <div className="fig-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Five constraint bars with a dashed growth line at the height of the shortest. Investing in any bar but the shortest leaves the line where it is.">
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={44} y1={base - v * scale} x2={408} y2={base - v * scale} stroke={GRID}
                strokeWidth={1} />
              <text x={36} y={base - v * scale + 3.5} textAnchor="end" className="fig-axis">
                {v}
              </text>
            </g>
          ))}

          {bars.map((b, i) => {
            const isMin = b.h === water;
            return (
              <g key={b.key} onClick={() => invest(b.key)}
                style={{ cursor: left > 0 ? "pointer" : "default" }}>
                <rect x={bx(i)} y={base - b.h * scale} width={bw} height={b.h * scale} rx={3}
                  fill={b.color} fillOpacity={0.16} stroke={b.color}
                  strokeWidth={isMin ? 2 : 1.1}
                  style={{ transition: "all 0.5s cubic-bezier(.2,.8,.3,1)" }} />
                <rect x={bx(i)} y={base - b.h * scale} width={bw} height={5} fill={b.color}
                  style={{ transition: "all 0.5s cubic-bezier(.2,.8,.3,1)" }} />
                <text x={bx(i) + bw / 2} y={base + 15} textAnchor="middle" fontSize={10.5}
                  fontWeight={isMin ? 700 : 450} fill={isMin ? b.color : INK3}>
                  {b.label}
                </text>
                {left > 0 && (
                  <text x={bx(i) + bw / 2} y={base - b.h * scale - 7} textAnchor="middle"
                    fontSize={11} fill={INK4}>
                    +
                  </text>
                )}
              </g>
            );
          })}

          {/* the growth line */}
          <line x1={44} y1={base - animWater * scale} x2={408} y2={base - animWater * scale}
            stroke="#1a1714" strokeWidth={1.8} strokeDasharray="7 5" />
          <text x={414} y={base - animWater * scale + 3.5} fontSize={11} fontWeight={700}
            fill="#1a1714">
            growth = {Math.round(animWater)}
          </text>
          <text x={414} y={base - animWater * scale + 17} fontSize={9} fill={INK3}>
            shortest bar
          </text>
        </svg>
      </div>

      <p className="widget-caption">
        {spent.length === 0
          ? "Three tokens of political attention. Liebig's law, as a bar chart: the dashed line only ever sits on the shortest bar."
          : gain === 0
            ? "The line hasn't moved — every token so far went to a bar that wasn't binding. The chart doesn't care how tall its tallest bar is."
            : `Growth +${gain}. Only tokens spent on the shortest bar moved the line — and whatever is shortest now is tomorrow's diagnosis.`}
      </p>
    </>
  );
}

function BarrelThumb2() {
  const bars = [
    { h: 82, c: "#1a5a8e" },
    { h: 72, c: "#1a5a8e" },
    { h: 52, c: "#b07d1e" },
    { h: 58, c: "#b07d1e" },
    { h: 30, c: "#cc4948" },
  ];
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={44} y1={225 - i * 60} x2={400} y2={225 - i * 60} stroke={GRID} strokeWidth={1.6} />
      ))}
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={64 + i * 70} y={225 - b.h * 2.2} width={50} height={b.h * 2.2} rx={4}
            fill={b.c} fillOpacity={0.16} stroke={b.c} strokeWidth={2} />
          <rect x={64 + i * 70} y={225 - b.h * 2.2} width={50} height={8} fill={b.c} />
        </g>
      ))}
      <line x1={40} y1={225 - 30 * 2.2} x2={430} y2={225 - 30 * 2.2} stroke="#1a1714"
        strokeWidth={3.5} strokeDasharray="12 9" />
    </svg>
  );
}

/* ============================================================
   the seven figures, packaged as concept cards
   ============================================================ */

export const TEXTBOOK_CONCEPTS: Concept[] = [
  {
    id: "fig-feet",
    num: "F1",
    eyebrow: "Population",
    title: "The vote, plotted",
    teaser: "Read the ballot off three slopes: city, peers, nation.",
    lede: "The same running vote as the pixel skyline, drawn the way a report would plot it: population as an index against the nation and the peer group. Pick a situation and read the verdict off the slopes.",
    tag: "the population trend chart at the top of every city profile — same two comparisons, real data.",
    thumb: <FeetThumb />,
    paperThumb: true,
    body: () => <FigFeet />,
  },
  {
    id: "fig-equilibrium",
    num: "F2",
    eyebrow: "Spatial equilibrium",
    title: "The deal always ties",
    teaser: "Raise one town's pay; watch rents drag the deals level.",
    lede: "Two towns as pay-and-rent bars, one slider. Give Bruma a raise and people flow east — but every arrival bids its rents up, and the system settles only when the two deals tie again.",
    tag: "why the tool always reads population and pay together — a persistent pay gap is buying off some cost.",
    thumb: <EquilibriumThumb />,
    paperThumb: true,
    body: () => <FigEquilibrium />,
  },
  {
    id: "fig-island",
    num: "F3",
    eyebrow: "Labor markets",
    title: "One market, two lines",
    teaser: "Count the same valley at midnight and at noon.",
    lede: "A schematic of the valley: the metro's dashed boundary around everything, the city's line through the middle. Flip the clock and watch the same workers change which side of the line they stand on.",
    tag: "the moment a profile zooms out from the city line to the whole metro — and why the numbers after that cover the metro.",
    thumb: <IslandThumb />,
    paperThumb: true,
    body: () => <FigIsland />,
  },
  {
    id: "fig-oxygen",
    num: "F4",
    eyebrow: "Exports",
    title: "The circular flow",
    teaser: "Outside money in, wages around, imports back out.",
    lede: "The economist's own drawing of the oxygen metaphor: money enters through the export firms, circulates through local shops and services with a multiplier, and partly leaks back out. The slider is the city's breath.",
    tag: "the industry treemap in a profile's exports section — the exporting slices are the lungs.",
    thumb: <OxygenThumb />,
    paperThumb: true,
    body: () => <FigOxygen />,
  },
  {
    id: "fig-pizza",
    num: "F5",
    eyebrow: "The pizza chart",
    title: "Eight slices, one dot",
    teaser: "Drag your city around the plane; the slice names the story.",
    lede: "Figure 31 as a live plane: change in population across, change in wages up, eight slices around the middle. Drag the dot anywhere and the slice hands you the scenario and its constraint verdict, verbatim from the figure.",
    tag: "the big scatter of metros in the diagnosis section — hundreds of real cities on these same slices.",
    thumb: <PizzaThumb2 />,
    paperThumb: true,
    body: () => <FigPizza />,
  },
  {
    id: "fig-fortress",
    num: "F6",
    eyebrow: "Housing",
    title: "Supply meets the boom",
    teaser: "One demand shock, one slider for the supply curve's slope.",
    lede: "The fortress city in its native habitat: a supply-and-demand diagram. The boom shifts demand out either way; the zoning slider sets the slope of the supply curve — and with it, whether the shock becomes homes or prices.",
    tag: "the housing branch of the diagnosis — price trends and the construction map test exactly this slope.",
    thumb: <FortressThumb />,
    paperThumb: true,
    body: () => <FigFortress />,
  },
  {
    id: "fig-barrel",
    num: "F7",
    eyebrow: "Binding constraints",
    title: "Liebig's bar chart",
    teaser: "The dashed line only ever sits on the shortest bar.",
    lede: "The barrel, unrolled into a bar chart: five candidate constraints, a dashed growth line at the height of the shortest, and three tokens of attention. Spend them anywhere else and the line does not move.",
    tag: "the end of every diagnosis: find the shortest bar first, because attention spent anywhere else changes nothing.",
    thumb: <BarrelThumb2 />,
    paperThumb: true,
    body: () => <FigBarrel />,
  },
];
