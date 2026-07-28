/**
 * The pocket textbook, part B (M11–M20) — land and housing. The bid-rent
 * curve, the density gradient, filtering, vacancy as musical chairs, rent
 * ceilings, the missing middle, parking mandates, greenbelts, the holdout
 * problem, and capitalization.
 */

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Concept } from "./ConceptsPage";
import { useTweens } from "./TextbookFigs";

const INK3 = "#4f4a42";
const INK4 = "#9a9389";
const GRID = "#e7e1d3";
const BLUE = "#1a5a8e";
const GOLD = "#b07d1e";
const RED = "#cc4948";
const GREEN = "#1a6b53";

/** deterministic pseudo-random in [0,1) from a seed string (FNV-1a + avalanche,
 *  so consecutive seeds like "a1"/"a2" land far apart) */
function rnd(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 1597334677);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* ============================================================
   M11 · the bid-rent curve
   ============================================================ */

function MBidRent() {
  const [c, setC] = useState(5);
  const [ac] = useTweens([c], 450);
  const edge = 50 / ac;
  const xOf = (d: number) => 46 + (d / 25) * 388;
  const yOf = (r: number) => 200 - r * 2.5;
  return (
    <>
      <div className="fig-slider">
        <span>cost of a kilometer</span>
        <input type="range" min={2} max={10} step={0.5} value={c}
          onChange={(e) => setC(Number(e.target.value))} />
        <span className="readout">{c}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="Rent against distance from the center: a line falling at the cost of commuting until it meets flat farmland rent, where the city ends. Cheaper transport flattens the line and pushes the edge out.">
          {[20, 40, 60].map((r) => (
            <line key={r} x1={46} y1={yOf(r)} x2={434} y2={yOf(r)} stroke={GRID} strokeWidth={1} />
          ))}
          <line x1={46} y1={yOf(12)} x2={434} y2={yOf(12)} stroke="#a89f8e" strokeWidth={1.2}
            strokeDasharray="5 5" />
          <text x={434} y={yOf(12) - 5} textAnchor="end" fontSize={9} fill={INK4}>
            what a farmer pays
          </text>
          <text x={46} y={224} className="fig-axis">downtown</text>
          <text x={434} y={224} textAnchor="end" className="fig-axis">25 km out</text>
          <line x1={xOf(0)} y1={yOf(62)} x2={xOf(Math.min(25, edge))} y2={yOf(62 - ac * Math.min(25, edge))}
            stroke={BLUE} strokeWidth={2.6} strokeLinecap="round" />
          <line x1={xOf(Math.min(25, edge))} y1={yOf(12)} x2={xOf(25)} y2={yOf(12)}
            stroke={BLUE} strokeWidth={1.6} opacity={0.4} />
          {Array.from({ length: Math.floor(Math.min(25, edge) / 2.5) }, (_, i) => {
            const x = xOf(1.4 + i * 2.5);
            return <path key={i} d={`M${x - 5},206 L${x},199 L${x + 5},206 Z`} fill="#8d867a" />;
          })}
          <line x1={xOf(edge)} y1={yOf(12)} x2={xOf(edge)} y2={68} stroke={GOLD} strokeWidth={1.2}
            strokeDasharray="4 4" />
          <text x={xOf(edge)} y={58} textAnchor="middle" fontSize={9.5} fontWeight={700}
            fill="#785312">
            the city ends here
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">city radius</div>
          <div className="value">{edge.toFixed(1)} <span style={{ fontSize: 15 }}>km</span></div>
        </div>
        <div className="stat-tile sm">
          <div className="label">rent cliff · center vs edge</div>
          <div className="value">62 → 12</div>
        </div>
      </div>
      <p className="widget-caption">
        {c >= 7
          ? "Movement is dear, so location is dear: a steep rent cliff and a tight city. Everyone pays to be near."
          : c <= 3.5
            ? "Cheap movement flattens the gradient and flings the edge outward — the car built the suburbs by tilting exactly this line."
            : "Rent is what you pay to not commute: the line falls at precisely the cost of the kilometers it saves you."}
      </p>
      <p className="data-note">
        The bid-rent curve — the oldest diagram in urban economics. Every household's
        rent-versus-commute choice is an arbitrage along this line, and the city's edge is
        where a farmer outbids a resident.
      </p>
    </>
  );
}

function MBidRentThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[80, 140].map((y) => (
        <line key={y} x1={44} y1={y} x2={436} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <line x1={44} y1={200} x2={436} y2={200} stroke="#a89f8e" strokeWidth={2.5} strokeDasharray="9 8" />
      <line x1={44} y1={48} x2={330} y2={200} stroke={BLUE} strokeWidth={6} strokeLinecap="round" />
      <line x1={330} y1={62} x2={330} y2={214} stroke={GOLD} strokeWidth={2.5} strokeDasharray="6 6" />
      {[90, 150, 210, 270].map((x) => (
        <path key={x} d={`M${x - 8},226 L${x},214 L${x + 8},226 Z`} fill="#8d867a" />
      ))}
    </svg>
  );
}

/* ============================================================
   M12 · the density gradient — skylines are rent made visible
   ============================================================ */

function MGradient() {
  const [poly, setPoly] = useState(false);
  const target = Array.from({ length: 13 }, (_, i) => {
    const mono = 150 * Math.exp(-0.28 * i) + 6;
    const hub = poly ? 95 * Math.exp(-0.5 * (i - 9) * (i - 9)) : 0;
    return mono + hub;
  });
  const anim = useTweens(target, 600);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!poly} onClick={() => setPoly(false)}>
          one downtown
        </button>
        <button className="btn" aria-pressed={poly} onClick={() => setPoly(true)}>
          a transit hub opens at km 9
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="A row of buildings falling in height with distance from downtown. When a transit hub opens further out, the skyline grows a second peak above it.">
          <line x1={40} y1={200} x2={440} y2={200} stroke="#8d867a" strokeWidth={1.6} />
          {anim.map((h, i) => (
            <g key={i}>
              <rect x={46 + i * 30} y={200 - h} width={24} height={h} rx={2} fill={BLUE}
                fillOpacity={0.18} stroke={BLUE} strokeWidth={1.2} />
              <rect x={46 + i * 30} y={200 - h} width={24} height={4} fill={BLUE} />
            </g>
          ))}
          <text x={58} y={218} textAnchor="middle" className="fig-axis">km 0</text>
          <text x={46 + 9 * 30 + 12} y={218} textAnchor="middle" className="fig-axis"
            fontWeight={poly ? 700 : 400}>
            km 9
          </text>
          {poly && (
            <circle cx={46 + 9 * 30 + 12} cy={228} r={3.5} fill={GOLD} />
          )}
        </svg>
      </div>
      <p className="widget-caption">
        {poly
          ? "A new station is a mountain-builder: access spikes at km 9 and the skyline grows a second peak above it. Cities stay monocentric only until the next fast link."
          : "Rent made visible: the skyline is the bid-rent curve, extruded. Height falls off with distance at exactly the rate access decays."}
      </p>
      <p className="data-note">
        Building heights track land values, and land values track access. Which is why a
        subway map and a skyline photograph of the same city contain nearly the same
        information.
      </p>
    </>
  );
}

function MGradientThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={228} x2={444} y2={228} stroke="#8d867a" strokeWidth={3} />
      {[170, 120, 84, 60, 42, 30, 22, 58, 96, 52, 24, 18].map((h, i) => (
        <g key={i}>
          <rect x={44 + i * 33} y={228 - h} width={26} height={h} rx={2} fill={BLUE}
            fillOpacity={0.18} stroke={BLUE} strokeWidth={2} />
          <rect x={44 + i * 33} y={228 - h} width={26} height={6} fill={BLUE} />
        </g>
      ))}
      <circle cx={44 + 8 * 33 + 13} cy={248} r={6} fill={GOLD} />
    </svg>
  );
}

/* ============================================================
   M13 · filtering — housing trickles down as vacancy
   ============================================================ */

const TIERS = ["new & shiny", "10 years old", "30 years old", "60 years old · cheapest"];

function MFilter() {
  const [mode, setMode] = useState<"build" | "ban" | null>(null);
  const [n, setN] = useState(0);
  const [freed, setFreed] = useState(0);
  const [wars, setWars] = useState(0);
  const fire = (m: "build" | "ban") => {
    setMode(m);
    setN((x) => x + 1);
    if (m === "build") setFreed((x) => x + 1);
    else setWars((x) => x + 1);
  };
  return (
    <>
      <div className="widget-controls">
        <button className="btn gold" onClick={() => fire("build")}>
          build a new tower uptown
        </button>
        <button className="btn" onClick={() => fire("ban")}>
          ban it — the buyers still come
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="A four-rung housing ladder from new to sixty years old. Building at the top sends a chain of moves down the ladder freeing the cheapest home; banning the top sends bidding pressure down the ladder instead.">
          {TIERS.map((t, i) => (
            <g key={t}>
              <rect x={120} y={22 + i * 50} width={200} height={36} rx={6}
                fill="var(--paper, #fff)" stroke="#c9c2b2" strokeWidth={1.2} />
              <path d={`M126,${22 + i * 50} L220,${10 + i * 50} L314,${22 + i * 50}`} fill="none"
                stroke="#c9c2b2" strokeWidth={1.2} />
              <text x={220} y={44 + i * 50} textAnchor="middle" fontSize={10.5} fontWeight={600}
                fill={INK3}>
                {t}
              </text>
            </g>
          ))}
          {mode === "build" && (
            <g key={`b${n}`}>
              <rect x={352} y={10} width={94} height={40} rx={6} fill={GOLD} fillOpacity={0.14}
                stroke={GOLD} strokeWidth={1.6} className="sk-pop" />
              <text x={399} y={34} textAnchor="middle" fontSize={10} fontWeight={700} fill="#785312">
                the tower
              </text>
              {[0, 1, 2, 3].map((i) => (
                <g key={i} className="sk-pop" style={{ animationDelay: `${0.18 + i * 0.22}s` }}>
                  <path
                    d={i === 0
                      ? "M352,36 C336,36 330,38 324,40"
                      : `M340,${30 + i * 50} C356,${22 + i * 50} 356,${64 + (i - 1) * 50} 340,${56 + (i - 1) * 50}`}
                    fill="none" stroke={GOLD} strokeWidth={2.2} strokeDasharray="5 4" />
                  <path
                    d={i === 0 ? "M322,41 l10,-6 v10 Z" : `M338,${54 + (i - 1) * 50} l10,4 -8,7 Z`}
                    fill={GOLD} />
                </g>
              ))}
              <g className="sk-pop" style={{ animationDelay: "1.1s" }}>
                <rect x={30} y={176} width={78} height={30} rx={15} fill={GREEN} fillOpacity={0.12}
                  stroke={GREEN} strokeWidth={1.4} />
                <text x={69} y={195} textAnchor="middle" fontSize={9} fontWeight={700} fill={GREEN}>
                  vacancy!
                </text>
              </g>
            </g>
          )}
          {mode === "ban" && (
            <g key={`x${n}`}>
              <rect x={352} y={10} width={94} height={40} rx={6} fill="none" stroke={RED}
                strokeWidth={1.6} strokeDasharray="5 4" className="sk-pop" />
              <line x1={360} y1={16} x2={438} y2={44} stroke={RED} strokeWidth={2} className="sk-pop" />
              <text x={399} y={34} textAnchor="middle" fontSize={10} fontWeight={700} fill={RED}
                opacity={0.8}>
                denied
              </text>
              {[0, 1, 2, 3].map((i) => (
                <text key={i} x={86} y={46 + i * 50} textAnchor="middle" fontSize={13}
                  fontWeight={700} fill={RED} className="sk-pop"
                  style={{ animationDelay: `${0.2 + i * 0.22}s` }}>
                  +$ ↑
                </text>
              ))}
            </g>
          )}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">cheap homes freed</div>
          <div className="value">{freed}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">bidding wars started</div>
          <div className="value">{wars}</div>
        </div>
      </div>
      <p className="widget-caption">
        {mode === "build"
          ? "One luxury tower, four moves: everyone shuffles up a rung and the cheapest home in town goes vacant. New housing at the top filters down — as vacancy."
          : mode === "ban"
            ? "The tower is refused but the buyers don't vanish: they bid for the next rung down, and the pressure cascades to the bottom as prices instead of vacancies."
            : "Housing trickles down the ladder as it ages — as long as the top keeps getting built. Try both buttons."}
      </p>
      <p className="data-note">
        Filtering: most affordable housing was once someone's new housing. Vacancy-chain
        studies find one new market-rate building loosens units across the whole ladder within
        a few years — including at the bottom.
      </p>
    </>
  );
}

function MFilterThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={130} y={34 + i * 58} width={220} height={40} rx={7} fill="#fdfcf8"
            stroke="#c9c2b2" strokeWidth={2} />
          <path d={`M138,${34 + i * 58} L240,${18 + i * 58} L342,${34 + i * 58}`} fill="none"
            stroke="#c9c2b2" strokeWidth={2} />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M368,${100 + i * 58} C390,${88 + i * 58} 390,${60 + i * 58} 368,${50 + i * 58}`}
          fill="none" stroke={GOLD} strokeWidth={4} strokeDasharray="8 6" />
      ))}
    </svg>
  );
}

/* ============================================================
   M14 · musical chairs — vacancy sets the price
   ============================================================ */

function MChairs() {
  const [homes, setHomes] = useState(11);
  const price = 100 + (12 - homes) * 11;
  const [aPrice] = useTweens([price], 500);
  const short = Math.max(0, 12 - homes);
  const spare = Math.max(0, homes - 12);
  return (
    <>
      <div className="fig-slider">
        <span>homes on the block · 12 households</span>
        <input type="range" min={10} max={14} step={1} value={homes}
          onChange={(e) => setHomes(Number(e.target.value))} />
        <span className="readout">{homes}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="A grid of fourteen lots holding twelve households. Fewer homes than households leaves families hunting and prices bid up; spare homes show for-rent signs and discipline prices.">
          {Array.from({ length: 14 }, (_, i) => {
            const x = 40 + (i % 7) * 60;
            const y = 34 + Math.floor(i / 7) * 78;
            const built = i < homes;
            const occupied = i < Math.min(12, homes);
            return (
              <g key={i}>
                {built ? (
                  <>
                    <rect x={x} y={y + 12} width={40} height={30} fill="#efe9db" stroke="#c9c2b2" />
                    <path d={`M${x - 3},${y + 12} L${x + 20},${y - 3} L${x + 43},${y + 12} Z`}
                      fill="#b3ab9c" />
                    {occupied ? (
                      <circle cx={x + 20} cy={y + 28} r={6} fill={BLUE} opacity={0.85} />
                    ) : (
                      <text x={x + 20} y={y + 32} textAnchor="middle" fontSize={7.5}
                        fontWeight={700} fill={GREEN}>
                        FOR RENT
                      </text>
                    )}
                  </>
                ) : (
                  <rect x={x} y={y + 6} width={40} height={36} rx={3} fill="none" stroke="#d8d2c4"
                    strokeWidth={1.2} strokeDasharray="4 4" />
                )}
              </g>
            );
          })}
          {Array.from({ length: short }, (_, i) => (
            <g key={i}>
              <circle cx={452} cy={64 + i * 30} r={7} fill={RED} opacity={0.85} />
              <text x={452} y={68 + i * 30} textAnchor="middle" fontSize={8} fontWeight={700}
                fill="#fff">
                ?
              </text>
            </g>
          ))}
          {short > 0 && (
            <text x={452} y={38} textAnchor="middle" fontSize={8} fontWeight={700} fill={RED}>
              hunting
            </text>
          )}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">asking price · index</div>
          <div className="value">{Math.round(aPrice)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">{spare ? "spare homes" : "households without a chair"}</div>
          <div className="value">{spare || short}</div>
        </div>
      </div>
      <p className="widget-caption">
        {short > 0
          ? "Musical chairs: two households chase every gap, and the loser's desperate bid sets the price for the whole block — not just the contested homes."
          : spare === 0
            ? "Exactly enough chairs — and zero slack. One divorce, one in-migrant, and it's a shortage again. Healthy markets keep spare chairs."
            : "Spare chairs: now landlords compete for tenants. A few empty homes aren't waste — they're what price discipline looks like."}
      </p>
      <p className="data-note">
        Prices are set at the margin, by the last household hunting. That's why small changes in
        vacancy move rents so much, and why vacancy rates are one of the profile's earliest
        housing warnings.
      </p>
    </>
  );
}

function MChairsThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => {
        const x = 48 + (i % 4) * 100;
        const y = 56 + Math.floor(i / 4) * 110;
        return (
          <g key={i}>
            <rect x={x} y={y + 18} width={64} height={44} fill="#efe9db" stroke="#c9c2b2"
              strokeWidth={2} />
            <path d={`M${x - 5},${y + 18} L${x + 32},${y - 6} L${x + 69},${y + 18} Z`} fill="#b3ab9c" />
            {i < 7 && <circle cx={x + 32} cy={y + 42} r={9} fill={BLUE} opacity={0.85} />}
          </g>
        );
      })}
      <circle cx={442} cy={130} r={11} fill={RED} />
      <circle cx={442} cy={170} r={11} fill={RED} />
    </svg>
  );
}

/* ============================================================
   M15 · the ceiling — rent control's geometry
   ============================================================ */

function MCeiling() {
  const [pc, setPc] = useState(36);
  const binding = pc < 50;
  const qs = binding ? 2 * (pc - 10) : 80;
  const qd = binding ? 2 * (90 - pc) : 80;
  const xOf = (q: number) => 46 + q * 2.4;
  const yOf = (p: number) => 208 - p * 1.7;
  const drag = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = (208 - ((e.clientY - r.top) / r.height) * 232) / 1.7;
    setPc(Math.max(20, Math.min(70, Math.round(p))));
  };
  return (
    <>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="A supply and demand cross for housing with a draggable rent-ceiling line. Dragged below the market price, offered homes shrink, wanted homes swell, and a queue fills the gap."
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag(e); }}
          onPointerMove={(e) => e.buttons > 0 && drag(e)}
          style={{ touchAction: "none", cursor: "ns-resize" }}>
          <line x1={46} y1={208} x2={440} y2={208} stroke="#c9c2b2" strokeWidth={1.3} />
          <text x={440} y={226} textAnchor="end" className="fig-axis">homes →</text>
          <line x1={xOf(0)} y1={yOf(90)} x2={xOf(160)} y2={yOf(10)} stroke={INK4} strokeWidth={1.6} />
          <text x={xOf(158)} y={yOf(10) - 8} textAnchor="end" fontSize={9.5} fill={INK4}>
            D · who wants one at each rent
          </text>
          <line x1={xOf(0)} y1={yOf(10)} x2={xOf(160)} y2={yOf(90)} stroke={BLUE} strokeWidth={1.8} />
          <text x={xOf(158)} y={yOf(90) - 6} textAnchor="end" fontSize={9.5} fontWeight={700}
            fill={BLUE}>
            S · who offers one
          </text>
          <circle cx={xOf(80)} cy={yOf(50)} r={4} fill={INK3} opacity={binding ? 0.35 : 1} />
          <line x1={40} y1={yOf(pc)} x2={412} y2={yOf(pc)} stroke={RED} strokeWidth={2.4}
            strokeDasharray="8 5" />
          <g transform={`translate(414, ${yOf(pc)})`}>
            <rect x={0} y={-11} width={58} height={22} rx={6} fill={RED} />
            <text x={29} y={4} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
              the cap ⇕
            </text>
          </g>
          {binding && (
            <g>
              <circle cx={xOf(qs)} cy={yOf(pc)} r={5} fill={BLUE} />
              <circle cx={xOf(qd)} cy={yOf(pc)} r={5} fill={INK3} />
              <line x1={xOf(qs)} y1={yOf(pc) + 16} x2={xOf(qd)} y2={yOf(pc) + 16} stroke={RED}
                strokeWidth={1.3} />
              {Array.from({ length: Math.max(0, Math.floor((qd - qs) / 12)) }, (_, i) => (
                <circle key={i} cx={xOf(qs) + 10 + i * 12 * 2.4} cy={yOf(pc) + 26} r={4.5}
                  fill={GOLD} opacity={0.85} />
              ))}
              <text x={(xOf(qs) + xOf(qd)) / 2} y={yOf(pc) + 46} textAnchor="middle" fontSize={9.5}
                fontWeight={700} fill="#9a6712">
                the queue
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">homes offered</div>
          <div className="value">{Math.round(qs)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">homes wanted</div>
          <div className="value">{Math.round(qd)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">the gap</div>
          <div className="value">{Math.round(qd - qs)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {binding
          ? `Cheaper on paper: ${Math.round(qd)} households want a home at this rent and ${Math.round(qs)} exist. The gap doesn't pay rent — it queues, searches, and pays key money.`
          : "The ceiling floats above the market price — a rule that binds nobody, yet. Drag it down."}
      </p>
      <p className="data-note">
        Ceilings protect sitting tenants and tax searching ones. The shortage is invisible in
        rent statistics and vivid in waiting lists — the queue from S5, manufactured by a
        well-meant line on a chart.
      </p>
    </>
  );
}

function MCeilingThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={230} x2={440} y2={230} stroke="#c9c2b2" strokeWidth={2.5} />
      <line x1={60} y1={50} x2={420} y2={214} stroke={INK4} strokeWidth={3} />
      <line x1={60} y1={214} x2={420} y2={50} stroke={BLUE} strokeWidth={4} />
      <line x1={40} y1={160} x2={440} y2={160} stroke={RED} strokeWidth={4.5} strokeDasharray="12 8" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={180 + i * 34} cy={186} r={8} fill={GOLD} />
      ))}
    </svg>
  );
}

/* ============================================================
   M16 · the missing middle
   ============================================================ */

const FORMS = [
  { key: "duplex", label: "duplex", homes: 2 },
  { key: "row", label: "rowhouse", homes: 4 },
  { key: "mid", label: "mid-rise", homes: 12 },
  { key: "tower", label: "tower", homes: 48 },
];

function LotShape({ x, homes }: { x: number; homes: number }) {
  if (homes >= 48)
    return (
      <g>
        <rect x={x + 10} y={54} width={26} height={126} fill={BLUE} fillOpacity={0.2}
          stroke={BLUE} strokeWidth={1.3} />
        <rect x={x + 10} y={54} width={26} height={4} fill={BLUE} />
      </g>
    );
  if (homes >= 12)
    return (
      <g>
        <rect x={x + 4} y={112} width={38} height={68} fill={BLUE} fillOpacity={0.2}
          stroke={BLUE} strokeWidth={1.3} />
        <rect x={x + 4} y={112} width={38} height={4} fill={BLUE} />
      </g>
    );
  if (homes >= 4)
    return (
      <g>
        <rect x={x + 2} y={142} width={42} height={38} fill={BLUE} fillOpacity={0.2}
          stroke={BLUE} strokeWidth={1.3} />
        {[1, 2, 3].map((s) => (
          <line key={s} x1={x + 2 + s * 10.5} y1={142} x2={x + 2 + s * 10.5} y2={180}
            stroke={BLUE} strokeWidth={0.8} opacity={0.5} />
        ))}
      </g>
    );
  if (homes >= 2)
    return (
      <g>
        <rect x={x + 4} y={152} width={38} height={28} fill={BLUE} fillOpacity={0.2}
          stroke={BLUE} strokeWidth={1.3} />
        <path d={`M${x + 2},152 L${x + 23},140 L${x + 44},152 Z`} fill="#b3ab9c" />
        <line x1={x + 23} y1={152} x2={x + 23} y2={180} stroke={BLUE} strokeWidth={0.8}
          opacity={0.5} />
      </g>
    );
  return (
    <g>
      <rect x={x + 10} y={158} width={26} height={22} fill="#efe9db" stroke="#c9c2b2" />
      <path d={`M${x + 7},158 L${x + 23},146 L${x + 39},158 Z`} fill="#b3ab9c" />
    </g>
  );
}

function MMiddle() {
  const [legal, setLegal] = useState<string[]>(["tower"]);
  const per = Math.max(1, ...FORMS.filter((f) => legal.includes(f.key)).map((f) => f.homes));
  const [homes] = useTweens([per * 8], 500);
  const polarized = legal.includes("tower") && !legal.some((k) => ["duplex", "row", "mid"].includes(k));
  return (
    <>
      <div className="widget-controls">
        <span className="barrel-tokens">legal on this block: <b>cottage</b> +</span>
        {FORMS.map((f) => (
          <button key={f.key} className="btn" aria-pressed={legal.includes(f.key)}
            onClick={() =>
              setLegal(legal.includes(f.key) ? legal.filter((x) => x !== f.key) : [...legal, f.key])
            }>
            {f.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="A block of eight lots, each built to the densest housing form the rules allow — from lone cottages to towers, with the middle forms toggleable.">
          <line x1={30} y1={180} x2={450} y2={180} stroke="#8d867a" strokeWidth={1.6} />
          {Array.from({ length: 8 }, (_, i) => (
            <LotShape key={`${per}-${i}`} x={38 + i * 51} homes={per} />
          ))}
          <text x={240} y={200} textAnchor="middle" className="fig-axis">
            eight lots, densest legal form each
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">homes on the block</div>
          <div className="value">{Math.round(homes)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {polarized
          ? "The legal menu jumps from 1 home to 48 — so every proposal is a war between nothing and a tower. The compromise buildings are the ones nobody is allowed to build."
          : per === 1
            ? "A block frozen at one home per lot: the gentlest possible neighborhood, and mathematically unable to absorb a boom."
            : "With middle rungs legal, the block can densify gently — duplexes, rowhouses and low-rises carry most of the growth in cities that allow them."}
      </p>
      <p className="data-note">
        The “missing middle”: many North American cities zone the large majority of their
        residential land for detached homes only, making everything between a house and a tower
        illegal by default.
      </p>
    </>
  );
}

function MMiddleThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={30} y1={230} x2={450} y2={230} stroke="#8d867a" strokeWidth={3} />
      <rect x={56} y={196} width={40} height={34} fill="#efe9db" stroke="#c9c2b2" strokeWidth={2} />
      <path d="M50,196 L76,174 L102,196 Z" fill="#b3ab9c" />
      <rect x={150} y={150} width={64} height={80} rx={2} fill="none" stroke={GOLD} strokeWidth={3}
        strokeDasharray="8 6" />
      <text x={182} y={200} textAnchor="middle" fontSize={26} fill={GOLD}>?</text>
      <rect x={268} y={140} width={58} height={90} rx={2} fill="none" stroke={GOLD} strokeWidth={3}
        strokeDasharray="8 6" />
      <text x={297} y={195} textAnchor="middle" fontSize={26} fill={GOLD}>?</text>
      <rect x={382} y={60} width={40} height={170} fill={BLUE} fillOpacity={0.2} stroke={BLUE}
        strokeWidth={3} />
      <rect x={382} y={60} width={40} height={8} fill={BLUE} />
    </svg>
  );
}

/* ============================================================
   M17 · the parking shadow
   ============================================================ */

function MParking() {
  const [spots, setSpots] = useState(1);
  const share = (0.35 * spots) / (1 + 0.35 * spots);
  const homes = Math.floor(100 / (1 + 0.35 * spots));
  const [aShare] = useTweens([share], 450);
  const bw = (1 - aShare) * 380;
  return (
    <>
      <div className="fig-slider">
        <span>required parking per home</span>
        <input type="range" min={0} max={2} step={0.25} value={spots}
          onChange={(e) => setSpots(Number(e.target.value))} />
        <span className="readout">{spots.toFixed(2)}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 190" role="img"
          aria-label="One development lot split between building and mandated parking. As the requirement rises, asphalt eats the buildable area and the count of homes falls.">
          <rect x={50} y={30} width={380} height={130} fill="none" stroke="#8d867a"
            strokeWidth={1.6} />
          <rect x={50} y={30} width={bw} height={130} fill={BLUE} fillOpacity={0.16}
            stroke={BLUE} strokeWidth={1.2} />
          <text x={50 + bw / 2} y={100} textAnchor="middle" fontSize={12} fontWeight={700}
            fill={BLUE}>
            {homes} homes
          </text>
          {aShare > 0.02 && (
            <g>
              <rect x={50 + bw} y={30} width={380 - bw} height={130} fill="#8d867a"
                fillOpacity={0.25} />
              {Array.from({ length: Math.max(0, Math.floor((380 - bw) / 24)) }, (_, i) => (
                <line key={i} x1={58 + bw + i * 24} y1={40} x2={58 + bw + i * 24} y2={150}
                  stroke="#fdfcf8" strokeWidth={2} />
              ))}
              <text x={50 + bw + (380 - bw) / 2} y={176} textAnchor="middle" fontSize={9.5}
                fontWeight={700} fill={INK3}>
                asphalt
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">homes on the lot</div>
          <div className="value">{homes}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">land given to cars</div>
          <div className="value">{Math.round(aShare * 100)}%</div>
        </div>
      </div>
      <p className="widget-caption">
        {spots === 0
          ? "No mandate: the lot is all homes. Residents who want a space rent one — parking gets priced instead of bundled."
          : spots >= 1.5
            ? `At ${spots.toFixed(2)} spaces per home, ${Math.round(share * 100)}% of the lot is asphalt before anyone has a bedroom — a tax paid in rent, including by tenants who don't own a car.`
            : "Every mandated space displaces floor area. The requirement is invisible in the skyline and perfectly visible in the rent."}
      </p>
      <p className="data-note">
        Parking minimums are a housing rule wearing a traffic costume. A wave of cities has
        recently abolished them — one of the cheapest housing-supply reforms on the menu.
      </p>
    </>
  );
}

function MParkingThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={48} y={50} width={384} height={170} fill="none" stroke="#8d867a" strokeWidth={3} />
      <rect x={48} y={50} width={210} height={170} fill={BLUE} fillOpacity={0.18} stroke={BLUE}
        strokeWidth={2.5} />
      <rect x={258} y={50} width={174} height={170} fill="#8d867a" fillOpacity={0.3} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={278 + i * 32} y1={66} x2={278 + i * 32} y2={204} stroke="#fdfcf8"
          strokeWidth={4} />
      ))}
    </svg>
  );
}

/* ============================================================
   M18 · the greenbelt
   ============================================================ */

function MBelt() {
  const [belt, setBelt] = useState(true);
  const [n, setN] = useState(70);
  const rFree = 52 + n * 0.55;
  const r = belt ? Math.min(80, rFree) : rFree;
  const overflow = belt ? Math.max(0, n - 51) : 0;
  const price = belt ? 100 + overflow * 0.9 : 100 + n * 0.12;
  const [ar, aPrice] = useTweens([r, price], 550);
  const leap = Math.round(overflow / 8);
  return (
    <>
      <div className="fig-slider">
        <span>newcomers</span>
        <input type="range" min={0} max={100} step={5} value={n}
          onChange={(e) => setN(Number(e.target.value))} />
        <span className="readout">{n}k</span>
      </div>
      <div className="widget-controls">
        <button className="btn" aria-pressed={belt} onClick={() => setBelt(true)}>
          greenbelt on
        </button>
        <button className="btn" aria-pressed={!belt} onClick={() => setBelt(false)}>
          greenbelt off
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="A city disc inside a green ring. With the belt on, growth stops at the ring: prices inside rise and development leapfrogs beyond the belt, commuting over it.">
          {belt && (
            <circle cx={240} cy={116} r={88} fill="none" stroke={GREEN} strokeWidth={10}
              opacity={0.35} />
          )}
          <circle cx={240} cy={116} r={ar} fill="rgba(26,90,142,0.13)" stroke={BLUE}
            strokeWidth={1.6} />
          <text x={240} y={112} textAnchor="middle" fontSize={11} fontWeight={700} fill={BLUE}>
            the city
          </text>
          <text x={240} y={128} textAnchor="middle" fontSize={9.5} fill={INK3}>
            price {Math.round(aPrice)}
          </text>
          {Array.from({ length: leap }, (_, i) => {
            const a = rnd("leap" + i) * Math.PI * 2;
            const rr = 108 + rnd("lr" + i) * 22;
            const x = 240 + Math.cos(a) * rr * 1.55;
            const y = 116 + Math.sin(a) * rr * 0.75;
            return (
              <g key={i}>
                <path d={`M${x},${y} Q${(x + 240) / 2},${(y + 116) / 2 - 26} 240,116`} fill="none"
                  stroke={GOLD} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
                <rect x={x - 5} y={y - 4} width={10} height={8} fill={GOLD} />
                <path d={`M${x - 7},${y - 4} L${x},${y - 10} L${x + 7},${y - 4} Z`} fill="#785312" />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="widget-caption">
        {belt && overflow > 0
          ? `The belt holds the edge — so the boom leapfrogs it: ${leap * 8}k people now live beyond the green ring and commute over it, while prices inside climb to ${Math.round(price)}.`
          : belt
            ? "The city still fits inside the belt. The rule exists but isn't binding — slide the newcomers up."
            : "No belt: the edge advances, prices barely move, commutes stay short. The green near town is what got spent."}
      </p>
      <p className="data-note">
        Growth boundaries protect land at the edge, but demand doesn't evaporate — it jumps.
        The test of a good belt is whether density inside was allowed to rise to absorb what
        the ring deflects.
      </p>
    </>
  );
}

function MBeltThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <circle cx={220} cy={135} r={104} fill="none" stroke={GREEN} strokeWidth={16} opacity={0.4} />
      <circle cx={220} cy={135} r={78} fill="rgba(26,90,142,0.15)" stroke={BLUE} strokeWidth={3} />
      {[[398, 60], [420, 150], [382, 224]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 9} y={y - 7} width={18} height={14} fill={GOLD} />
          <path d={`M${x - 12},${y - 7} L${x},${y - 18} L${x + 12},${y - 7} Z`} fill="#785312" />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================
   M19 · the holdout
   ============================================================ */

const ASK = [10, 14, 22, 38, 75];

function MHoldout() {
  const [paid, setPaid] = useState<(number | null)[]>([null, null, null, null, null]);
  const k = paid.filter((p) => p !== null).length;
  const spent = paid.reduce((a: number, p) => a + (p ?? 0), 0);
  const buy = (i: number) => {
    if (paid[i] !== null || k >= 5) return;
    setPaid(paid.map((p, j) => (j === i ? ASK[k] : p)));
  };
  return (
    <>
      <div className="fig-frame">
        <svg viewBox="0 0 480 216" role="img"
          aria-label="Five parcels needed for one tower. Each purchase raises the asking price of the parcels that remain; the last seller charges a large holdout premium.">
          {k === 5 && (
            <g className="sk-pop">
              <rect x={175} y={16} width={130} height={64} fill={BLUE} fillOpacity={0.18}
                stroke={BLUE} strokeWidth={1.6} />
              <rect x={175} y={16} width={130} height={5} fill={BLUE} />
              <text x={240} y={52} textAnchor="middle" fontSize={11} fontWeight={700} fill={BLUE}>
                the tower
              </text>
            </g>
          )}
          {ASK.map((_, i) => {
            const bought = paid[i] !== null;
            return (
              <g key={i} onClick={() => buy(i)}
                style={{ cursor: bought || k >= 5 ? "default" : "pointer" }}>
                <rect x={44 + i * 80} y={104} width={72} height={64} rx={4}
                  fill={bought ? "rgba(26,107,83,0.12)" : "#efe9db"}
                  stroke={bought ? GREEN : "#c9c2b2"} strokeWidth={bought ? 1.8 : 1.2}
                  style={{ transition: "all 0.3s" }} />
                <text x={80 + i * 80} y={132} textAnchor="middle" fontSize={10.5} fontWeight={700}
                  fill={bought ? GREEN : INK3}>
                  {bought ? "sold" : "lot " + (i + 1)}
                </text>
                <text x={80 + i * 80} y={150} textAnchor="middle" fontSize={11}
                  fontWeight={700} fill={bought ? GREEN : "#9a6712"}>
                  {bought ? `paid ${paid[i]}` : `asks ${ASK[k]}`}
                </text>
                <text x={80 + i * 80} y={188} textAnchor="middle" fontSize={8.5} fill={INK4}>
                  worth 10
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="widget-controls">
        <span className="barrel-tokens">
          spent: <b>{spent}</b> · land value: 50
        </span>
        <span className="control-sep" />
        <button className="btn" onClick={() => setPaid([null, null, null, null, null])}>
          reset
        </button>
      </div>
      <p className="widget-caption">
        {k === 0
          ? "You need all five parcels for the tower; each is worth 10. Start buying — any order you like."
          : k < 5
            ? "Word is out: the remaining owners know the tower can't happen without them, and their asks climb with every deal you close."
            : `Assembled — for ${spent} against 50 of land value. The last seller charged for the whole project. That's the holdout premium, and it's why towers rise where big parcels already exist.`}
      </p>
      <p className="data-note">
        Land assembly is a bargaining game the last owner wins. It shapes skylines, stalls
        redevelopment near stations, and is the honest argument in every eminent-domain fight.
      </p>
    </>
  );
}

function MHoldoutThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={36 + i * 84} y={140} width={72} height={80} rx={5}
            fill={i < 4 ? "rgba(26,107,83,0.12)" : "#efe9db"}
            stroke={i < 4 ? GREEN : GOLD} strokeWidth={i < 4 ? 2.5 : 4} />
          <text x={72 + i * 84} y={186} textAnchor="middle" fontSize={i < 4 ? 15 : 22}
            fontWeight={700} fill={i < 4 ? GREEN : "#9a6712"}>
            {i < 4 ? "✓" : "75"}
          </text>
        </g>
      ))}
      <rect x={168} y={44} width={144} height={70} fill="none" stroke={BLUE} strokeWidth={3}
        strokeDasharray="9 7" />
    </svg>
  );
}

/* ============================================================
   M20 · the price of a park — capitalization
   ============================================================ */

function MCapital() {
  const [q, setQ] = useState(0);
  const target = Array.from({ length: 7 }, (_, i) => 28 * q * Math.exp(-0.45 * Math.abs(i - 3)));
  const prem = useTweens(target, 500);
  const total = Math.round(prem.reduce((a, b) => a + b, 0));
  return (
    <>
      <div className="fig-slider">
        <span>park quality · none → beloved</span>
        <input type="range" min={0} max={1} step={0.1} value={q}
          onChange={(e) => setQ(Number(e.target.value))} />
        <span className="readout">{Math.round(q * 100)}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="A street of seven houses with a park behind the middle one. As park quality rises, house prices rise most next to it and less with each door away.">
          {q > 0.05 && (
            <g opacity={Math.min(1, q * 2)}>
              <rect x={196} y={26} width={88} height={44} rx={8} fill={GREEN} fillOpacity={0.22} />
              {[214, 240, 266].map((x) => (
                <circle key={x} cx={x} cy={44} r={9 + q * 4} fill={GREEN} opacity={0.55} />
              ))}
              <text x={240} y={84} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={GREEN}>
                the park
              </text>
            </g>
          )}
          {prem.map((p, i) => {
            const x = 46 + i * 58;
            return (
              <g key={i}>
                <rect x={x} y={140} width={40} height={32} fill="#efe9db" stroke="#c9c2b2" />
                <path d={`M${x - 3},140 L${x + 20},124 L${x + 43},140 Z`} fill="#b3ab9c" />
                <text x={x + 20} y={192} textAnchor="middle" fontSize={10} fontWeight={700}
                  fill={p > 0.5 ? GREEN : INK4}>
                  {100 + Math.round(p)}
                </text>
                {p > 0.5 && (
                  <text x={x + 20} y={116} textAnchor="middle" fontSize={9} fontWeight={700}
                    fill={GREEN}>
                    +{Math.round(p)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">value created on the street</div>
          <div className="value">+{total}</div>
        </div>
      </div>
      <p className="widget-caption">
        {q === 0
          ? "No park: seven identical houses, seven identical prices. Now slide the quality up."
          : q < 0.5
            ? "The premium appears next door first — proximity is the product, and the price gradient maps how far the amenity reaches."
            : `Nobody buys a park at a till; everyone pays for it in housing — +${total} points of value, steepest beside the gate. Amenities are sold through the housing market.`}
      </p>
      <p className="data-note">
        Capitalization: schools, safety, transit and parks all show up in home prices — hedonic
        studies price them from exactly this gradient. It's also why land taxes can recapture
        the value public investment creates.
      </p>
    </>
  );
}

function MCapitalThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={180} y={40} width={120} height={60} rx={12} fill={GREEN} fillOpacity={0.25} />
      {[206, 240, 274].map((x) => (
        <circle key={x} cx={x} cy={68} r={15} fill={GREEN} opacity={0.6} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 52 + i * 82;
        return (
          <g key={i}>
            <rect x={x} y={170} width={56} height={44} fill="#efe9db" stroke="#c9c2b2" strokeWidth={2} />
            <path d={`M${x - 4},170 L${x + 28},146 L${x + 60},170 Z`} fill="#b3ab9c" />
          </g>
        );
      })}
      <text x={240} y={140} textAnchor="middle" fontSize={22} fontWeight={700} fill={GREEN}>
        +24
      </text>
    </svg>
  );
}

/* ============================================================
   the entries
   ============================================================ */

export const MICRO_B: Concept[] = [
  {
    id: "m-bidrent",
    num: "M11",
    eyebrow: "Land",
    title: "The bid-rent curve",
    teaser: "Rent is the price of not commuting.",
    lede: "The oldest diagram in urban economics: rent falls with distance from the center at exactly the cost of the kilometers. Slide the cost of movement and watch the cliff flatten and the city's edge fling outward.",
    tag: "the quiet logic under every rent map and every commute — and the reason suburbs are a transport technology.",
    thumb: <MBidRentThumb />,
    paperThumb: true,
    body: () => <MBidRent />,
  },
  {
    id: "m-gradient",
    num: "M12",
    eyebrow: "Urban form",
    title: "Skylines are rent, extruded",
    teaser: "Open a transit hub; grow a second peak.",
    lede: "Building heights trace land values, and land values trace access. One downtown makes one peak — open a fast station nine kilometers out and watch the skyline grow another.",
    tag: "any skyline, and any construction map in a profile — density is where access is.",
    thumb: <MGradientThumb />,
    paperThumb: true,
    body: () => <MGradient />,
  },
  {
    id: "m-filter",
    num: "M13",
    eyebrow: "Housing",
    title: "The ladder of homes",
    teaser: "Build at the top; a vacancy exits the bottom.",
    lede: "Housing ages down the income ladder. Build a luxury tower and a chain of moves frees the cheapest home in town; ban it and the same buyers bid down the ladder instead. Try both buttons.",
    tag: "why new market-rate supply matters for affordability arguments in the housing branch.",
    thumb: <MFilterThumb />,
    paperThumb: true,
    body: () => <MFilter />,
  },
  {
    id: "m-chairs",
    num: "M14",
    eyebrow: "Housing",
    title: "Musical chairs",
    teaser: "The last household hunting sets the price.",
    lede: "Twelve households, a slider's worth of homes. One chair short and desperate bids reprice the whole block; one chair spare and landlords compete instead. Prices are set at the margin.",
    tag: "vacancy rates in a profile's housing section — small slack, huge price leverage.",
    thumb: <MChairsThumb />,
    paperThumb: true,
    body: () => <MChairs />,
  },
  {
    id: "m-ceiling",
    num: "M15",
    eyebrow: "Housing",
    title: "The ceiling",
    teaser: "Cap the rent; watch the queue absorb the gap.",
    lede: "A supply-and-demand cross with a draggable rent cap. Above the market price it binds nobody; drag it below and the shortage appears — not in rent statistics, but as a queue.",
    tag: "rent-regulation debates in any housing diagnosis — and the queue test from the sketchbook, revisited.",
    thumb: <MCeilingThumb />,
    paperThumb: true,
    body: () => <MCeiling />,
  },
  {
    id: "m-middle",
    num: "M16",
    eyebrow: "Housing",
    title: "The missing middle",
    teaser: "Everything between a house and a tower is illegal.",
    lede: "Eight lots, one rule: each builds the densest legal form. When the menu is a cottage or a 48-home tower, every proposal is a war. Toggle the middle rungs back in and watch the block grow gently.",
    tag: "zoning maps in the housing branch — what's legal, not what's imaginable, sets the supply curve.",
    thumb: <MMiddleThumb />,
    paperThumb: true,
    body: () => <MMiddle />,
  },
  {
    id: "m-parking",
    num: "M17",
    eyebrow: "Housing",
    title: "The parking shadow",
    teaser: "Slide the mandate; asphalt eats the homes.",
    lede: "Every mandated parking space displaces floor area someone would have lived in. Slide the requirement from zero to two spaces per home and watch the lot's arithmetic — and its rent — change.",
    tag: "the small-print rules behind a fortress diagnosis: height caps get the headlines, parking does the damage.",
    thumb: <MParkingThumb />,
    paperThumb: true,
    body: () => <MParking />,
  },
  {
    id: "m-belt",
    num: "M18",
    eyebrow: "Land",
    title: "The greenbelt",
    teaser: "Hold the edge; the boom jumps over it.",
    lede: "A green ring holds the city's edge. Demand doesn't evaporate — it leapfrogs: exurbs sprout beyond the belt, commutes arc over it, and prices inside climb. Toggle the belt and compare.",
    tag: "growth-boundary and land-use fights in the housing branch — the binding question is what density the inside allows.",
    thumb: <MBeltThumb />,
    paperThumb: true,
    body: () => <MBelt />,
  },
  {
    id: "m-holdout",
    num: "M19",
    eyebrow: "Land",
    title: "The holdout",
    teaser: "The last seller charges for the whole tower.",
    lede: "Five parcels, one tower, and a bargaining game: every purchase tells the remaining owners how essential they've become. Buy the block and meet the holdout premium.",
    tag: "why redevelopment stalls on fragmented land — and the honest half of every eminent-domain argument.",
    thumb: <MHoldoutThumb />,
    paperThumb: true,
    body: () => <MHoldout />,
  },
  {
    id: "m-capital",
    num: "M20",
    eyebrow: "Land",
    title: "The price of a park",
    teaser: "Amenities are sold through the housing market.",
    lede: "Build a park and watch its value appear where no one voted for it: in the price of the houses next door, fading with each door away. Capitalization is how cities pay for the things money can't buy directly.",
    tag: "the amenity branch of the tree — home values are the sensor the diagnosis reads.",
    thumb: <MCapitalThumb />,
    paperThumb: true,
    body: () => <MCapital />,
  },
];
