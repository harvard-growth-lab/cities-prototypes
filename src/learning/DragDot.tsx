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
import { PizzaChart, type PizzaPoint } from "./PizzaChart";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The signal panel's one-line read, in plain language: describe the two dials
 * against the typical metro, then flag which side the pattern points to.
 * `dp`/`dw` are the point's growth minus the US medians; `side` is the wedge's
 * constraint side. e.g. "People and paychecks both up — but pay is outrunning
 * population, a possible constraint on the labor-supply side."
 */
function plainSummary(dp: number, dw: number, side: string): string {
  const eps = 0.07;
  const pUp = dp > eps;
  const pDown = dp < -eps;
  const wUp = dw > eps;
  const wDown = dw < -eps;
  const people = pUp ? "people arriving" : pDown ? "people leaving" : "population flat";
  const pay = wUp ? "pay rising" : wDown ? "pay falling" : "pay flat";
  const together = (pUp && wUp) || (pDown && wDown);

  if (side === "none")
    return `${cap(people)}, ${pay} — both close to the typical metro, so no side clearly binds yet.`;

  if (side === "demand")
    return pUp
      ? "People and paychecks up together — a labor-demand boom: the jobs engine is pulling."
      : "People and paychecks down together — the labor-demand side is faltering: the jobs engine is stalling.";

  // labor supply
  if (together)
    return pUp
      ? "People and paychecks both up — but pay is outrunning population, a possible constraint on the labor-supply side (housing, amenities)."
      : "People and paychecks both down — but population is sliding faster than pay, a labor-supply story.";
  return pUp
    ? "People arriving on thinner paychecks — a labor-supply story: cheaper living or amenities are doing the recruiting."
    : "Paychecks up but people leaving — a labor-supply warning: something about living here is pushing people out.";
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
  const shownDp = shownPt.x - MEDIANS.popCagr;
  const shownDw = shownPt.y - MEDIANS.wageCagr;

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
                {plainSummary(shownDp, shownDw, shown.side)}
                {shown.spiralRisk && (
                  <span className="dd-spiral">negative-spiral risk</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {!locked && (
        <div className="fig-caption" style={{ marginTop: 10 }}>
          Diagonals = where the verdict flips.
        </div>
      )}
    </div>
  );
}
