/**
 * The pocket textbook, part D (M31–M40) — trade and place. Hotelling's
 * beach, the gravity model, market access, clustering, Dutch disease,
 * enclave economies, self-discovery, coordination cascades, anchor
 * institutions, and seasonality.
 */

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Concept } from "./ConceptsPage";
import { useTweens } from "./TextbookFigs";

const INK3 = "#4f4a42";
const INK4 = "#9a9389";
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
   M31 · two carts, one beach — Hotelling
   ============================================================ */

const BEACH_GOERS = Array.from({ length: 12 }, (_, i) => 75 + i * 30);

function MHotelling() {
  const [s, setS] = useState(0);
  const a = Math.min(150 + s * 11, 234);
  const b = Math.max(330 - s * 11, 246);
  const done = a >= 234 && b <= 246;
  const mid = (a + b) / 2;
  const nearest = (x: number) => (Math.abs(x - a) <= Math.abs(x - b) ? a : b);
  const avgWalk = Math.round(
    (BEACH_GOERS.reduce((acc, x) => acc + Math.abs(x - nearest(x)), 0) / 12) * 2,
  );
  const shareA = Math.round(((mid - 60) / 360) * 100);
  return (
    <>
      <div className="widget-controls">
        <button className="btn gold" onClick={() => setS(Math.min(8, s + 1))} disabled={done}>
          another season of rivalry
        </button>
        <button className="btn" onClick={() => setS(0)}>reset</button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 190" role="img"
          aria-label="Two ice-cream carts on a beach of twelve bathers. Season by season each cart inches toward the middle to steal customers, until both stand back to back at the center.">
          <rect x={60} y={128} width={360} height={26} rx={6} fill="#f0e3c0" />
          <rect x={60} y={150} width={360} height={16} fill="#5d86b8" opacity={0.35} />
          <rect x={60} y={128} width={mid - 60} height={5} fill={BLUE} opacity={0.55}
            style={{ transition: "width 0.5s" }} />
          <rect x={mid} y={128} width={420 - mid} height={5} fill={GOLD} opacity={0.6}
            style={{ transition: "all 0.5s" }} />
          {BEACH_GOERS.map((x) => (
            <circle key={x} cx={x} cy={144} r={4.5}
              fill={Math.abs(x - a) <= Math.abs(x - b) ? BLUE : GOLD} opacity={0.8}
              style={{ transition: "fill 0.5s" }} />
          ))}
          {[{ x: a, c: BLUE, n: "A" }, { x: b, c: GOLD, n: "B" }].map((cart) => (
            <g key={cart.n} style={{ transform: `translate(${cart.x}px, 0)`, transition: "transform 0.5s" }}>
              <rect x={-13} y={92} width={26} height={20} rx={3} fill={cart.c} />
              <circle cx={-7} cy={116} r={4} fill={INK3} />
              <circle cx={7} cy={116} r={4} fill={INK3} />
              <text x={0} y={86} textAnchor="middle" fontSize={10} fontWeight={700} fill={cart.c}>
                {cart.n}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">A's share of the beach</div>
          <div className="value">{shareA}%</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">average walk for ice cream</div>
          <div className="value">{avgWalk} <span style={{ fontSize: 15 }}>m</span></div>
        </div>
      </div>
      <p className="widget-caption">
        {s === 0
          ? "Spread apart, everyone walks a little: the socially perfect layout. It is also unstable — press the button."
          : !done
            ? "Each cart inches toward the middle to poach the customers between them. Its own share grows; everyone's walk lengthens."
            : "Back to back at the center: neither cart can move without losing customers, and every bather walks farther than before. Clustering without conspiracy."}
      </p>
      <p className="data-note">
        Hotelling's beach — why gas stations share corners, why parties crowd the median voter,
        and one honest reason competitors end up on the same street.
      </p>
    </>
  );
}

function MHotellingThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={40} y={170} width={400} height={38} rx={8} fill="#f0e3c0" />
      <rect x={40} y={202} width={400} height={22} fill="#5d86b8" opacity={0.35} />
      {[80, 140, 200, 280, 340, 400].map((x, i) => (
        <circle key={x} cx={x} cy={192} r={7} fill={i < 3 ? BLUE : GOLD} opacity={0.8} />
      ))}
      <rect x={196} y={110} width={40} height={32} rx={4} fill={BLUE} />
      <rect x={244} y={110} width={40} height={32} rx={4} fill={GOLD} />
    </svg>
  );
}

/* ============================================================
   M32 · gravity — size times size over distance
   ============================================================ */

function MGravity() {
  const [bx, setBx] = useState(330);
  const [sB, setSB] = useState(4);
  const distKm = Math.round((bx - 90) * 2);
  const flow = (4 * sB) / Math.pow(distKm / 100, 1.8);
  const drag = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 480;
    setBx(Math.max(200, Math.min(440, Math.round(x))));
  };
  return (
    <>
      <div className="fig-slider">
        <span>size of the far city</span>
        <input type="range" min={1} max={8} step={1} value={sB}
          onChange={(e) => setSB(Number(e.target.value))} />
        <span className="readout">{sB}m</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 200" role="img"
          aria-label="Two cities joined by a trade flow whose thickness follows size times size over distance. Dragging the far city closer thickens the flow steeply."
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag(e); }}
          onPointerMove={(e) => e.buttons > 0 && drag(e)}
          style={{ touchAction: "none", cursor: "ew-resize" }}>
          <line x1={90} y1={100} x2={bx} y2={100} stroke={GREEN}
            strokeWidth={Math.min(26, 1 + flow * 2.2)} opacity={0.55} strokeLinecap="round"
            strokeDasharray="10 8" className="fig-flow" />
          <circle cx={90} cy={100} r={26} fill={BLUE} opacity={0.85} />
          <text x={90} y={104} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#fff">
            4m
          </text>
          <text x={90} y={146} textAnchor="middle" fontSize={10} fontWeight={700} fill={BLUE}>
            home
          </text>
          <g style={{ transform: `translate(${bx}px, 0)` }}>
            <circle cx={0} cy={100} r={10 + sB * 2.4} fill={GOLD} opacity={0.85} />
            <text x={0} y={104} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#fff">
              {sB}m
            </text>
            <text x={0} y={146} textAnchor="middle" fontSize={10} fontWeight={700} fill="#785312">
              partner ⇔
            </text>
          </g>
          <text x={(90 + bx) / 2} y={74} textAnchor="middle" fontSize={10} fill={INK3}>
            {distKm} km apart
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">trade between them · index</div>
          <div className="value">{flow.toFixed(1)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {distKm < 300
          ? "Next door, the flow is a firehose: size × size with hardly any distance to divide by. Neighbors trade enormously more than strangers."
          : distKm > 580
            ? "At this range the same two cities barely trade — distance sits in the denominator with an exponent near two, and it is merciless."
            : "Drag the partner city and watch the pipe: halve the distance and trade more than doubles. Gravity is the most reliable law in economics."}
      </p>
      <p className="data-note">
        The gravity model fits trade, migration, phone calls and even Zoom meetings. Distance
        did not die with the internet — which is why a city's location remains one of its
        assets, or its taxes.
      </p>
    </>
  );
}

function MGravityThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={110} y1={135} x2={370} y2={135} stroke={GREEN} strokeWidth={22} opacity={0.5}
        strokeLinecap="round" strokeDasharray="16 14" />
      <circle cx={100} cy={135} r={44} fill={BLUE} opacity={0.85} />
      <circle cx={382} cy={135} r={32} fill={GOLD} opacity={0.85} />
    </svg>
  );
}

/* ============================================================
   M33 · market access — your market is bigger than your city
   ============================================================ */

const ACC_NEIGHBORS = [
  { name: "Fartown", x: 400, y: 50, size: 8 },
  { name: "Nearville", x: 90, y: 60, size: 3 },
  { name: "Smallport", x: 420, y: 180, size: 2 },
  { name: "Overborder", x: 110, y: 186, size: 5 },
];

function MAccess() {
  const [hwy, setHwy] = useState(false);
  const [border, setBorder] = useState(false);
  const cx = 250, cy = 120;
  const dist = (n: { x: number; y: number }) => Math.hypot(n.x - cx, n.y - cy);
  const eff = (i: number) => {
    if (i === 0 && hwy) return dist(ACC_NEIGHBORS[0]) / 2;
    if (i === 3 && !border) return Infinity;
    return dist(ACC_NEIGHBORS[i]);
  };
  const access = 40 + ACC_NEIGHBORS.reduce((a, n, i) => a + (n.size / eff(i)) * 1000, 0);
  const [aAcc] = useTweens([access], 550);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={hwy} onClick={() => setHwy(!hwy)}>
          build the highway to Fartown
        </button>
        <button className="btn" aria-pressed={border} onClick={() => setBorder(!border)}>
          open the border
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="A home city ringed by neighbors of different sizes and distances. A highway halves the effective distance to the biggest neighbor; opening the border adds a whole city to the market. The home ring grows with access.">
          <line x1={62} y1={150} x2={180} y2={232} stroke={RED} strokeWidth={1.4}
            strokeDasharray="6 5" opacity={border ? 0.25 : 0.8} />
          <text x={70} y={224} fontSize={8.5} fill={RED} opacity={border ? 0.3 : 0.9}>
            the border
          </text>
          {ACC_NEIGHBORS.map((n, i) => {
            const reachable = i !== 3 || border;
            return (
              <g key={n.name} opacity={reachable ? 1 : 0.3} style={{ transition: "opacity 0.4s" }}>
                <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={i === 0 && hwy ? GOLD : "#c9c2b2"}
                  strokeWidth={i === 0 && hwy ? 3 : 1.2}
                  strokeDasharray={i === 0 && hwy ? undefined : "4 5"}
                  style={{ transition: "all 0.3s" }} />
                <circle cx={n.x} cy={n.y} r={6 + n.size * 1.8} fill="#b3ab9c" opacity={0.8} />
                <text x={n.x} y={n.y + n.size * 1.8 + 18} textAnchor="middle" fontSize={9}
                  fontWeight={600} fill={INK3}>
                  {n.name} · {n.size}m
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={Math.min(64, aAcc * 0.28)} fill="rgba(26,90,142,0.1)"
            stroke={BLUE} strokeWidth={1.2} strokeDasharray="4 4" />
          <circle cx={cx} cy={cy} r={16} fill={BLUE} opacity={0.9} />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff">
            home
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">market access · index</div>
          <div className="value">{Math.round(aAcc)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {hwy && border
          ? "Road plus border: the city didn't grow, its market did — nearly double the demand within reach. Firms location-scout on exactly this number."
          : hwy
            ? "The highway moved Fartown next door: same map, twice the reachable demand from the biggest neighbor."
            : border
              ? "The border was a mountain you couldn't see: opening it adds a whole city to the market without moving anything."
              : "A city's market is its own demand plus every neighbor's, discounted by distance. Toggle the two levers and watch the reach ring."}
      </p>
      <p className="data-note">
        Market access — the gravity model (M32) summed over every destination. It explains why
        port and crossroads cities punch above their weight, and what transport investments
        actually buy.
      </p>
    </>
  );
}

function MAccessThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <circle cx={240} cy={135} r={92} fill="rgba(26,90,142,0.08)" stroke={BLUE} strokeWidth={2.5}
        strokeDasharray="7 7" />
      <circle cx={240} cy={135} r={26} fill={BLUE} />
      {[[404, 58, 24], [76, 72, 14], [420, 208, 11], [96, 208, 18]].map(([x, y, r], i) => (
        <g key={i}>
          <line x1={240} y1={135} x2={x} y2={y} stroke="#c9c2b2" strokeWidth={2.5}
            strokeDasharray="5 6" />
          <circle cx={x} cy={y} r={r} fill="#b3ab9c" />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================
   M34 · shoulder to shoulder — why rivals cluster
   ============================================================ */

const SPREAD_POS: [number, number][] = [
  [70, 50], [390, 44], [90, 160], [410, 168], [220, 36], [250, 180],
];
const CLUSTER_POS: [number, number][] = [
  [190, 62], [250, 50], [306, 68], [180, 120], [312, 122], [246, 150],
];

function MCluster() {
  const [together, setTogether] = useState(false);
  const [prod, rent] = useTweens(together ? [126, 118] : [100, 100], 550);
  const pos = together ? CLUSTER_POS : SPREAD_POS;
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!together} onClick={() => setTogether(false)}>
          spread across the region
        </button>
        <button className="btn" aria-pressed={together} onClick={() => setTogether(true)}>
          cluster in one district
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="Six rival workshops either scattered across the region or gathered in one district around a shared supplier and labor pool. Clustered, their productivity rises — and so does the rent.">
          {together && (
            <g style={{ transition: "opacity 0.4s" }}>
              <rect x={206} y={86} width={88} height={30} rx={6} fill={GOLD} fillOpacity={0.15}
                stroke={GOLD} strokeWidth={1.4} />
              <text x={250} y={105} textAnchor="middle" fontSize={9} fontWeight={700} fill="#785312">
                shared toolworks
              </text>
              <ellipse cx={250} cy={186} rx={104} ry={16} fill="rgba(26,90,142,0.1)"
                stroke={BLUE} strokeWidth={1} strokeDasharray="4 4" />
              <text x={250} y={190} textAnchor="middle" fontSize={9} fontWeight={700} fill={BLUE}>
                the labor pool
              </text>
            </g>
          )}
          {pos.map(([x, y], i) => (
            <g key={i} style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 0.7s cubic-bezier(.4,0,.3,1)" }}>
              <rect x={-16} y={-12} width={32} height={24} rx={3} fill={BLUE} fillOpacity={0.2}
                stroke={BLUE} strokeWidth={1.3} />
              <rect x={-16} y={-12} width={32} height={4} fill={BLUE} />
            </g>
          ))}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">productivity</div>
          <div className="value">{Math.round(prod)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">rent in the district</div>
          <div className="value">{Math.round(rent)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {together
          ? "Shoulder to shoulder with their fiercest rivals — and richer for it: the shared supplier, the deep labor pool, the gossip at lunch. The rent hike is the entry fee, and it's worth paying."
          : "Six workshops, each alone with its own little toolshed and its own thin hiring pool. No rivals nearby — and nothing shared, learned or poached either."}
      </p>
      <p className="data-note">
        Marshall's trinity (sharing, matching, learning — M10) at district scale. It's why the
        profile maps industry clusters: co-location is what agglomeration looks like from above.
      </p>
    </>
  );
}

function MClusterThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <ellipse cx={240} cy={220} rx={150} ry={26} fill="rgba(26,90,142,0.1)" stroke={BLUE}
        strokeWidth={2} strokeDasharray="6 6" />
      <rect x={190} y={120} width={100} height={36} rx={7} fill={GOLD} fillOpacity={0.15}
        stroke={GOLD} strokeWidth={2.5} />
      {CLUSTER_POS.map(([x, y], i) => (
        <rect key={i} x={x * 0.9 + 10} y={y * 0.85 - 20} width={44} height={32} rx={4}
          fill={BLUE} fillOpacity={0.2} stroke={BLUE} strokeWidth={2.5} />
      ))}
    </svg>
  );
}

/* ============================================================
   M35 · the gilded squeeze — Dutch disease
   ============================================================ */

const DD_FACTORIES = [
  { name: "textiles", rev: 120 },
  { name: "machinery", rev: 132 },
  { name: "instruments", rev: 148 },
];

function MDutch() {
  const [b, setB] = useState(0);
  const costs = 95 + 45 * b;
  const [aCosts] = useTweens([costs], 450);
  const alive = DD_FACTORIES.filter((f) => f.rev > costs).length;
  return (
    <>
      <div className="fig-slider">
        <span>the resource boom</span>
        <input type="range" min={0} max={1} step={0.05} value={b}
          onChange={(e) => setB(Number(e.target.value))} />
        <span className="readout">{Math.round(b * 100)}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 216" role="img"
          aria-label="A glowing mine beside three exporting factories. As the boom bids up local wages and rents, factories whose revenues no longer cover local costs fade out one by one.">
          <path d="M40,176 L92,96 L144,176 Z" fill={GOLD} opacity={0.35 + b * 0.6} />
          <rect x={78} y={132} width={28} height={44} fill="#5c564a" />
          <text x={92} y={196} textAnchor="middle" fontSize={10} fontWeight={700} fill="#785312">
            the mine
          </text>
          {b > 0.1 && (
            <text x={92} y={84} textAnchor="middle" fontSize={12} fontWeight={700} fill={GOLD}>
              {"$".repeat(Math.max(1, Math.round(b * 4)))}
            </text>
          )}
          {DD_FACTORIES.map((f, i) => {
            const ok = f.rev > costs;
            return (
              <g key={f.name} opacity={ok ? 1 : 0.28} style={{ transition: "opacity 0.5s" }}>
                <rect x={196 + i * 92} y={120} width={70} height={56} fill={BLUE}
                  fillOpacity={0.16} stroke={BLUE} strokeWidth={1.3} />
                <path d={`M${200 + i * 92},120 l10,-12 v12 M${214 + i * 92},120 l10,-12 v12`}
                  fill="none" stroke={BLUE} strokeWidth={1.3} />
                <text x={231 + i * 92} y={150} textAnchor="middle" fontSize={9.5} fontWeight={600}
                  fill={INK3}>
                  {f.name}
                </text>
                <text x={231 + i * 92} y={166} textAnchor="middle" fontSize={9}
                  fill={ok ? GREEN : RED} fontWeight={700}>
                  {ok ? `margin +${f.rev - Math.round(aCosts)}` : "underwater"}
                </text>
                <text x={231 + i * 92} y={196} textAnchor="middle" fontSize={8.5} fill={INK4}>
                  sells at {f.rev}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">local wages & rents</div>
          <div className="value">{Math.round(aCosts)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">other exporters alive</div>
          <div className="value">{alive} <span style={{ fontSize: 15 }}>of 3</span></div>
        </div>
      </div>
      <p className="widget-caption">
        {b < 0.2
          ? "Before the boom: the mine is one exporter among four, and everyone's costs are livable. Now open the slider."
          : alive === 3
            ? "The mine's dollars are bidding up wages and rents for everyone — margins elsewhere are thinning, though nobody has closed yet."
            : alive > 0
              ? "There goes a factory: it sells at world prices but pays boom-town costs. The mine didn't compete with it for customers — it competed for the city."
              : "Only the mine is left standing. When the ore runs out, the town must re-learn everything the boom priced out — the fortress city's cousin, paid in factories instead of rent."}
      </p>
      <p className="data-note">
        Dutch disease: a booming export appreciates local costs and quietly evicts the other
        tradables. The cure isn't refusing booms — it's banking them, and watching the
        non-boom exporters like a fuel gauge.
      </p>
    </>
  );
}

function MDutchThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <path d="M40,220 L120,90 L200,220 Z" fill={GOLD} opacity={0.8} />
      <text x={120} y={70} textAnchor="middle" fontSize={26} fontWeight={700} fill={GOLD}>
        $$$
      </text>
      {[0, 1].map((i) => (
        <g key={i} opacity={i === 0 ? 1 : 0.3}>
          <rect x={250 + i * 110} y={150} width={86} height={70} fill={BLUE} fillOpacity={0.16}
            stroke={BLUE} strokeWidth={2.5} />
          <path d={`M${256 + i * 110},150 l12,-16 v16 M${274 + i * 110},150 l12,-16 v16`}
            fill="none" stroke={BLUE} strokeWidth={2.5} />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================
   M36 · the enclave — where the export money lands
   ============================================================ */

function MEnclave() {
  const [linked, setLinked] = useState(false);
  const [jobs] = useTweens([linked ? 80 : 10], 550);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!linked} onClick={() => setLinked(false)}>
          fly-in, fly-out enclave
        </button>
        <button className="btn" aria-pressed={linked} onClick={() => setLinked(true)}>
          locally linked mine
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="A mine earning the same export money in both scenarios. As an enclave, the money arcs over the town and leaves; linked locally, it lands in the shops along the main street and lights them up.">
          <path d="M36,160 L84,92 L132,160 Z" fill="#8d867a" />
          <rect x={72} y={124} width={24} height={36} fill="#5c564a" />
          <text x={84} y={180} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK3}>
            the mine · exports 100
          </text>
          {linked ? (
            [0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={`M108,110 C${170 + i * 20},${40 - i * 4} ${200 + i * 56},60 ${226 + i * 52},124`}
                fill="none" stroke={GOLD} strokeWidth={2} strokeDasharray="5 6"
                className="fig-flow" opacity={0.8} />
            ))
          ) : (
            <>
              <path d="M108,102 C220,10 360,10 462,60" fill="none" stroke={GOLD} strokeWidth={3.5}
                strokeDasharray="7 7" className="fig-flow" opacity={0.85} />
              <text x={380} y={32} textAnchor="middle" fontSize={9.5} fontWeight={700}
                fill="#785312">
                wages & profits leave by air
              </text>
            </>
          )}
          {[0, 1, 2, 3, 4].map((i) => {
            const lit = linked;
            return (
              <g key={i}>
                <rect x={210 + i * 52} y={124} width={40} height={38} fill={lit ? "#efe9db" : "#e2dccd"}
                  stroke="#c9c2b2" style={{ transition: "fill 0.4s" }} />
                <rect x={222 + i * 52} y={134} width={16} height={12}
                  fill={lit ? "#e9c46a" : "#cfc8b8"} style={{ transition: "fill 0.4s" }} />
                <text x={230 + i * 52} y={176} textAnchor="middle" fontSize={7.5} fill={INK4}>
                  {["grocer", "bank", "garage", "cafe", "school"][i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">export earnings</div>
          <div className="value">100</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">town jobs supported</div>
          <div className="value">{Math.round(jobs)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {linked
          ? "Same ore, same 100 of exports — but the wages are spent at the grocer, the parts come from the garage, the payroll sits in the local bank. The multiplier found somewhere to land."
          : "The export column says boom; the main street says nothing. Workers fly in, profits fly out, supplies arrive in sealed containers — a multiplier of almost nothing."}
      </p>
      <p className="data-note">
        What matters is not what a city exports but what the export buys in town. Linkages —
        local hiring, local suppliers, local banking — are the difference between an economy
        and an extraction site.
      </p>
    </>
  );
}

function MEnclaveThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <path d="M36,210 L100,110 L164,210 Z" fill="#8d867a" />
      <path d="M120,120 C240,10 360,20 460,70" fill="none" stroke={GOLD} strokeWidth={6}
        strokeDasharray="12 10" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={250 + i * 70} y={160} width={54} height={50} fill="#e2dccd"
          stroke="#c9c2b2" strokeWidth={2} />
      ))}
    </svg>
  );
}

/* ============================================================
   M37 · the pioneer's gamble — self-discovery
   ============================================================ */

function MDiscovery() {
  const [funded, setFunded] = useState(false);
  const [failMode, setFailMode] = useState(false);
  const pioneer = failMode ? -15 : 12;
  const town = failMode ? -15 : 92;
  return (
    <>
      <div className="widget-controls">
        <button className="btn gold" onClick={() => setFunded(true)} disabled={funded}>
          fund the pineapple experiment
        </button>
        {funded && (
          <button className="btn" aria-pressed={failMode} onClick={() => setFailMode(!failMode)}>
            …and if it had failed?
          </button>
        )}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 200" role="img"
          aria-label="Five farm plots. One pioneer pays to discover whether pineapples grow here; if the experiment works, four copiers plant for free. If it fails, the pioneer bears the loss alone.">
          {[0, 1, 2, 3, 4].map((i) => {
            const isPioneer = i === 0;
            const planted = isPioneer ? funded : funded && !failMode;
            return (
              <g key={i} opacity={isPioneer || funded ? 1 : 0.5}>
                <rect x={40 + i * 84} y={70} width={68} height={74} rx={4}
                  fill={planted ? (isPioneer && failMode ? "#e8dcd2" : "rgba(26,107,83,0.1)") : "#efe9db"}
                  stroke={planted ? GREEN : "#c9c2b2"}
                  strokeWidth={isPioneer ? 1.8 : 1.2}
                  strokeDasharray={planted ? undefined : "4 4"}
                  style={{ transition: "all 0.4s" }} />
                {planted && !failMode && (
                  <g className="sk-pop" style={{ animationDelay: `${i * 0.15}s` }}>
                    {[0, 1, 2].map((p) => (
                      <path key={p} d={`M${58 + i * 84 + p * 16},128 l4,-14 l4,14 Z`} fill={GREEN} />
                    ))}
                  </g>
                )}
                {isPioneer && funded && failMode && (
                  <text x={74} y={112} textAnchor="middle" fontSize={16} fill={RED}>✗</text>
                )}
                <text x={74 + i * 84} y={162} textAnchor="middle" fontSize={9} fontWeight={600}
                  fill={INK3}>
                  {isPioneer ? "the pioneer" : `copier ${i}`}
                </text>
                <text x={74 + i * 84} y={178} textAnchor="middle" fontSize={9.5} fontWeight={700}
                  fill={!funded ? INK4 : isPioneer ? (failMode ? RED : "#9a6712") : failMode ? INK4 : GREEN}>
                  {!funded ? "—" : isPioneer ? (failMode ? "−15" : "+12") : failMode ? "0" : "+20"}
                </text>
              </g>
            );
          })}
          <text x={240} y={40} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK3}>
            {!funded
              ? "nobody knows if pineapples grow here — finding out costs 15"
              : failMode
                ? "the answer was no · one farmer paid to learn it for everyone"
                : "the answer was yes · and it was free to everyone but one"}
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">the pioneer's return</div>
          <div className="value">{funded ? (pioneer > 0 ? `+${pioneer}` : pioneer) : "—"}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">the town's return</div>
          <div className="value">{funded ? (town > 0 ? `+${town}` : town) : "—"}</div>
        </div>
      </div>
      <p className="widget-caption">
        {!funded
          ? "A new export starts as a costly question: can this place grow pineapples, write firmware, host film crews? Someone has to pay to find out."
          : failMode
            ? "Heads the town wins, tails the pioneer loses alone. With payoffs like these, rational farmers under-experiment — and the city under-discovers what it could be."
            : "It worked — and the copiers captured most of the value without paying for the answer. The discovery was a public good funded by one private gambler."}
      </p>
      <p className="data-note">
        Self-discovery (Hausmann & Rodrik): the information about what a place can profitably
        make is a public good. It's the case for pilots, guarantees and first-mover support —
        paying pioneers for the answer everyone will use.
      </p>
    </>
  );
}

function MDiscoveryThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={40 + i * 108} y={90} width={88} height={100} rx={6}
          fill={i === 0 ? "rgba(26,107,83,0.12)" : "#efe9db"}
          stroke={i === 0 ? GREEN : "#c9c2b2"} strokeWidth={i === 0 ? 3.5 : 2}
          strokeDasharray={i === 0 ? undefined : "7 6"} />
      ))}
      {[0, 1, 2].map((p) => (
        <path key={p} d={`M${62 + p * 22},168 l7,-24 l7,24 Z`} fill={GREEN} />
      ))}
      <text x={300} y={150} textAnchor="middle" fontSize={30} fill={INK4}>?</text>
    </svg>
  );
}

/* ============================================================
   M38 · the empty dance floor — coordination cascades
   ============================================================ */

const FLOOR_N = 24;
const FLOOR_POS = Array.from({ length: FLOOR_N }, (_, i) => ({
  x: 50 + rnd("fx" + i) * 380,
  y: 40 + rnd("fy" + i) * 140,
  t: 3 + i,
}));

function MDanceFloor() {
  const [seeds, setSeeds] = useState(0);
  // Granovetter cascade: firm i (threshold 3+i) enters once entered count reaches it
  const rounds: number[] = FLOOR_POS.map(() => -1);
  if (seeds > 0) {
    let entered = seeds;
    let round = 0;
    let moved = true;
    while (moved) {
      moved = false;
      round += 1;
      for (let i = 0; i < FLOOR_N; i++) {
        if (rounds[i] < 0 && FLOOR_POS[i].t <= entered) {
          rounds[i] = round;
          entered += 1;
          moved = true;
        }
      }
    }
  }
  const inCount = rounds.filter((r) => r > 0).length;
  return (
    <>
      <div className="widget-controls">
        {[1, 2, 3].map((k) => (
          <button key={k} className="btn" aria-pressed={seeds === k} onClick={() => setSeeds(k)}>
            anchor {k} firm{k > 1 ? "s" : ""}
          </button>
        ))}
        <button className="btn" onClick={() => setSeeds(0)}>reset</button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 200" role="img"
          aria-label="Twenty-four hesitant firms on an empty dance floor, each willing to enter only after enough others have. Anchoring one or two changes nothing; the third tips a cascade that fills the room.">
          {Array.from({ length: seeds }, (_, i) => (
            <g key={i}>
              <circle cx={70 + i * 34} cy={180} r={9} fill={GOLD} />
              <text x={70 + i * 34} y={184} textAnchor="middle" fontSize={9} fontWeight={700}
                fill="#fff">
                ★
              </text>
            </g>
          ))}
          {seeds > 0 && (
            <text x={70 + seeds * 34 + 16} y={184} fontSize={8.5} fill="#9a6712">
              anchored
            </text>
          )}
          {FLOOR_POS.map((f, i) => {
            const inn = rounds[i] > 0;
            return (
              <circle key={i} cx={f.x} cy={f.y} r={inn ? 7 : 5}
                fill={inn ? BLUE : "none"} stroke={inn ? "none" : "#b3ab9c"} strokeWidth={1.4}
                strokeDasharray={inn ? undefined : "3 3"}
                style={{
                  transition: "fill 0.3s, r 0.3s",
                  transitionDelay: inn ? `${Math.min(2.4, rounds[i] * 0.09)}s` : "0s",
                }} />
            );
          })}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">firms you anchored</div>
          <div className="value">{seeds}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">firms that followed</div>
          <div className="value">{inCount}</div>
        </div>
      </div>
      <p className="widget-caption">
        {seeds === 0
          ? "Every firm wants to be where the others already are — so nobody moves first, forever. That's a coordination failure: the empty floor is an equilibrium."
          : inCount === 0
            ? `${seeds} anchor${seeds > 1 ? "s" : ""} and silence: nobody's threshold was met. Subsidy spent, room still empty — the tip is further than it looks.`
            : "Past the tipping point the room fills itself, one threshold at a time. The subsidy wasn't for the dancers — it was for the floor."}
      </p>
      <p className="data-note">
        Threshold cascades: outcomes flip on the margin between two and three anchors. It's the
        economics of industrial parks, anchor tenants and first-mover deals — and why identical
        policies fizzle in one city and detonate in another.
      </p>
    </>
  );
}

function MDanceFloorThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {FLOOR_POS.slice(0, 16).map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y * 1.3 + 20} r={i < 6 ? 11 : 8}
          fill={i < 6 ? BLUE : "none"} stroke={i < 6 ? "none" : "#b3ab9c"} strokeWidth={2.5}
          strokeDasharray={i < 6 ? undefined : "4 4"} />
      ))}
      <circle cx={70} cy={238} r={13} fill={GOLD} />
    </svg>
  );
}

/* ============================================================
   M39 · ballast — anchor institutions
   ============================================================ */

function MAnchor() {
  const [a, setA] = useState(0.3);
  const [bust, setBust] = useState(false);
  const cyc = (1 - a) * 100 * (bust ? 0.72 : 1.08);
  const [aAnchor, aCyc] = useTweens([a * 100, cyc], 550);
  const swing = Math.round((1 - a) * 36);
  return (
    <>
      <div className="fig-slider">
        <span>anchor share · eds, meds, government</span>
        <input type="range" min={0} max={0.8} step={0.05} value={a}
          onChange={(e) => setA(Number(e.target.value))} />
        <span className="readout">{Math.round(a * 100)}%</span>
      </div>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!bust} onClick={() => setBust(false)}>
          the boom years
        </button>
        <button className="btn" aria-pressed={bust} onClick={() => setBust(true)}>
          the bust
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="City employment as a stacked bar: a steady anchor layer of hospitals, universities and government, with a cyclical layer on top that swells in booms and shrinks in busts.">
          <line x1={40} y1={196} x2={440} y2={196} stroke="#c9c2b2" strokeWidth={1.3} />
          <rect x={170} y={196 - aAnchor * 1.55} width={140} height={aAnchor * 1.55} fill={BLUE}
            fillOpacity={0.25} stroke={BLUE} strokeWidth={1.6} />
          {aAnchor > 6 && (
            <text x={240} y={196 - (aAnchor * 1.55) / 2 + 4} textAnchor="middle" fontSize={10.5}
              fontWeight={700} fill={BLUE}>
              the anchor · steady
            </text>
          )}
          <rect x={170} y={196 - (aAnchor + aCyc) * 1.55} width={140} height={aCyc * 1.55}
            fill={GOLD} fillOpacity={0.22} stroke={GOLD} strokeWidth={1.4} />
          {aCyc > 8 && (
            <text x={240} y={196 - (aAnchor + aCyc / 2) * 1.55 + 4} textAnchor="middle"
              fontSize={10.5} fontWeight={700} fill="#9a6712">
              cyclical · {bust ? "shrinking" : "swelling"}
            </text>
          )}
          <line x1={150} y1={196 - 100 * 1.55} x2={330} y2={196 - 100 * 1.55} stroke={INK4}
            strokeWidth={1} strokeDasharray="4 5" />
          <text x={336} y={196 - 100 * 1.55 + 3} fontSize={9} fill={INK4}>
            normal = 100
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">employment now</div>
          <div className="value">{Math.round(aAnchor + aCyc)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">boom-to-bust swing</div>
          <div className="value">{swing}</div>
        </div>
      </div>
      <p className="widget-caption">
        {a >= 0.6
          ? "An eds-and-meds town: the bust barely registers — and neither does the boom. Anchors are ballast, not sail; stability is what they pay, growth is what they cost."
          : bust
            ? "The cyclical layer takes the hit; the anchor holds the floor. Every recession, the hospital quietly becomes the town's largest employer."
            : "Sunny weather flatters the cyclical layer. Slide the anchor share and ask what next winter looks like at each setting."}
      </p>
      <p className="data-note">
        Anchor institutions don't crash — or take off. The right share is a portfolio choice,
        the calendar-twin of the Detroit dial (S11): diversification against time instead of
        against industry.
      </p>
    </>
  );
}

function MAnchorThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={230} x2={440} y2={230} stroke="#c9c2b2" strokeWidth={2.5} />
      <rect x={170} y={130} width={140} height={100} fill={BLUE} fillOpacity={0.25} stroke={BLUE}
        strokeWidth={3} />
      <rect x={170} y={54} width={140} height={76} fill={GOLD} fillOpacity={0.22} stroke={GOLD}
        strokeWidth={3} strokeDasharray="8 6" />
    </svg>
  );
}

/* ============================================================
   M40 · the February problem — seasonality
   ============================================================ */

const SEASONAL = [0.25, 0.25, 0.35, 0.6, 1.1, 1.9, 2.2, 2.0, 1.2, 0.6, 0.3, 0.35];
const SEASONAL_SCALE = 12 / SEASONAL.reduce((a, b) => a + b, 0);

function MSeason() {
  const [s, setS] = useState(0.4);
  const emp = SEASONAL.map((m) => (1 - s) * 100 + s * 100 * m * SEASONAL_SCALE);
  const anim = useTweens(emp, 450);
  const feb = Math.round(emp[1]);
  const jul = Math.round(emp[6]);
  return (
    <>
      <div className="fig-slider">
        <span>tourism's share of the export base</span>
        <input type="range" min={0} max={0.8} step={0.05} value={s}
          onChange={(e) => setS(Number(e.target.value))} />
        <span className="readout">{Math.round(s * 100)}%</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="Twelve monthly employment bars. The more tourism dominates, the taller July grows and the deeper February sinks.">
          <line x1={36} y1={196} x2={444} y2={196} stroke="#c9c2b2" strokeWidth={1.3} />
          <line x1={36} y1={196 - 100 * 0.75} x2={444} y2={196 - 100 * 0.75} stroke={INK4}
            strokeWidth={0.8} strokeDasharray="4 5" />
          {anim.map((v, i) => (
            <g key={i}>
              <rect x={42 + i * 33.4} y={196 - v * 0.75} width={24} height={v * 0.75} rx={2}
                fill={i === 1 ? RED : i === 6 ? GOLD : BLUE}
                fillOpacity={i === 1 || i === 6 ? 0.45 : 0.2}
                stroke={i === 1 ? RED : i === 6 ? GOLD : BLUE} strokeWidth={1.1} />
              <text x={54 + i * 33.4} y={212} textAnchor="middle" fontSize={8} fill={INK3}>
                {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">July payroll</div>
          <div className="value">{jul}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">February payroll</div>
          <div className="value">{feb}</div>
        </div>
      </div>
      <p className="widget-caption">
        {s < 0.15
          ? "A diversified calendar: every month looks like every other. Boring — which, for the people paying rent in February, is the point."
          : s < 0.5
            ? "The summer spike grows and the winter trough deepens — same annual total, colder Februaries."
            : "July hires, February fires. This is concentration risk again — the Detroit dial (S11) with a calendar for a fuse."}
      </p>
      <p className="data-note">
        Tourism is a genuine export (it arrives on a schedule and leaves on one). Seasonality
        diagnostics ask what share of the base sleeps four months a year — and who carries the
        town while it does.
      </p>
    </>
  );
}

function MSeasonThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={30} y1={230} x2={450} y2={230} stroke="#c9c2b2" strokeWidth={2.5} />
      {[40, 36, 50, 80, 130, 190, 210, 196, 120, 76, 44, 48].map((h, i) => (
        <rect key={i} x={38 + i * 34} y={230 - h} width={24} height={h} rx={3}
          fill={i === 1 ? RED : i === 6 ? GOLD : BLUE}
          fillOpacity={i === 1 || i === 6 ? 0.5 : 0.2}
          stroke={i === 1 ? RED : i === 6 ? GOLD : BLUE} strokeWidth={2} />
      ))}
    </svg>
  );
}

/* ============================================================
   the entries
   ============================================================ */

export const MICRO_D: Concept[] = [
  {
    id: "m-hotelling",
    num: "M31",
    eyebrow: "Location",
    title: "Two carts, one beach",
    teaser: "Watch rivals crowd the middle, season by season.",
    lede: "Two ice-cream carts start at the beach's quarter points — the layout that serves everyone best. Press the seasons forward and watch competition walk them, step by logical step, back to back at the center.",
    tag: "Hotelling's model — the other reason competitors share a street, alongside the cluster economics of M34.",
    thumb: <MHotellingThumb />,
    paperThumb: true,
    body: () => <MHotelling />,
  },
  {
    id: "m-gravity",
    num: "M32",
    eyebrow: "Trade",
    title: "Gravity",
    teaser: "Size times size, divided by distance — drag it.",
    lede: "Trade between two cities follows a law worthy of physics: the product of their sizes over the distance between them. Drag the partner city along the map and feel how merciless the denominator is.",
    tag: "the workhorse model behind every trade and migration flow a profile maps.",
    thumb: <MGravityThumb />,
    paperThumb: true,
    body: () => <MGravity />,
  },
  {
    id: "m-access",
    num: "M33",
    eyebrow: "Trade",
    title: "Market access",
    teaser: "Your market is bigger than your city.",
    lede: "A city's real market is its own demand plus every neighbor's, discounted by distance. Build a highway, open a border — the city never grows, and its market nearly doubles.",
    tag: "gravity (M32) summed over the map — what transport links and border policy actually buy.",
    thumb: <MAccessThumb />,
    paperThumb: true,
    body: () => <MAccess />,
  },
  {
    id: "m-cluster",
    num: "M34",
    eyebrow: "Clusters",
    title: "Shoulder to shoulder",
    teaser: "Rivals co-locate — and get richer for it.",
    lede: "Scatter six rival workshops across the region, then gather them into one district with a shared toolworks and a deep labor pool. Productivity jumps; so does the rent. Both are the point.",
    tag: "the industry-cluster maps in a profile — co-location is what agglomeration looks like from above.",
    thumb: <MClusterThumb />,
    paperThumb: true,
    body: () => <MCluster />,
  },
  {
    id: "m-dutch",
    num: "M35",
    eyebrow: "Exports",
    title: "The gilded squeeze",
    teaser: "One booming export evicts the others.",
    lede: "The mine booms, and its dollars bid up wages and rents for the whole town. The factories sell at world prices but pay boom prices — slide the boom and watch them go under, one margin at a time.",
    tag: "Dutch disease — the diversification warning inside every resource-boom profile.",
    thumb: <MDutchThumb />,
    paperThumb: true,
    body: () => <MDutch />,
  },
  {
    id: "m-enclave",
    num: "M36",
    eyebrow: "Exports",
    title: "The enclave",
    teaser: "Same exports; the money never lands.",
    lede: "Two versions of the same mine, earning the same 100 of exports. In one, wages and supplies are local and Main Street lights up; in the other, everything flies in and out and the multiplier starves.",
    tag: "the fine print on the export multiplier (F4, S8): linkages, not shipments, feed the town.",
    thumb: <MEnclaveThumb />,
    paperThumb: true,
    body: () => <MEnclave />,
  },
  {
    id: "m-discovery",
    num: "M37",
    eyebrow: "Discovery",
    title: "The pioneer's gamble",
    teaser: "Discovery pays everyone except the discoverer.",
    lede: "Nobody knows if pineapples grow here until someone pays to find out. If the answer is yes, the copiers get it free; if no, the pioneer eats the loss alone. Run both branches and count who under-invests.",
    tag: "the self-discovery externality — the economics behind pilots, guarantees and first-mover support in a diagnosis.",
    thumb: <MDiscoveryThumb />,
    paperThumb: true,
    body: () => <MDiscovery />,
  },
  {
    id: "m-dancefloor",
    num: "M38",
    eyebrow: "Coordination",
    title: "The empty dance floor",
    teaser: "Anchor two firms: silence. Anchor three: cascade.",
    lede: "Twenty-four firms each willing to enter only after enough others have. The empty floor is a stable equilibrium — until exactly the right number of anchors tips a cascade that fills the room.",
    tag: "coordination failures on the demand branch of the tree — industrial parks, anchor tenants, first-mover deals.",
    thumb: <MDanceFloorThumb />,
    paperThumb: true,
    body: () => <MDanceFloor />,
  },
  {
    id: "m-anchor",
    num: "M39",
    eyebrow: "Resilience",
    title: "Ballast",
    teaser: "Eds and meds don't crash — or take off.",
    lede: "Stack the city's employment: a steady anchor layer of hospitals, campuses and government, and a cyclical layer that swells and shrinks with the weather. Slide the mix, then run a bust through it.",
    tag: "the Detroit dial's calendar twin — diversification against time, priced in foregone booms.",
    thumb: <MAnchorThumb />,
    paperThumb: true,
    body: () => <MAnchor />,
  },
  {
    id: "m-season",
    num: "M40",
    eyebrow: "Resilience",
    title: "The February problem",
    teaser: "An export that arrives on a schedule leaves on one.",
    lede: "Slide tourism's share of the export base and watch the year deform: July swells, February hollows out. Concentration risk again — with a calendar for a fuse.",
    tag: "seasonality diagnostics in tourist-economy profiles — who carries the town while the beach sleeps.",
    thumb: <MSeasonThumb />,
    paperThumb: true,
    body: () => <MSeason />,
  },
];
