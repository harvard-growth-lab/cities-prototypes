/**
 * The pocket textbook, part C (M21–M30) — work and workers. Spatial
 * mismatch, skills mismatch, the participation funnel, the informal
 * iceberg, churn as health, thick-market matching, human-capital
 * spillovers, brain gain, the rent-vs-commute tradeoff, and real wages.
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
   M21 · jobs across the river — spatial mismatch
   ============================================================ */

const MM_WORKERS = [
  { x: 62, y: 66 }, { x: 95, y: 92 }, { x: 70, y: 128 }, { x: 120, y: 70 },
  { x: 142, y: 120 }, { x: 88, y: 168 }, { x: 152, y: 160 }, { x: 172, y: 96 },
  { x: 118, y: 148 }, { x: 60, y: 24 },
];

function MMismatch() {
  const [bus, setBus] = useState(false);
  const employed = (w: { x: number; y: number }, i: number) =>
    bus ? i !== 9 : w.x >= 140;
  const count = MM_WORKERS.filter((w, i) => employed(w, i)).length;
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!bus} onClick={() => setBus(false)}>
          no crosstown transit
        </button>
        <button className="btn gold" aria-pressed={bus} onClick={() => setBus(true)}>
          run the bus line
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="Workers cluster on the west side of the map and jobs on the east. Without transit only the nearest workers reach them; a bus line across the middle lights most of the rest up as employed.">
          <text x={40} y={200} className="fig-axis">where people live</text>
          <text x={440} y={200} textAnchor="end" className="fig-axis">where the jobs are</text>
          {bus && (
            <g>
              <line x1={110} y1={116} x2={382} y2={116} stroke={GOLD} strokeWidth={4}
                strokeDasharray="10 8" className="fig-flow" opacity={0.75} />
              <text x={246} y={104} textAnchor="middle" fontSize={9.5} fontWeight={700}
                fill="#785312">
                the bus line
              </text>
            </g>
          )}
          {Array.from({ length: 10 }, (_, i) => {
            const x = 322 + (i % 3) * 42;
            const y = 52 + Math.floor(i / 3) * 38;
            return <rect key={i} x={x} y={y} width={16} height={13} rx={2} fill="#c9c2b2" />;
          })}
          {MM_WORKERS.map((w, i) => {
            const ok = employed(w, i);
            return (
              <circle key={i} cx={w.x} cy={w.y} r={6.5} fill={ok ? BLUE : "#b3ab9c"}
                stroke={ok ? "none" : RED} strokeWidth={ok ? 0 : 1.4}
                style={{ transition: "fill 0.4s" }} />
            );
          })}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">workers reaching a job</div>
          <div className="value">{count} <span style={{ fontSize: 15 }}>of 10</span></div>
        </div>
      </div>
      <p className="widget-caption">
        {bus
          ? "Same people, same jobs, one bus line: employment triples. The vacancy list never changed — the map between homes and jobs did."
          : "The jobs exist and the workers exist — on opposite sides of town, with nothing running between them. Spatial mismatch looks exactly like laziness in the statistics."}
      </p>
      <p className="data-note">
        Employment is a matching problem in space. Before diagnosing skills or effort, check
        the geometry: who can actually reach the jobs within a tolerable commute? (S15's
        isochrone is this test, formalized.)
      </p>
    </>
  );
}

function MMismatchThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[[70, 70], [110, 120], [66, 170], [130, 200], [150, 90]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={11} fill={BLUE} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={330 + (i % 2) * 50} y={64 + Math.floor(i / 2) * 52} width={30}
          height={24} rx={3} fill="#c9c2b2" />
      ))}
      <line x1={175} y1={140} x2={310} y2={140} stroke={GOLD} strokeWidth={7} strokeDasharray="13 11" />
    </svg>
  );
}

/* ============================================================
   M22 · the shelf gap — skills mismatch
   ============================================================ */

const OCC = [
  { name: "assemblers", d: 2, s: 7 },
  { name: "clerks", d: 3, s: 6 },
  { name: "coders", d: 8, s: 2 },
  { name: "nurses", d: 5, s: 3 },
];

function MShelves() {
  const [t, setT] = useState(0);
  const supply = useTweens(OCC.map((o) => o.s + (o.d - o.s) * t), 450);
  const vac = OCC.reduce((a, o, i) => a + Math.max(0, o.d - supply[i]), 0);
  const idle = OCC.reduce((a, o, i) => a + Math.max(0, supply[i] - o.d), 0);
  return (
    <>
      <div className="fig-slider">
        <span>retraining effort</span>
        <input type="range" min={0} max={1} step={0.05} value={t}
          onChange={(e) => setT(Number(e.target.value))} />
        <span className="readout">{Math.round(t * 100)}%</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="Paired bars per occupation: outlined bars for the jobs on offer, filled bars for the workers available. Retraining slides the worker bars toward the job bars, shrinking both vacancies and unemployment.">
          <line x1={40} y1={196} x2={440} y2={196} stroke="#c9c2b2" strokeWidth={1.3} />
          {OCC.map((o, i) => {
            const x = 52 + i * 104;
            const sv = supply[i];
            return (
              <g key={o.name}>
                <rect x={x} y={196 - o.d * 18} width={34} height={o.d * 18} rx={3} fill="none"
                  stroke={GOLD} strokeWidth={1.8} strokeDasharray="4 3" />
                <text x={x + 17} y={196 - o.d * 18 - 6} textAnchor="middle" fontSize={9.5}
                  fontWeight={700} fill="#9a6712">
                  {o.d} jobs
                </text>
                <rect x={x + 42} y={196 - sv * 18} width={34} height={sv * 18} rx={3}
                  fill={BLUE} fillOpacity={0.2} stroke={BLUE} strokeWidth={1.4} />
                <text x={x + 59} y={196 - sv * 18 - 6} textAnchor="middle" fontSize={9.5}
                  fontWeight={700} fill={BLUE}>
                  {sv.toFixed(0)}
                </text>
                <text x={x + 38} y={214} textAnchor="middle" fontSize={9.5} fontWeight={600}
                  fill={INK3}>
                  {o.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">unfilled jobs</div>
          <div className="value">{Math.round(vac)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">stranded workers</div>
          <div className="value">{Math.round(idle)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {t < 0.2
          ? "Eight jobs unfilled and eight people idle — in the same town, at the same time. Not a contradiction: a mismatch. The shelves don't line up."
          : t < 0.8
            ? "Retraining slides the worker bars toward the job bars — both problems shrink together, because they were always one problem."
            : "Shelves aligned: the same headcount, redeployed. The constraint was never the number of people — it was the shape of what they knew."}
      </p>
      <p className="data-note">
        When vacancies and unemployment are both high, the labor market isn't slack — it's
        mismatched. Economists watch exactly this pair (the Beveridge curve) to tell the two
        stories apart.
      </p>
    </>
  );
}

function MShelvesThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={224} x2={444} y2={224} stroke="#c9c2b2" strokeWidth={2.5} />
      {[
        [40, 150], [160, 60], [280, 190], [400, 110],
      ].map(([x, hd], i) => (
        <g key={i}>
          <rect x={x} y={224 - hd} width={36} height={hd} rx={4} fill="none" stroke={GOLD}
            strokeWidth={3} strokeDasharray="7 5" />
          <rect x={x + 44} y={224 - (250 - hd) * 0.7} width={36} height={(250 - hd) * 0.7} rx={4}
            fill={BLUE} fillOpacity={0.2} stroke={BLUE} strokeWidth={2.5} />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================
   M23 · the funnel — who counts as unemployed
   ============================================================ */

function MFunnel() {
  const [disc, setDisc] = useState(false);
  const lf = disc ? 46 : 42;
  const [aLf] = useTweens([lf], 500);
  const rate = ((lf - 38) / lf) * 100;
  const rows = [
    { label: "everyone", v: 100, note: "" },
    { label: "working age", v: 64, note: "−36 children & retired" },
    { label: "in the labor force", v: aLf, note: disc ? "−18 students & carers" : "−22 students, carers, discouraged" },
    { label: "employed", v: 38, note: "−the job seekers" },
  ];
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={disc} onClick={() => setDisc(!disc)}>
          count the discouraged as unemployed
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="A funnel of horizontal bars from the whole population down to the employed. Toggling whether discouraged workers count as unemployed moves the labor-force bar and jumps the unemployment rate.">
          {rows.map((r, i) => (
            <g key={r.label}>
              <rect x={132} y={22 + i * 46} width={r.v * 3.1} height={26} rx={4}
                fill={i === 3 ? GREEN : i === 2 ? BLUE : "#b3ab9c"}
                fillOpacity={i < 2 ? 0.4 : 0.25}
                stroke={i === 3 ? GREEN : i === 2 ? BLUE : "#8d867a"} strokeWidth={1.3} />
              <text x={124} y={39 + i * 46} textAnchor="end" fontSize={10} fontWeight={600}
                fill={INK3}>
                {r.label}
              </text>
              <text x={138 + r.v * 3.1} y={33 + i * 46} fontSize={9} fill={INK4}>
                {Math.round(r.v)}{r.note && ` · ${r.note}`}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">unemployment rate</div>
          <div className="value">{rate.toFixed(1)}%</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">participation · of working age</div>
          <div className="value">{Math.round((lf / 64) * 100)}%</div>
        </div>
      </div>
      <p className="widget-caption">
        {disc
          ? "Same city, same jobs — and the rate jumped from 9.5% to 17.4%, because the denominator moved. Who gets counted is a modelling choice wearing a fact's clothes."
          : "The headline unemployment rate lives at the bottom of this funnel — after two bigger gates have quietly sorted most people out of the story. Toggle the discouraged back in."}
      </p>
      <p className="data-note">
        A falling unemployment rate can mean jobs found or seekers giving up. Serious profiles
        read the rate together with participation — the funnel's middle gate — before
        celebrating.
      </p>
    </>
  );
}

function MFunnelThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[
        [340, "#b3ab9c"], [240, "#b3ab9c"], [170, BLUE], [140, GREEN],
      ].map(([w, c], i) => (
        <rect key={i} x={70} y={36 + i * 56} width={w as number} height={36} rx={6}
          fill={c as string} fillOpacity={0.3} stroke={c as string} strokeWidth={2.5} />
      ))}
    </svg>
  );
}

/* ============================================================
   M24 · the iceberg — informality
   ============================================================ */

function MIceberg() {
  const [f, setF] = useState(55);
  const [af] = useTweens([f], 450);
  const above = af * 0.9;
  const below = (100 - af) * 1.1;
  return (
    <>
      <div className="fig-slider">
        <span>share of the economy that is formal</span>
        <input type="range" min={30} max={95} step={5} value={f}
          onChange={(e) => setF(Number(e.target.value))} />
        <span className="readout">{f}%</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="An iceberg at a waterline: the formal economy above the water, the informal economy below it, larger than it looks from the surface.">
          <rect x={30} y={96} width={420} height={130} fill="#5d86b8" opacity={0.18} />
          <line x1={30} y1={96} x2={450} y2={96} stroke="#8fb4dc" strokeWidth={2.5} />
          <polygon
            points={`200,${96 - above} 300,${96 - above * 0.75} 330,96 170,96`}
            fill="#e8f0f6" stroke="#9fb8cc" strokeWidth={1.4} />
          <polygon
            points={`170,96 330,96 360,${96 + below * 0.55} 260,${96 + below} 150,${96 + below * 0.7}`}
            fill="#b8cfe0" stroke="#9fb8cc" strokeWidth={1.4} opacity={0.85} />
          <text x={250} y={Math.max(30, 96 - above / 2)} textAnchor="middle" fontSize={10.5}
            fontWeight={700} fill={INK3}>
            formal · taxed, counted
          </text>
          <text x={255} y={96 + below / 2 + 4} textAnchor="middle" fontSize={10.5} fontWeight={700}
            fill="#33566e">
            informal · working, invisible
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">activity the tax base sees</div>
          <div className="value">{f}%</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">workers without protections</div>
          <div className="value">{100 - f}%</div>
        </div>
      </div>
      <p className="widget-caption">
        {f < 50
          ? "Most of the city works below the waterline: employed, productive, and invisible to the statistics, the tax base and the safety net. Diagnose from formal data alone and you diagnose the tip."
          : f > 80
            ? "A mostly formal economy: what the statistics see is close to what exists. This is what most rich-country profiles quietly assume."
            : "Half the iceberg is under water. Every formal indicator — wages, employment, firm size — is a biased sample of a bigger, wetter truth."}
      </p>
      <p className="data-note">
        Informality is symptom and constraint at once: firms stay small to stay invisible,
        which starves them of credit, contracts and scale — and starves the city of the taxes
        that fix binding constraints.
      </p>
    </>
  );
}

function MIcebergThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={20} y={120} width={440} height={150} fill="#5d86b8" opacity={0.2} />
      <line x1={20} y1={120} x2={460} y2={120} stroke="#8fb4dc" strokeWidth={4} />
      <polygon points="200,52 296,72 330,120 164,120" fill="#e8f0f6" stroke="#9fb8cc" strokeWidth={2.5} />
      <polygon points="164,120 330,120 372,190 250,246 140,196" fill="#b8cfe0" stroke="#9fb8cc"
        strokeWidth={2.5} />
    </svg>
  );
}

/* ============================================================
   M25 · churn is health
   ============================================================ */

function MChurn() {
  const [hot, setHot] = useState(true);
  const [born, lost] = useTweens(hot ? [12, 10] : [3, 1], 550);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!hot} onClick={() => setHot(false)}>
          the frozen market
        </button>
        <button className="btn" aria-pressed={hot} onClick={() => setHot(true)}>
          the dynamic market
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="Jobs created rise above a baseline and jobs destroyed hang below it. The frozen and dynamic markets have the same small net, but wildly different gross bars.">
          <line x1={40} y1={113} x2={440} y2={113} stroke="#8d867a" strokeWidth={1.4} />
          <rect x={120} y={113 - born * 7.4} width={80} height={born * 7.4} rx={3} fill={GREEN}
            fillOpacity={0.2} stroke={GREEN} strokeWidth={1.6} />
          <text x={160} y={113 - born * 7.4 - 8} textAnchor="middle" fontSize={11} fontWeight={700}
            fill={GREEN}>
            +{born.toFixed(0)}% born
          </text>
          <rect x={280} y={113} width={80} height={lost * 7.4} rx={3} fill={RED}
            fillOpacity={0.16} stroke={RED} strokeWidth={1.6} />
          <text x={320} y={113 + lost * 7.4 + 16} textAnchor="middle" fontSize={11} fontWeight={700}
            fill={RED}>
            −{lost.toFixed(0)}% lost
          </text>
          <g>
            <line x1={404} y1={113} x2={404} y2={113 - 2 * 7.4} stroke="#221e19" strokeWidth={3}
              strokeLinecap="round" />
            <text x={412} y={100} fontSize={10} fontWeight={700} fill="#221e19">
              net +2%
            </text>
            <text x={412} y={113} fontSize={8.5} fill={INK4}>
              both times
            </text>
          </g>
        </svg>
      </div>
      <p className="widget-caption">
        {hot
          ? "A tenth of all jobs die every year — and more are born. The net hides an engine turning over: experiments, failures, reallocation toward what works."
          : "Nothing dies, little is born: the calm of a market where nobody dares switch. The same net growth — and no renewal underneath it."}
      </p>
      <p className="data-note">
        Job creation and destruction rates travel together; healthy cities run hot in both.
        Where firing is impossible, hiring quietly becomes impossible too — low churn is a
        constraint wearing the mask of stability.
      </p>
    </>
  );
}

function MChurnThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={135} x2={444} y2={135} stroke="#8d867a" strokeWidth={3} />
      <rect x={110} y={40} width={90} height={95} rx={5} fill={GREEN} fillOpacity={0.22}
        stroke={GREEN} strokeWidth={3} />
      <rect x={270} y={135} width={90} height={80} rx={5} fill={RED} fillOpacity={0.18}
        stroke={RED} strokeWidth={3} />
    </svg>
  );
}

/* ============================================================
   M26 · the thick market — matching quality
   ============================================================ */

function MThick() {
  const [n, setN] = useState(4);
  const yOf = (i: number) => (n === 1 ? 105 : 28 + (i * 158) / (n - 1));
  const firms = Array.from({ length: n }, (_, i) => {
    let best = 0;
    let bj = 0;
    for (let j = 0; j < n; j++) {
      const sim = 0.25 + 0.75 * rnd(`m26-${i}-${j}`);
      if (sim > best) {
        best = sim;
        bj = j;
      }
    }
    return { best, bj };
  });
  const avg = firms.reduce((a, f) => a + f.best, 0) / n;
  const tone = (q: number) => (q > 0.82 ? GREEN : q > 0.62 ? GOLD : RED);
  return (
    <>
      <div className="fig-slider">
        <span>people & openings in the market</span>
        <input type="range" min={3} max={12} step={1} value={n}
          onChange={(e) => setN(Number(e.target.value))} />
        <span className="readout">{n}+{n}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 210" role="img"
          aria-label="Two columns of dots, workers and openings, joined by each opening's best available match. As the market thickens, more of the links turn green with good fits.">
          <text x={120} y={202} textAnchor="middle" className="fig-axis">workers</text>
          <text x={360} y={202} textAnchor="middle" className="fig-axis">openings</text>
          {firms.map((f, i) => (
            <line key={i} x1={132} y1={yOf(f.bj)} x2={348} y2={yOf(i)} stroke={tone(f.best)}
              strokeWidth={1.6} opacity={0.8} />
          ))}
          {Array.from({ length: n }, (_, i) => (
            <circle key={`w${i}`} cx={120} cy={yOf(i)} r={7} fill={BLUE} opacity={0.85} />
          ))}
          {Array.from({ length: n }, (_, i) => (
            <circle key={`f${i}`} cx={360} cy={yOf(i)} r={7} fill={INK3} opacity={0.85} />
          ))}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">average quality of the match</div>
          <div className="value">{Math.round(avg * 100)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {n <= 4
          ? "Three candidates, take the least bad: thin markets force compromises, and the red links are careers spent in the wrong job."
          : n >= 10
            ? "With a crowd in the room, the picky find each other — most links run green. Matched pairs are what productivity is made of."
            : "Every added pair raises everyone's odds of a good fit. Thickness is a service the city provides for free."}
      </p>
      <p className="data-note">
        The matching engine from M10, quantified: bigger pools raise the expected quality of the
        best match. It's why specialized workers and specialized firms both migrate to the same
        few places.
      </p>
    </>
  );
}

function MThickThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[50, 105, 160, 215].map((y, i) => (
        <g key={y}>
          <circle cx={110} cy={y} r={13} fill={BLUE} />
          <circle cx={370} cy={y} r={13} fill={INK3} />
          <line x1={126} y1={y} x2={354} y2={[105, 50, 215, 160][i]}
            stroke={[GREEN, GREEN, GOLD, RED][i]} strokeWidth={3.5} opacity={0.85} />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================
   M27 · the schooled street — human-capital spillovers
   ============================================================ */

function MSpillover() {
  const [g, setG] = useState(20);
  const grads = Math.round((8 * g) / 100);
  const [wNon, wGrad] = useTweens([100 + g * 0.45, 135 + g * 0.45], 450);
  return (
    <>
      <div className="fig-slider">
        <span>graduates in the city's workforce</span>
        <input type="range" min={0} max={80} step={5} value={g}
          onChange={(e) => setG(Number(e.target.value))} />
        <span className="readout">{g}%</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="Eight workers as wage bars, graduates in gold and the rest in blue. Raising the graduate share lifts every bar — including the non-graduates'.">
          <line x1={40} y1={190} x2={440} y2={190} stroke="#c9c2b2" strokeWidth={1.3} />
          {Array.from({ length: 8 }, (_, i) => {
            const isGrad = i < grads;
            const w = isGrad ? wGrad : wNon;
            const x = 56 + i * 47;
            const c = isGrad ? GOLD : BLUE;
            return (
              <g key={i}>
                <rect x={x} y={190 - (w - 60)} width={32} height={w - 60} rx={3} fill={c}
                  fillOpacity={0.2} stroke={c} strokeWidth={1.4} />
                <circle cx={x + 16} cy={190 - (w - 60) - 10} r={6} fill={c} />
                {isGrad && (
                  <rect x={x + 8} y={190 - (w - 60) - 20} width={16} height={4} fill="#785312" />
                )}
              </g>
            );
          })}
          <text x={440} y={190 - (wNon - 60) + 4} textAnchor="end" fontSize={10} fontWeight={700}
            fill={BLUE}>
            {Math.round(wNon)}
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">a non-graduate's wage</div>
          <div className="value">{Math.round(wNon)}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">a graduate's wage</div>
          <div className="value">{Math.round(wGrad)}</div>
        </div>
      </div>
      <p className="widget-caption">
        {g === 0
          ? "No graduates: the baseline street. Now educate some neighbors."
          : g < 40
            ? "Watch the blue bars: they rise without a day of extra schooling. Knowledge leaks across desks, streets and supply chains — and lands in other people's paychecks."
            : "In the schooled city everyone earns more — the non-graduate premium here is pure spillover. Education is one of the few investments that pays the people who didn't make it."}
      </p>
      <p className="data-note">
        US estimates: a one-point rise in a city's graduate share lifts everyone's wages, the
        least-educated workers' most of all. It's the strongest human-capital argument for why
        cities should fight to attract and keep graduates.
      </p>
    </>
  );
}

function MSpilloverThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={230} x2={444} y2={230} stroke="#c9c2b2" strokeWidth={2.5} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const grad = i < 2;
        const h = grad ? 150 : 108;
        const c = grad ? GOLD : BLUE;
        return (
          <g key={i}>
            <rect x={58 + i * 62} y={230 - h} width={40} height={h} rx={4} fill={c}
              fillOpacity={0.2} stroke={c} strokeWidth={2.5} />
            <circle cx={78 + i * 62} cy={230 - h - 14} r={9} fill={c} />
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   M28 · the leaky pump — brain gain
   ============================================================ */

function MBrainGain() {
  const [ret, setRet] = useState(30);
  const [aRet] = useTweens([ret], 450);
  const series: number[] = [100];
  for (let t = 0; t < 15; t++) series.push(series[t] * 0.95 + 20 * (aRet / 100));
  const eq = Math.round(400 * (ret / 100));
  const xOf = (t: number) => 46 + (t / 15) * 388;
  const yOf = (v: number) => 200 - (v / 400) * 172;
  return (
    <>
      <div className="fig-slider">
        <span>graduates who stay each June</span>
        <input type="range" min={10} max={90} step={5} value={ret}
          onChange={(e) => setRet(Number(e.target.value))} />
        <span className="readout">{ret}%</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="The stock of skilled residents over fifteen years, fed by a university graduating twenty a year. Retention sets whether the line climbs or leaks flat.">
          {[100, 200, 300].map((v) => (
            <g key={v}>
              <line x1={46} y1={yOf(v)} x2={434} y2={yOf(v)} stroke={GRID} strokeWidth={1} />
              <text x={40} y={yOf(v) + 3.5} textAnchor="end" className="fig-axis">
                {v}
              </text>
            </g>
          ))}
          <text x={46} y={222} className="fig-axis">now</text>
          <text x={434} y={222} textAnchor="end" className="fig-axis">year 15</text>
          <path d={"M" + series.map((v, t) => `${xOf(t)},${yOf(v)}`).join(" L")} fill="none"
            stroke={BLUE} strokeWidth={2.6} strokeLinecap="round" />
          <circle cx={xOf(15)} cy={yOf(series[15])} r={5.5} fill={BLUE} />
          <text x={xOf(15) - 8} y={yOf(series[15]) - 10} textAnchor="end" fontSize={10.5}
            fontWeight={700} fill={BLUE}>
            {Math.round(series[15])}
          </text>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">skilled residents · year 15</div>
          <div className="value">{Math.round(series[15])}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">where it settles eventually</div>
          <div className="value">{eq}</div>
        </div>
      </div>
      <p className="widget-caption">
        {ret <= 25
          ? "The pump runs, the bucket leaks: a fine university, a flat line. The graduates exist — they just live somewhere else now."
          : ret >= 70
            ? "Same university, triple the graduates in town. The constraint was never the diploma mill — it's what happens the June after: a job worth staying for, a rent that permits it."
            : "Every extra point of retention compounds: the graduates who stay hire, marry and anchor the ones who follow."}
      </p>
      <p className="data-note">
        “Build a university” is only half a policy. The retention rate — set by the job market,
        housing and amenities — decides whether it fills the city or supplies its rivals.
      </p>
    </>
  );
}

function MBrainGainThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[80, 150, 220].map((y) => (
        <line key={y} x1={44} y1={y} x2={436} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <path d="M44,230 Q200,170 436,80" fill="none" stroke={BLUE} strokeWidth={6} />
      <path d="M44,230 Q200,214 436,196" fill="none" stroke="#b3ab9c" strokeWidth={4} />
      <circle cx={436} cy={80} r={9} fill={BLUE} />
    </svg>
  );
}

/* ============================================================
   M29 · the household's arbitrage — rent vs commute
   ============================================================ */

function MTradeoff() {
  const [d, setD] = useState(6);
  const [slope, setSlope] = useState(2);
  const rent = (x: number) => 58 * Math.exp(-0.09 * x) + 10;
  const comm = (x: number) => slope * x;
  const total = (x: number) => rent(x) + comm(x);
  const xs = Array.from({ length: 61 }, (_, i) => i * 0.5);
  let opt = 0;
  for (const x of xs) if (total(x) < total(opt)) opt = x;
  const xOf = (x: number) => 46 + (x / 30) * 388;
  const yOf = (v: number) => 196 - v * 1.5;
  const drag = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (((e.clientX - r.left) / r.width) * 480 - 46) / 388 * 30;
    setD(Math.max(0, Math.min(30, Math.round(x * 2) / 2)));
  };
  return (
    <>
      <div className="fig-slider">
        <span>cost of a kilometer · fares & fuel</span>
        <input type="range" min={1} max={4} step={0.5} value={slope}
          onChange={(e) => setSlope(Number(e.target.value))} />
        <span className="readout">{slope.toFixed(1)}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="Rent falls with distance from downtown while commuting cost rises; their sum is a U-shaped curve with a sweet spot. Drag the home along the corridor and move the tradeoff."
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag(e); }}
          onPointerMove={(e) => e.buttons > 0 && drag(e)}
          style={{ touchAction: "none", cursor: "ew-resize" }}>
          <line x1={46} y1={196} x2={434} y2={196} stroke="#c9c2b2" strokeWidth={1.3} />
          <text x={46} y={222} className="fig-axis">downtown</text>
          <text x={434} y={222} textAnchor="end" className="fig-axis">30 km out</text>
          <path d={"M" + xs.map((x) => `${xOf(x)},${yOf(rent(x))}`).join(" L")} fill="none"
            stroke={BLUE} strokeWidth={1.4} opacity={0.55} />
          <text x={60} y={yOf(rent(1)) - 8} fontSize={9} fill={BLUE}>rent</text>
          <path d={"M" + xs.map((x) => `${xOf(x)},${yOf(comm(x))}`).join(" L")} fill="none"
            stroke={GOLD} strokeWidth={1.4} opacity={0.6} />
          <text x={xOf(28)} y={yOf(comm(28)) - 8} fontSize={9} fill="#9a6712">commute</text>
          <path d={"M" + xs.map((x) => `${xOf(x)},${yOf(total(x))}`).join(" L")} fill="none"
            stroke="#221e19" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={xOf(opt)} cy={yOf(total(opt))} r={4.5} fill="none" stroke={GREEN}
            strokeWidth={2} />
          <text x={xOf(opt)} y={yOf(total(opt)) - 10} textAnchor="middle" fontSize={9}
            fontWeight={700} fill={GREEN}>
            sweet spot
          </text>
          <g style={{ transform: `translate(${xOf(d)}px, 0)`, transition: "transform 0.15s" }}>
            <line x1={0} y1={yOf(total(d))} x2={0} y2={196} stroke="#221e19" strokeWidth={1}
              strokeDasharray="3 4" />
            <circle cx={0} cy={yOf(total(d))} r={7} fill="#221e19" />
            <rect x={-10} y={186} width={20} height={14} fill={GOLD} />
            <path d="M-13,186 L0,175 L13,186 Z" fill="#785312" />
          </g>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">rent at {d.toFixed(0)} km</div>
          <div className="value">{Math.round(rent(d))}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">commute cost</div>
          <div className="value">{Math.round(comm(d))}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">total</div>
          <div className="value">{Math.round(total(d))}</div>
        </div>
      </div>
      <p className="widget-caption">
        {Math.abs(d - opt) <= 2
          ? "You found the sweet spot — where an extra kilometer's rent saving exactly pays its commute. Raise fares and watch it slide toward downtown."
          : d < opt
            ? "Close in: the rent premium outruns the commute it saves you. Households drift outward from here."
            : "Far out: cheap keys, dear hours. Households drift back in from here — or lobby for the fast train."}
      </p>
      <p className="data-note">
        This is the household-sized version of the bid-rent curve (M11): the market gradient is
        just millions of these dots settling on their sweet spots at once.
      </p>
    </>
  );
}

function MTradeoffThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={230} x2={444} y2={230} stroke="#c9c2b2" strokeWidth={2.5} />
      <path d="M44,60 Q200,180 436,196" fill="none" stroke={BLUE} strokeWidth={3} opacity={0.6} />
      <path d="M44,224 L436,86" fill="none" stroke={GOLD} strokeWidth={3} opacity={0.6} />
      <path d="M44,80 Q180,124 240,120 Q330,120 436,60" fill="none" stroke="#221e19" strokeWidth={5} />
      <circle cx={252} cy={120} r={11} fill="#221e19" />
    </svg>
  );
}

/* ============================================================
   M30 · the wage you keep — nominal vs real
   ============================================================ */

const RW_CITIES = [
  { name: "Coasta", pay: 132, cost: 122, color: BLUE },
  { name: "Plaine", pay: 100, cost: 82, color: GOLD },
];

function MRealWage() {
  const [real, setReal] = useState(false);
  const vals = RW_CITIES.map((c) => (real ? (c.pay / c.cost) * 100 : c.pay));
  const anim = useTweens(vals, 550);
  const winner = anim[0] >= anim[1] ? 0 : 1;
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!real} onClick={() => setReal(false)}>
          sticker pay
        </button>
        <button className="btn" aria-pressed={real} onClick={() => setReal(true)}>
          what it buys
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="Two cities' pay bars. Deflating by local living costs flips the ranking: the high-pay coastal city buys less than the modest inland one.">
          <line x1={40} y1={190} x2={440} y2={190} stroke="#c9c2b2" strokeWidth={1.3} />
          {RW_CITIES.map((c, i) => {
            const v = anim[i];
            const x = 110 + i * 180;
            return (
              <g key={c.name}>
                <rect x={x} y={190 - v * 1.05} width={80} height={v * 1.05} rx={4} fill={c.color}
                  fillOpacity={0.2} stroke={c.color} strokeWidth={1.6} />
                <rect x={x} y={190 - v * 1.05} width={80} height={5} fill={c.color} />
                <text x={x + 40} y={190 - v * 1.05 - 10} textAnchor="middle" fontSize={13}
                  fontWeight={700} fill={c.color}>
                  {Math.round(v)}
                </text>
                <text x={x + 40} y={208} textAnchor="middle" fontSize={11} fontWeight={700}
                  fill="#2c2823">
                  {c.name}
                </text>
                {winner === i && (
                  <text x={x + 40} y={190 - v * 1.05 - 26} textAnchor="middle" fontSize={10}
                    fontWeight={700} fill={GREEN}>
                    ★ better deal
                  </text>
                )}
              </g>
            );
          })}
          <text x={240} y={40} textAnchor="middle" className="fig-axis">
            {real ? "pay ÷ local cost of living" : "pay, as advertised"}
          </text>
        </svg>
      </div>
      <p className="widget-caption">
        {real
          ? "Deflate by what living there costs and the ranking flips: the raise was rent all along. Spatial equilibrium predicts exactly this — big sticker gaps mostly buy off big costs."
          : "Coasta pays 32% more — case closed? Flip the toggle before you move."}
      </p>
      <p className="data-note">
        Real wages are the profile's default for a reason: nominal comparisons across cities
        mostly measure the price of housing. The interesting residual is what's left after —
        the be-here premium of S13.
      </p>
    </>
  );
}

function MRealWageThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={224} x2={440} y2={224} stroke="#c9c2b2" strokeWidth={2.5} />
      <rect x={110} y={70} width={90} height={154} rx={5} fill={BLUE} fillOpacity={0.2}
        stroke={BLUE} strokeWidth={3} />
      <rect x={290} y={110} width={90} height={114} rx={5} fill={GOLD} fillOpacity={0.2}
        stroke={GOLD} strokeWidth={3} />
      <text x={335} y={90} textAnchor="middle" fontSize={30} fill={GREEN}>★</text>
    </svg>
  );
}

/* ============================================================
   the entries
   ============================================================ */

export const MICRO_C: Concept[] = [
  {
    id: "m-mismatch",
    num: "M21",
    eyebrow: "Labor markets",
    title: "Jobs across the river",
    teaser: "The vacancies exist; the bus doesn't.",
    lede: "Workers on one side of the map, jobs on the other, nothing running between. Run the bus line and watch employment triple without a single new job — spatial mismatch is a geometry problem wearing a motivation costume.",
    tag: "the transport branch of the tree — job accessibility, not job counts, is the binding quantity.",
    thumb: <MMismatchThumb />,
    paperThumb: true,
    body: () => <MMismatch />,
  },
  {
    id: "m-shelves",
    num: "M22",
    eyebrow: "Labor markets",
    title: "The shelf gap",
    teaser: "Unfilled jobs and idle workers, simultaneously.",
    lede: "Four occupations, jobs on one shelf and workers on another — misaligned. Slide the retraining effort and watch vacancies and unemployment shrink together, because they were always one problem.",
    tag: "skills diagnostics in any profile: when vacancies and unemployment are both high, the market is mismatched, not slack.",
    thumb: <MShelvesThumb />,
    paperThumb: true,
    body: () => <MShelves />,
  },
  {
    id: "m-funnel",
    num: "M23",
    eyebrow: "Labor markets",
    title: "The funnel",
    teaser: "Who counts as unemployed is a choice.",
    lede: "From everyone, to working-age, to the labor force, to the employed: the headline rate lives at the bottom of a funnel with quietly-decided gates. Toggle one gate and watch the rate nearly double.",
    tag: "unemployment and participation numbers in every profile — read the funnel, not just its last line.",
    thumb: <MFunnelThumb />,
    paperThumb: true,
    body: () => <MFunnel />,
  },
  {
    id: "m-iceberg",
    num: "M24",
    eyebrow: "Informality",
    title: "The iceberg",
    teaser: "Most of the work is below the waterline.",
    lede: "The formal economy floats above the waterline — taxed, measured, protected. Slide the formal share and watch how much of the city's actual work sinks out of sight of every statistic a diagnosis relies on.",
    tag: "profiles of developing-country cities, where formal data covers the tip and policy must reach the rest.",
    thumb: <MIcebergThumb />,
    paperThumb: true,
    body: () => <MIceberg />,
  },
  {
    id: "m-churnjobs",
    num: "M25",
    eyebrow: "Labor markets",
    title: "Churn is health",
    teaser: "Same net, opposite economies.",
    lede: "Two labor markets with identical net growth: one where a tenth of all jobs die and more are born each year, one where nothing moves. The gross bars — not the net — tell you which one is alive.",
    tag: "the job-flows counterpart of M2's revolving door — dynamism lives in the gross numbers.",
    thumb: <MChurnThumb />,
    paperThumb: true,
    body: () => <MChurn />,
  },
  {
    id: "m-thick",
    num: "M26",
    eyebrow: "Labor markets",
    title: "The thick market",
    teaser: "More players, better matches — for everyone.",
    lede: "Each opening hires the best available worker. Thicken the market and watch the links turn green: the quality of the best match rises with the size of the pool, mechanically.",
    tag: "the matching engine of agglomeration (M10), quantified — why specialists cluster in the same few cities.",
    thumb: <MThickThumb />,
    paperThumb: true,
    body: () => <MThick />,
  },
  {
    id: "m-spillover",
    num: "M27",
    eyebrow: "Human capital",
    title: "The schooled street",
    teaser: "Your neighbors' degrees raise your wage.",
    lede: "Raise the city's graduate share and watch the non-graduates' wage bars rise without a day of extra schooling. Knowledge leaks — and lands in other people's paychecks.",
    tag: "the human-capital numbers in a profile: schooling is an investment that pays people who didn't make it.",
    thumb: <MSpilloverThumb />,
    paperThumb: true,
    body: () => <MSpillover />,
  },
  {
    id: "m-braingain",
    num: "M28",
    eyebrow: "Human capital",
    title: "The leaky pump",
    teaser: "A university is only half a policy.",
    lede: "The university graduates twenty a year, forever. Whether the city's skilled stock climbs or leaks flat is decided by one valve: how many stay each June. Slide the retention and watch fifteen years compound.",
    tag: "every 'build a university' proposal in a diagnosis — retention, not graduation, is the binding rate.",
    thumb: <MBrainGainThumb />,
    paperThumb: true,
    body: () => <MBrainGain />,
  },
  {
    id: "m-tradeoff",
    num: "M29",
    eyebrow: "Households",
    title: "The household's arbitrage",
    teaser: "Drag your home along the rent-commute seesaw.",
    lede: "Rent falls with distance, commuting rises; their sum is a U with a sweet spot. Drag the house along the corridor, then double the fares and watch the whole city's geometry shift inward.",
    tag: "the micro-foundation of M11's bid-rent curve — the market gradient is millions of these choices at once.",
    thumb: <MTradeoffThumb />,
    paperThumb: true,
    body: () => <MTradeoff />,
  },
  {
    id: "m-realwage",
    num: "M30",
    eyebrow: "Prices",
    title: "The wage you keep",
    teaser: "Deflate the pay; watch the ranking flip.",
    lede: "Coasta pays 32% more than Plaine — until you divide by what living in each costs, and the crown changes heads. Nominal comparisons across cities mostly measure the price of housing.",
    tag: "why every wage in a serious profile is a real wage — and the doorway to the be-here premium.",
    thumb: <MRealWageThumb />,
    paperThumb: true,
    body: () => <MRealWage />,
  },
];
