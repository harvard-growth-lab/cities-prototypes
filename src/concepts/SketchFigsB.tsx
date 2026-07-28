/**
 * The sketchbook, part B (S11–S20) — the second ten experiments: a
 * concentration-and-shock donut, a magnetic vector field, the be-here
 * premium as a gauge, the housing test as a 2×2, an isochrone dial, an
 * export-or-local sorting quiz, the root question's four emphases, a
 * shift-share waterfall, a draggable height cap, and the compensating-
 * differential seesaw.
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

function rnd(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) % 4096;
  return h / 4096;
}

/* ============================================================
   S11 · the Detroit dial — concentration meets a shock
   ============================================================ */

const DONUT_COLORS = ["#1a5a8e", "#4f95e8", "#b07d1e", "#1a6b53", "#9a9389"];
const SLICE_NAMES = ["autos", "medical", "finance", "food", "logistics"];

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number): [number, number] => [
    cx + r * Math.sin(a),
    cy - r * Math.cos(a),
  ];
  const span = Math.min(a1 - a0, Math.PI * 2 - 1e-4);
  const large = span > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a0 + span);
  const [x2, y2] = p(r0, a0 + span);
  const [x3, y3] = p(r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

function SkShock() {
  const [conc, setConc] = useState(0.75);
  const [hit, setHit] = useState(false);
  const shares = [20 + 44 * conc, ...Array(4).fill(20 - 11 * conc)];
  const afterTop = hit ? shares[0] * 0.45 : shares[0];
  const target = [afterTop, ...shares.slice(1)];
  const anim = useTweens(target, 600);
  const total = anim.reduce((a, b) => a + b, 0);
  const lost = Math.round(shares[0] - afterTop);

  let acc = 0;
  const arcs = anim.map((v, i) => {
    const a0 = (acc / 100) * Math.PI * 2;
    acc += v;
    const a1 = (acc / 100) * Math.PI * 2;
    return { a0, a1, i };
  });

  return (
    <>
      <div className="fig-slider">
        <span>diversified</span>
        <input type="range" min={0} max={1} step={0.05} value={conc}
          onChange={(e) => { setConc(Number(e.target.value)); setHit(false); }} />
        <span>one-industry town</span>
      </div>
      <div className="widget-controls">
        <button className="btn gold" onClick={() => setHit(true)} disabled={hit}>
          ⚡ shock the biggest industry
        </button>
        <button className="btn" onClick={() => setHit(false)}>recover</button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="A donut chart of the export base. The more concentrated it is, the more a shock to the biggest industry takes down.">
          {arcs.map(({ a0, a1, i }) => (
            <path key={i} d={arcPath(150, 105, 46, 86, a0, a1)} fill={DONUT_COLORS[i]}
              opacity={i === 0 && hit ? 0.55 : 0.85} stroke="#fff" strokeWidth={2} />
          ))}
          <text x={150} y={100} textAnchor="middle" fontSize={20} fontWeight={700}
            fill="#221e19" fontFamily="Georgia, serif">
            {Math.round(total)}k
          </text>
          <text x={150} y={116} textAnchor="middle" className="fig-axis">export jobs</text>
          {SLICE_NAMES.map((n, i) => (
            <g key={n}>
              <rect x={300} y={44 + i * 26} width={11} height={11} rx={3} fill={DONUT_COLORS[i]} />
              <text x={318} y={54 + i * 26} fontSize={11} fill={INK3}>
                {n} · {Math.round(anim[i])}k
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="widget-caption">
        {!hit
          ? "Same total, different shapes. Now hit the biggest industry with the same-sized shock at both ends of the slider."
          : lost > 20
            ? `−${lost}k jobs from one shock: a one-industry town has no shock absorbers. This is Detroit's geometry — and why resilience is a diversification story.`
            : `−${lost}k jobs — the same shock, cushioned. The other slices don't rescue autos; they just mean autos was never the whole town.`}
      </p>
    </>
  );
}

function SkShockThumb() {
  const shares = [52, 12, 12, 12, 12];
  let acc = 0;
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {shares.map((v, i) => {
        const a0 = (acc / 100) * Math.PI * 2;
        acc += v;
        const a1 = (acc / 100) * Math.PI * 2;
        return <path key={i} d={arcPath(240, 135, 58, 108, a0, a1)} fill={DONUT_COLORS[i]}
          opacity={0.85} stroke="#fdfcf8" strokeWidth={4} />;
      })}
      <text x={392} y={80} fontSize={34} fill={GOLD}>⚡</text>
    </svg>
  );
}

/* ============================================================
   S12 · magnetic fields — where capable firms point
   ============================================================ */

function SkField() {
  const [pull, setPull] = useState(0.4);
  const A: [number, number] = [86, 118];
  const B: [number, number] = [394, 118];
  const wA = (1 - pull) / 2 + 0.5 - pull / 2; // 0..1 → weight of A
  const wB = 1 - wA;

  const arrows: { x: number; y: number; ang: number; mag: number }[] = [];
  for (let gx = 0; gx < 8; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const x = 55 + gx * 53;
      const y = 46 + gy * 49;
      const to = (c: [number, number], w: number) => {
        const dx = c[0] - x;
        const dy = c[1] - y;
        const d = Math.hypot(dx, dy) || 1;
        const f = w / Math.pow(d, 1.35);
        return [dx * f, dy * f];
      };
      const [ax, ay] = to(A, wA);
      const [bx, by] = to(B, wB);
      const vx = ax + bx;
      const vy = ay + by;
      arrows.push({ x, y, ang: (Math.atan2(vy, vx) * 180) / Math.PI, mag: Math.hypot(vx, vy) });
    }
  }

  return (
    <>
      <div className="fig-slider">
        <span>Alba pulls</span>
        <input type="range" min={0} max={1} step={0.05} value={pull}
          onChange={(e) => setPull(Number(e.target.value))} />
        <span>Bruma pulls</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="A field of small compass arrows between two cities. As one city's pull strengthens, the arrows across the whole map swing toward it.">
          {arrows.map((a, i) => (
            <g key={i}
              style={{
                transform: `rotate(${a.ang}deg)`,
                transformOrigin: `${a.x}px ${a.y}px`,
                transformBox: "view-box" as const,
                transition: "transform 0.45s",
              }}>
              <line x1={a.x - 8} y1={a.y} x2={a.x + 8} y2={a.y} stroke={INK4} strokeWidth={1.6} />
              <path d={`M${a.x + 8},${a.y} l-5,-3.4 v6.8 Z`} fill={INK4} />
            </g>
          ))}
          <circle cx={A[0]} cy={A[1]} r={10 + (1 - pull) * 8} fill="#3987e5" opacity={0.9}
            style={{ transition: "r 0.3s" }} />
          <text x={A[0]} y={A[1] - 20 - (1 - pull) * 8} textAnchor="middle" fontSize={11}
            fontWeight={700} fill="#1a5a8e">Alba</text>
          <circle cx={B[0]} cy={B[1]} r={10 + pull * 8} fill="#9085e9" opacity={0.9} />
          <text x={B[0]} y={B[1] - 20 - pull * 8} textAnchor="middle" fontSize={11}
            fontWeight={700} fill="#6b5fc7">Bruma</text>
        </svg>
      </div>
      <p className="widget-caption">
        The paper's “magnetic fields” test: don't just count arrivals — watch where capable firms
        and workers <em>point</em>. If they sniff around your city and land elsewhere, something
        here repels them, and the field says so before the census does.
      </p>
    </>
  );
}

function SkFieldThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {Array.from({ length: 15 }, (_, i) => {
        const x = 60 + (i % 5) * 90;
        const y = 60 + Math.floor(i / 5) * 75;
        const ang = (Math.atan2(140 - y, 390 - x) * 180) / Math.PI;
        return (
          <g key={i} transform={`rotate(${ang} ${x} ${y})`}>
            <line x1={x - 14} y1={y} x2={x + 14} y2={y} stroke={INK4} strokeWidth={3} />
            <path d={`M${x + 14},${y} l-9,-6 v12 Z`} fill={INK4} />
          </g>
        );
      })}
      <circle cx={408} cy={140} r={22} fill="#9085e9" />
    </svg>
  );
}

/* ============================================================
   S13 · the be-here premium — a gauge for the amenity residual
   ============================================================ */

const GAUGE_PRESETS = [
  { key: "typical", label: "a typical metro", v: 0, note: "wages buy what the place costs — no premium either way. Most metros sit here." },
  { key: "boom", label: "a magnet city", v: 5, note: "people accept lower real pay just to be here — the place itself is part of the wage. A positive be-here premium." },
  { key: "boston", label: "Boston lately", v: -2, note: "the premium has slipped negative: employers now pay extra to keep people. The profile's amenity residual reads about −2pp and draining." },
  { key: "flint", label: "Flint after the crisis", v: -8, note: "wages up, home values down, people leaving anyway — a collapsed premium is the signature of an amenity constraint." },
];

function SkGauge() {
  const [k, setK] = useState("boston");
  const preset = GAUGE_PRESETS.find((p) => p.key === k)!;
  const [v] = useTweens([preset.v], 650);
  const ang = (v / 10) * 74; // degrees from vertical
  return (
    <>
      <div className="widget-controls">
        {GAUGE_PRESETS.map((p) => (
          <button key={p.key} className="btn" aria-pressed={k === p.key} onClick={() => setK(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 200" role="img"
          aria-label={`A gauge of the be-here premium from minus ten to plus ten percentage points, reading ${preset.v}.`}>
          <path d={arcPath(240, 172, 108, 130, -Math.PI / 2 + 0.12, Math.PI / 2 - 0.12)}
            fill="#f1ecdf" />
          <path d={arcPath(240, 172, 108, 130, -Math.PI / 2 + 0.12, -0.06)} fill={RED} opacity={0.25} />
          <path d={arcPath(240, 172, 108, 130, 0.06, Math.PI / 2 - 0.12)} fill={GREEN} opacity={0.25} />
          {[-10, -5, 0, 5, 10].map((t) => {
            const a = ((t / 10) * 74 * Math.PI) / 180;
            const x = 240 + Math.sin(a) * 142;
            const y = 172 - Math.cos(a) * 142;
            return (
              <text key={t} x={x} y={y} textAnchor="middle" fontSize={10} fill={INK3}>
                {t > 0 ? `+${t}` : t}
              </text>
            );
          })}
          <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: "240px 172px", transition: "transform 0.1s" }}>
            <line x1={240} y1={172} x2={240} y2={62} stroke="#221e19" strokeWidth={3}
              strokeLinecap="round" />
          </g>
          <circle cx={240} cy={172} r={7} fill="#221e19" />
          <text x={240} y={196} textAnchor="middle" className="fig-axis">
            the be-here premium, pp
          </text>
          <text x={92} y={196} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={RED}>
            paying people to stay
          </text>
          <text x={392} y={196} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={GREEN}>
            people pay to be here
          </text>
        </svg>
      </div>
      <p className="widget-caption">
        <b>{preset.label}:</b> {preset.note}
      </p>
      <p className="data-note">
        The amenity residual: compare what people earn to what staying costs, and whatever's left
        is the revealed value of the place itself — compensating differentials, read as a number.
      </p>
    </>
  );
}

function SkGaugeThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <path d={arcPath(240, 230, 130, 168, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1)} fill="#f1ecdf" />
      <path d={arcPath(240, 230, 130, 168, -Math.PI / 2 + 0.1, -0.05)} fill={RED} opacity={0.3} />
      <path d={arcPath(240, 230, 130, 168, 0.05, Math.PI / 2 - 0.1)} fill={GREEN} opacity={0.3} />
      <line x1={240} y1={230} x2={166} y2={92} stroke="#221e19" strokeWidth={6} strokeLinecap="round" />
      <circle cx={240} cy={230} r={12} fill="#221e19" />
    </svg>
  );
}

/* ============================================================
   S14 · high price, low quantity — the housing test as a 2×2
   ============================================================ */

const HPLQ = [
  { p: "rising", q: "busy", verdict: "A boom being absorbed", note: "prices firm while cranes swing: demand is strong and supply is answering. Watch that the answering keeps up.", tone: GREEN },
  { p: "rising", q: "idle", verdict: "The fortress signature", note: "high price and low quantity together is the paper's smoking gun for a housing-supply constraint: the boom is turning into rent, not homes.", tone: RED },
  { p: "falling", q: "busy", verdict: "Catching up — or overshooting", note: "building into softening prices: yesterday's permits arriving late. Fine after a squeeze; worrying after a bust.", tone: GOLD },
  { p: "falling", q: "idle", verdict: "Demand has left the room", note: "nobody builds and prices sag anyway — the constraint isn't housing, it's the demand side of the tree. Cheap homes don't hold people.", tone: BLUE },
];

function SkHplq() {
  const [sel, setSel] = useState(1);
  const active = HPLQ[sel];
  return (
    <>
      <div className="sk-quad">
        <span />
        <span className="sk-quad-col">cranes busy</span>
        <span className="sk-quad-col">cranes idle</span>
        <span className="sk-quad-row">prices rising</span>
        {[0, 1].map((i) => (
          <button key={i} className="sk-quad-cell" aria-pressed={sel === i} onClick={() => setSel(i)}
            style={{ ["--tone" as string]: HPLQ[i].tone }}>
            <svg viewBox="0 0 64 40" aria-hidden>
              <path d="M8,30 L26,12 M26,12 l-7,2 M26,12 l-2,7" stroke={RED} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              <path d="M40,32 v-18 M34,14 h18 M52,14 l6,7" stroke={i % 2 ? "#c9c2b2" : INK3} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            </svg>
            <b>{HPLQ[i].verdict}</b>
          </button>
        ))}
        <span className="sk-quad-row">prices falling</span>
        {[2, 3].map((i) => (
          <button key={i} className="sk-quad-cell" aria-pressed={sel === i} onClick={() => setSel(i)}
            style={{ ["--tone" as string]: HPLQ[i].tone }}>
            <svg viewBox="0 0 64 40" aria-hidden>
              <path d="M8,12 L26,30 M26,30 l-2,-7 M26,30 l-7,-2" stroke={GREEN} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              <path d="M40,32 v-18 M34,14 h18 M52,14 l6,7" stroke={i % 2 ? "#c9c2b2" : INK3} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            </svg>
            <b>{HPLQ[i].verdict}</b>
          </button>
        ))}
      </div>
      <p className="widget-caption">
        <b style={{ color: active.tone }}>{active.verdict}.</b> {active.note}
      </p>
      <p className="data-note">
        Prices alone can't diagnose housing — every cell above has rising or falling prices for a
        different reason. The test needs both dials: what prices do, and what construction does.
      </p>
    </>
  );
}

function SkHplqThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={64 + (i % 2) * 184} y={40 + Math.floor(i / 2) * 104} width={168}
          height={88} rx={10} fill={i === 1 ? "rgba(204,73,72,0.12)" : "#fdfcf8"}
          stroke={i === 1 ? RED : "#d8d2c4"} strokeWidth={i === 1 ? 3 : 2} />
      ))}
      <path d="M100,102 L140,64 M140,64 l-12,3 M140,64 l-3,12" stroke={RED} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M300,100 v-30 M286,70 h30 M316,70 l12,14" stroke="#c9c2b2" strokeWidth={4} fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ============================================================
   S15 · thirty minutes of city — the isochrone dial
   ============================================================ */

const JOB_DOTS = Array.from({ length: 26 }, (_, i) => {
  const cluster = i < 16;
  return {
    x: cluster ? 240 + rnd("jx" + i) * 150 : 90 + rnd("jx" + i) * 330,
    y: cluster ? 60 + rnd("jy" + i) * 120 : 40 + rnd("jy" + i) * 160,
  };
});
const HOME: [number, number] = [132, 152];

function SkIsochrone() {
  const [speed, setSpeed] = useState(18);
  const [r] = useTweens([speed * 6.4], 400);
  const within = JOB_DOTS.filter((j) => Math.hypot(j.x - HOME[0], j.y - HOME[1]) <= r).length;
  return (
    <>
      <div className="fig-slider">
        <span>average door-to-door speed</span>
        <input type="range" min={8} max={44} step={2} value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))} />
        <span className="readout">{speed} km/h</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="A home dot with a ring showing everything reachable in thirty minutes, and the metro's jobs scattered around it. Faster travel widens the ring and captures more jobs.">
          <circle cx={HOME[0]} cy={HOME[1]} r={r} fill="rgba(26,90,142,0.07)" stroke={BLUE}
            strokeWidth={1.4} strokeDasharray="5 5" />
          {JOB_DOTS.map((j, i) => {
            const inside = Math.hypot(j.x - HOME[0], j.y - HOME[1]) <= r;
            return <circle key={i} cx={j.x} cy={j.y} r={4.5} fill={inside ? BLUE : "#c9c2b2"}
              style={{ transition: "fill 0.3s" }} />;
          })}
          <rect x={HOME[0] - 8} y={HOME[1] - 6} width={16} height={12} fill={GOLD} />
          <path d={`M${HOME[0] - 11},${HOME[1] - 6} L${HOME[0]},${HOME[1] - 15} L${HOME[0] + 11},${HOME[1] - 6} Z`} fill="#785312" />
          <text x={HOME[0]} y={HOME[1] + 26} textAnchor="middle" fontSize={9.5} fontWeight={700}
            fill="#785312">home</text>
          <text x={HOME[0] + r * 0.72} y={HOME[1] - r * 0.72} fontSize={9} fill={BLUE}>
            30 min
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">jobs within 30 minutes</div>
          <div className="value">{within} <span style={{ fontSize: 15 }}>of 26</span></div>
        </div>
        <div className="stat-tile sm">
          <div className="label">share of the metro's jobs</div>
          <div className="value">{Math.round((within / 26) * 100)}%</div>
        </div>
      </div>
      <p className="widget-caption">
        {speed <= 14
          ? "Nairobi at rush hour: the jobs exist, but the ring can't reach them. Congestion doesn't just cost time — it shrinks the labor market itself."
          : speed >= 34
            ? "At highway speeds the whole metro is one labor market — workers and firms can match on quality, not on geography."
            : "The effective labor market is whatever fits inside the ring. Same city, same jobs — the transport system decides how much of it each resident actually has."}
      </p>
    </>
  );
}

function SkIsochroneThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <circle cx={170} cy={150} r={100} fill="rgba(26,90,142,0.08)" stroke={BLUE} strokeWidth={2.5}
        strokeDasharray="9 8" />
      {JOB_DOTS.slice(0, 18).map((j, i) => {
        const x = j.x * 0.95;
        const y = j.y * 1.15 + 10;
        const inside = Math.hypot(x - 170, y - 150) <= 100;
        return <circle key={i} cx={x} cy={y} r={8} fill={inside ? BLUE : "#c9c2b2"} />;
      })}
      <rect x={156} y={140} width={28} height={20} fill={GOLD} />
      <path d="M150,140 L170,124 L190,140 Z" fill="#785312" />
    </svg>
  );
}

/* ============================================================
   S16 · export or local? — the sorting quiz
   ============================================================ */

const SORT_ITEMS = [
  { name: "a chip fab", isExport: true, why: "every wafer ships out — textbook tradable." },
  { name: "a barber shop", isExport: false, why: "it recirculates money the exporters brought in." },
  { name: "a university", isExport: true, why: "students import themselves; tuition is export revenue." },
  { name: "a grocery store", isExport: false, why: "local wages in, local wages out." },
  { name: "a harbor tour boat", isExport: true, why: "it sells a nice Tuesday afternoon to outsiders — tourism is an export." },
  { name: "a regional hospital", isExport: true, why: "surgery for patients from three counties away is a tradable service." },
  { name: "a neighborhood bakery", isExport: false, why: "beloved, but downstream of the export base." },
  { name: "a software firm", isExport: true, why: "the code leaves town even if nobody sees a box." },
];

function SkSorter() {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState<{ right: boolean; why: string } | null>(null);
  const done = i >= SORT_ITEMS.length;
  const item = SORT_ITEMS[Math.min(i, SORT_ITEMS.length - 1)];

  const answer = (guessExport: boolean) => {
    const right = guessExport === item.isExport;
    setScore((s) => s + (right ? 1 : 0));
    setLast({ right, why: item.why });
    setI((x) => x + 1);
  };

  return (
    <>
      <div className="fig-frame sk-sorter">
        {!done ? (
          <>
            <div className="sk-sorter-count">{i + 1} of {SORT_ITEMS.length}</div>
            <div className="sk-sorter-item">{item.name}</div>
            <div className="sk-sorter-btns">
              <button className="btn gold" onClick={() => answer(true)}>
                exports · brings money in
              </button>
              <button className="btn" onClick={() => answer(false)}>
                local · recirculates it
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sk-sorter-item">
              {score} / {SORT_ITEMS.length}
            </div>
            <p className="sk-sorter-why">
              The lesson hiding in the tricky ones: an export doesn't need a box. Hospitals,
              lecture halls and tour boats all breathe money into town — the diagnosis counts
              them all as tradables.
            </p>
            <button className="btn" onClick={() => { setI(0); setScore(0); setLast(null); }}>
              run it again
            </button>
          </>
        )}
      </div>
      <p className="widget-caption" aria-live="polite">
        {last ? (
          <>
            <b style={{ color: last.right ? GREEN : RED }}>
              {last.right ? "Right." : "Not quite —"}
            </b>{" "}
            {last.why}
          </>
        ) : (
          "Sort each business: does it bring outside money in, or pass local money around?"
        )}
      </p>
    </>
  );
}

function SkSorterThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={130} y={40} width={220} height={70} rx={10} fill="#fdfcf8" stroke="#c9c2b2" strokeWidth={2.5} />
      <rect x={160} y={62} width={160} height={11} rx={5} fill="#b3ab9c" />
      <rect x={60} y={160} width={170} height={54} rx={27} fill="none" stroke={GOLD} strokeWidth={3} />
      <text x={145} y={193} textAnchor="middle" fontSize={15} fontWeight={700} fill={GOLD}>exports?</text>
      <rect x={250} y={160} width={170} height={54} rx={27} fill="none" stroke="#8d867a" strokeWidth={3} />
      <text x={335} y={193} textAnchor="middle" fontSize={15} fontWeight={700} fill="#8d867a">local?</text>
    </svg>
  );
}

/* ============================================================
   S17 · four ways to ask the question
   ============================================================ */

const EMPHASES = [
  { key: "better", word: "better", city: "Bangalore", asked: "asked about future growth", read: "a “better” tomorrow points the tree at diversification — which new words can the city's letters spell next?" },
  { key: "inclusive", word: "more inclusive", city: "Savannah", asked: "asked about inclusion", read: "inclusion asks who the growth reaches — the same tree, walked while watching who holds the letters and who can reach the jobs." },
  { key: "higher", word: "higher", city: "Cali", asked: "asked about current growth", read: "raw speed sends you hunting for today's binding constraint — usually on whichever side the wedge analysis flags first." },
  { key: "resilient", word: "more resilient", city: "Ciudad del Carmen", asked: "asked about resilience to an oil shock", read: "resilience walks straight to external shocks and asks how concentrated the export base is — the Detroit dial, in advance." },
];

function SkQuestion() {
  const [k, setK] = useState("higher");
  const e = EMPHASES.find((x) => x.key === k)!;
  return (
    <>
      <div className="fig-frame sk-question">
        <p className="sk-question-text">
          What are the binding constraints to achieve{" "}
          {EMPHASES.map((x, i) => (
            <span key={x.key}>
              {i > 0 && ", "}
              <button className={`sk-qword${k === x.key ? " is-on" : ""}`}
                onClick={() => setK(x.key)}>
                {x.word}
              </button>
            </span>
          ))}{" "}
          … economic growth?
        </p>
      </div>
      <p className="widget-caption">
        <b>{e.city}</b> {e.asked} — and {e.read}
      </p>
      <p className="data-note">
        The root of Figure 27 is one question with four accents. The paper's cases each stress a
        different word, and the emphasis decides which branches deserve the hardest look.
      </p>
    </>
  );
}

function SkQuestionThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[
        [60, 60, 150], [230, 60, 120], [60, 110, 200], [280, 110, 120],
        [60, 160, 110], [190, 160, 210],
      ].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={13} rx={6}
          fill={i === 3 ? GOLD : "#ddd7c9"} />
      ))}
      <rect x={272} y={100} width={136} height={33} rx={16} fill="none" stroke={GOLD} strokeWidth={3} />
      <text x={70} y={232} fontSize={26} fontFamily="Georgia, serif" fontStyle="italic" fill={INK3}>
        …better? higher?
      </text>
    </svg>
  );
}

/* ============================================================
   S18 · the growth waterfall — shift-share in three bars
   ============================================================ */

const SS_PRESETS = [
  { key: "tide", label: "riding the tide", parts: [6, 2.5, 0.5] },
  { key: "mix", label: "hot mix, weak engine", parts: [6, 3, -2.2] },
  { key: "local", label: "the local engine", parts: [6, -1, 3.6] },
];

function SkShiftShare() {
  const [k, setK] = useState("local");
  const preset = SS_PRESETS.find((p) => p.key === k)!;
  const anim = useTweens(preset.parts, 550);
  const labels = ["national tide", "industry mix", "local effect"];
  const colors = [INK4, BLUE, GOLD];
  const total = anim.reduce((a, b) => a + b, 0);

  const W = 480, base = 190, scale = 13;
  let cum = 0;
  const bars = anim.map((v, i) => {
    const y0 = base - cum * scale;
    cum += v;
    const y1 = base - cum * scale;
    return { top: Math.min(y0, y1), h: Math.abs(y1 - y0), x: 60 + i * 100, v, i, yEnd: y1 };
  });

  return (
    <>
      <div className="widget-controls">
        {SS_PRESETS.map((p) => (
          <button key={p.key} className="btn" aria-pressed={k === p.key} onClick={() => setK(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox={`0 0 ${W} 232`} role="img"
          aria-label="A waterfall chart splitting city growth into the national tide, the industry mix, and the local effect.">
          <line x1={40} y1={base} x2={440} y2={base} stroke="#c9c2b2" strokeWidth={1.3} />
          {bars.map((b) => (
            <g key={b.i}>
              <rect x={b.x} y={b.top} width={64} height={Math.max(2, b.h)} rx={3}
                fill={colors[b.i]} opacity={0.75}
                style={{ transition: "all 0.2s" }} />
              <text x={b.x + 32} y={b.top - 6} textAnchor="middle" fontSize={11} fontWeight={700}
                fill={colors[b.i]}>
                {b.v >= 0 ? "+" : ""}{b.v.toFixed(1)}
              </text>
              <text x={b.x + 32} y={base + 16} textAnchor="middle" className="fig-axis">
                {labels[b.i]}
              </text>
              {b.i < 2 && (
                <line x1={b.x + 64} y1={b.yEnd} x2={b.x + 100} y2={b.yEnd} stroke={INK4}
                  strokeWidth={1} strokeDasharray="3 4" />
              )}
            </g>
          ))}
          <rect x={360} y={Math.min(base, base - total * scale)} width={64}
            height={Math.abs(total * scale)} rx={3} fill="#221e19" opacity={0.85}
            style={{ transition: "all 0.2s" }} />
          <text x={392} y={base - total * scale - 8} textAnchor="middle" fontSize={13}
            fontWeight={700} fill="#221e19" fontFamily="Georgia, serif">
            {total >= 0 ? "+" : ""}{total.toFixed(1)}%
          </text>
          <text x={392} y={base + 16} textAnchor="middle" className="fig-axis">city growth</text>
        </svg>
      </div>
      <p className="widget-caption">
        {k === "tide" && "Everything grew because everything grew: strip the tide and the city itself added almost nothing. Flattering, fragile."}
        {k === "mix" && "The city drew a lucky hand of industries — and still underperformed it. A negative local effect is the tell that the constraint is at home."}
        {k === "local" && "The mix is ordinary but the local effect is the engine: this city beats its own industries' national averages. Boston's decomposition looks like this — the mix isn't the drag."}
      </p>
      <p className="data-note">
        Shift-share: city growth = the nation's tide + the luck of the industry mix + the local
        residual. Only the third term is really about the city — and it's the one the diagnosis
        interrogates.
      </p>
    </>
  );
}

function SkShiftShareThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={210} x2={444} y2={210} stroke="#c9c2b2" strokeWidth={2.5} />
      <rect x={60} y={130} width={70} height={80} rx={4} fill={INK4} opacity={0.7} />
      <rect x={160} y={96} width={70} height={36} rx={4} fill={BLUE} opacity={0.8} />
      <rect x={260} y={52} width={70} height={44} rx={4} fill={GOLD} opacity={0.85} />
      <rect x={360} y={52} width={70} height={158} rx={4} fill="#221e19" opacity={0.85} />
      {[130, 230, 330].map((x, i) => (
        <line key={i} x1={x} y1={[130, 96, 52][i]} x2={x + 30} y2={[130, 96, 52][i]}
          stroke={INK4} strokeWidth={2} strokeDasharray="5 5" />
      ))}
    </svg>
  );
}

/* ============================================================
   S19 · the height cap — drag the rules
   ============================================================ */

const CAP_MAX = 20;
const CAP_DEMAND = 18;

function SkCap() {
  const [cap, setCap] = useState(8);
  const built = Math.min(cap, CAP_DEMAND);
  const premium = (CAP_DEMAND - built) * 6;
  const H = 250, floorH = 10.4, baseY = 224;
  const capY = baseY - cap * floorH;

  const drag = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * H;
    setCap(Math.max(2, Math.min(CAP_MAX, Math.round((baseY - y) / floorH))));
  };

  return (
    <>
      <div className="fig-frame">
        <svg viewBox={`0 0 480 ${H}`} role="img"
          aria-label="A tower cross-section under a draggable height cap. Floors the rules refuse become price instead."
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag(e); }}
          onPointerMove={(e) => e.buttons > 0 && drag(e)}
          style={{ touchAction: "none", cursor: "ns-resize" }}>
          <line x1={30} y1={baseY} x2={450} y2={baseY} stroke="#8d867a" strokeWidth={2} />
          {/* wanted-but-banned ghost floors */}
          {Array.from({ length: CAP_DEMAND }, (_, i) => {
            const y = baseY - (i + 1) * floorH;
            const isBuilt = i < built;
            return (
              <rect key={i} x={150} y={y + 1} width={120} height={floorH - 2} rx={2}
                fill={isBuilt ? BLUE : "none"} opacity={isBuilt ? 0.75 : 1}
                stroke={isBuilt ? "none" : "#c9c2b2"} strokeDasharray={isBuilt ? undefined : "4 3"}
                style={{ transition: "fill 0.2s" }} />
            );
          })}
          {/* the cap */}
          <line x1={90} y1={capY} x2={390} y2={capY} stroke={RED} strokeWidth={2.5}
            strokeDasharray="8 5" />
          <g transform={`translate(398, ${capY})`}>
            <rect x={0} y={-11} width={52} height={22} rx={6} fill={RED} />
            <text x={26} y={4} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff">
              the cap ⇕
            </text>
          </g>
          <text x={150} y={baseY - CAP_DEMAND * floorH - 8} fontSize={9.5} fill={INK4}>
            what the boom wants: {CAP_DEMAND} floors
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">floors built</div>
          <div className="value">{built}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">price premium</div>
          <div className="value">+{premium}%</div>
        </div>
      </div>
      <p className="widget-caption">
        {built >= CAP_DEMAND
          ? "The cap clears demand: the boom becomes floors, and the premium evaporates. The rule exists — it just isn't binding."
          : `Drag the red line. Every wanted floor the cap refuses (${CAP_DEMAND - built} right now) doesn't disappear — it reappears as ${premium}% on the price of the ones that exist.`}
      </p>
    </>
  );
}

function SkCapThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={230} x2={440} y2={230} stroke="#8d867a" strokeWidth={3} />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={170} y={230 - (i + 1) * 17 + 2} width={140} height={13} rx={3}
          fill={i < 5 ? BLUE : "none"} opacity={i < 5 ? 0.75 : 1}
          stroke={i < 5 ? "none" : "#c9c2b2"} strokeWidth={2} strokeDasharray={i < 5 ? undefined : "6 4"} />
      ))}
      <line x1={90} y1={230 - 5 * 17} x2={390} y2={230 - 5 * 17} stroke={RED} strokeWidth={4}
        strokeDasharray="12 8" />
    </svg>
  );
}

/* ============================================================
   S20 · the seesaw of staying — compensating differentials
   ============================================================ */

const SEESAW_EVENTS = [
  { key: "parks", label: "the parks close", dv: -2 },
  { key: "crime", label: "crime rises", dv: -3 },
  { key: "schools", label: "schools improve", dv: +2 },
];

function SkSeesaw() {
  const [on, setOn] = useState<string[]>([]);
  const amen = 6 + SEESAW_EVENTS.filter((e) => on.includes(e.key)).reduce((a, e) => a + e.dv, 0);
  const wageNeed = 14 - amen;
  const [wage] = useTweens([wageNeed], 1400);
  const tilt = Math.max(-13, Math.min(13, (wageNeed - wage) * 5));
  const settled = Math.abs(tilt) < 0.8;

  return (
    <>
      <div className="widget-controls">
        {SEESAW_EVENTS.map((e) => (
          <button key={e.key} className="btn" aria-pressed={on.includes(e.key)}
            onClick={() => setOn(on.includes(e.key) ? on.filter((x) => x !== e.key) : [...on, e.key])}>
            {e.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 220" role="img"
          aria-label="A balance: the pleasures of living somewhere on one pan, the wage on the other. When the place gets worse, the wage side must grow to level the beam.">
          <path d="M240,196 L214,196 L240,142 L266,196 Z" fill="#c9c2b2" />
          <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "240px 142px", transition: "transform 0.15s" }}>
            <line x1={70} y1={142} x2={410} y2={142} stroke="#5c564a" strokeWidth={5}
              strokeLinecap="round" />
            {/* amenity pan */}
            <g>
              <line x1={100} y1={142} x2={100} y2={112} stroke="#8d867a" strokeWidth={2} />
              {Array.from({ length: Math.max(0, amen) }, (_, i) => (
                <rect key={i} x={72} y={96 - i * 13} width={56} height={11} rx={3}
                  fill={GREEN} opacity={0.75} className="sk-pop" />
              ))}
              <text x={100} y={126} textAnchor="middle" fontSize={9} fontWeight={700} fill={GREEN}>
                the place · {amen}
              </text>
            </g>
            {/* wage pan */}
            <g>
              <line x1={380} y1={142} x2={380} y2={112} stroke="#8d867a" strokeWidth={2} />
              <rect x={352} y={108 - wage * 6.4} width={56} height={wage * 6.4} rx={3}
                fill={GOLD} opacity={0.8} />
              <text x={380} y={126} textAnchor="middle" fontSize={9} fontWeight={700} fill="#785312">
                the wage · {wage.toFixed(0)}
              </text>
            </g>
          </g>
        </svg>
      </div>
      <p className="widget-caption">
        {settled
          ? on.length === 0
            ? "In balance: pay plus place equals what it takes to keep people. Now break something."
            : "Level again — but look at the pans: the wage is carrying what the place no longer does. That premium is the compensating differential, and it's measurable."
          : "Tilted: people are leaving. Employers must bid the wage pan heavier until staying balances again."}
      </p>
      <p className="data-note">
        Flint's signature in the paper — rising wages, falling home values, outmigration — is this
        seesaw mid-swing.
      </p>
    </>
  );
}

function SkSeesawThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <path d="M240,232 L206,232 L240,160 L274,232 Z" fill="#c9c2b2" />
      <g transform="rotate(-8 240 160)">
        <line x1={70} y1={160} x2={410} y2={160} stroke="#5c564a" strokeWidth={8} strokeLinecap="round" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={78} y={118 - i * 22} width={64} height={18} rx={4} fill={GREEN} opacity={0.75} />
        ))}
        <rect x={342} y={92} width={64} height={62} rx={4} fill={GOLD} opacity={0.85} />
      </g>
    </svg>
  );
}

/* ============================================================
   the entries
   ============================================================ */

export const SKETCH_B: Concept[] = [
  {
    id: "sk-shock",
    num: "S11",
    eyebrow: "Resilience",
    title: "The Detroit dial",
    teaser: "Concentrate the export base, then shock it.",
    lede: "Two towns with the same jobs, different shapes. Slide from diversified to one-industry town and hit the biggest slice with the same shock — the damage depends on the shape, not the shock.",
    tag: "why the answer to external shocks is diversification of the export base, not reversing the shock.",
    thumb: <SkShockThumb />,
    paperThumb: true,
    body: () => <SkShock />,
  },
  {
    id: "sk-field",
    num: "S12",
    eyebrow: "Diagnostic tests",
    title: "Magnetic fields",
    teaser: "Watch where capable firms point before they move.",
    lede: "A compass field between two rival cities. Shift the balance of pull and every arrow on the map swings — the paper's test asks which way the field around your city points.",
    tag: "the magnetic-fields test: do capable firms sniff around and then locate elsewhere?",
    thumb: <SkFieldThumb />,
    paperThumb: true,
    body: () => <SkField />,
  },
  {
    id: "sk-gauge",
    num: "S13",
    eyebrow: "Amenities",
    title: "The be-here premium",
    teaser: "One needle for what a place is worth.",
    lede: "Compare what people earn to what staying costs; the residual is the revealed value of the place itself. Four presets swing the needle from magnet city to Flint.",
    tag: "the amenity residual in the profile's diagnosis — compensating differentials as a single number.",
    thumb: <SkGaugeThumb />,
    paperThumb: true,
    body: () => <SkGauge />,
  },
  {
    id: "sk-hplq",
    num: "S14",
    eyebrow: "Housing",
    title: "High price, low quantity",
    teaser: "The housing test needs both dials, not one.",
    lede: "Prices alone can't convict housing — every combination of price and construction tells a different story. Click the four cells and find the one that smells like a fortress.",
    tag: "the paper's housing-supply test: are prices rising while little gets built?",
    thumb: <SkHplqThumb />,
    paperThumb: true,
    body: () => <SkHplq />,
  },
  {
    id: "sk-30min",
    num: "S15",
    eyebrow: "Transportation",
    title: "Thirty minutes of city",
    teaser: "Speed sets how much city each resident gets.",
    lede: "One home, one ring: everything reachable in half an hour. Drag the speed from gridlock to highway and watch the effective labor market — not the city — grow and shrink.",
    tag: "the transport branch: Nairobi's driving speeds cutting reachable jobs dramatically.",
    thumb: <SkIsochroneThumb />,
    paperThumb: true,
    body: () => <SkIsochrone />,
  },
  {
    id: "sk-sorter",
    num: "S16",
    eyebrow: "Exports",
    title: "Export or local?",
    teaser: "Eight businesses, two bins, a few traps.",
    lede: "Sort each business by the only question that matters for the export base: does it bring outside money in, or recirculate what's already here? The hospital and the tour boat are where it gets interesting.",
    tag: "the definition under the exports section: tradables don't need a container.",
    thumb: <SkSorterThumb />,
    paperThumb: true,
    body: () => <SkSorter />,
  },
  {
    id: "sk-question",
    num: "S17",
    eyebrow: "The framework",
    title: "Four ways to ask",
    teaser: "One root question, four accents, four cities.",
    lede: "The root of Figure 27 is a single sentence with four possible stresses — better, more inclusive, higher, more resilient. Click each accent and see which of the paper's cities asked it that way.",
    tag: "the verbatim root question of the decision tree, and the cases that stressed each word.",
    thumb: <SkQuestionThumb />,
    paperThumb: true,
    body: () => <SkQuestion />,
  },
  {
    id: "sk-shiftshare",
    num: "S18",
    eyebrow: "Performance",
    title: "The growth waterfall",
    teaser: "Tide, mix, engine — which one is your city?",
    lede: "Shift-share in three bars: the national tide lifts everyone, the industry mix is dealt luck, and only the local effect is really about the city. Three presets, three very different diagnoses of the same headline number.",
    tag: "the decomposition behind the profile's performance section — “the industry mix isn't the drag.”",
    thumb: <SkShiftShareThumb />,
    paperThumb: true,
    body: () => <SkShiftShare />,
  },
  {
    id: "sk-cap",
    num: "S19",
    eyebrow: "Housing",
    title: "The height cap",
    teaser: "Drag the rule; watch floors turn into prices.",
    lede: "A tower wants eighteen floors; the red line is the law. Drag it up and down — every wanted floor the cap refuses reappears as a premium on the floors that exist.",
    tag: "FAR limits and height caps — the fortress city's machinery, one rule at a time.",
    thumb: <SkCapThumb />,
    paperThumb: true,
    body: () => <SkCap />,
  },
  {
    id: "sk-seesaw",
    num: "S20",
    eyebrow: "Amenities",
    title: "The seesaw of staying",
    teaser: "Break the place; watch the wage make up for it.",
    lede: "Pay plus place must balance what it takes to keep people. Close the parks or let crime rise and the beam tips — then watch the wage pan grow until staying balances again.",
    tag: "compensating differentials — Flint's rising wages and falling home values, mid-swing.",
    thumb: <SkSeesawThumb />,
    paperThumb: true,
    body: () => <SkSeesaw />,
  },
];
