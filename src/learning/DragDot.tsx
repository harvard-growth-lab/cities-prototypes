/**
 * Drag the dot — the pizza-plane instrument, embedded in a quiz card (see
 * proto/InstrumentCards). Controlled: the card owns the point and the
 * answered state; this renders the draggable plane plus a live readout.
 *
 * The readout is built to parse at a glance: two growth tiles (each against
 * the typical-metro benchmark), then ONE signal line — the wedge under the
 * dot and the constraint side it reads as. While the dot still sits on the
 * benchmark crosshair (its neutral starting spot) there is no signal yet and
 * the readout says so. When `showTruth` is on (after lock-in), Boston's real
 * position appears beside the user's call and the readout switches to the
 * true wedge.
 */

import { boston } from "./data/boston";
import { MEDIANS } from "./data/metros";
import { verdictAt, signed } from "./data/derive";
import { CONSTRAINT_COLORS, type WedgeId } from "./content/figures";
import { PizzaChart, type PizzaPoint } from "./PizzaChart";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The signal panel's one-line read, in plain language — one line per wedge,
 * matching the Figure-31 scenario named in the header just above it. The
 * wedge places the point against the typical metro; the absolute growth
 * rates keep the words honest — a metro can lag the benchmark on people
 * while still growing, or lag on pay while paychecks still rise.
 */
function plainSummary(wedge: WedgeId, popCagr: number, wageCagr: number): string {
  const eps = 0.07;
  const peopleLag =
    popCagr < -eps ? "people leaving" : "population lagging the typical metro";
  const payLag = wageCagr < -eps ? "pay falling" : "pay lagging the typical metro";
  switch (wedge) {
    case "1a":
      return "People and paychecks both beating the typical metro — but pay is outrunning population: either a constraint on the labor-supply side (housing, amenities) or a superstar's naturally tight supply. The housing tests tell the two apart.";
    case "1b":
      return "People arriving faster than pay is climbing — a boom the city is absorbing. No side binds; the challenge is keeping services ahead of growth.";
    case "2a":
      return `People pouring in with ${payLag} — cheaper living or amenities are doing the recruiting, and the jobs stretch to absorb them. No side clearly binds.`;
    case "2c":
      return `People arriving with ${payLag} — the jobs engine can't stretch to meet them: a possible constraint on the labor-demand side.`;
    case "3c":
      return `${cap(payLag)} while population barely budges — people ride out the pain: a labor-demand constraint either way.`;
    case "3d":
      return `${cap(peopleLag)} faster than pay is giving way — firms leave and people follow: the strongest labor-demand signal.`;
    case "4e":
      return `${cap(peopleLag)} even though pay beats the benchmark — a labor-supply warning: something about living here is pushing people away.`;
    case "4f":
      return `Pay bid far past the benchmark and ${peopleLag} anyway — a labor-supply warning: something about living here needs paying for.`;
  }
}

export function DragDot({
  pt,
  onChange,
  locked = false,
  showTruth = false,
  hideGuess = false,
}: {
  pt: { x: number; y: number };
  onChange: (pt: { x: number; y: number }) => void;
  locked?: boolean;
  showTruth?: boolean;
  /** skip path: reveal Boston without pretending the user took a position */
  hideGuess?: boolean;
}) {
  const v = verdictAt(pt.x, pt.y);
  const truth = {
    x: boston.diagnosis.msa.popCagr,
    y: boston.diagnosis.msa.wageCagr,
  };
  const tv = verdictAt(truth.x, truth.y);
  const shown = showTruth ? tv : v;
  const shownPt = showTruth ? truth : pt;

  // On (or a hair off) the benchmark crosshair every wedge meets — there is
  // no honest signal to report, so don't pretend there is one.
  const neutral =
    !showTruth &&
    Math.abs(pt.x - MEDIANS.popCagr) < 0.07 &&
    Math.abs(pt.y - MEDIANS.wageCagr) < 0.07;

  const points: PizzaPoint[] = [
    ...(hideGuess
      ? []
      : [
          {
            x: pt.x,
            y: pt.y,
            label: showTruth ? "your call" : "your metro",
            kind: "sim" as const,
          },
        ]),
    ...(showTruth
      ? [{ ...truth, label: "Boston MSA", kind: "msa" as const }]
      : []),
  ];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 1fr) minmax(230px, 290px)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <PizzaChart
          points={points}
          highlightWedge={neutral ? null : shown.wedge}
          draggable={!locked}
          onDrag={(x, y) => onChange({ x, y })}
          windowLabel={boston.diagnosis.windowLabel}
        />
        <div style={{ display: "grid", gap: 12 }}>
          <div
            className="stat-tiles"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            <div className="stat-tile">
              <div className="label">people /yr</div>
              <div className="value" style={{ fontSize: 22 }}>
                {signed(shownPt.x)}%
              </div>
              <div className="note">typical {signed(MEDIANS.popCagr)}%</div>
            </div>
            <div className="stat-tile">
              <div className="label">pay /yr</div>
              <div className="value" style={{ fontSize: 22 }}>
                {signed(shownPt.y)}%
              </div>
              <div className="note">typical {signed(MEDIANS.wageCagr)}%</div>
            </div>
          </div>
          {neutral ? (
            <div className="dd-signal is-neutral">
              <div className="dd-signal-head">
                On the benchmark — no signal yet.
              </div>
              <div className="dd-signal-read">
                Drag the dot to take a position.
              </div>
            </div>
          ) : (
            <div
              className="dd-signal"
              style={{ borderLeftColor: shown.scenario.color }}
            >
              <div className="dd-signal-head">
                <span
                  className="dd-swatch"
                  style={{ background: shown.scenario.color }}
                />
                {shown.scenario.id} · {shown.scenario.title}
              </div>
              <div className="dd-signal-read">
                {plainSummary(shown.wedge, shownPt.x, shownPt.y)}
                {shown.spiralRisk && (
                  <span className="dd-spiral">negative-spiral risk</span>
                )}
              </div>
              {/* The figure's own constraint note for this wedge — the hinge
                  between this chart and the decision tree's first fork. */}
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12.5,
                  color: CONSTRAINT_COLORS[shown.side],
                }}
              >
                <strong>{shown.scenario.constraint}</strong>
                <span style={{ opacity: 0.85 }}>
                  {shown.side === "none"
                    ? " — no tree branch to walk yet"
                    : ` → walk the tree's Labor ${shown.side === "demand" ? "Demand" : "Supply"} branch`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="fig-caption" style={{ marginTop: 10 }}>
        Both dials are read against the typical US metro — the dashed
        crosshair. Diagonals = where the verdict flips.
      </div>
    </div>
  );
}
