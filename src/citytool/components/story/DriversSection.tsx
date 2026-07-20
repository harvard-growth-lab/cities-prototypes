import type { ComponentProps, ReactNode } from 'react';
import type { ConstraintType, Diagnosis, SupplyDiagnosis, SupplySide } from '../../lib/diagnosis';
import type { ShiftShareResult } from '../../lib/shiftShare';
import type {
  CityDirectoryRow,
  PlaceDirectoryRow,
  IndustryAttributeRow,
  CityPanelRow,
  HousingRow,
  CityRentRow,
  PlacePanelRow,
  PlaceHousingRow,
  PlaceRentRow,
  PlaceFiscalRow,
} from '../../data/types';
import ShiftShareWaterfall from '../charts/ShiftShareWaterfall';
import ShiftShareEffectTreemap from '../charts/ShiftShareEffectTreemap';
import NewIndustriesTreemap from '../charts/NewIndustriesTreemap';
import MigrationChangeScatter, { buildPoints as buildMetroPoints } from '../charts/MigrationChangeScatter';
import PlaceExplodeScatter from '../charts/PlaceExplodeScatter';
import MsaPlacesChoropleth from '../charts/MsaPlacesChoropleth';
import MsaHousingTrend from '../charts/MsaHousingTrend';
import { useStory } from './useStory';

// Section 5 — "what's driving the change?" — broken into one-visual-per-screen
// steps. Branches on the diagnosis: a demand constraint walks the industry /
// shift-share story; a supply constraint walks the housing story. Each branch
// emits an ordered list of steps that CityStory drops into the scroll sequence
// (so every chart gets its own full screen). This is the least-settled part of
// the thinking, so the branch is deliberately swappable at runtime.

export type DriverStep = {
  key: string;
  title: ReactNode;
  narrative: ReactNode;
  chart: ReactNode;
  // 'stage' renders the step full-bleed (chart fills the screen, narrative
  // floats as a card) — used for the interactive MSA map. Defaults to 'full'.
  layout?: 'full' | 'stage';
};

export type DriverData = {
  msa: CityDirectoryRow;
  place: PlaceDirectoryRow;
  shiftShare: ShiftShareResult | null;
  industryAttributes: IndustryAttributeRow[] | null;
  cityPanelCountry: CityPanelRow[];
  housingUsa: HousingRow[];
  cityRentUsa: CityRentRow[];
  placeDirUsa: PlaceDirectoryRow[];
  placePanelUsa: PlacePanelRow[];
  placeHousingUsa: PlaceHousingRow[];
  placeRentUsa: PlaceRentRow[];
  placeFiscalUsa: PlaceFiscalRow[];
  msaPlaceIds: string[];
  placeNames: Map<string, string>;
  // Compare window — the same one useYearRange() gives the charts, threaded
  // through so step narratives can quote the numbers behind the branch.
  startYear: number;
  endYear: number;
  // Story index of the first driver step (CityStory's DRIVERS_BASE) — steps
  // that need to know their own section index (the explode intro) add their
  // position to it.
  baseIndex: number;
  // Second bifurcation, supply branch only: housing wall vs. amenities.
  supplyDiagnosis: SupplyDiagnosis | null;
  supplySide: SupplySide;
};

// The diagnosis tree — the story's two bifurcations drawn as an actual tree,
// rendered on the first driver step. The root poses the question; level 1
// splits demand vs. supply (read off the pop × wage quadrants two screens
// back); level 2, inside supply, splits housing vs. amenities (read off
// house-price growth on this screen). The filled path is the view being
// walked; ● marks where the diagnostics point; every node is clickable to
// walk the other branch.
export function DriverTree({
  msaName,
  view,
  supplySide,
  diagnosis,
  supplyDiagnosis,
  onViewChange,
  onSupplySideChange,
}: {
  msaName: string;
  view: ConstraintType;
  supplySide: SupplySide;
  diagnosis: Diagnosis | null;
  supplyDiagnosis: SupplyDiagnosis | null;
  onViewChange: (v: ConstraintType) => void;
  onSupplySideChange: (s: SupplySide) => void;
}) {
  const inSupply = view === 'supply';
  const node = (
    active: boolean,
    dim: boolean,
    flagged: boolean,
    title: string,
    sub: string,
    onClick: () => void,
  ) => (
    <button
      type="button"
      className={`dt-node${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="dt-node-title">
        {title}
        {flagged && <span className="dt-dot" title="Where the diagnostics point" />}
      </span>
      <span className="dt-node-sub">{sub}</span>
    </button>
  );
  return (
    <div className="driver-tree" role="group" aria-label="Diagnosis tree">
      <div className="dt-root">What constrains the growth of the {msaName} MSA?</div>
      <div className="dt-children on-path">
        <span className="dt-edge">population × wage growth</span>
        <div className={`dt-branch${!inSupply ? ' on-path' : ''}`}>
          {node(
            !inSupply,
            false,
            diagnosis?.constraintType === 'demand',
            'Demand',
            'industry story',
            () => onViewChange('demand'),
          )}
        </div>
        <div className={`dt-branch${inSupply ? ' on-path' : ''}`}>
          {node(
            inSupply,
            false,
            diagnosis?.constraintType === 'supply',
            'Supply',
            'cost-of-living story',
            () => onViewChange('supply'),
          )}
          <div className={`dt-children${inSupply ? ' on-path' : ''}`}>
            <span className="dt-edge">house-price growth</span>
            <div className={`dt-branch${inSupply && supplySide === 'housing' ? ' on-path' : ''}`}>
              {node(
                inSupply && supplySide === 'housing',
                !inSupply,
                supplyDiagnosis?.side === 'housing',
                'Housing',
                'priced out',
                () => { onViewChange('supply'); onSupplySideChange('housing'); },
              )}
            </div>
            <div className={`dt-branch${inSupply && supplySide === 'amenity' ? ' on-path' : ''}`}>
              {node(
                inSupply && supplySide === 'amenity',
                !inSupply,
                supplyDiagnosis?.side === 'amenity',
                'Amenities',
                'residual drift',
                () => { onViewChange('supply'); onSupplySideChange('amenity'); },
              )}
            </div>
          </div>
        </div>
      </div>
      {(diagnosis || supplyDiagnosis) && (
        <p className="dt-legend muted">
          <span className="dt-dot" /> where the diagnostics point · click any node to walk the
          other branch
        </p>
      )}
    </div>
  );
}

// Feeds the explode scatter its activation signal (the burst replays each time
// its section becomes the active one). Lives here rather than in the chart so
// the chart stays story-agnostic; mirrors CityStory's ExplodeScatterStep.
function ActiveExplodeChart({
  index,
  ...props
}: { index: number } & Omit<ComponentProps<typeof PlaceExplodeScatter>, 'active'>) {
  const { activeIndex } = useStory();
  return <PlaceExplodeScatter {...props} active={activeIndex === index} />;
}

const fmtSignedPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
const fmtPp = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`;

export function buildDriverSteps(view: ConstraintType, d: DriverData): DriverStep[] {
  return view === 'demand' ? demandSteps(d) : supplySteps(d);
}

function demandSteps({ msa, shiftShare, industryAttributes }: DriverData): DriverStep[] {
  if (!shiftShare || !industryAttributes) {
    return [
      {
        key: 'demand-empty',
        title: "What's driving the change?",
        narrative: (
          <p>
            A <strong>demand</strong> story is told in the industry mix — but
            shift-share needs two QCEW years inside the compare window.
          </p>
        ),
        chart: (
          <p className="muted">
            Widen the compare window in the corner to see the {msa.city_name}{' '}
            decomposition.
          </p>
        ),
      },
    ];
  }
  const steps: DriverStep[] = [
    {
      key: 'demand-waterfall',
      title: 'What grew the jobs?',
      narrative: (
        <p>
          A <strong>demand</strong> story is told in the industry mix. Shift-share
          splits the {msa.city_name} MSA's employment change into the national
          tide, its industry mix, and its own local performance — separating
          "everyone grew" from "this metro won or lost share".
        </p>
      ),
      chart: <ShiftShareWaterfall result={shiftShare} msaName={msa.city_name} />,
    },
    {
      key: 'demand-effect',
      title: 'Which industries drove it?',
      narrative: (
        <p>
          Each tile is an industry, sized by employment and shaded by whether the
          metro out- or under-performed the nation in it. The green mass is where{' '}
          {msa.city_name} won share; the red is where it bled.
        </p>
      ),
      chart: (
        <ShiftShareEffectTreemap result={shiftShare} attributes={industryAttributes} msaName={msa.city_name} />
      ),
    },
  ];
  if (shiftShare.newIndustries.length > 0) {
    steps.push({
      key: 'demand-new',
      title: 'What did the metro add?',
      narrative: (
        <p>
          Industries that {msa.city_name} had essentially none of at the start of
          the window and built up by the end — new legs the export base grew.
        </p>
      ),
      chart: <NewIndustriesTreemap result={shiftShare} attributes={industryAttributes} msaName={msa.city_name} />,
    });
  }
  return steps;
}

// Supply branch. Step 1 states the priced-out answer read off the price
// signal, then the branch forks: prices outrunning the field → the housing
// walk (trend + price map); prices lagging it → the amenity walk (residual
// drift at metro grain, the explode into places, then the Δ-residual map).
function supplySteps(d: DriverData): DriverStep[] {
  const { msa, cityPanelCountry, housingUsa, cityRentUsa, supplyDiagnosis: sd, supplySide } = d;
  const intro: DriverStep = {
    key: 'supply-scatter',
    title: 'Are people priced out?',
    narrative: (
      <>
        <p>
          A <strong>supply</strong> story is told in housing. If pay is bid up
          while people can't move in, the wall is usually the cost and supply of
          housing. Here is where {msa.city_name} sits on the population-growth ×
          house-price plane against every metro.
        </p>
        {sd && (
          <p>
            {sd.side === 'housing' ? (
              <>
                Here the answer is <strong>plausibly yes</strong>: home values
                grew <strong>{fmtSignedPct(sd.housingCagr)}/yr</strong> against{' '}
                <strong>{fmtSignedPct(sd.housingMedian)}/yr</strong> for the
                typical metro. Prices outrunning the field is what being priced
                out looks like — the next screens follow the housing branch.
              </>
            ) : (
              <>
                Here the answer is <strong>probably not</strong>: home values
                grew <strong>{fmtSignedPct(sd.housingCagr)}/yr</strong> against{' '}
                <strong>{fmtSignedPct(sd.housingMedian)}/yr</strong> for the
                typical metro. With prices lagging the field, "priced out" is
                hard to sustain — and if housing isn't the wall, the other
                supply lever is <strong>amenities</strong>. The next screens
                follow that branch.
              </>
            )}
          </p>
        )}
      </>
    ),
    chart: (
      <MigrationChangeScatter
        panel={cityPanelCountry}
        housing={housingUsa}
        rent={cityRentUsa}
        highlightCityId={msa.city_id}
        initialMode="housing"
      />
    ),
  };
  return [intro, ...(supplySide === 'amenity' ? amenitySteps(d) : housingSteps(d))];
}

function housingSteps({
  msa,
  place,
  housingUsa,
  placePanelUsa,
  placeHousingUsa,
  placeRentUsa,
  placeFiscalUsa,
  placeDirUsa,
  msaPlaceIds,
}: DriverData): DriverStep[] {
  return [
    {
      key: 'supply-trend',
      title: 'How fast are prices climbing?',
      narrative: (
        <p>
          The {msa.city_name} MSA's home-value trajectory over time. A steep,
          sustained climb is the price signal of supply failing to keep up with
          the people who want in.
        </p>
      ),
      chart: (
        <MsaHousingTrend
          housing={housingUsa}
          placeHousing={placeHousingUsa}
          cityId={msa.city_id}
          placeId={place.place_id}
          placeName={place.place_name}
          country={msa.country}
        />
      ),
    },
    {
      key: 'supply-choropleth',
      title: 'Where is it most expensive?',
      layout: 'stage',
      narrative: (
        <>
          <p>
            The within-metro geography of prices. Where the expensive places cluster
            — and where {place.place_name} sits in that pattern — hints at where
            supply is tightest.
          </p>
          {/* Slot the choropleth adopts for its metric picker + legend, so the
              card carries the map's full framing (see toolsPortalId below). */}
          <div id="choropleth-card-tools" className="stage-card-tools" />
        </>
      ),
      chart: (
        <MsaPlacesChoropleth
          msaId={msa.city_id}
          msaName={msa.city_name}
          placeId={place.place_id}
          placeName={place.place_name}
          panel={placePanelUsa}
          housing={placeHousingUsa}
          rent={placeRentUsa}
          fiscal={placeFiscalUsa}
          directory={placeDirUsa}
          msaPlaceIds={msaPlaceIds}
          fill
          toolsPortalId="choropleth-card-tools"
        />
      ),
    },
  ];
}

function amenitySteps({
  msa,
  place,
  cityPanelCountry,
  housingUsa,
  cityRentUsa,
  placePanelUsa,
  placeHousingUsa,
  placeRentUsa,
  placeFiscalUsa,
  placeDirUsa,
  msaPlaceIds,
  placeNames,
  startYear,
  endYear,
  baseIndex,
}: DriverData): DriverStep[] {
  // The metro's own amenity drift, so the narrative can state the direction
  // rather than asking the reader to find the dot. Same computation as the
  // chart below (buildPoints is the chart's own point constructor).
  const metroDrift =
    buildMetroPoints('amenity_zhvi', cityPanelCountry, housingUsa, cityRentUsa, startYear, endYear)
      .find((p) => p.id === msa.city_id)?.y ?? null;
  return [
    {
      key: 'supply-amenity-msa',
      title: 'Is the metro losing its pull?',
      narrative: (
        <p>
          The residual is our amenity read: the part of housing cost that
          salaries <em>can't</em> explain is the premium people pay just to be
          somewhere. Here is how that premium moved over the window for every
          metro.{' '}
          {metroDrift != null ? (
            <>
              For {msa.city_name} it moved <strong>{fmtPp(metroDrift)}</strong>{' '}
              — {metroDrift < 0
                ? 'people pay less of a premium to be here than they used to. The revealed amenity value is falling.'
                : 'people pay a growing premium to be here — the revealed amenity value is rising.'}
            </>
          ) : (
            <>Where {msa.city_name} lands tells us whether its pull is rising or fading.</>
          )}
        </p>
      ),
      chart: (
        <MigrationChangeScatter
          panel={cityPanelCountry}
          housing={housingUsa}
          rent={cityRentUsa}
          highlightCityId={msa.city_id}
          initialMode="amenity_zhvi"
        />
      ),
    },
    {
      key: 'supply-amenity-explode',
      title: `Is ${place.place_name} tracking the metro's trend?`,
      narrative: (
        <p>
          The metro's drift is not one number underneath — watch the{' '}
          {msa.city_name} dot break apart into its places, each positioned by
          its own residual change <em>net of the metro average</em>.{' '}
          {place.place_name} in red: above the ring means gaining appeal
          relative to its own metro, below means it is the part of the metro
          people are trading away.
        </p>
      ),
      chart: (
        <ActiveExplodeChart
          // Position 2 in this branch: intro (0) → metro drift (1) → this.
          index={baseIndex + 2}
          cityPanel={cityPanelCountry}
          cityHousing={housingUsa}
          cityRent={cityRentUsa}
          placePanel={placePanelUsa}
          placeHousing={placeHousingUsa}
          placeRent={placeRentUsa}
          placeNames={placeNames}
          msaPlaceIds={msaPlaceIds}
          msaId={msa.city_id}
          msaName={msa.city_name}
          highlightPlaceId={place.place_id}
          initialMode="amenity_zhvi"
          directory={placeDirUsa}
        />
      ),
    },
    {
      key: 'supply-amenity-choropleth',
      title: 'Where is the appeal shifting?',
      layout: 'stage',
      narrative: (
        <>
          <p>
            The same residual change on the map: where inside the{' '}
            {msa.city_name} MSA appeal is rising (green) or fading (red), and
            where {place.place_name} ranks in that pattern. The picker also
            holds the residual <em>levels</em> and the rent-based versions of
            both.
          </p>
          <div id="amenity-choropleth-card-tools" className="stage-card-tools" />
        </>
      ),
      chart: (
        <MsaPlacesChoropleth
          msaId={msa.city_id}
          msaName={msa.city_name}
          placeId={place.place_id}
          placeName={place.place_name}
          panel={placePanelUsa}
          housing={placeHousingUsa}
          rent={placeRentUsa}
          fiscal={placeFiscalUsa}
          directory={placeDirUsa}
          msaPlaceIds={msaPlaceIds}
          fill
          toolsPortalId="amenity-choropleth-card-tools"
          initialMetric="amenity_zhvi_delta"
        />
      ),
    },
  ];
}
