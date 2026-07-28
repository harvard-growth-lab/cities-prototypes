/**
 * The pocket textbook, part A (M1–M10) — how cities grow. The fourth take
 * on the concepts page: fifty micro-pages in the interactive-textbook
 * register, reaching past the paper's seven core ideas onto the wider
 * urban-economics shelf. Part A is population arithmetic and the physics
 * of scale: stocks vs flows, gross vs net, compounding, log scales, the
 * urban wage premium, scaling laws, Zipf, the one-hour city, optimal
 * size, and the three engines of agglomeration.
 */

import { useState } from "react";
import type { Concept } from "./ConceptsPage";
import { useTweens } from "./TextbookFigs";

const INK3 = "#4f4a42";
const INK4 = "#9a9389";
const GRID = "#e7e1d3";
const BLUE = "#1a5a8e";
const GOLD = "#b07d1e";
const RED = "#cc4948";
const GREEN = "#1a6b53";

/* ============================================================
   M1 · the bathtub — stocks are not flows
   ============================================================ */

function MTub() {
  const [inflow, setInflow] = useState(6);
  const [outflow, setOutflow] = useState(6);
  const net = inflow - outflow;
  const busy = inflow + outflow;
  const [level] = useTweens([Math.max(18, Math.min(162, 98 + net * 6))], 600);
  return (
    <>
      <div className="fig-slider">
        <span>arrivals + births</span>
        <input type="range" min={0} max={12} step={1} value={inflow}
          onChange={(e) => setInflow(Number(e.target.value))} />
        <span className="readout">{inflow}k</span>
      </div>
      <div className="fig-slider">
        <span>departures + deaths</span>
        <input type="range" min={0} max={12} step={1} value={outflow}
          onChange={(e) => setOutflow(Number(e.target.value))} />
        <span className="readout">{outflow}k</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="A bathtub: an inflow pipe of arrivals, a drain of departures, and the water level — the population stock — rising or falling with the difference between them.">
          <path d="M118,50 L118,196 L362,196 L362,50" fill="none" stroke="#8d867a"
            strokeWidth={3} strokeLinecap="round" />
          <rect x={121} y={196 - level} width={238} height={level} fill="#5d86b8" opacity={0.45} />
          <rect x={121} y={196 - level} width={238} height={3.5} fill="#8fb4dc" />
          <text x={240} y={Math.min(196 - level + 24, 186)} textAnchor="middle" fontSize={11}
            fontWeight={700} fill="#1a3f66">
            the stock · {Math.round(1800 + (level - 98) * 5)}k people
          </text>
          <path d="M30,34 H146 V58" fill="none" stroke={BLUE} strokeWidth={2 + inflow * 0.45}
            strokeDasharray="7 7" className={inflow > 0 ? "fig-flow" : undefined}
            opacity={inflow ? 0.9 : 0.25} />
          <text x={30} y={20} fontSize={9.5} fontWeight={700} fill={BLUE}>
            arrivals · a flow
          </text>
          <path d="M356,186 H430 V214" fill="none" stroke={GOLD} strokeWidth={2 + outflow * 0.45}
            strokeDasharray="7 7" className={outflow > 0 ? "fig-flow" : undefined}
            opacity={outflow ? 0.9 : 0.25} />
          <text x={436} y={228} textAnchor="end" fontSize={9.5} fontWeight={700} fill={GOLD}>
            departures · a flow
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">net change per year</div>
          <div className="value">{net >= 0 ? "+" : ""}{net}k</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">lives changing address</div>
          <div className="value">{busy}k</div>
        </div>
      </div>
      <p className="widget-caption">
        {net === 0 && busy >= 14
          ? "The level hasn't moved — and fourteen thousand lives changed address. A flat population can hide a roaring labor market underneath."
          : net === 0
            ? "Still water, quiet pipes. Two very different cities can both look like this from the stock alone — always check the pipes."
            : net > 0
              ? "Filling. The census will report the new level; the story is in which pipe changed."
              : "Draining. Nobody decided this level — it's just what the two flows leave behind."}
      </p>
      <p className="data-note">
        Population is a stock; migration and natural change are flows. “The city grew by 9,000”
        is news about the pipes; “the city is 1.9 million” is news about the tub. A diagnosis
        needs both, and mixing them up is the oldest error in the genre.
      </p>
    </>
  );
}

function MTubThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <path d="M120,60 L120,225 L370,225 L370,60" fill="none" stroke="#8d867a" strokeWidth={5}
        strokeLinecap="round" />
      <rect x={125} y={140} width={240} height={85} fill="#5d86b8" opacity={0.5} />
      <rect x={125} y={140} width={240} height={6} fill="#8fb4dc" />
      <path d="M28,42 H150 V72" fill="none" stroke={BLUE} strokeWidth={7} strokeDasharray="12 11" />
      <path d="M365,210 H440 V245" fill="none" stroke={GOLD} strokeWidth={5} strokeDasharray="10 9" />
    </svg>
  );
}

/* ============================================================
   M2 · the revolving door — gross vs net
   ============================================================ */

function MGross() {
  const [churn, setChurn] = useState(4);
  const inn = churn + 2;
  const out = churn + 1;
  return (
    <>
      <div className="fig-slider">
        <span>turn up the churn</span>
        <input type="range" min={0} max={20} step={1} value={churn}
          onChange={(e) => setChurn(Number(e.target.value))} />
        <span className="readout">{inn + out}k</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 190" role="img"
          aria-label="A city box with an in-arrow and an out-arrow. The slider swells both arrows together while the net difference stays fixed at one thousand.">
          <rect x={178} y={58} width={124} height={74} rx={10} fill="var(--paper, #fff)"
            stroke="#c9c2b2" strokeWidth={1.3} />
          <text x={240} y={90} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#2c2823">
            the city
          </text>
          <text x={240} y={108} textAnchor="middle" fontSize={9.5} fill={INK3}>
            net +1k, always
          </text>
          <line x1={40} y1={80} x2={168} y2={80} stroke={BLUE} strokeWidth={1.5 + inn * 0.5}
            strokeDasharray="7 7" className="fig-flow" opacity={0.85} />
          <path d="M174,80 l-11,-7 v14 Z" fill={BLUE} />
          <text x={40} y={58} fontSize={10} fontWeight={700} fill={BLUE}>
            {inn}k move in
          </text>
          <line x1={308} y1={112} x2={432} y2={112} stroke={GOLD} strokeWidth={1.5 + out * 0.5}
            strokeDasharray="7 7" className="fig-flow" opacity={0.85} />
          <path d="M438,112 l-11,-7 v14 Z" fill={GOLD} />
          <text x={438} y={136} textAnchor="end" fontSize={10} fontWeight={700} fill="#785312">
            {out}k move out
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">gross moves</div>
          <div className="value">{inn + out}k</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">net growth</div>
          <div className="value">+1k</div>
        </div>
      </div>
      <p className="widget-caption">
        {churn < 3
          ? "A quiet town: three thousand moves produce the same +1k as the storm at the other end of the slider."
          : churn >= 14
            ? `A revolving door: ${inn + out}k lives rearranged for the same +1k. Churn is opportunity — people trading up jobs, homes, cities — and none of it shows in the net.`
            : "Slide right: the net never budges, the doors never stop. The census prints the net; the economy runs on the gross."}
      </p>
      <p className="data-note">
        Two cities with identical net growth can be opposite economies. Gross flows measure
        dynamism and matching; net measures the residue. Big US metros turn over several
        percent of their population every single year.
      </p>
    </>
  );
}

function MGrossThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={170} y={90} width={140} height={90} rx={12} fill="#fdfcf8" stroke="#c9c2b2"
        strokeWidth={2.5} />
      <line x1={30} y1={115} x2={160} y2={115} stroke={BLUE} strokeWidth={12} strokeDasharray="14 12" />
      <path d="M170,115 l-16,-11 v22 Z" fill={BLUE} />
      <line x1={318} y1={158} x2={434} y2={158} stroke={GOLD} strokeWidth={11} strokeDasharray="14 12" />
      <path d="M450,158 l-16,-11 v22 Z" fill={GOLD} />
    </svg>
  );
}

/* ============================================================
   M3 · the patience of 2% — compounding
   ============================================================ */

const RATE_CHOICES = [
  { r: 1, label: "1% · drift" },
  { r: 2, label: "2% · steady" },
  { r: 3.5, label: "3.5% · boomtown" },
];

function MCompound() {
  const [r, setR] = useState(2);
  const [ar] = useTweens([r], 500);
  const xOf = (t: number) => 46 + (t / 40) * 388;
  const yOf = (v: number) => 208 - (v - 100) * 0.6;
  const path = (rr: number) =>
    "M" +
    Array.from({ length: 21 }, (_, i) => {
      const t = i * 2;
      return `${xOf(t)},${yOf(100 * Math.pow(1 + rr / 100, t))}`;
    }).join(" L");
  const dbl = 70 / ar;
  const end = 100 * Math.pow(1 + ar / 100, 40);
  return (
    <>
      <div className="widget-controls">
        {RATE_CHOICES.map((c) => (
          <button key={c.r} className="btn" aria-pressed={r === c.r} onClick={() => setR(c.r)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 240" role="img"
          aria-label="Population index curves over forty years at one, two and three-and-a-half percent growth, with a marker at the doubling year.">
          {[100, 200, 300, 400].map((v) => (
            <g key={v}>
              <line x1={46} y1={yOf(v)} x2={434} y2={yOf(v)} stroke={v === 100 ? "#d8d2c4" : GRID}
                strokeWidth={1} />
              <text x={40} y={yOf(v) + 3.5} textAnchor="end" className="fig-axis">
                {v}
              </text>
            </g>
          ))}
          <text x={46} y={228} className="fig-axis">year 0</text>
          <text x={434} y={228} textAnchor="end" className="fig-axis">year 40</text>
          {RATE_CHOICES.map((c) => (
            <path key={c.r} d={path(c.r)} fill="none" stroke="#c9c2b2" strokeWidth={1.2} />
          ))}
          <path d={path(ar)} fill="none" stroke={BLUE} strokeWidth={2.6} strokeLinecap="round" />
          {dbl <= 40 && (
            <g>
              <line x1={xOf(dbl)} y1={yOf(200)} x2={xOf(dbl)} y2={208} stroke={GOLD}
                strokeWidth={1.2} strokeDasharray="4 4" />
              <circle cx={xOf(dbl)} cy={yOf(200)} r={5} fill={GOLD} />
              <text x={xOf(dbl)} y={yOf(200) - 10} textAnchor="middle" fontSize={10}
                fontWeight={700} fill="#785312">
                doubled
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">after 40 years · index</div>
          <div className="value">{Math.round(end)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">doubling time</div>
          <div className="value">{Math.round(70 / r)} <span style={{ fontSize: 15 }}>yrs</span></div>
        </div>
      </div>
      <p className="widget-caption">
        {r === 1 && "Drift: +49% in a working lifetime, and the double never arrives on this chart. Nobody notices 1% — which is exactly the danger of it."}
        {r === 2 && "Steady: a doubling every ~35 years. That's a whole second city built on top of the first, once a generation."}
        {r === 3.5 && "Boomtown: doubling every ~20 years. Schools, pipes and homes must double on the same schedule — growth this fast is a construction deadline."}
      </p>
      <p className="data-note">
        The rule of 70: divide 70 by the growth rate for the doubling time. Small differences in
        rates are enormous differences in destinations — which is why the profile obsesses over
        a point or two of growth.
      </p>
    </>
  );
}

function MCompoundThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[70, 130, 190].map((y) => (
        <line key={y} x1={44} y1={y} x2={436} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <path d="M44,220 Q240,214 436,196" fill="none" stroke="#b3ab9c" strokeWidth={4} />
      <path d="M44,220 Q260,200 436,130" fill="none" stroke="#8d867a" strokeWidth={4} />
      <path d="M44,220 Q300,190 436,44" fill="none" stroke={BLUE} strokeWidth={6} />
      <circle cx={436} cy={44} r={9} fill={BLUE} />
    </svg>
  );
}

/* ============================================================
   M4 · the honest axis — linear vs log
   ============================================================ */

const LOG_T = Array.from({ length: 41 }, (_, t) => t);
const logV = (t: number) =>
  t <= 20 ? 100 * Math.pow(1.06, t) : 100 * Math.pow(1.06, 20) * Math.pow(1.015, t - 20);

function MLog() {
  const [logAxis, setLogAxis] = useState(false);
  const [m] = useTweens([logAxis ? 1 : 0], 550);
  const xOf = (t: number) => 46 + (t / 40) * 388;
  const yLin = (v: number) => 208 - (v - 100) * 0.5;
  const yLog = (v: number) => 208 - (Math.log10(v) - 2) * 250;
  const yOf = (v: number) => yLin(v) * (1 - m) + yLog(v) * m;
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!logAxis} onClick={() => setLogAxis(false)}>
          linear scale
        </button>
        <button className="btn" aria-pressed={logAxis} onClick={() => setLogAxis(true)}>
          ratio (log) scale
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 240" role="img"
          aria-label="One growth series drawn on a linear axis, then morphed onto a log axis where equal slopes mean equal growth rates and a kink at year twenty becomes visible.">
          {[100, 200, 300, 400].map((v) => (
            <g key={v} opacity={v === 300 ? 1 - m : 1}>
              <line x1={46} y1={yOf(v)} x2={434} y2={yOf(v)} stroke={GRID} strokeWidth={1} />
              <text x={40} y={yOf(v) + 3.5} textAnchor="end" className="fig-axis">
                {v}
              </text>
            </g>
          ))}
          <text x={46} y={228} className="fig-axis">year 0</text>
          <text x={434} y={228} textAnchor="end" className="fig-axis">year 40</text>
          <line x1={xOf(20)} y1={40} x2={xOf(20)} y2={208} stroke={GOLD} strokeWidth={1}
            strokeDasharray="4 5" opacity={0.35 + m * 0.65} />
          <text x={xOf(20)} y={30} textAnchor="middle" fontSize={9.5} fontWeight={700}
            fill="#785312" opacity={0.35 + m * 0.65}>
            growth halves here
          </text>
          <path
            d={"M" + LOG_T.map((t) => `${xOf(t)},${yOf(logV(t))}`).join(" L")}
            fill="none" stroke={BLUE} strokeWidth={2.6} strokeLinecap="round" />
        </svg>
      </div>
      <p className="widget-caption">
        {logAxis
          ? "On a ratio scale, equal slopes are equal growth rates. Now the kink at year 20 — the moment growth halved — is plain, and the early boom finally looks like one."
          : "Read literally, the late years dwarf the early boom. The axis is lying about the drama: the biggest rise is just the biggest base."}
      </p>
      <p className="data-note">
        Any chart of something that grows by percentages deserves a log axis: equal vertical
        steps become equal doublings. It's the difference between seeing levels and seeing
        growth — and diagnosis is about growth.
      </p>
    </>
  );
}

function MLogThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[60, 120, 180].map((y) => (
        <line key={y} x1={44} y1={y} x2={436} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <path d="M44,230 Q290,222 436,60" fill="none" stroke="#b3ab9c" strokeWidth={4} />
      <path d="M44,230 L240,120 L436,72" fill="none" stroke={BLUE} strokeWidth={6} />
      <circle cx={240} cy={120} r={8} fill={GOLD} />
    </svg>
  );
}

/* ============================================================
   M5 · the urban wage premium
   ============================================================ */

const fmtPop = (thousands: number) =>
  thousands >= 1000 ? `${(thousands / 1000).toFixed(1)}M` : `${Math.round(thousands)}k`;

function MPremium() {
  const [s, setS] = useState(2);
  const [sv] = useTweens([s], 450);
  const wageAt = (d: number) => 100 * Math.pow(1.045, d);
  const xOf = (d: number) => 46 + (d / 7) * 388;
  const yOf = (w: number) => 206 - (w - 100) * 3.2;
  const wage = wageAt(sv);
  return (
    <>
      <div className="fig-slider">
        <span>city size · each step doubles it</span>
        <input type="range" min={0} max={7} step={1} value={s}
          onChange={(e) => setS(Number(e.target.value))} />
        <span className="readout">{fmtPop(50 * Math.pow(2, s))}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 240" role="img"
          aria-label="A curve of wages for the same job against city size on a doubling scale. A dot slides up the curve as the city grows.">
          {[100, 110, 120, 130].map((v) => (
            <g key={v}>
              <line x1={46} y1={yOf(v)} x2={434} y2={yOf(v)} stroke={v === 100 ? "#d8d2c4" : GRID}
                strokeWidth={1} />
              <text x={40} y={yOf(v) + 3.5} textAnchor="end" className="fig-axis">
                {v}
              </text>
            </g>
          ))}
          {[0, 3, 7].map((d) => (
            <text key={d} x={xOf(d)} y={226} textAnchor={d === 0 ? "start" : d === 7 ? "end" : "middle"}
              className="fig-axis">
              {fmtPop(50 * Math.pow(2, d))}
            </text>
          ))}
          <path
            d={"M" + Array.from({ length: 29 }, (_, i) => {
              const d = i * 0.25;
              return `${xOf(d)},${yOf(wageAt(d))}`;
            }).join(" L")}
            fill="none" stroke={BLUE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={xOf(sv)} cy={yOf(wage)} r={7} fill={GOLD} stroke="#785312" strokeWidth={1.5} />
          <text x={xOf(sv)} y={yOf(wage) - 14} textAnchor="middle" fontSize={11} fontWeight={700}
            fill="#785312">
            {Math.round(wage)}
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">same job, this city</div>
          <div className="value">{Math.round(wage)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">premium over the small town</div>
          <div className="value">+{Math.round(wage - 100)}%</div>
        </div>
      </div>
      <p className="widget-caption">
        {s === 0
          ? "The benchmark small town: index 100. Now start doubling."
          : s <= 3
            ? "Each doubling of city size adds roughly 4–5% to the wage for the same job — the urban wage premium, ticking upward."
            : `In the metropolis the premium has compounded to +${Math.round(wage - 100)}%. Rent will claw much of it back (spatial equilibrium) — but the productivity underneath is real.`}
      </p>
      <p className="data-note">
        Estimates put the elasticity at 3–8% per doubling of city size. Part is selection —
        ambitious people move to big cities — but studies that follow the same worker across
        moves keep most of the premium.
      </p>
    </>
  );
}

function MPremiumThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[80, 140, 200].map((y) => (
        <line key={y} x1={44} y1={y} x2={436} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <path d="M44,224 Q240,180 436,84" fill="none" stroke={BLUE} strokeWidth={6} />
      <circle cx={330} cy={126} r={12} fill={GOLD} stroke="#785312" strokeWidth={3} />
    </svg>
  );
}

/* ============================================================
   M6 · the scaling laws — superlinear cities
   ============================================================ */

function MScaling() {
  const [s, setS] = useState(2);
  const soc = 100 * Math.pow(2, 0.15 * s);
  const inf = 100 * Math.pow(2, -0.15 * s);
  const [aSoc, aInf] = useTweens([soc, inf], 500);
  const bar = (x: number, v: number, color: string, label: string, sub: string) => (
    <g>
      <rect x={x} y={196 - v * 0.85} width={104} height={v * 0.85} rx={4} fill={color}
        fillOpacity={0.18} stroke={color} strokeWidth={1.6} />
      <rect x={x} y={196 - v * 0.85} width={104} height={5} fill={color} />
      <text x={x + 52} y={196 - v * 0.85 - 8} textAnchor="middle" fontSize={13} fontWeight={700}
        fill={color}>
        {Math.round(v)}
      </text>
      <text x={x + 52} y={212} textAnchor="middle" fontSize={10} fontWeight={600} fill={INK3}>
        {label}
      </text>
      <text x={x + 52} y={225} textAnchor="middle" fontSize={8.5} fill={INK4}>
        {sub}
      </text>
    </g>
  );
  return (
    <>
      <div className="fig-slider">
        <span>city size</span>
        <input type="range" min={0} max={4} step={0.5} value={s}
          onChange={(e) => setS(Number(e.target.value))} />
        <span className="readout">×{Math.pow(2, s) % 1 === 0 ? Math.pow(2, s) : Math.pow(2, s).toFixed(1)}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 238" role="img"
          aria-label="Two bars indexed to 100: per-person output rises as the city grows while per-person infrastructure falls.">
          <line x1={40} y1={196 - 85} x2={440} y2={196 - 85} stroke="#d8d2c4" strokeWidth={1}
            strokeDasharray="5 5" />
          <text x={440} y={196 - 89} textAnchor="end" className="fig-axis">
            the 1× town = 100
          </text>
          {bar(96, aSoc, BLUE, "output per person", "wages · patents · ideas")}
          {bar(280, aInf, GREEN, "pipe per person", "roads · cables · stations")}
        </svg>
      </div>
      <p className="widget-caption">
        {s === 0
          ? "A town of 1× — both bars at the benchmark. Now grow it."
          : `At ×${Math.pow(2, s) % 1 === 0 ? Math.pow(2, s) : Math.pow(2, s).toFixed(1)} the size: each person produces ~${Math.round(aSoc - 100)}% more, using ~${Math.round(100 - aInf)}% less pavement and pipe. Bigger cities are idea machines and efficiency machines at once.`}
      </p>
      <p className="data-note">
        Urban scaling: socio-economic outputs grow like size^1.15, infrastructure like
        size^0.85 — a regularity found across countries and centuries. The premium isn't free
        (crime and rents scale superlinearly too), but it's why humanity keeps urbanizing.
      </p>
    </>
  );
}

function MScalingThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={130} x2={440} y2={130} stroke="#d8d2c4" strokeWidth={2} strokeDasharray="8 8" />
      <rect x={100} y={64} width={110} height={166} rx={6} fill={BLUE} fillOpacity={0.18}
        stroke={BLUE} strokeWidth={3} />
      <rect x={100} y={64} width={110} height={9} fill={BLUE} />
      <rect x={280} y={162} width={110} height={68} rx={6} fill={GREEN} fillOpacity={0.18}
        stroke={GREEN} strokeWidth={3} />
      <rect x={280} y={162} width={110} height={9} fill={GREEN} />
    </svg>
  );
}

/* ============================================================
   M7 · the rank-size rule — Zipf
   ============================================================ */

const ZIPF: Record<"rule" | "primate", number[]> = {
  rule: [12, 6, 4, 3, 2.4, 2, 1.7, 1.5],
  primate: [18, 3.2, 2.5, 2, 1.6, 1.35, 1.15, 1],
};

function MZipf() {
  const [k, setK] = useState<"rule" | "primate">("rule");
  const anim = useTweens(ZIPF[k], 550);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={k === "rule"} onClick={() => setK("rule")}>
          the rank-size rule
        </button>
        <button className="btn" aria-pressed={k === "primate"} onClick={() => setK("primate")}>
          a primate country
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 238" role="img"
          aria-label="A country's eight largest cities as bars. Under the rank-size rule each is the largest divided by its rank; in a primate country the capital towers over a starved tail.">
          {anim.map((v, i) => (
            <g key={i}>
              <rect x={50 + i * 48} y={206 - v * 10} width={38} height={v * 10} rx={3}
                fill={i === 0 && k === "primate" ? RED : BLUE}
                fillOpacity={0.2} stroke={i === 0 && k === "primate" ? RED : BLUE}
                strokeWidth={1.4} style={{ transition: "stroke 0.3s" }} />
              <rect x={50 + i * 48} y={206 - v * 10} width={38} height={4}
                fill={i === 0 && k === "primate" ? RED : BLUE} style={{ transition: "fill 0.3s" }} />
              <text x={69 + i * 48} y={206 - v * 10 - 6} textAnchor="middle" fontSize={9.5}
                fontWeight={700} fill={INK3}>
                {v.toFixed(1)}m
              </text>
              <text x={69 + i * 48} y={222} textAnchor="middle" className="fig-axis">
                #{i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="widget-caption">
        {k === "rule"
          ? "The strange regularity: sort a country's cities and #2 has half the people of #1, #3 a third, #4 a quarter. Nobody planned this — it emerges, country after country."
          : "A primate country: the capital is five times city #2. Often the signature of centralized states or colonial port geographies — and the tail cities are starved of scale."}
      </p>
      <p className="data-note">
        Zipf's law: on log-log axes, city rank against size is a straight line of slope −1.
        Deviations are diagnostic — they tell you where a country's urban system concentrates
        its chances.
      </p>
    </>
  );
}

function MZipfThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[12, 6, 4, 3, 2.4, 2].map((v, i) => (
        <g key={i}>
          <rect x={54 + i * 64} y={230 - v * 16} width={48} height={v * 16} rx={4}
            fill={BLUE} fillOpacity={0.2} stroke={BLUE} strokeWidth={2.5} />
          <rect x={54 + i * 64} y={230 - v * 16} width={48} height={7} fill={BLUE} />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================
   M8 · the one-hour city — Marchetti's constant
   ============================================================ */

const ERAS = [
  { key: "walk", label: "on foot", speed: 5, note: "Rome, medieval Paris, every city before 1850: about 5 km/h, so about 2.5 km of radius. The one-hour rule, already in charge." },
  { key: "tram", label: "the streetcar", speed: 15, note: "The streetcar tripled the radius — and the first suburbs grew in beads along its lines. Still one hour wide." },
  { key: "car", label: "the car", speed: 40, note: "Forty km/h door-to-door redrew the map: sixty times ancient Rome's area inside the same hour. Sprawl is speed, capitalized." },
  { key: "rail", label: "express rail", speed: 60, note: "Fast, separated transit stretches the hour again — which is how Tokyo can be enormous and still commutable." },
];

function MHour() {
  const [k, setK] = useState("car");
  const era = ERAS.find((e) => e.key === k)!;
  const rKm = era.speed / 2;
  const [rPx] = useTweens([rKm * 3.3], 600);
  return (
    <>
      <div className="widget-controls">
        {ERAS.map((e) => (
          <button key={e.key} className="btn" aria-pressed={k === e.key} onClick={() => setK(e.key)}>
            {e.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="Concentric rings around a home marker showing how far half an hour reaches on foot, by streetcar, by car and by express rail.">
          {ERAS.map((e) => (
            <circle key={e.key} cx={240} cy={116} r={(e.speed / 2) * 3.3} fill="none"
              stroke="#d8d2c4" strokeWidth={1} strokeDasharray="3 5" />
          ))}
          <circle cx={240} cy={116} r={rPx} fill="rgba(26,90,142,0.08)" stroke={BLUE}
            strokeWidth={1.8} />
          <rect x={233} y={111} width={14} height={10} fill={GOLD} />
          <path d="M230,111 L240,103 L250,111 Z" fill="#785312" />
          <text x={240 + rPx * 0.72} y={116 - rPx * 0.72 - 5} fontSize={9.5} fontWeight={700}
            fill={BLUE}>
            {rKm} km
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">half-hour radius</div>
          <div className="value">{rKm} <span style={{ fontSize: 15 }}>km</span></div>
        </div>
        <div className="stat-tile sm">
          <div className="label">reachable area</div>
          <div className="value">{Math.round(Math.PI * rKm * rKm)} <span style={{ fontSize: 15 }}>km²</span></div>
        </div>
      </div>
      <p className="widget-caption">{era.note}</p>
      <p className="data-note">
        Marchetti's constant: across every era and continent, people average about one hour a
        day in motion. Cities don't grow by asking for more patience — they grow by moving
        faster inside the same hour.
      </p>
    </>
  );
}

function MHourThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[30, 65, 105].map((r) => (
        <circle key={r} cx={240} cy={135} r={r} fill="none" stroke="#c9c2b2" strokeWidth={2.5}
          strokeDasharray="6 8" />
      ))}
      <circle cx={240} cy={135} r={105} fill="rgba(26,90,142,0.07)" />
      <rect x={228} y={128} width={24} height={17} fill={GOLD} />
      <path d="M223,128 L240,114 L257,128 Z" fill="#785312" />
    </svg>
  );
}

/* ============================================================
   M9 · the city's sweet spot — agglomeration minus congestion
   ============================================================ */

function MPeak() {
  const [m, setM] = useState(0.3);
  const ben = (x: number) => 34 * Math.log(1 + x);
  const cost = (x: number) => (4.2 - 2.6 * m) * Math.pow(x, 1.55);
  const net = (x: number) => ben(x) - cost(x);
  const xs = Array.from({ length: 41 }, (_, i) => i * 0.25);
  let peak = xs[0];
  for (const x of xs) if (net(x) > net(peak)) peak = x;
  const xOf = (x: number) => 46 + (x / 10) * 388;
  const yOf = (v: number) => 118 - v * 1.15;
  const line = (f: (x: number) => number) =>
    "M" + xs.map((x) => `${xOf(x)},${Math.min(226, yOf(f(x)))}`).join(" L");
  return (
    <>
      <div className="fig-slider">
        <span>congestion management · clogged</span>
        <input type="range" min={0} max={1} step={0.05} value={m}
          onChange={(e) => setM(Number(e.target.value))} />
        <span>smooth</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="Agglomeration benefits and congestion costs against city size, with the net curve peaking at the optimal size. Better congestion management slides the peak toward a larger city.">
          <line x1={46} y1={118} x2={434} y2={118} stroke="#d8d2c4" strokeWidth={1}
            strokeDasharray="5 5" />
          <text x={434} y={228} textAnchor="end" className="fig-axis">city size →</text>
          <path d={line(ben)} fill="none" stroke={GREEN} strokeWidth={1.4} opacity={0.5} />
          <text x={412} y={yOf(ben(9.6)) - 6} fontSize={9} fill={GREEN} textAnchor="end">
            what scale gives
          </text>
          <path d={line((x) => -cost(x))} fill="none" stroke={RED} strokeWidth={1.4} opacity={0.5} />
          <text x={412} y={Math.min(220, yOf(-cost(9.6)) - 6)} fontSize={9} fill={RED} textAnchor="end">
            what crowding takes
          </text>
          <path d={line(net)} fill="none" stroke="#221e19" strokeWidth={2.6} strokeLinecap="round" />
          <line x1={xOf(peak)} y1={yOf(net(peak))} x2={xOf(peak)} y2={118} stroke={GOLD}
            strokeWidth={1.2} strokeDasharray="4 4" />
          <circle cx={xOf(peak)} cy={yOf(net(peak))} r={6} fill={GOLD} stroke="#785312"
            strokeWidth={1.4} />
          <text x={xOf(peak)} y={yOf(net(peak)) - 12} textAnchor="middle" fontSize={10}
            fontWeight={700} fill="#785312">
            the sweet spot
          </text>
        </svg>
      </div>
      <p className="widget-caption">
        {m < 0.35
          ? "Crowding bites early: the city outgrows its plumbing at modest size, and every extra resident costs more than they add."
          : m > 0.7
            ? "Fix the plumbing — transit, courts, sewers, governance — and the same geography carries twice the city before crowding wins."
            : "The optimal size isn't a constant of nature. It's the moving intersection of what scale gives and what crowding takes."}
      </p>
      <p className="data-note">
        “Is this city too big?” is usually the wrong question. The right one: which congestion
        cost curve is too steep — and that's a policy variable, not a fate.
      </p>
    </>
  );
}

function MPeakThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={150} x2={440} y2={150} stroke="#d8d2c4" strokeWidth={2} strokeDasharray="8 8" />
      <path d="M44,148 Q160,40 260,84 Q360,128 436,240" fill="none" stroke="#221e19" strokeWidth={5} />
      <circle cx={205} cy={62} r={11} fill={GOLD} stroke="#785312" strokeWidth={3} />
    </svg>
  );
}

/* ============================================================
   M10 · sharing, matching, learning — the three engines
   ============================================================ */

const ENGINES = [
  { key: "share", label: "sharing", cap: "Six small firms can't each afford a foundry, a test lab, a cargo terminal. Together they can. Scale splits fixed costs — the oldest reason to crowd." },
  { key: "match", label: "matching", cap: "A rare skill meets a rare need: in a village the odds are terrible; in a city someone fits every socket. Better matches, fewer compromises, higher productivity." },
  { key: "learn", label: "learning", cap: "Knowledge leaks — across desks, lunches, defections. Proximity speeds the leak, and the leak is the point: cities are where know-how goes to spread." },
];

const PEG_SHAPES = ["circle", "square", "tri", "diamond"] as const;

function EngineShape({ kind, x, y, color }: { kind: string; x: number; y: number; color: string }) {
  if (kind === "circle") return <circle cx={x} cy={y} r={9} fill={color} />;
  if (kind === "square") return <rect x={x - 8} y={y - 8} width={16} height={16} rx={2} fill={color} />;
  if (kind === "tri") return <path d={`M${x},${y - 10} L${x + 9},${y + 7} L${x - 9},${y + 7} Z`} fill={color} />;
  return <path d={`M${x},${y - 10} L${x + 9},${y} L${x},${y + 10} L${x - 9},${y} Z`} fill={color} />;
}

function MEngines() {
  const [k, setK] = useState("share");
  const active = ENGINES.find((e) => e.key === k)!;
  return (
    <>
      <div className="widget-controls">
        {ENGINES.map((e) => (
          <button key={e.key} className="btn" aria-pressed={k === e.key} onClick={() => setK(e.key)}>
            {e.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="Three schematics of why density pays: firms sharing one big supplier, workers matched to well-fitting jobs, and ideas hopping between people.">
          {k === "share" && (
            <g>
              <rect x={185} y={128} width={110} height={52} rx={8} fill="var(--paper, #fff)"
                stroke={GOLD} strokeWidth={1.8} />
              <text x={240} y={150} textAnchor="middle" fontSize={11} fontWeight={700} fill="#785312">
                the foundry
              </text>
              <text x={240} y={166} textAnchor="middle" fontSize={8.5} fill={INK4}>
                one fixed cost, six users
              </text>
              {[70, 140, 210, 270, 340, 410].map((x, i) => (
                <g key={x}>
                  <line x1={x} y1={52} x2={200 + i * 16} y2={126} stroke="#c9c2b2" strokeWidth={1.2}
                    strokeDasharray="4 4" />
                  <circle cx={x} cy={44} r={11} fill={BLUE} opacity={0.85} />
                </g>
              ))}
            </g>
          )}
          {k === "match" && (
            <g>
              {PEG_SHAPES.map((s, i) => (
                <g key={s}>
                  <line x1={140} y1={40 + i * 44} x2={340} y2={40 + i * 44} stroke={GREEN}
                    strokeWidth={1.6} strokeDasharray="5 5" className="fig-flow" />
                  <EngineShape kind={s} x={120} y={40 + i * 44} color={BLUE} />
                  <EngineShape kind={s} x={360} y={40 + i * 44} color={GOLD} />
                </g>
              ))}
              <text x={120} y={202} textAnchor="middle" className="fig-axis">workers</text>
              <text x={360} y={202} textAnchor="middle" className="fig-axis">jobs</text>
            </g>
          )}
          {k === "learn" && (
            <g>
              {([[100, 70], [210, 44], [330, 76], [150, 156], [280, 168], [400, 140]] as const).map(
                ([x, y], i) => (
                  <g key={i}>
                    {i < 5 && (
                      <line x1={x} y1={y}
                        x2={[210, 330, 400, 280, 400][i]}
                        y2={[44, 76, 140, 168, 140][i]}
                        stroke="#c9c2b2" strokeWidth={1.4} strokeDasharray="4 6"
                        className="fig-flow" />
                    )}
                    <circle cx={x} cy={y} r={13} fill="var(--paper, #fff)" stroke={INK3}
                      strokeWidth={1.6} />
                  </g>
                ),
              )}
              <circle cx={210} cy={44} r={5} fill={GOLD} />
              <text x={210} y={24} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#785312">
                the idea
              </text>
            </g>
          )}
        </svg>
      </div>
      <p className="widget-caption">{active.cap}</p>
      <p className="data-note">
        Sharing, matching, learning — the standard decomposition of agglomeration economies.
        Every profile that shows a wage premium or an industry cluster is showing these three
        engines at work.
      </p>
    </>
  );
}

function MEnginesThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={40} y={150} width={100} height={54} rx={8} fill="#fdfcf8" stroke={GOLD} strokeWidth={3} />
      {[52, 90, 128].map((x) => (
        <circle key={x} cx={x} cy={90} r={12} fill={BLUE} opacity={0.85} />
      ))}
      <circle cx={230} cy={110} r={13} fill={BLUE} />
      <rect x={286} y={97} width={26} height={26} rx={3} fill={GOLD} />
      <line x1={248} y1={110} x2={282} y2={110} stroke={GREEN} strokeWidth={4} strokeDasharray="7 6" />
      <circle cx={396} cy={90} r={16} fill="#fdfcf8" stroke={INK3} strokeWidth={3} />
      <circle cx={430} cy={160} r={16} fill="#fdfcf8" stroke={INK3} strokeWidth={3} />
      <line x1={402} y1={104} x2={424} y2={148} stroke="#c9c2b2" strokeWidth={3} strokeDasharray="5 6" />
      <circle cx={396} cy={90} r={6} fill={GOLD} />
    </svg>
  );
}

/* ============================================================
   the entries
   ============================================================ */

export const MICRO_A: Concept[] = [
  {
    id: "m-tub",
    num: "M1",
    eyebrow: "Population",
    title: "The bathtub",
    teaser: "Two pipes, one level: stocks are not flows.",
    lede: "Population is the water; migration and natural change are the pipes. Work the two sliders and watch what the census reports (the level) drift apart from what the city is actually doing (the pipes).",
    tag: "every population card in a profile — the level is the stock; the interesting news is almost always in a pipe.",
    thumb: <MTubThumb />,
    paperThumb: true,
    body: () => <MTub />,
  },
  {
    id: "m-gross",
    num: "M2",
    eyebrow: "Population",
    title: "The revolving door",
    teaser: "Crank the churn; the net never moves.",
    lede: "Hold net growth fixed at +1k and turn the churn dial. The arrows swell, the net doesn't — and the difference between a quiet town and a revolving door disappears from every headline number.",
    tag: "migration tables that report in-moves and out-moves separately — the gross rows are where the dynamism hides.",
    thumb: <MGrossThumb />,
    paperThumb: true,
    body: () => <MGross />,
  },
  {
    id: "m-compound",
    num: "M3",
    eyebrow: "Growth arithmetic",
    title: "The patience of 2%",
    teaser: "Pick a rate; watch forty years compound.",
    lede: "One percent is invisible, two rebuilds the city each generation, three and a half is a construction deadline. Same chart, forty years — the only difference is the rate.",
    tag: "any growth-rate comparison in a profile: a point of growth is a different destiny, not a rounding error.",
    thumb: <MCompoundThumb />,
    paperThumb: true,
    body: () => <MCompound />,
  },
  {
    id: "m-log",
    num: "M4",
    eyebrow: "Growth arithmetic",
    title: "The honest axis",
    teaser: "Flip to a ratio scale; find the hidden kink.",
    lede: "One series, two axes. On the linear axis the late years look explosive; flip to the log axis and equal slopes become equal growth — and the year the boom actually halved appears out of nowhere.",
    tag: "long-run charts everywhere — when a series grows by percentages, only a log axis shows growth honestly.",
    thumb: <MLogThumb />,
    paperThumb: true,
    body: () => <MLog />,
  },
  {
    id: "m-premium",
    num: "M5",
    eyebrow: "Agglomeration",
    title: "The urban wage premium",
    teaser: "Double the city; the same job pays more.",
    lede: "Slide the city from 50,000 people to six million and watch the wage for the same job climb a few percent per doubling. The premium is the clearest fingerprint agglomeration leaves in the data.",
    tag: "wage comparisons across city sizes in any profile — and the reason pay must always be read next to rents.",
    thumb: <MPremiumThumb />,
    paperThumb: true,
    body: () => <MPremium />,
  },
  {
    id: "m-scaling",
    num: "M6",
    eyebrow: "Agglomeration",
    title: "The scaling laws",
    teaser: "×16 the city: more ideas, less pipe, per person.",
    lede: "Grow the city sixteen-fold and two bars pull apart: output per person rises, infrastructure per person falls. Cities are idea machines and efficiency machines at the same time.",
    tag: "the deep background of every 'why cities?' claim in the framework — scale pays twice.",
    thumb: <MScalingThumb />,
    paperThumb: true,
    body: () => <MScaling />,
  },
  {
    id: "m-zipf",
    num: "M7",
    eyebrow: "Systems of cities",
    title: "The rank-size rule",
    teaser: "Half, a third, a quarter — cities keep rank.",
    lede: "Sort a country's cities by size and a strange regularity appears: each has roughly the largest's population divided by its rank. Toggle to a primate country to see what deviation looks like.",
    tag: "choosing peer cities for a profile — where a city sits in its national hierarchy shapes what it can be compared to.",
    thumb: <MZipfThumb />,
    paperThumb: true,
    body: () => <MZipf />,
  },
  {
    id: "m-hour",
    num: "M8",
    eyebrow: "Urban form",
    title: "The one-hour city",
    teaser: "Cities grow by speed, not patience.",
    lede: "In every era, people budget about an hour a day for getting around — so the city's size is set by how far half an hour reaches. Step through four transport eras and watch the same hour draw four different cities.",
    tag: "the transport branch of the tree — and the reason commuting speed appears in city profiles at all.",
    thumb: <MHourThumb />,
    paperThumb: true,
    body: () => <MHour />,
  },
  {
    id: "m-peak",
    num: "M9",
    eyebrow: "Agglomeration",
    title: "The city's sweet spot",
    teaser: "Benefits minus crowding: slide the peak.",
    lede: "Scale gives (ideas, matches, shared costs); crowding takes (congestion, rents, queues). The net curve peaks — and where it peaks depends on how well the city manages crowding. Slide the plumbing and move the peak.",
    tag: "the whole supply side of the diagnostic tree, drawn as one curve: fixing constraints moves the peak.",
    thumb: <MPeakThumb />,
    paperThumb: true,
    body: () => <MPeak />,
  },
  {
    id: "m-engines",
    num: "M10",
    eyebrow: "Agglomeration",
    title: "Sharing, matching, learning",
    teaser: "The three reasons crowding pays.",
    lede: "Why does putting people near each other make them richer? Three engines: shared fixed costs, better matches, faster-leaking knowledge. One schematic each — click through them.",
    tag: "the standard decomposition behind every agglomeration claim in the paper.",
    thumb: <MEnginesThumb />,
    paperThumb: true,
    body: () => <MEngines />,
  },
];
