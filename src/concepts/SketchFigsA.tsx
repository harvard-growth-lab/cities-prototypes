/**
 * The sketchbook, part A (S1–S10) — quick experimental prototypes of the
 * diagnostics framework's tests and metaphors, each tried as a different
 * kind of interactive: a micro tree-walk, an elimination board, a
 * survivorship scatter (camels & hippos), a generator count (bypassing),
 * a permit queue (shadow prices), a diff-in-diff chart, a guided tour of
 * the eight slices, a multiplier cascade, Scrabble tiles (the adjacent
 * possible), and a product-space hop. Deliberately rougher than the
 * textbook figures — these are sketches.
 */

import { useState } from "react";
import {
  FIG27_NODES,
  FIG31_SCENARIOS,
  wedgePolygon,
  type TreeNodeData,
} from "../learning/content/figures";
import type { Concept } from "./ConceptsPage";
import { useTweens } from "./TextbookFigs";

const INK3 = "#4f4a42";
const INK4 = "#9a9389";
const GRID = "#e7e1d3";
const BLUE = "#1a5a8e";
const GOLD = "#b07d1e";
const RED = "#cc4948";

const firstSentence = (s: string) => {
  const i = s.indexOf(". ");
  return i > 0 ? s.slice(0, i + 1) : s;
};

/** deterministic pseudo-random in [0,1) from a seed string */
function rnd(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) % 4096;
  return h / 4096;
}

/* ============================================================
   S1 · the tree in ten seconds — a micro walk of Figure 27
   ============================================================ */

const T_POS: Record<string, [number, number]> = {
  root: [0.5, 0], demand: [0.27, 1], supply: [0.76, 1],
  newact: [0.12, 2], existing: [0.35, 2], col: [0.63, 2], amen: [0.88, 2],
  coord: [0.11, 3], external: [0.27, 3], inputs: [0.445, 3],
  housing: [0.615, 3], transport: [0.78, 3],
  horizontal: [0.36, 4], vertical: [0.53, 4],
};
const DEMAND_IDS = new Set(["demand", "newact", "existing", "coord", "external", "inputs", "horizontal", "vertical"]);
const tKids = (id: string) => FIG27_NODES.filter((n) => n.parent === id);
const tNode = (id: string): TreeNodeData => FIG27_NODES.find((n) => n.id === id)!;
const tPt = (id: string): [number, number] => {
  const [fx, row] = T_POS[id];
  return [24 + fx * 432, 22 + row * 47];
};

function SkTree() {
  const [path, setPath] = useState<string[]>(["root"]);
  const current = path[path.length - 1];
  const kids = tKids(current);
  const done = kids.length === 0;
  const active = tNode(current);
  const onPath = (id: string) => path.includes(id);
  const isKid = (id: string) => kids.some((k) => k.id === id);
  const sideColor = (id: string) => (id === "root" ? "#221e19" : DEMAND_IDS.has(id) ? BLUE : GOLD);

  return (
    <>
      <div className="fig-frame">
        <svg viewBox="0 0 480 232" role="img"
          aria-label="A miniature of the Figure 27 decision tree. At each fork, click one of the highlighted branches to walk down; reaching a leaf names a candidate constraint.">
          {FIG27_NODES.filter((n) => n.parent).map((n) => {
            const [x0, y0] = tPt(n.parent!);
            const [x1, y1] = tPt(n.id);
            const lit = onPath(n.id) && onPath(n.parent!);
            return (
              <path key={n.id} d={`M${x0},${y0 + 5} C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1 - 5}`}
                fill="none" stroke={lit ? sideColor(n.id) : "#ddd7c9"} strokeWidth={lit ? 2.2 : 1}
                style={{ transition: "stroke 0.2s" }} />
            );
          })}
          {FIG27_NODES.map((n) => {
            const [x, y] = tPt(n.id);
            const lit = onPath(n.id);
            const kid = isKid(n.id);
            const showLabel = lit || kid;
            return (
              <g key={n.id} onClick={kid ? () => setPath([...path, n.id]) : undefined}
                style={{ cursor: kid ? "pointer" : "default" }}>
                {kid && (
                  <circle cx={x} cy={y} r={9} fill="none" stroke={sideColor(n.id)}
                    strokeWidth={1.3} strokeDasharray="3 3" />
                )}
                <circle cx={x} cy={y} r={lit ? 5 : 3.6}
                  fill={lit ? sideColor(n.id) : kid ? "#fff" : "#d5cebf"}
                  stroke={kid ? sideColor(n.id) : "none"} strokeWidth={1.4}
                  style={{ transition: "fill 0.2s" }} />
                {showLabel && (
                  <text x={x} y={y + 19} textAnchor="middle" fontSize={8.5}
                    fontWeight={lit ? 700 : 500} fill={lit ? sideColor(n.id) : INK3}
                    style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>
                    {n.title.length > 22 ? n.title.slice(0, 20) + "…" : n.title}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="widget-caption">
        <b>{active.title}.</b> {firstSentence(active.detail)}{" "}
        {done && <em>A leaf — this is a candidate binding constraint.</em>}
      </p>
      {path.length > 1 && (
        <div className="widget-controls">
          <button className="btn" onClick={() => setPath(path.slice(0, -1))}>← back up</button>
          <button className="btn" onClick={() => setPath(["root"])}>restart</button>
        </div>
      )}
    </>
  );
}

function SkTreeThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {FIG27_NODES.filter((n) => n.parent).map((n) => {
        const [x0, y0] = tPt(n.parent!);
        const [x1, y1] = tPt(n.id);
        const lit = ["supply", "amen"].includes(n.id);
        return (
          <path key={n.id}
            d={`M${x0},${y0 * 1.1 + 12} C${x0},${((y0 + y1) / 2) * 1.1 + 12} ${x1},${((y0 + y1) / 2) * 1.1 + 12} ${x1},${y1 * 1.1 + 4}`}
            fill="none" stroke={lit ? GOLD : "#ddd7c9"} strokeWidth={lit ? 4 : 2} />
        );
      })}
      {FIG27_NODES.map((n) => {
        const [x, y] = tPt(n.id);
        const lit = ["root", "supply", "amen"].includes(n.id);
        return <circle key={n.id} cx={x} cy={y * 1.1 + 8} r={lit ? 8 : 5}
          fill={lit ? GOLD : "#d5cebf"} />;
      })}
    </svg>
  );
}

/* ============================================================
   S2 · rule it out — the elimination board
   ============================================================ */

const SUSPECTS = [
  { id: "housing", name: "Housing", ev: "home values lag the nation and the cranes are busy" },
  { id: "transport", name: "Transportation", ev: "38% of jobs within 30 minutes — middling, but stable" },
  { id: "coord", name: "Coordination", ev: "new firms keep entering; nobody is frozen at the door" },
  { id: "amen", name: "Amenities", ev: "pay rising, people leaving — the be-here premium is draining" },
];

function SkRuleOut() {
  const [struck, setStruck] = useState<string[]>([]);
  const standing = SUSPECTS.filter((s) => !struck.includes(s.id));
  return (
    <>
      <div className="sk-cards">
        {SUSPECTS.map((s) => {
          const out = struck.includes(s.id);
          return (
            <button key={s.id} className={`sk-card${out ? " is-out" : ""}`}
              onClick={() => setStruck(out ? struck.filter((x) => x !== s.id) : [...struck, s.id])}>
              <span className="sk-card-name">{s.name}</span>
              <span className="sk-card-ev">{s.ev}</span>
              <span className="sk-card-verdict">{out ? "ruled out" : "still a suspect"}</span>
            </button>
          );
        })}
      </div>
      {standing.length === 1 ? (
        <p className="widget-caption">
          <b style={{ color: "#9a6712" }}>One suspect standing: {standing[0].name}.</b>{" "}
          {standing[0].id === "amen"
            ? "That's the walk the Boston evidence takes — progressing down a branch means ruling out the alternatives, and you just did."
            : "The paper's Boston walk ends at amenities — check the evidence line on your survivor before you commit."}
        </p>
      ) : (
        <p className="widget-caption">
          A diagnosis is an elimination: strike the suspects the evidence clears until one is left
          standing. {struck.length === 0 ? "Start with the line that sounds least binding." : `${standing.length} still standing.`}
        </p>
      )}
    </>
  );
}

function SkRuleOutThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[0, 1, 2, 3].map((i) => {
        const x = 44 + (i % 2) * 208;
        const y = 48 + Math.floor(i / 2) * 96;
        const out = i !== 3;
        return (
          <g key={i}>
            <rect x={x} y={y} width={184} height={72} rx={8} fill="#fdfcf8"
              stroke={out ? "#d8d2c4" : GOLD} strokeWidth={out ? 2 : 3} />
            <rect x={x + 16} y={y + 20} width={100} height={9} rx={4} fill={out ? "#d8d2c4" : "#b07d1e"} />
            <rect x={x + 16} y={y + 40} width={140} height={7} rx={3} fill="#e7e1d3" />
            {out && <line x1={x + 10} y1={y + 36} x2={x + 174} y2={y + 36} stroke={RED} strokeWidth={3} opacity={0.6} />}
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   S3 · camels & hippos — read the survivors
   ============================================================ */

const FIRMS = Array.from({ length: 14 }, (_, i) => ({
  use: 0.06 + (i / 13) * 0.88,
  y: 0.2 + rnd("firm" + i) * 0.6,
}));

function SkCamels() {
  const [scarcity, setScarcity] = useState(0);
  const alive = (use: number) => use < 1 - 0.82 * scarcity;
  const survivors = FIRMS.filter((f) => alive(f.use)).length;
  return (
    <>
      <div className="fig-slider">
        <span>water gets scarce</span>
        <input type="range" min={0} max={1} step={0.05} value={scarcity}
          onChange={(e) => setScarcity(Number(e.target.value))} />
        <span className="readout">{Math.round(scarcity * 100)}%</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 220" role="img"
          aria-label="Firms scattered by how much of the scarce input they use. As scarcity rises, the heavy users disappear — the survivors are the ones that barely drink.">
          <line x1={40} y1={186} x2={440} y2={186} stroke="#c9c2b2" strokeWidth={1.3} />
          <text x={40} y={206} className="fig-axis">camels · barely drink</text>
          <text x={440} y={206} textAnchor="end" className="fig-axis">hippos · heavy users</text>
          <text x={240} y={206} textAnchor="middle" className="fig-axis">input use →</text>
          {FIRMS.map((f, i) => {
            const x = 48 + f.use * 384;
            const y = 30 + f.y * 140;
            const ok = alive(f.use);
            return (
              <g key={i} style={{ transition: "opacity 0.4s" }} opacity={ok ? 1 : 0.18}>
                <circle cx={x} cy={y} r={7} fill={ok ? BLUE : "#8d867a"} opacity={0.85} />
                {!ok && (
                  <>
                    <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} stroke={RED} strokeWidth={2} />
                    <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} stroke={RED} strokeWidth={2} />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="widget-caption">
        {scarcity < 0.2
          ? "Water is cheap, so camels and hippos both thrive — the mix of firms tells you nothing yet."
          : scarcity < 0.7
            ? `The hippos are going first. ${survivors} of 14 firms left — and the exits are all heavy users.`
            : "Only camels remain. That's the test read backwards: when everyone still standing barely uses an input, that input is what's binding."}
      </p>
      <p className="data-note">
        The paper's “camels and hippos”: you rarely observe the scarce input directly, but you can
        observe who survives. A city of camels is a desert — whatever they're not drinking is the
        constraint.
      </p>
    </>
  );
}

function SkCamelsThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <line x1={40} y1={220} x2={440} y2={220} stroke="#c9c2b2" strokeWidth={2.5} />
      {FIRMS.slice(0, 12).map((f, i) => {
        const x = 56 + f.use * 370;
        const y = 50 + f.y * 140;
        const ok = f.use < 0.5;
        return (
          <g key={i} opacity={ok ? 1 : 0.25}>
            <circle cx={x} cy={y} r={11} fill={ok ? BLUE : "#8d867a"} />
            {!ok && (
              <>
                <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={RED} strokeWidth={3.5} />
                <line x1={x - 8} y1={y + 8} x2={x + 8} y2={y - 8} stroke={RED} strokeWidth={3.5} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   S4 · the generator count — bypassing as a price signal
   ============================================================ */

const GEN_ORDER = Array.from({ length: 12 }, (_, i) => i).sort(
  (a, b) => rnd("gen" + a) - rnd("gen" + b),
);

function SkBypass() {
  const [outage, setOutage] = useState(6);
  const nGen = Math.round((outage / 40) * 12);
  const hasGen = (i: number) => GEN_ORDER.indexOf(i) < nGen;
  return (
    <>
      <div className="fig-slider">
        <span>grid outages</span>
        <input type="range" min={0} max={40} step={2} value={outage}
          onChange={(e) => setOutage(Number(e.target.value))} />
        <span className="readout">{outage}h/wk</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 190" role="img"
          aria-label="A courtyard of twelve buildings. As grid outages rise, private generators appear beside them — the visible price of the missing input.">
          {Array.from({ length: 12 }, (_, i) => {
            const x = 34 + (i % 6) * 72;
            const y = 30 + Math.floor(i / 6) * 80;
            const g = hasGen(i);
            return (
              <g key={i}>
                <rect x={x} y={y} width={42} height={48} rx={3} fill="#efe9db" stroke="#c9c2b2" />
                {[0, 1].map((r) =>
                  [0, 1].map((c) => (
                    <rect key={`${r}${c}`} x={x + 8 + c * 16} y={y + 8 + r * 16} width={10}
                      height={10} fill={g || outage < 20 ? "#e9c46a" : "#d8d2c4"} opacity={0.8} />
                  )),
                )}
                <g opacity={g ? 1 : 0} style={{ transition: "opacity 0.35s" }}>
                  <rect x={x + 46} y={y + 30} width={20} height={18} rx={2} fill="#5c564a" />
                  <text x={x + 56} y={y + 43} textAnchor="middle" fontSize={11} fill="#ffd76a">
                    ⚡
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">generators in the courtyard</div>
          <div className="value">{nGen} <span style={{ fontSize: 15 }}>of 12</span></div>
        </div>
      </div>
      <p className="widget-caption">
        {nGen === 0
          ? "Reliable grid, empty courtyards — nobody pays twice for power they already have."
          : nGen < 7
            ? "Firms are starting to buy their own power plant. Every generator is a receipt for the true price of electricity here."
            : "A generator behind every wall: the city runs on bypassed infrastructure. You didn't need a utility audit — the courtyard already published the shadow price."}
      </p>
    </>
  );
}

function SkBypassThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => {
        const x = 42 + (i % 3) * 140;
        const y = 44 + Math.floor(i / 3) * 110;
        return (
          <g key={i}>
            <rect x={x} y={y} width={76} height={78} rx={5} fill="#efe9db" stroke="#c9c2b2" strokeWidth={2} />
            {i % 2 === 0 && (
              <>
                <rect x={x + 82} y={y + 48} width={34} height={30} rx={3} fill="#5c564a" />
                <text x={x + 99} y={y + 70} textAnchor="middle" fontSize={18} fill="#ffd76a">⚡</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   S5 · the queue — waiting time is a price
   ============================================================ */

function SkQueue() {
  const [rate, setRate] = useState(6);
  const waiting = Math.max(0, 24 - rate);
  const waitWeeks = waiting ? (waiting / rate).toFixed(1) : "0";
  return (
    <>
      <div className="fig-slider">
        <span>permits processed weekly</span>
        <input type="range" min={2} max={24} step={1} value={rate}
          onChange={(e) => setRate(Number(e.target.value))} />
        <span className="readout">{rate}</span>
      </div>
      <div className="fig-frame">
        <svg viewBox="0 0 480 150" role="img"
          aria-label="A queue of applicants snaking toward a permit window. The slower the window, the longer the line — waiting time is the unposted price.">
          <rect x={396} y={38} width={64} height={74} rx={6} fill="#efe9db" stroke="#c9c2b2" />
          <rect x={410} y={54} width={36} height={26} rx={3} fill="#fff" stroke="#c9c2b2" />
          <text x={428} y={128} textAnchor="middle" className="fig-axis">permits</text>
          <line x1={40} y1={92} x2={388} y2={92} stroke={GRID} strokeWidth={1}
            strokeDasharray="3 6" />
          {Array.from({ length: waiting }, (_, i) => {
            const x = 372 - i * 15.5;
            return (
              <g key={i} style={{ transition: "transform 0.5s" }}>
                <circle cx={x} cy={84} r={6} fill={i < 4 ? GOLD : "#b3ab9c"} opacity={0.9} />
                <rect x={x - 4} y={92} width={8} height={14} rx={3}
                  fill={i < 4 ? GOLD : "#b3ab9c"} opacity={0.7} />
              </g>
            );
          })}
          {waiting === 0 && (
            <text x={220} y={88} textAnchor="middle" fontSize={11} fill={INK4}>
              no line — walk right up
            </text>
          )}
        </svg>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">firms in line</div>
          <div className="value">{waiting}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">wait to build</div>
          <div className="value">{waitWeeks} <span style={{ fontSize: 15 }}>wks</span></div>
        </div>
      </div>
      <p className="widget-caption">
        The permit is “free” — the queue is not. Scarce things that aren't rationed by price get
        rationed by waiting, and the length of the line is the shadow price of the missing
        institution.
      </p>
    </>
  );
}

function SkQueueThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      <rect x={368} y={70} width={84} height={110} rx={8} fill="#efe9db" stroke="#c9c2b2" strokeWidth={2} />
      <rect x={388} y={94} width={44} height={34} rx={4} fill="#fff" stroke="#c9c2b2" strokeWidth={2} />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <circle cx={330 - i * 32} cy={140} r={10} fill={i < 3 ? GOLD : "#b3ab9c"} />
          <rect x={322 - i * 32} y={152} width={16} height={26} rx={5} fill={i < 3 ? GOLD : "#b3ab9c"} opacity={0.7} />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================
   S6 · changes-in-changes — the shock, differenced
   ============================================================ */

function SkCiC() {
  const [shock, setShock] = useState(true);
  const [drop] = useTweens([shock ? 26 : 0], 600);
  const W = 480, x0 = 46, x1 = 434, yBase = 150, slope = 42;
  const xAt = (t: number) => x0 + (t / 10) * (x1 - x0);
  const cityEnd = yBase - slope + drop;
  return (
    <>
      <div className="widget-controls">
        <button className="btn" aria-pressed={!shock} onClick={() => setShock(false)}>
          No shock
        </button>
        <button className="btn" aria-pressed={shock} onClick={() => setShock(true)}>
          The shock hits
        </button>
      </div>
      <div className="fig-frame">
        <svg viewBox={`0 0 ${W} 216`} role="img"
          aria-label="Two employment lines move in parallel until year five; if the shock hits, the city's line breaks downward and the gap to its twin is the measured effect.">
          {[190, 150, 110, 70].map((y) => (
            <line key={y} x1={x0} y1={y} x2={x1} y2={y} stroke={GRID} strokeWidth={1} />
          ))}
          <line x1={xAt(5)} y1={30} x2={xAt(5)} y2={196} stroke={RED} strokeWidth={1}
            strokeDasharray="4 5" opacity={shock ? 0.8 : 0.25} style={{ transition: "opacity 0.3s" }} />
          <text x={xAt(5)} y={22} textAnchor="middle" fontSize={9.5} fontWeight={700}
            fill={shock ? RED : INK4} style={{ transition: "fill 0.3s" }}>
            year 5 · the plant closes
          </text>
          {/* twin city */}
          <path d={`M${x0},${yBase + 22} L${x1},${yBase + 22 - slope}`} fill="none"
            stroke="#b3ab9c" strokeWidth={2} />
          <text x={x1 + 2} y={yBase + 22 - slope + 3} fontSize={9.5} fill="#8d867a">twin city</text>
          {/* the city */}
          <path
            d={`M${x0},${yBase} L${xAt(5)},${yBase - slope / 2} L${x1},${cityEnd}`}
            fill="none" stroke={BLUE} strokeWidth={2.6} />
          <text x={x1 + 2} y={cityEnd + 3} fontSize={9.5} fontWeight={700} fill={BLUE}>
            the city
          </text>
          {/* the effect bracket */}
          <g opacity={drop > 2 ? 1 : 0} style={{ transition: "opacity 0.3s" }}>
            <line x1={x1 + 40} y1={yBase - slope - 22} x2={x1 + 40} y2={cityEnd} stroke={RED}
              strokeWidth={1.4} />
            <line x1={x1 + 35} y1={yBase - slope - 22} x2={x1 + 40} y2={yBase - slope - 22}
              stroke={RED} strokeWidth={1.4} />
            <line x1={x1 + 35} y1={cityEnd} x2={x1 + 40} y2={cityEnd} stroke={RED} strokeWidth={1.4} />
          </g>
          <text x={240} y={208} textAnchor="middle" className="fig-axis">
            employment, indexed · years 0–10
          </text>
        </svg>
      </div>
      <p className="widget-caption">
        {shock
          ? "The twin keeps the shared trend; the city breaks from it at year five. The difference between the two differences is the shock's measured bite — that's changes-in-changes."
          : "Before anything happens, the city and its twin move in parallel — that parallel is what makes the comparison honest when the shock arrives."}
      </p>
      <p className="data-note">
        The paper's test for external shocks: don't ask “did the city fall?” — ask “did it fall
        relative to places that ate the same national weather?”
      </p>
    </>
  );
}

function SkCiCThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[70, 130, 190].map((y) => (
        <line key={y} x1={44} y1={y} x2={436} y2={y} stroke={GRID} strokeWidth={1.6} />
      ))}
      <line x1={240} y1={40} x2={240} y2={230} stroke={RED} strokeWidth={2} strokeDasharray="7 7" />
      <path d="M44,186 L436,130" fill="none" stroke="#b3ab9c" strokeWidth={4} />
      <path d="M44,166 L240,138 L436,196" fill="none" stroke={BLUE} strokeWidth={5} />
    </svg>
  );
}

/* ============================================================
   S7 · a tour of the eight slices — flash cards for Figure 31
   ============================================================ */

const TOUR_SIZE = 264;
const trX = (v: number) => 22 + ((v + 10) / 20) * (TOUR_SIZE - 44);
const trY = (v: number) => TOUR_SIZE - 22 - ((v + 10) / 20) * (TOUR_SIZE - 44);
const CENTROIDS: Record<string, [number, number]> = Object.fromEntries(
  FIG31_SCENARIOS.map((s) => {
    const poly = wedgePolygon(s.id, [-10, 10], [-10, 10]);
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    return [s.id, [cx * 0.82, cy * 0.82]];
  }),
);

function SkTour() {
  const [i, setI] = useState(0);
  const s = FIG31_SCENARIOS[i];
  const [cx, cy] = CENTROIDS[s.id];
  const [dx, dy] = useTweens([cx, cy], 450);
  return (
    <div className="fig-pizza-row">
      <div className="fig-frame fig-pizza-fig" style={{ flexBasis: 240 }}>
        <svg viewBox={`0 0 ${TOUR_SIZE} ${TOUR_SIZE}`} role="img"
          aria-label={`The eight-slice plane with the marker on slice ${s.id}: ${s.title}.`}>
          {FIG31_SCENARIOS.map((w) => {
            const poly = wedgePolygon(w.id, [-10, 10], [-10, 10]);
            return (
              <polygon key={w.id} points={poly.map(([x, y]) => `${trX(x)},${trY(y)}`).join(" ")}
                fill={w.color} opacity={w.id === s.id ? 0.35 : 0.1}
                style={{ transition: "opacity 0.25s" }} />
            );
          })}
          <line x1={trX(-10)} y1={trY(0)} x2={trX(10)} y2={trY(0)} stroke={INK4} strokeWidth={0.8} strokeDasharray="4 4" />
          <line x1={trX(0)} y1={trY(-10)} x2={trX(0)} y2={trY(10)} stroke={INK4} strokeWidth={0.8} strokeDasharray="4 4" />
          <circle cx={trX(dx)} cy={trY(dy)} r={7} fill="#1a1714" />
          <circle cx={trX(dx)} cy={trY(dy)} r={12} fill="none" stroke="#1a1714" strokeWidth={1.2} opacity={0.4} />
        </svg>
      </div>
      <div className="fig-pizza-read">
        <span className="wedge-chip">
          <span className="dot" style={{ background: s.color }} />
          {s.quadrant} · {s.elasticity}
        </span>
        <h4>{s.title}</h4>
        <p className="fig-pizza-blurb">{s.blurb}</p>
        <div className="widget-controls" style={{ margin: 0 }}>
          <button className="btn" onClick={() => setI((i + 7) % 8)}>← prev</button>
          <span className="sk-tour-count">{i + 1} / 8</span>
          <button className="btn" onClick={() => setI((i + 1) % 8)}>next →</button>
        </div>
      </div>
    </div>
  );
}

function SkTourThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {FIG31_SCENARIOS.map((w, i) => {
        const poly = wedgePolygon(w.id, [-10, 10], [-10, 10]);
        return (
          <polygon key={w.id}
            points={poly.map(([x, y]) => `${240 + x * 11},${135 - y * 11}`).join(" ")}
            fill={w.color} opacity={i === 2 ? 0.4 : 0.13} />
        );
      })}
      <circle cx={300} cy={100} r={11} fill="#1a1714" />
      <text x={330} y={78} fontSize={26} fill={INK4}>→</text>
    </svg>
  );
}

/* ============================================================
   S8 · the multiplier cascade — one job hires two more
   ============================================================ */

const LOCAL_PATTERN = [2, 2, 1, 2, 2]; // averages 1.8

function SkMultiplier() {
  const [exp, setExp] = useState(3);
  const locals = Array.from({ length: exp }, (_, i) => LOCAL_PATTERN[i % 5]).reduce(
    (a, b) => a + b, 0,
  );
  return (
    <>
      <div className="widget-controls">
        <button className="btn gold" onClick={() => setExp(Math.min(15, exp + 1))}
          disabled={exp >= 15}>
          + hire one exporter
        </button>
        <button className="btn" onClick={() => setExp(0)}>reset</button>
      </div>
      <div className="fig-frame">
        <div className="sk-cascade">
          <div className="sk-cascade-row">
            <span className="sk-cascade-label">export jobs</span>
            <span className="sk-cascade-dots">
              {Array.from({ length: exp }, (_, i) => (
                <i key={i} className="sk-dot sk-pop" style={{ background: "#c98500" }} />
              ))}
            </span>
          </div>
          <div className="sk-cascade-arrow" aria-hidden>
            ↓ paychecks, spent down Main Street
          </div>
          <div className="sk-cascade-row">
            <span className="sk-cascade-label">local jobs</span>
            <span className="sk-cascade-dots">
              {Array.from({ length: locals }, (_, i) => (
                <i key={i} className="sk-dot sk-pop" style={{ background: BLUE }} />
              ))}
            </span>
          </div>
        </div>
      </div>
      <div className="stat-tiles">
        <div className="stat-tile sm">
          <div className="label">exporters</div>
          <div className="value">{exp}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">locals they support</div>
          <div className="value">{locals}</div>
        </div>
        <div className="stat-tile sm">
          <div className="label">multiplier</div>
          <div className="value">{exp ? (locals / exp).toFixed(1) : "—"}×</div>
        </div>
      </div>
      <p className="widget-caption">
        {exp === 0
          ? "No oxygen, no town. Hire your first exporter."
          : "Each gold job is funded from outside; each blue one is a barber, grocer or teacher paid out of those wages — the ~1.8× multiplier, one click at a time."}
      </p>
    </>
  );
}

function SkMultiplierThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={180 + i * 60} cy={70} r={14} fill="#c98500" />
      ))}
      <text x={240} y={130} textAnchor="middle" fontSize={22} fill={INK4}>↓</text>
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={100 + i * 56} cy={185} r={14} fill={BLUE} />
      ))}
    </svg>
  );
}

/* ============================================================
   S9 · the scrabble hand — the adjacent possible
   ============================================================ */

const HAND = ["S", "O", "F", "T", "W", "A", "R", "E"];
const EXTRAS = ["B", "L", "M"];
const WORDS = [
  { w: "SOFTWARE", note: "already exporting" },
  { w: "WAFERS", note: "already within reach" },
  { w: "BOATS", note: "" },
  { w: "SOLAR", note: "" },
  { w: "METALS", note: "" },
];

function canSpell(word: string, letters: string[]): { ok: boolean; missing: string[] } {
  const pool = [...letters];
  const missing: string[] = [];
  for (const ch of word) {
    const idx = pool.indexOf(ch);
    if (idx >= 0) pool.splice(idx, 1);
    else missing.push(ch);
  }
  return { ok: missing.length === 0, missing };
}

function SkScrabble() {
  const [picked, setPicked] = useState<string[]>([]);
  const letters = [...HAND, ...picked];
  const unlocked = WORDS.filter((w) => canSpell(w.w, letters).ok).length;
  return (
    <>
      <div className="sk-letterbar">
        <span className="sk-letterbar-label">the city's letters</span>
        {HAND.map((ch, i) => (
          <span key={i} className="sk-tile">{ch}</span>
        ))}
        <span className="sk-letterbar-label" style={{ marginLeft: 10 }}>learnable</span>
        {EXTRAS.map((ch) => (
          <button key={ch} className="sk-tile sk-tile-extra" aria-pressed={picked.includes(ch)}
            onClick={() =>
              setPicked(picked.includes(ch) ? picked.filter((x) => x !== ch) : [...picked, ch])
            }>
            {ch}
          </button>
        ))}
      </div>
      <div className="sk-words">
        {WORDS.map(({ w, note }) => {
          const r = canSpell(w, letters);
          return (
            <span key={w} className={`sk-word${r.ok ? " is-on" : ""}`}>
              {w.split("").map((ch, i) => {
                const miss = r.missing.includes(ch) &&
                  r.missing.indexOf(ch) >= 0 && !letters.includes(ch);
                return (
                  <b key={i} className={miss ? "is-missing" : ""}>{ch}</b>
                );
              })}
              {r.ok && note && <em> · {note}</em>}
            </span>
          );
        })}
      </div>
      <p className="widget-caption">
        Letters are capabilities — machinists, cold chains, testing labs; words are industries.
        {picked.length === 0
          ? " This hand already spells two exports. Learn a letter and see what else it unlocks."
          : ` With ${picked.join(" and ")} learned, the city can spell ${unlocked} of 5 — note how METALS needs two new letters at once: that's the coordination problem in tile form.`}
      </p>
      <p className="data-note">
        The paper's Scrabble metaphor for economic complexity: cities diversify into words one
        letter away from their hand — the adjacent possible.
      </p>
    </>
  );
}

function SkScrabbleThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {["S", "O", "F", "T"].map((ch, i) => (
        <g key={ch}>
          <rect x={64 + i * 92} y={56} width={72} height={78} rx={8} fill="#fdf9ec"
            stroke="#d8cfb8" strokeWidth={2} />
          <text x={100 + i * 92} y={108} textAnchor="middle" fontSize={40}
            fontFamily="Georgia, serif" fontWeight={700} fill="#5c4d28">{ch}</text>
        </g>
      ))}
      <rect x={156} y={176} width={72} height={78} rx={8} fill="#fff" stroke={GOLD}
        strokeWidth={3} strokeDasharray="8 6" />
      <text x={192} y={228} textAnchor="middle" fontSize={40} fontFamily="Georgia, serif"
        fontWeight={700} fill={GOLD}>L</text>
      <text x={280} y={222} fontSize={30} fill={INK4}>?</text>
    </svg>
  );
}

/* ============================================================
   S10 · the adjacent hop — a pocket product space
   ============================================================ */

const PS_NODES: { x: number; y: number; label: string }[] = [
  { x: 70, y: 150, label: "textiles" },
  { x: 130, y: 90, label: "garments" },
  { x: 150, y: 196, label: "footwear" },
  { x: 216, y: 130, label: "furniture" },
  { x: 262, y: 62, label: "toys" },
  { x: 296, y: 186, label: "auto parts" },
  { x: 330, y: 106, label: "machinery" },
  { x: 396, y: 62, label: "electronics" },
  { x: 402, y: 160, label: "instruments" },
  { x: 442, y: 110, label: "chips" },
];
const PS_EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [6, 7], [6, 8], [7, 9], [8, 9],
];

function SkHop() {
  const [owned, setOwned] = useState<number[]>([0, 1, 2]);
  const [rejected, setRejected] = useState<number | null>(null);
  const adjacent = (i: number) =>
    PS_EDGES.some(([a, b]) => (a === i && owned.includes(b)) || (b === i && owned.includes(a)));
  const tryHop = (i: number) => {
    if (owned.includes(i)) return;
    if (adjacent(i)) {
      setOwned([...owned, i]);
      setRejected(null);
    } else {
      setRejected(i);
      window.setTimeout(() => setRejected(null), 900);
    }
  };
  return (
    <>
      <div className="fig-frame">
        <svg viewBox="0 0 480 240" role="img"
          aria-label="A pocket product space: industries as connected nodes. The city can only jump to industries adjacent to ones it already makes.">
          {PS_EDGES.map(([a, b], i) => (
            <line key={i} x1={PS_NODES[a].x} y1={PS_NODES[a].y} x2={PS_NODES[b].x}
              y2={PS_NODES[b].y}
              stroke={owned.includes(a) && owned.includes(b) ? GOLD : "#d8d2c4"}
              strokeWidth={owned.includes(a) && owned.includes(b) ? 2.4 : 1.2}
              style={{ transition: "stroke 0.3s" }} />
          ))}
          {PS_NODES.map((n, i) => {
            const mine = owned.includes(i);
            const near = !mine && adjacent(i);
            return (
              <g key={i} onClick={() => tryHop(i)}
                className={rejected === i ? "sk-shake" : undefined}
                style={{ cursor: mine ? "default" : "pointer" }}>
                <circle cx={n.x} cy={n.y} r={mine ? 11 : 9}
                  fill={mine ? GOLD : near ? "#fff" : "#efe9db"}
                  stroke={mine ? "#785312" : near ? GOLD : "#c9c2b2"}
                  strokeWidth={near ? 2 : 1.3}
                  strokeDasharray={near ? "3 3" : undefined}
                  style={{ transition: "fill 0.3s" }} />
                <text x={n.x} y={n.y + 22} textAnchor="middle" fontSize={8.5}
                  fontWeight={mine ? 700 : 450} fill={mine ? "#785312" : INK3}
                  style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="widget-controls">
        <span className="barrel-tokens">
          industries: <b>{owned.length}</b> of 10
        </span>
        <span className="control-sep" />
        <button className="btn" onClick={() => setOwned([0, 1, 2])}>reset</button>
      </div>
      <p className="widget-caption">
        {rejected !== null
          ? "Too far — no shared know-how, no bridge. Chips can't be reached from garments in one jump."
          : owned.length >= 9
            ? "You reached the far shore — but only by walking the chain. That's path dependence: what a city can make next depends on what it makes now."
            : "Click a ringed industry to diversify into it. The dashed rings are the adjacent possible; everything else is out of reach for now."}
      </p>
    </>
  );
}

function SkHopThumb() {
  return (
    <svg viewBox="0 0 480 270" aria-hidden>
      {PS_EDGES.map(([a, b], i) => (
        <line key={i} x1={PS_NODES[a].x} y1={PS_NODES[a].y + 20} x2={PS_NODES[b].x}
          y2={PS_NODES[b].y + 20} stroke={i < 3 ? GOLD : "#d8d2c4"} strokeWidth={i < 3 ? 4 : 2} />
      ))}
      {PS_NODES.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y + 20} r={i < 3 ? 16 : 11}
          fill={i < 3 ? GOLD : i === 3 ? "#fff" : "#efe9db"}
          stroke={i < 3 ? "#785312" : i === 3 ? GOLD : "#c9c2b2"}
          strokeWidth={i === 3 ? 3 : 2} strokeDasharray={i === 3 ? "5 5" : undefined} />
      ))}
    </svg>
  );
}

/* ============================================================
   the entries
   ============================================================ */

export const SKETCH_A: Concept[] = [
  {
    id: "sk-tree",
    num: "S1",
    eyebrow: "The framework",
    title: "The tree in ten seconds",
    teaser: "Walk one path of Figure 27, fork by fork.",
    lede: "The whole diagnostic tree in miniature. At every fork, the ringed branches are your choices — click one to walk down, and read what each node means as you pass through it.",
    tag: "Figure 27 itself — the spine of the whole framework, and of the profile's diagnosis section.",
    thumb: <SkTreeThumb />,
    paperThumb: true,
    body: () => <SkTree />,
  },
  {
    id: "sk-ruleout",
    num: "S2",
    eyebrow: "Method",
    title: "Rule it out",
    teaser: "Strike suspects until the evidence leaves one standing.",
    lede: "Progressing down any branch of the tree requires evidence that rules out the alternatives. Here are four suspects and one line of Boston evidence each — strike the ones the evidence clears.",
    tag: "the logic of every diagnosis chapter in the paper: elimination, not accumulation.",
    thumb: <SkRuleOutThumb />,
    paperThumb: true,
    body: () => <SkRuleOut />,
  },
  {
    id: "sk-camels",
    num: "S3",
    eyebrow: "Diagnostic tests",
    title: "Camels & hippos",
    teaser: "Dry out the market and read the survivors.",
    lede: "You can rarely measure a scarce input directly — but you can look at who survives. Raise the scarcity and watch the heavy users vanish: a city of camels means the water is binding.",
    tag: "one of the paper's four tests for a binding constraint — survivorship as evidence.",
    thumb: <SkCamelsThumb />,
    paperThumb: true,
    body: () => <SkCamels />,
  },
  {
    id: "sk-bypass",
    num: "S4",
    eyebrow: "Diagnostic tests",
    title: "The generator count",
    teaser: "Private workarounds publish the shadow price.",
    lede: "When firms buy what the city fails to provide — generators, boreholes, private buses — each purchase is a receipt for the missing input. Slide the outages and count the receipts.",
    tag: "the bypassing test: “generators in every courtyard” is a diagnosis you can see from the street.",
    thumb: <SkBypassThumb />,
    paperThumb: true,
    body: () => <SkBypass />,
  },
  {
    id: "sk-queue",
    num: "S5",
    eyebrow: "Diagnostic tests",
    title: "The queue",
    teaser: "Waiting time is the price nobody posted.",
    lede: "Scarce things that aren't rationed by price get rationed by waiting. Slow the permit window down and watch the line — its length is the shadow price of the institution.",
    tag: "queues and wait times, the paper's most literal shadow-price test.",
    thumb: <SkQueueThumb />,
    paperThumb: true,
    body: () => <SkQueue />,
  },
  {
    id: "sk-cic",
    num: "S6",
    eyebrow: "Diagnostic tests",
    title: "Changes-in-changes",
    teaser: "Difference the city against its twin.",
    lede: "Did the shock bite, or was everyone falling? Compare the city to a twin that ate the same national weather: the gap that opens after the shock — and only that gap — is the effect.",
    tag: "the paper's test for external shocks, from Detroit to the China shock.",
    thumb: <SkCiCThumb />,
    paperThumb: true,
    body: () => <SkCiC />,
  },
  {
    id: "sk-tour",
    num: "S7",
    eyebrow: "The pizza chart",
    title: "A tour of the eight slices",
    teaser: "Flash cards: every slice, one at a time.",
    lede: "The eight kinds of city around the typical one, dealt as flash cards. Step through all eight; the marker moves slice to slice and each card reads its verdict, verbatim from Figure 31.",
    tag: "Figure 31's wedges — the same eight verdicts behind the profile's metro scatter.",
    thumb: <SkTourThumb />,
    paperThumb: true,
    body: () => <SkTour />,
  },
  {
    id: "sk-multiplier",
    num: "S8",
    eyebrow: "Exports",
    title: "The multiplier cascade",
    teaser: "Hire one exporter; watch two locals appear.",
    lede: "The export multiplier as a clicker: every gold job is paid from outside, and its paycheck hires blue ones down Main Street — about 1.8 of them, on average, in US cities.",
    tag: "why the diagnosis cares about tradables first — the rest of the town is downstream.",
    thumb: <SkMultiplierThumb />,
    paperThumb: true,
    body: () => <SkMultiplier />,
  },
  {
    id: "sk-scrabble",
    num: "S9",
    eyebrow: "Complexity",
    title: "The Scrabble hand",
    teaser: "Learn a letter; see which industries it unlocks.",
    lede: "Capabilities are letters, industries are words. The city's hand already spells a couple of exports — toggle a learnable letter and watch the adjacent possible light up (and note the word that needs two letters at once).",
    tag: "the paper's Scrabble metaphor for economic complexity and diversification.",
    thumb: <SkScrabbleThumb />,
    paperThumb: true,
    body: () => <SkScrabble />,
  },
  {
    id: "sk-hop",
    num: "S10",
    eyebrow: "Complexity",
    title: "The adjacent hop",
    teaser: "A pocket product space — jump only to neighbors.",
    lede: "Industries as a network: the city can only diversify into nodes that share know-how with what it already makes. Try to reach chips from garments and feel the path dependence.",
    tag: "the product-space logic behind “low diversification into new activities.”",
    thumb: <SkHopThumb />,
    paperThumb: true,
    body: () => <SkHop />,
  },
];
