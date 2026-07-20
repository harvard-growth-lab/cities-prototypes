/**
 * Walk the tree yourself — embedded in a quiz card (see proto/InstrumentCards).
 * One fork at a time: the mini-map spotlights the current level (path lit,
 * the two candidate branches ringed, everything else dimmed), a terse
 * evidence table sits beside it, and you choose by clicking a ringed node or
 * its button. Reaching a leaf commits; the framework grades your path
 * against where the data points (root → supply → amenities for Boston).
 */

import { useEffect, useRef, useState } from "react";
import { boston } from "../../data/boston";
import { signed } from "../../data/derive";
import { FIG27_NODES } from "../../content/figures";
import { MiniTree } from "../../shared/MiniTree";

const p = boston;

interface Fork {
  prompt: string;
  evidence: { label: string; value: string; hint: string }[];
}

// One screen of evidence per fork. Values carry the signal; hints stay under
// ten words — the reading happens in the reveal, not here.
const FORKS: Record<string, Fork> = {
  root: {
    prompt: "Whose problem is it — the firms' or the residents'?",
    evidence: [
      { label: "The wedge", value: "pay ↑↑ · people ↓", hint: "pay is sprinting; people aren't coming" },
      { label: "Shift-share, local", value: `${signed(p.demand.shiftShare.localPp)} pp`, hint: "the industry mix isn't the drag" },
      { label: "Tradable jobs", value: "100 → 112", hint: "the export engine kept growing" },
    ],
  },
  supply: {
    prompt: "Residents' side. The cost of living — or what living here is like?",
    evidence: [
      {
        label: "Home-value growth",
        value: `${signed(p.supply.housingTest.cityGrowthPct)} vs ${signed(p.supply.housingTest.medianGrowthPct)} %/yr`,
        hint: "lags the typical metro",
      },
      { label: "Amenity residual", value: `${signed(p.supply.amenityResidualPp)} pp`, hint: "the be-here premium is draining" },
      { label: "Permits", value: `${p.supply.permits.msaPer1k} vs ${p.supply.permits.nationPer1k} per 1k`, hint: "slow building — a watch item" },
    ],
  },
  demand: {
    prompt: "Firms' side. What the city already does — or what it can't become?",
    evidence: [
      { label: "Export jobs", value: "100 → 112", hint: "existing industries grew fine" },
      {
        label: "New exports",
        value: `${p.demand.newExports.actual} vs ${p.demand.newExports.predictedForEci} predicted`,
        hint: "fewer new lines than know-how predicts",
      },
    ],
  },
  col: {
    prompt: "Cost of living. Housing prices — or reaching the jobs?",
    evidence: [
      { label: "Home-value growth", value: "lags the nation", hint: "prices rose slower than typical" },
      { label: "Jobs within 30 min", value: "38%", hint: "middling reach, but stable" },
    ],
  },
  existing: {
    prompt: "Existing industries. Outside shocks — or missing inputs?",
    evidence: [
      { label: "US market share", value: `${signed(p.demand.marketShare.deltaPp)} pp`, hint: "rising — no shock signature" },
      { label: "Input prices", value: "land #3 · rent #5", hint: "pricey — but land cuts both ways" },
    ],
  },
  newact: {
    prompt: "New activities. One suspect left on this branch: coordination.",
    evidence: [{ label: "Complexity outlook (COI)", value: `${p.demand.coi}`, hint: "many adjacent options, untaken" }],
  },
};

const childrenOf = (id: string) => FIG27_NODES.filter((n) => n.parent === id);
const titleOf = (id: string) => FIG27_NODES.find((n) => n.id === id)!.title;

export function TreeWalk({ onComplete }: { onComplete?: (correct: boolean) => void }) {
  const [path, setPath] = useState<string[]>(["root"]);
  const current = path[path.length - 1];
  const kids = childrenOf(current);
  const done = kids.length === 0;
  const fork = FORKS[current];

  const correctPath = p.treePath; // ["root","supply","amen"]
  const score = path.filter((n) => correctPath.includes(n)).length - 1; // exclude root
  const maxScore = correctPath.length - 1;

  // Reaching a leaf is the commitment — report the graded walk upward, but
  // ONLY on the false→true transition of `done`. The effect also re-runs when
  // the parent re-renders (inline `onComplete` gets a new identity), and after
  // a quiz reset that re-run would instantly re-submit the cleared answer:
  // child effects fire before the parent card can remount this widget.
  const firedRef = useRef(false);
  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      onComplete?.(score === maxScore);
    } else if (!done) {
      firedRef.current = false;
    }
  }, [done, score, maxScore, onComplete]);

  return (
    <div className="tree-walk">
      {/* The tree is the hero: full card width, so the level being decided is
          legible at a glance. The fork controls ride below it. */}
      <div className="tw-tree">
        <MiniTree
          path={path}
          ruledOut={done ? p.treeRuledOut : []}
          selected={current}
          choices={done ? [] : kids.map((k) => k.id)}
          onSelect={done ? undefined : (n) => setPath([...path, n.id])}
          height={250}
        />
      </div>

      {!done && fork && (
        <div className="tw-fork">
          <div className="tw-ask">
            <div className="tw-fork-tag">
              Fork {path.length}
              {path.length > 1 && <> · after {titleOf(current).toLowerCase()}</>}
            </div>
            <p className="tw-question">{fork.prompt}</p>
            <div className="tw-evidence">
              {fork.evidence.map((e) => (
                <div className="tw-ev" key={e.label}>
                  <div className="tw-ev-top">
                    <span className="tw-ev-label">{e.label}</span>
                    <span className="tw-ev-value">{e.value}</span>
                  </div>
                  <div className="tw-ev-hint">{e.hint}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="tw-act">
            <div className="quiz-options tw-choices">
              {kids.map((k) => (
                <button key={k.id} className="quiz-option" onClick={() => setPath([...path, k.id])}>
                  <strong>{k.title}</strong>
                  {k.sub ? <span className="tw-choice-sub"> — {k.sub}</span> : null}
                </button>
              ))}
            </div>
            {path.length > 1 && (
              <button className="quiz-skip" onClick={() => setPath(path.slice(0, -1))}>
                ← back up a level
              </button>
            )}
          </div>
        </div>
      )}

      {done && (
        <div className="verdict-card tw-verdict" style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Your walk: {path.map(titleOf).join(" → ")}
          </div>
          <h3 style={{ fontSize: 18 }}>
            {score === maxScore
              ? "Same walk the data takes."
              : score > 0
                ? "Half right — you turned off the data's path."
                : "The data walks the other way."}
          </h3>
          {/* The why lives in the quiz reveal just below — repeating it
              here doubled the text without adding information. */}
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginBottom: 0 }}>
            Your ending — <em>{titleOf(current)}</em> —{" "}
            {current === "amen"
              ? "is exactly where the evidence points."
              : "would need evidence that outweighs the walk below."}
          </p>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setPath(["root"])}>
            walk it again
          </button>
        </div>
      )}
    </div>
  );
}
