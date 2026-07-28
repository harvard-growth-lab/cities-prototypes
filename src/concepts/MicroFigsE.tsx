/**
 * The pocket textbook, part E (M41–M50) — reading the evidence. The price
 * scream, confounders, selection bias, complaints vs ledgers, benchmark
 * choice, mean vs median, totals vs per-head, convergence eras, the
 * dashboard trap, and the kink that makes diagnosis pay.
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
   M41 · the loudest price — shadow prices point
   ============================================================ */

const SCREAM_INPUTS = [
  { key: "land", name: "industrial land", mult: 1.1 },
  { key: "power", name: "electricity", mult: 1.05 },
  { key: "eng", name: "engineers", mult: 2.6 },
];

function MScream() {
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === "eng";
  return (
    <>
      <div className="fig-frame">
        <svg viewBox="0 0 480 200" role="img"
          aria-label="Three input prices as bars against the national level: industrial land and electricity near parity, engineer pay at two point six times. Click the input you believe is the binding constraint.">
          <line x1={150} y1={20} x2={150} y2={168} stroke={INK4} strokeWidth={1}
            strokeDasharray="4 5" />
          <text x={150} y={186} textAnchor="middle" className="fig-axis">
            national price = 1×
          </text>
          {SCREAM_INPUTS.map((inp, i) => {
            const chosen = picked === inp.key;
            const isAnswer = inp.key === "eng";
            return (
              <g key={inp.key} onClick={() => setPicked(inp.key)} style={{ cursor: "pointer" }}>
                <text x={140} y={48 + i * 48} textAnchor="end" fontSize={10.5} fontWeight={600}
                  fill={INK3}>
                  {inp.name}
                </text>
                <rect x={150} y={34 + i * 48} width={inp.mult * 105} height={22} rx={4}
                  fill={isAnswer ? RED : BLUE}
                  fillOpacity={picked ? (isAnswer ? 0.4 : 0.12) : 0.22}
                  stroke={chosen ? "#221e19" : isAnswer ? RED : BLUE}
                  strokeWidth={chosen ? 2.2 : 1.3}
                  style={{ transition: "all 0.25s" }} />
                <text x={158 + inp.mult * 105} y={49 + i * 48} fontSize={11} fontWeight={700}
                  fill={isAnswer ? RED : BLUE}>
                  {inp.mult}×
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="widget-caption" aria-live="polite">
        {picked === null
          ? "Firms here use land, power and engineers. One of the three is the binding constraint — and the prices already know which. Click your suspect."
          : right
            ? "Yes — the scream is the diagnosis. Firms are bidding desperately for the one scarce thing; the quiet prices are alibis for everything else."
            : "That price says abundant: firms get roughly all they want at close to the national rate. Cheap things aren't binding — follow the scream."}
      </p>
      <p className="data-note">
        The shadow-price test in its purest form: if something binds, its price — in money,
        queues (S5) or workarounds (S4) — is high. A constraint that's cheap is a complaint,
        not a constraint.
      </p>
    </>
  );
}

function MScreamThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={170} y1={30} x2={170} y2={240} stroke={INK4} strokeWidth={2.5} strokeDasharray="6 7" />
      <rect x={170} y={44} width={120} height={38} rx={6} fill={BLUE} fillOpacity={0.2}
        stroke={BLUE} strokeWidth={2.5} />
      <rect x={170} y={112} width={108} height={38} rx={6} fill={BLUE} fillOpacity={0.2}
        stroke={BLUE} strokeWidth={2.5} />
      <rect x={170} y={180} width={272} height={38} rx={6} fill={RED} fillOpacity={0.4}
        stroke={RED} strokeWidth={3} />
    </svg>
  );
}

/* ============================================================
   M42 · the third thing — confounders
   ============================================================ */

const HOODS = Array.from({ length: 24 }, (_, i) => {
  const z = rnd("z" + i);
  return {
    z,
    buses: 20 + 60 * z + (rnd("bn" + i) - 0.5) * 16,
    jobs: 15 + 70 * z + (rnd("jn" + i) - 0.5) * 16,
  };
});
const TIER_COLORS = [GREEN, GOLD, RED];

function MConfounder() {
  const [control, setControl] = useState(false);
  const xOf = (b: number) => 46 + ((b - 10) / 90) * 388;
  const yOf = (j: number) => 196 - (j / 100) * 166;
  const tierOf = (z: number) => (z < 0.34 ? 0 : z < 0.67 ? 1 : 2);
  const tiers = [0, 1, 2].map((t) => {
    const pts = HOODS.filter((h) => tierOf(h.z) === t);
    const mj = pts.reduce((a, h) => a + h.jobs, 0) / pts.length;
    const xs = pts.map((h) => h.buses);
    return { mj, x0: Math.min(...xs), x1: Math.max(...xs) };
  });
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!control} onClick={() => setControl(false)}>
          the raw scatter
        </button>
        <button className="btn" aria-pressed={control} onClick={() => setControl(true)}>
          hold city size constant
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="A scatter of neighborhoods: bus service against jobs. The raw fit is steep, but colored by neighborhood size the within-group lines are nearly flat — size was driving both.">
          <text x={434} y={218} textAnchor="end" className="fig-axis">bus service →</text>
          <text x={46} y={22} className="fig-axis">jobs ↑</text>
          {HOODS.map((h, i) => (
            <circle key={i} cx={xOf(h.buses)} cy={yOf(h.jobs)} r={5}
              fill={control ? TIER_COLORS[tierOf(h.z)] : BLUE} opacity={0.75}
              style={{ transition: "fill 0.4s" }} />
          ))}
          {!control ? (
            <line x1={xOf(22)} y1={yOf(17)} x2={xOf(80)} y2={yOf(85)} stroke="#221e19"
              strokeWidth={2.2} strokeDasharray="7 5" />
          ) : (
            tiers.map((t, i) => (
              <line key={i} x1={xOf(t.x0)} y1={yOf(t.mj)} x2={xOf(t.x1)} y2={yOf(t.mj)}
                stroke={TIER_COLORS[i]} strokeWidth={2.2} strokeDasharray="6 4" />
            ))
          )}
          {control && (
            <text x={434} y={40} textAnchor="end" fontSize={9} fill={INK3}>
              colored by neighborhood size
            </text>
          )}
        </svg>
      </div>
      <p className="widget-caption">
        {control
          ? "Within each size class the fit goes flat: big places have lots of buses and lots of jobs. The bus didn't cause the jobs — the size caused both."
          : "More buses, more jobs — a beautiful line. Before you order the fleet: is anything driving both axes at once?"}
      </p>
      <p className="data-note">
        The confounder is the oldest trap in city data, where everything correlates with size.
        It's why the paper leans on designs like changes-in-changes (S6) instead of raw
        cross-city scatters.
      </p>
    </>
  );
}

function MConfounderThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {HOODS.slice(0, 18).map((h, i) => (
        <circle key={i} cx={60 + ((h.buses - 10) / 90) * 380} cy={240 - (h.jobs / 100) * 200}
          r={9} fill={[GREEN, GOLD, RED][h.z < 0.34 ? 0 : h.z < 0.67 ? 1 : 2]} opacity={0.75} />
      ))}
      <line x1={70} y1={220} x2={420} y2={60} stroke="#221e19" strokeWidth={4} strokeDasharray="12 9" />
    </svg>
  );
}

/* ============================================================
   M43 · the movers' mirage — selection bias
   ============================================================ */

function MMovers() {
  const [followed, setFollowed] = useState(false);
  const [before] = useTweens([followed ? 121 : 100], 550);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!followed} onClick={() => setFollowed(false)}>
          the headline comparison
        </button>
        <button className="btn" aria-pressed={followed} onClick={() => setFollowed(true)}>
          follow the same people
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="Bars comparing stayers, movers before their move, and movers after. The headline gap is thirty-two points; following the same people shows most of it existed before they moved.">
          <line x1={40} y1={196} x2={440} y2={196} stroke="#c9c2b2" strokeWidth={1.3} />
          {[
            { x: 70, v: 100, c: "#8d867a", top: "100", label: followed ? "stayers" : "people back home" },
            { x: 200, v: before, c: GOLD, top: followed ? "121" : "", label: followed ? "movers, before moving" : "" },
            { x: 330, v: 132, c: BLUE, top: "132", label: "movers, in the city" },
          ].map((b) =>
            b.top === "" && !followed && b.x === 200 ? null : (
              <g key={b.x} opacity={b.x === 200 && !followed ? 0 : 1}
                style={{ transition: "opacity 0.4s" }}>
                <rect x={b.x} y={196 - b.v * 1.1} width={80} height={b.v * 1.1} rx={4} fill={b.c}
                  fillOpacity={0.2} stroke={b.c} strokeWidth={1.6} />
                <text x={b.x + 40} y={196 - b.v * 1.1 - 8} textAnchor="middle" fontSize={12}
                  fontWeight={700} fill={b.c}>
                  {Math.round(b.v)}
                </text>
                <text x={b.x + 40} y={214} textAnchor="middle" fontSize={9} fontWeight={600}
                  fill={INK3}>
                  {b.label}
                </text>
              </g>
            ),
          )}
          {followed && (
            <g>
              <line x1={418} y1={196 - 132 * 1.1} x2={418} y2={196 - 121 * 1.1} stroke={GREEN}
                strokeWidth={2} />
              <text x={426} y={196 - 126 * 1.1 + 3} fontSize={9.5} fontWeight={700} fill={GREEN}>
                +11
              </text>
              <text x={426} y={196 - 121 * 1.1 + 16} fontSize={8} fill={INK4}>
                the city's real gift
              </text>
            </g>
          )}
        </svg>
      </div>
      <p className="widget-caption">
        {followed
          ? "The movers were already out-earning their neighbors before they packed. Of the 32-point headline gap, 21 moved with them — the city's true effect is the modest +11."
          : "Movers to the big city earn 32% more than the people back home. Before crediting the city: who chooses to move?"}
      </p>
      <p className="data-note">
        Selection bias wears a gain's costume: the ambitious select into cities, booms and
        programs. The honest estimate follows the same people across the change — exactly what
        the best wage-premium studies (M5) do.
      </p>
    </>
  );
}

function MMoversThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={230} x2={444} y2={230} stroke="#c9c2b2" strokeWidth={2.5} />
      <rect x={62} y={120} width={90} height={110} rx={5} fill="#8d867a" fillOpacity={0.25}
        stroke="#8d867a" strokeWidth={2.5} />
      <rect x={192} y={96} width={90} height={134} rx={5} fill={GOLD} fillOpacity={0.2}
        stroke={GOLD} strokeWidth={2.5} />
      <rect x={322} y={82} width={90} height={148} rx={5} fill={BLUE} fillOpacity={0.2}
        stroke={BLUE} strokeWidth={3} />
    </svg>
  );
}

/* ============================================================
   M44 · complaints vs ledgers
   ============================================================ */

const GRIPES = ["taxes", "red tape", "transport", "skills"];
const COMPLAINTS: Record<"A" | "B", number[]> = {
  A: [68, 61, 55, 52],
  B: [66, 63, 57, 50],
};
const LEDGERS: Record<"A" | "B", number[]> = {
  A: [1.05, 1.1, 2.4, 1.1],
  B: [1.1, 1.05, 1.15, 2.9],
};

function MComplaints() {
  const [city, setCity] = useState<"A" | "B">("A");
  const [ledger, setLedger] = useState(false);
  const vals = useTweens(ledger ? LEDGERS[city].map((v) => v * 34) : COMPLAINTS[city], 500);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!ledger} onClick={() => setLedger(false)}>
          what firms say
        </button>
        <button className="btn" aria-pressed={ledger} onClick={() => setLedger(true)}>
          what firms pay
        </button>
        <span className="control-sep" />
        <button className="btn" aria-pressed={city === "A"} onClick={() => setCity("A")}>
          city A
        </button>
        <button className="btn" aria-pressed={city === "B"} onClick={() => setCity("B")}>
          city B
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 208" role="img"
          aria-label="Survey complaint bars look almost identical in both cities; switching to what firms actually pay reveals sharply different spikes — transport in one city, skills in the other.">
          {GRIPES.map((g, i) => {
            const v = vals[i];
            const spike = ledger && LEDGERS[city][i] > 2;
            return (
              <g key={g}>
                <text x={104} y={40 + i * 44} textAnchor="end" fontSize={10.5} fontWeight={600}
                  fill={INK3}>
                  {g}
                </text>
                <rect x={114} y={26 + i * 44} width={v * 3.4} height={22} rx={4}
                  fill={spike ? RED : BLUE} fillOpacity={spike ? 0.4 : 0.18}
                  stroke={spike ? RED : BLUE} strokeWidth={spike ? 1.8 : 1.2} />
                <text x={122 + v * 3.4} y={41 + i * 44} fontSize={10.5} fontWeight={700}
                  fill={spike ? RED : BLUE}>
                  {ledger ? `${LEDGERS[city][i].toFixed(2)}×` : `${Math.round(v)}%`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="widget-caption">
        {ledger
          ? "Now swap cities: the ledgers disagree loudly. City A's firms pay 2.4× to move goods; city B's bid 2.9× for scarce skills. That's the constraint talking."
          : "Swap cities: the bars barely move. Everyone complains about everything, everywhere — surveys measure grievance, and grievance is universal."}
      </p>
      <p className="data-note">
        The complaint is not the constraint. Ask what firms and households actually pay —
        prices, premiums, queues, workarounds — and two identical-sounding cities turn out to
        have opposite diagnoses.
      </p>
    </>
  );
}

function MComplaintsThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[210, 196, 202, 188].map((w, i) => (
        <rect key={i} x={60} y={36 + i * 40} width={w} height={26} rx={5} fill={BLUE}
          fillOpacity={0.18} stroke={BLUE} strokeWidth={2} />
      ))}
      <rect x={60} y={202} width={360} height={26} rx={5} fill={RED} fillOpacity={0.4}
        stroke={RED} strokeWidth={3} />
    </svg>
  );
}

/* ============================================================
   M45 · compared to what — the benchmark is an argument
   ============================================================ */

const PEER_SETS = [
  { key: "rust", label: "old industrial peers", peers: [2, 3, 4], verdict: "head of the class", tone: GREEN },
  { key: "nation", label: "the nation", peers: [9], verdict: "a step behind", tone: GOLD },
  { key: "sun", label: "sunbelt boomtowns", peers: [12, 14, 16], verdict: "left in the dust", tone: RED },
];

function MPeers() {
  const [k, setK] = useState("rust");
  const set = PEER_SETS.find((p) => p.key === k)!;
  const bars = [8, ...set.peers];
  const anim = useTweens(bars, 500);
  return (
    <>
      <div className="widget-controls">
        {PEER_SETS.map((p) => (
          <button key={p.key} className="btn" aria-pressed={k === p.key} onClick={() => setK(p.key)}>
            vs {p.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="The same city's eight percent growth compared against three different peer groups, flipping the verdict from star to laggard without a single number about the city changing.">
          <line x1={40} y1={190} x2={440} y2={190} stroke="#c9c2b2" strokeWidth={1.3} />
          {anim.map((v, i) => {
            const isCity = i === 0;
            const x = 80 + i * 90;
            return (
              <g key={i}>
                <rect x={x} y={190 - v * 9} width={64} height={v * 9} rx={4}
                  fill={isCity ? BLUE : "#b3ab9c"} fillOpacity={isCity ? 0.3 : 0.35}
                  stroke={isCity ? BLUE : "#8d867a"} strokeWidth={isCity ? 2 : 1.2} />
                <text x={x + 32} y={190 - v * 9 - 8} textAnchor="middle" fontSize={11.5}
                  fontWeight={700} fill={isCity ? BLUE : INK3}>
                  +{v.toFixed(0)}%
                </text>
                <text x={x + 32} y={208} textAnchor="middle" fontSize={9} fontWeight={600}
                  fill={INK3}>
                  {isCity ? "your city" : `peer ${i}`}
                </text>
              </g>
            );
          })}
          <text x={440} y={40} textAnchor="end" fontSize={12} fontWeight={700} fill={set.tone}>
            verdict: {set.verdict}
          </text>
        </svg>
      </div>
      <p className="widget-caption">
        Same city, same +8%, three verdicts. The comparison set is an argument, not a default —
        an honest profile names its peers and defends the choice before it grades anyone.
      </p>
      <p className="data-note">
        Good peer groups share what the city can't change (region, size, industrial
        inheritance) so the residual is what it can. The two-comparisons table in W1 is this
        card, formalized.
      </p>
    </>
  );
}

function MPeersThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={224} x2={444} y2={224} stroke="#c9c2b2" strokeWidth={2.5} />
      <rect x={70} y={94} width={70} height={130} rx={5} fill={BLUE} fillOpacity={0.3}
        stroke={BLUE} strokeWidth={3} />
      <rect x={180} y={170} width={70} height={54} rx={5} fill="#b3ab9c" fillOpacity={0.4}
        stroke="#8d867a" strokeWidth={2} />
      <rect x={290} y={60} width={70} height={164} rx={5} fill="#b3ab9c" fillOpacity={0.4}
        stroke="#8d867a" strokeWidth={2} />
      <text x={410} y={110} textAnchor="middle" fontSize={30} fill={GOLD}>?</text>
    </svg>
  );
}

/* ============================================================
   M46 · the billionaire moves in — mean vs median
   ============================================================ */

const INCOMES = [32, 35, 38, 40, 42, 44, 46, 48, 50, 53, 56, 60, 66, 74, 86];

function MMedian() {
  const [rich, setRich] = useState(false);
  const mean = rich ? 107.5 : 51.3;
  const median = rich ? 49 : 48;
  const [aMean, aMedian] = useTweens([mean, median], 600);
  const xOf = (v: number) => 46 + ((v - 20) / 80) * 388;
  const meanX = Math.min(xOf(100), xOf(aMean));
  return (
    <>
      <div className="widget-controls">
        <button className="btn gold" aria-pressed={rich} onClick={() => setRich(!rich)}>
          {rich ? "the billionaire leaves" : "a billionaire buys the penthouse"}
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 190" role="img"
          aria-label="Fifteen household incomes as dots on a line with mean and median markers. Adding one billionaire hurls the mean off the chart while the median barely moves.">
          <line x1={46} y1={120} x2={434} y2={120} stroke="#c9c2b2" strokeWidth={1.4} />
          <text x={46} y={142} className="fig-axis">20k</text>
          <text x={434} y={142} textAnchor="end" className="fig-axis">100k</text>
          {INCOMES.map((v, i) => (
            <circle key={i} cx={xOf(v)} cy={120 - 14 - (i % 3) * 13} r={5.5} fill={BLUE}
              opacity={0.7} />
          ))}
          {rich && (
            <g className="sk-pop">
              <path d="M420,54 H444 l-8,-7 M444,54 l-8,7" stroke={GOLD} strokeWidth={2.5}
                fill="none" />
              <text x={416} y={44} textAnchor="end" fontSize={9.5} fontWeight={700} fill="#785312">
                one income of 950k →
              </text>
            </g>
          )}
          <g style={{ transform: `translate(${meanX}px, 0)` }}>
            <line x1={0} y1={58} x2={0} y2={128} stroke={GOLD} strokeWidth={2.4} />
            <text x={0} y={165} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9a6712">
              mean {aMean >= 99 ? "→ off the chart" : Math.round(aMean) + "k"}
            </text>
          </g>
          <g style={{ transform: `translate(${xOf(aMedian)}px, 0)` }}>
            <line x1={0} y1={58} x2={0} y2={128} stroke={GREEN} strokeWidth={2.4}
              strokeDasharray="5 4" />
            <text x={0} y={52} textAnchor="middle" fontSize={10} fontWeight={700} fill={GREEN}>
              median {Math.round(aMedian)}k
            </text>
          </g>
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">mean income</div>
          <div className="value">{Math.round(aMean)}k</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">median income</div>
          <div className="value">{Math.round(aMedian)}k</div>
        </div>
      </div>
      <p className="widget-caption">
        {rich
          ? "One arrival doubled the 'average income' of a city where nobody got a raise. The median shrugged — it can't be dragged by a single tail."
          : "Fifteen ordinary households: mean and median agree within a few thousand. Now sell the penthouse."}
      </p>
      <p className="data-note">
        Skewed distributions — income, rent, firm size — are the rule in cities. Which average
        you quote decides which city you describe; profiles default to medians for exactly this
        reason.
      </p>
    </>
  );
}

function MMedianThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={170} x2={440} y2={170} stroke="#c9c2b2" strokeWidth={2.5} />
      {INCOMES.slice(0, 12).map((v, i) => (
        <circle key={i} cx={50 + ((v - 20) / 80) * 380} cy={150 - (i % 3) * 22} r={9}
          fill={BLUE} opacity={0.7} />
      ))}
      <line x1={190} y1={70} x2={190} y2={186} stroke={GREEN} strokeWidth={4} strokeDasharray="8 6" />
      <line x1={392} y1={70} x2={392} y2={186} stroke={GOLD} strokeWidth={4} />
    </svg>
  );
}

/* ============================================================
   M47 · the average that fell for good reasons
   ============================================================ */

function MPerHead() {
  const [n, setN] = useState(0);
  const total = (20000 + 80 * n) / 100;
  const avg = (20000 + 80 * n) / (200 + n);
  const [aTotal, aAvg] = useTweens([total, avg], 450);
  return (
    <>
      <div className="fig-slider">
        <span>newcomers arriving for work</span>
        <input type="range" min={0} max={100} step={5} value={n}
          onChange={(e) => setN(Number(e.target.value))} />
        <span className="readout">{n}k</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="Two bars moving apart as newcomers arrive: the city's total payroll rises while the average wage falls, because arrivals earn less than incumbents but more than they did before moving.">
          <line x1={40} y1={190} x2={440} y2={190} stroke="#c9c2b2" strokeWidth={1.3} />
          <g>
            <rect x={100} y={190 - (aTotal - 140) * 1.05} width={100}
              height={(aTotal - 140) * 1.05} rx={4} fill={GREEN} fillOpacity={0.2} stroke={GREEN}
              strokeWidth={1.6} />
            <text x={150} y={190 - (aTotal - 140) * 1.05 - 8} textAnchor="middle" fontSize={12}
              fontWeight={700} fill={GREEN}>
              {Math.round(aTotal)} {n > 0 ? "↑" : ""}
            </text>
            <text x={150} y={208} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={INK3}>
              total payroll
            </text>
          </g>
          <g>
            <rect x={280} y={190 - (aAvg - 40) * 1.9} width={100} height={(aAvg - 40) * 1.9}
              rx={4} fill={BLUE} fillOpacity={0.2} stroke={BLUE} strokeWidth={1.6} />
            <text x={330} y={190 - (aAvg - 40) * 1.9 - 8} textAnchor="middle" fontSize={12}
              fontWeight={700} fill={BLUE}>
              {aAvg.toFixed(1)} {n > 0 ? "↓" : ""}
            </text>
            <text x={330} y={208} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={INK3}>
              average wage
            </text>
          </g>
        </svg>
      </div>
      <p className="widget-caption">
        {n === 0
          ? "200k incumbents earning 100 on average. Now open the gates to workers who'll earn 80 here — up from 60 where they're coming from."
          : "The average fell because opportunity arrived: every newcomer got a 33% raise on the town they left, and no incumbent took a cut. Composition moved; nobody got poorer."}
      </p>
      <p className="data-note">
        A booming city can watch its average wage fall as it succeeds — and a dying one can
        watch it rise as the low-paid leave first. Averages follow composition; read them with
        the population card open (M1).
      </p>
    </>
  );
}

function MPerHeadThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={224} x2={444} y2={224} stroke="#c9c2b2" strokeWidth={2.5} />
      <rect x={92} y={64} width={110} height={160} rx={5} fill={GREEN} fillOpacity={0.2}
        stroke={GREEN} strokeWidth={3} />
      <text x={147} y={48} textAnchor="middle" fontSize={22} fontWeight={700} fill={GREEN}>↑</text>
      <rect x={280} y={126} width={110} height={98} rx={5} fill={BLUE} fillOpacity={0.2}
        stroke={BLUE} strokeWidth={3} />
      <text x={335} y={110} textAnchor="middle" fontSize={22} fontWeight={700} fill={BLUE}>↓</text>
    </svg>
  );
}

/* ============================================================
   M48 · catching up, pulling away — convergence eras
   ============================================================ */

const ERAS_CV = [
  { key: "conv", label: "the convergence century", rich: 140, poor: 120 },
  { key: "star", label: "the superstar era", rich: 190, poor: 80 },
];

function MDiverge() {
  const [k, setK] = useState("conv");
  const era = ERAS_CV.find((e) => e.key === k)!;
  const [richEnd, poorEnd] = useTweens([era.rich, era.poor], 600);
  const yOf = (v: number) => 200 - (v - 40) * 1.05;
  return (
    <>
      <div className="widget-controls">
        {ERAS_CV.map((e) => (
          <button key={e.key} className="btn" aria-pressed={k === e.key} onClick={() => setK(e.key)}>
            {e.label}
          </button>
        ))}
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="Income lines for a rich and a poor city over decades. In the convergence century the gap closes; in the superstar era the rich city pulls away and the gap widens.">
          {[60, 100, 140, 180].map((v) => (
            <line key={v} x1={46} y1={yOf(v)} x2={410} y2={yOf(v)} stroke={GRID} strokeWidth={1} />
          ))}
          <text x={46} y={222} className="fig-axis">then</text>
          <text x={410} y={222} textAnchor="end" className="fig-axis">decades later</text>
          <line x1={46} y1={yOf(100)} x2={410} y2={yOf(richEnd)} stroke={BLUE} strokeWidth={2.4}
            strokeLinecap="round" />
          <text x={52} y={yOf(100) - 8} fontSize={9.5} fontWeight={700} fill={BLUE}>
            the rich city
          </text>
          <line x1={46} y1={yOf(55)} x2={410} y2={yOf(poorEnd)} stroke={GOLD} strokeWidth={2.4}
            strokeLinecap="round" />
          <text x={52} y={yOf(55) + 16} fontSize={9.5} fontWeight={700} fill="#9a6712">
            the poor city
          </text>
          <line x1={432} y1={yOf(richEnd)} x2={432} y2={yOf(poorEnd)} stroke={RED}
            strokeWidth={1.6} />
          <line x1={426} y1={yOf(richEnd)} x2={432} y2={yOf(richEnd)} stroke={RED} strokeWidth={1.6} />
          <line x1={426} y1={yOf(poorEnd)} x2={432} y2={yOf(poorEnd)} stroke={RED} strokeWidth={1.6} />
          <text x={440} y={(yOf(richEnd) + yOf(poorEnd)) / 2 + 3} fontSize={9.5} fontWeight={700}
            fill={RED}>
            {Math.round(richEnd - poorEnd)}
          </text>
        </svg>
      </div>
      <p className="widget-caption">
        {k === "conv"
          ? "For a century, poor regions grew faster than rich ones — capital sought cheap labor, and the gap closed on its own. Policy could ride the current."
          : "Then the current turned: skills, software and superstar firms compound where they already are. The gap widens by default now — and a lagging city can no longer just wait."}
      </p>
      <p className="data-note">
        US regional incomes converged from roughly 1880 to 1980, then the engine stalled.
        Which era your country is in decides what a gap means — and how hard the tree's
        branches have to work.
      </p>
    </>
  );
}

function MDivergeThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[70, 130, 190].map((y) => (
        <line key={y} x1={44} y1={y} x2={436} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <line x1={44} y1={110} x2={436} y2={44} stroke={BLUE} strokeWidth={5} strokeLinecap="round" />
      <line x1={44} y1={190} x2={436} y2={232} stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}

/* ============================================================
   M49 · eleven green lights — the dashboard trap
   ============================================================ */

const LIGHTS = [
  "transit", "schools", "parks", "safety", "power", "water",
  "broadband", "permits", "housing", "health", "port", "courts",
];

function MGreenLights() {
  const [binding, setBinding] = useState(false);
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!binding} onClick={() => setBinding(false)}>
          read the average
        </button>
        <button className="btn" aria-pressed={binding} onClick={() => setBinding(true)}>
          read the binding
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 216" role="img"
          aria-label="A dashboard of twelve indicators, eleven green and one red. Averaged, the city scores ninety-two and looks healthy; read for the binding constraint, the single red light caps everything.">
          <text x={240} y={34} textAnchor="middle" fontSize={14} fontWeight={700}
            fill={binding ? RED : GREEN} fontFamily="Georgia, serif">
            {binding ? "housing caps everything — the 92 means nothing" : "city health score: 92 / 100 — all clear"}
          </text>
          {LIGHTS.map((l, i) => {
            const isRed = l === "housing";
            const x = 52 + (i % 6) * 66;
            const y = 62 + Math.floor(i / 6) * 66;
            const dim = binding && !isRed;
            return (
              <g key={l} opacity={dim ? 0.3 : 1} style={{ transition: "opacity 0.35s" }}>
                <circle cx={x + 22} cy={y + 14} r={binding && isRed ? 20 : 13}
                  fill={isRed ? RED : GREEN} fillOpacity={0.22}
                  stroke={isRed ? RED : GREEN} strokeWidth={binding && isRed ? 2.6 : 1.4}
                  style={{ transition: "all 0.35s" }} />
                <circle cx={x + 22} cy={y + 14} r={5} fill={isRed ? RED : GREEN} />
                <text x={x + 22} y={y + 46} textAnchor="middle" fontSize={8.5} fontWeight={600}
                  fill={INK3}>
                  {l}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="widget-caption">
        {binding
          ? "Eleven strengths and one binding constraint — and growth answers only to the constraint. The dashboard's average is the barrel's most seductive lie."
          : "Eleven of twelve lights are green; the composite score beams. Would you like to see the same dashboard read the way the barrel reads it?"}
      </p>
      <p className="data-note">
        Composite indices average away the only number that matters. The barrel (W7, F7) is the
        antidote: growth equals the shortest stave, not the mean of the staves.
      </p>
    </>
  );
}

function MGreenLightsThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const isRed = i === 8;
        const x = 70 + (i % 4) * 96;
        const y = 56 + Math.floor(i / 4) * 76;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={isRed ? 30 : 20} fill={isRed ? RED : GREEN}
              fillOpacity={0.22} stroke={isRed ? RED : GREEN} strokeWidth={isRed ? 4 : 2.5} />
            <circle cx={x} cy={y} r={8} fill={isRed ? RED : GREEN} />
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   M50 · the kink — why diagnosis pays
   ============================================================ */

function MKink() {
  const [e, setE] = useState(20);
  const growth = (x: number) => (x < 55 ? 0.4 : 3.2 + (x - 55) * 0.02);
  const g = growth(e);
  const xOf = (x: number) => 46 + (x / 100) * 388;
  const yOf = (v: number) => 190 - v * 42;
  return (
    <>
      <div className="fig-slider">
        <span>reform effort at the constraint</span>
        <input type="range" min={0} max={100} step={1} value={e}
          onChange={(e2) => setE(Number(e2.target.value))} />
        <span className="readout">{e}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 226" role="img"
          aria-label="Growth response to reform effort: flat and discouraging until the constraint releases at fifty-five, then a sharp jump. A grey line shows effort spent elsewhere staying flat forever.">
          <line x1={46} y1={190} x2={434} y2={190} stroke="#c9c2b2" strokeWidth={1.3} />
          <text x={434} y={214} textAnchor="end" className="fig-axis">effort →</text>
          <line x1={xOf(0)} y1={yOf(0.4)} x2={xOf(100)} y2={yOf(0.4)} stroke={INK4}
            strokeWidth={1.4} strokeDasharray="3 5" />
          <text x={xOf(98)} y={yOf(0.4) + 15} textAnchor="end" fontSize={9} fill={INK4}>
            effort anywhere else, forever
          </text>
          <path
            d={`M${xOf(0)},${yOf(0.4)} L${xOf(55)},${yOf(0.4)} L${xOf(55)},${yOf(3.2)} L${xOf(100)},${yOf(growth(100))}`}
            fill="none" stroke={BLUE} strokeWidth={2.6} strokeLinecap="round" />
          <line x1={xOf(55)} y1={yOf(3.2)} x2={xOf(55)} y2={190} stroke={GOLD} strokeWidth={1}
            strokeDasharray="4 4" />
          <text x={xOf(55)} y={yOf(3.2) - 10} textAnchor="middle" fontSize={9.5} fontWeight={700}
            fill="#785312">
            the constraint releases
          </text>
          <circle cx={xOf(e)} cy={yOf(g)} r={7} fill={e >= 55 ? GREEN : "#221e19"}
            style={{ transition: "fill 0.3s" }} />
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">growth response</div>
          <div className="value">{g.toFixed(1)}%</div>
        </div>
      </div>
      <p className="widget-caption">
        {e < 55
          ? "Pushing, and nothing visible moves — until the stave clears the water, effort at the right target looks exactly like effort at the wrong one. This flat stretch is where reformers lose heart."
          : "The snap: past the release point, the same effort buys real growth. Diagnosis exists to find where this kink lives — and to keep you pushing through the flat part that guards it."}
      </p>
      <p className="data-note">
        The pocket textbook's last word, and the framework's first: returns to reform are
        kinked at the binding constraint (W7, F7). Everywhere else, the grey line is all there
        is.
      </p>
    </>
  );
}

function MKinkThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={36} y1={224} x2={444} y2={224} stroke="#c9c2b2" strokeWidth={2.5} />
      <line x1={44} y1={196} x2={436} y2={196} stroke={INK4} strokeWidth={3} strokeDasharray="5 8" />
      <path d="M44,196 L250,196 L250,80 L436,60" fill="none" stroke={BLUE} strokeWidth={6}
        strokeLinecap="round" />
      <circle cx={318} cy={73} r={11} fill={GREEN} />
    </svg>
  );
}

/* ============================================================
   the entries
   ============================================================ */

export const MICRO_E: Concept[] = [
  {
    id: "m-scream",
    num: "M41",
    eyebrow: "Diagnostic tests",
    title: "The loudest price",
    teaser: "Binding things are expensive. Click the scream.",
    lede: "Three inputs, three price tags against the national level. One of them is the city's binding constraint, and the prices have already confessed — click your suspect and check your instincts.",
    tag: "the shadow-price test that opens the paper's toolkit — S4's generators and S5's queues are this card in costume.",
    thumb: <MScreamThumb />,
    paperThumb: true,
    body: () => <MScream />,
  },
  {
    id: "m-confounder",
    num: "M42",
    eyebrow: "Evidence",
    title: "The third thing",
    teaser: "Buses correlate with jobs. Should you buy buses?",
    lede: "A beautiful scatter: more bus service, more jobs. Hold neighborhood size constant and watch the line go flat — the third thing was driving both axes. The oldest trap in city data, sprung in one click.",
    tag: "every cross-city scatter you'll ever be shown — and why the paper's tests difference confounders away.",
    thumb: <MConfounderThumb />,
    paperThumb: true,
    body: () => <MConfounder />,
  },
  {
    id: "m-movers",
    num: "M43",
    eyebrow: "Evidence",
    title: "The movers' mirage",
    teaser: "Movers earn +32%. The city gave them +11.",
    lede: "People who move to the big city out-earn the ones back home by a mile. Follow the same people to before their move and watch most of the gap turn out to have packed its own bags.",
    tag: "selection bias in every migration and program comparison — the reason M5's best studies track movers.",
    thumb: <MMoversThumb />,
    paperThumb: true,
    body: () => <MMovers />,
  },
  {
    id: "m-complaints",
    num: "M44",
    eyebrow: "Diagnostic tests",
    title: "Complaints vs ledgers",
    teaser: "Surveys measure grievance; prices measure truth.",
    lede: "Two cities file nearly identical complaints — taxes, red tape, transport, skills. Their ledgers disagree completely. Toggle between what firms say and what they pay, then swap cities.",
    tag: "why the paper's four tests read behavior, not opinion — the complaint is not the constraint.",
    thumb: <MComplaintsThumb />,
    paperThumb: true,
    body: () => <MComplaints />,
  },
  {
    id: "m-peers",
    num: "M45",
    eyebrow: "Method",
    title: "Compared to what",
    teaser: "Three peer groups, three verdicts, one city.",
    lede: "Your city grew 8%. Against its old industrial peers it's the head of the class; against sunbelt boomtowns, left in the dust. Nothing about the city changes — only the argument called a benchmark.",
    tag: "the peer-selection step at the top of every profile, done in the open instead of by default.",
    thumb: <MPeersThumb />,
    paperThumb: true,
    body: () => <MPeers />,
  },
  {
    id: "m-median",
    num: "M46",
    eyebrow: "Evidence",
    title: "The billionaire moves in",
    teaser: "One arrival doubles the mean. The median shrugs.",
    lede: "Fifteen ordinary incomes, two markers. Sell the penthouse to a billionaire and the 'average income' doubles in a city where nobody got a raise. Which average you quote decides which city you see.",
    tag: "every income, rent and firm-size figure in a profile — and why the medians are the ones to trust.",
    thumb: <MMedianThumb />,
    paperThumb: true,
    body: () => <MMedian />,
  },
  {
    id: "m-perhead",
    num: "M47",
    eyebrow: "Evidence",
    title: "The average that fell",
    teaser: "Everyone got a raise; the mean went down.",
    lede: "Open the gates to workers who earn 80 here — up from 60 where they came from. Total payroll climbs, the average wage falls, and not one person got poorer. Composition is not decline.",
    tag: "reading wage trends next to population trends — the two cards the pizza chart insists on pairing.",
    thumb: <MPerHeadThumb />,
    paperThumb: true,
    body: () => <MPerHead />,
  },
  {
    id: "m-diverge",
    num: "M48",
    eyebrow: "Systems of cities",
    title: "Catching up, pulling away",
    teaser: "The century the gap closed — and the era it won't.",
    lede: "For a hundred years, poor regions grew faster than rich ones and the gap closed by itself. Then skills and superstar firms started compounding in place. Toggle the era and see what a gap now means.",
    tag: "the macro backdrop of every lagging-city diagnosis: waiting stopped being a strategy around 1980.",
    thumb: <MDivergeThumb />,
    paperThumb: true,
    body: () => <MDiverge />,
  },
  {
    id: "m-greenlights",
    num: "M49",
    eyebrow: "Method",
    title: "Eleven green lights",
    teaser: "Score 92/100 — and none of it matters.",
    lede: "A dashboard with eleven green lights and one red. The composite score says healthy; the barrel says the red one caps everything. Toggle between the two readings of the same city.",
    tag: "every composite city index you'll ever be handed — versus the barrel's way of reading the same facts.",
    thumb: <MGreenLightsThumb />,
    paperThumb: true,
    body: () => <MGreenLights />,
  },
  {
    id: "m-kink",
    num: "M50",
    eyebrow: "Method",
    title: "The kink",
    teaser: "Reform pays nothing — until, suddenly, everything.",
    lede: "Effort at the binding constraint looks exactly like wasted effort, right up until the constraint releases and the response snaps upward. The last page of the pocket textbook is the reason the whole shelf exists.",
    tag: "the payoff geometry of the entire framework — find the kink, then survive the flat part that guards it.",
    thumb: <MKinkThumb />,
    paperThumb: true,
    body: () => <MKink />,
  },
];
