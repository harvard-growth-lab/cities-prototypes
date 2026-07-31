import type { CSSProperties } from "react";
import type { IndicatorRow, SliderSpec } from "../../data/content";

/** The little hatched slider in the "Change" column. The knob slides from
 *  --from to --to when the enclosing .ov-block gains the .inview class;
 *  the optional ghost is the city's dot on the MSA table. */
function ChangeSlider({ spec }: { spec: SliderSpec }) {
  return (
    <span className="chg-slider" style={{ "--zero": spec.zero } as CSSProperties}>
      <span className="neg"></span>
      <span className="pos"></span>
      <span className="track"></span>
      <span className="zero"></span>
      {spec.ghost && (
        <span
          className={"ghost " + (spec.ghost.good ? "good" : "bad")}
          style={{ "--gpos": spec.ghost.pos } as CSSProperties}
          data-tip={spec.ghost.tip}
        ></span>
      )}
      <span
        className={"knob " + (spec.good ? "good" : "bad") + (spec.focus ? " focus" : "")}
        style={{ "--from": spec.from, "--to": spec.to } as CSSProperties}
      ></span>
    </span>
  );
}

interface IndicatorTableProps {
  rows: IndicatorRow[];
  span: string;
  rankLabel: string;
}

export function IndicatorTable({ rows, span, rankLabel }: IndicatorTableProps) {
  return (
    <div className="ind-table">
      <div className="ind-head">
        <span></span>
        <span>Level</span>
        <span>Change in {span}</span>
        <span>{rankLabel}</span>
      </div>
      {rows.map((row) => (
        <div key={row.name} className={"ind-row" + (row.hero ? " hero" : "")}>
          <span className="ind-name">{row.name}</span>
          <span className="ind-val">{row.level}</span>
          <span className="chg-wrap">
            <ChangeSlider spec={row.slider} />
            <span className={"chg-val " + (row.changeGood ? "good" : "bad")}>{row.change}</span>
          </span>
          <span className="ind-rank">{row.rank}</span>
          {row.heroNote && <span className="hero-note">{row.heroNote}</span>}
        </div>
      ))}
    </div>
  );
}
