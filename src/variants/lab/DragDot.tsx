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

import { boston } from "../../data/boston";
import { MEDIANS } from "../../data/metros";
import { verdictAt, signed, sideLabel } from "../../data/derive";
import { PizzaChart, type PizzaPoint } from "../../shared/PizzaChart";

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
  const truth = { x: boston.diagnosis.msa.popCagr, y: boston.diagnosis.msa.wageCagr };
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
    ...(hideGuess ? [] : [{ x: pt.x, y: pt.y, label: showTruth ? "your call" : "your metro", kind: "sim" as const }]),
    ...(showTruth ? [{ ...truth, label: "Boston MSA", kind: "msa" as const }] : []),
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
          <div className="stat-tiles" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="stat-tile">
              <div className="label">people /yr</div>
              <div className="value" style={{ fontSize: 22 }}>{signed(shownPt.x)}%</div>
              <div className="note">typical {signed(MEDIANS.popCagr)}%</div>
            </div>
            <div className="stat-tile">
              <div className="label">pay /yr</div>
              <div className="value" style={{ fontSize: 22 }}>{signed(shownPt.y)}%</div>
              <div className="note">typical {signed(MEDIANS.wageCagr)}%</div>
            </div>
          </div>
          {neutral ? (
            <div className="dd-signal is-neutral">
              <div className="dd-signal-head">On the benchmark — no signal yet.</div>
              <div className="dd-signal-read">Drag the dot to take a position.</div>
            </div>
          ) : (
            <div className="dd-signal" style={{ borderLeftColor: shown.scenario.color }}>
              <div className="dd-signal-head">
                <span className="dd-swatch" style={{ background: shown.scenario.color }} />
                {shown.scenario.id} · {shown.scenario.title}
              </div>
              <div className="dd-signal-read">
                Reads as <strong>{sideLabel[shown.side]}</strong>
                {shown.spiralRisk && <span className="dd-spiral">negative-spiral risk</span>}
              </div>
            </div>
          )}
        </div>
      </div>
      {!locked && (
        <div className="fig-caption" style={{ marginTop: 10 }}>
          Dashed crosshair = the typical US metro · diagonals = where the verdict flips.
        </div>
      )}
    </div>
  );
}
