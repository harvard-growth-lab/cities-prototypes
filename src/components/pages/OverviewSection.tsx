import { useRef } from "react";
import type { RefObject } from "react";
import { CITY_INDICATORS, MSA_INDICATORS } from "../../data/content";
import { IndicatorTable } from "./IndicatorTable";
import { OverviewMap } from "./OverviewMap";

interface OverviewSectionProps {
  cityShort: string;
  span: string;
  pagesRef: RefObject<HTMLElement | null>;
  mapVisible: boolean;
}

/** City Overview: two full-height indicator blocks on the left, and a sticky
 *  map on the right that zooms from the city out to its MSA as you scroll. */
export function OverviewSection({ cityShort, span, pagesRef, mapVisible }: OverviewSectionProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div className="ov-wrap" ref={wrapRef}>
      <div className="ov-left">
        <section className="ov-block" id="page-overview">
          <div className="page-head">
            <h2>How well is your city doing?</h2>
          </div>
          <p className="lede">
            The clearest signal is whether people are arriving or leaving. Within a country, moving
            is relatively frictionless — so population change is residents{" "}
            <strong>voting with their feet</strong> on whether {cityShort} is a good place to live
            and work.
          </p>
          <IndicatorTable rows={CITY_INDICATORS} span={span} rankLabel="Rank in MSA" />
        </section>

        <section className="ov-block" id="page-overview-msa">
          <div className="page-head">
            <h2>Your city is not an island</h2>
          </div>
          <p className="lede">
            The administrative city is one piece of a larger machine: people commute, firms hire,
            and housing supply responds across a region far wider than the city line — the{" "}
            <strong>labor market</strong>. We approximate it with the metropolitan statistical area.{" "}
            {cityShort} sits inside its metro area, and most of what follows is read at that scale.
          </p>
          <IndicatorTable rows={MSA_INDICATORS} span={span} rankLabel="Rank of US metros" />
        </section>
      </div>

      <div className="ov-map">
        <div className="ov-map-inner">
          <OverviewMap pagesRef={pagesRef} wrapRef={wrapRef} visible={mapVisible} />
        </div>
      </div>
    </div>
  );
}
