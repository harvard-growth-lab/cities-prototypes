import { useMemo, useState, type ComponentProps } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useCityDirectory,
  useCityPanel,
  useCityComplexity,
  useHousing,
  useCityRent,
  usePlaceDirectory,
  usePlacePanel,
  usePlaceHousing,
  usePlaceRent,
  usePlaceFiscal,
  useMsaIndustry,
  useNationalIndustry,
  useIndustryAttributes,
} from '../data/usePanel';
import type { CityIndustryRow } from '../data/types';
import StoryScroller from '../components/story/StoryScroller';
import Section from '../components/story/Section';
import StoryMap from '../components/story/StoryMap';
import StatCardRow from '../components/story/StatCardRow';
import { useStory } from '../components/story/useStory';
import { buildPlaceCards, buildMsaCards } from '../lib/storyStats';
import { classifyMsa, classifySupply, type ConstraintType, type SupplySide } from '../lib/diagnosis';
import SectorEmploymentTreemap from '../components/charts/SectorEmploymentTreemap';
import MigrationChangeScatter from '../components/charts/MigrationChangeScatter';
import PlaceExplodeScatter from '../components/charts/PlaceExplodeScatter';
import { buildDriverSteps, DriverTree, type DriverData } from '../components/story/DriversSection';
import YearRangeSelector from '../components/YearRangeSelector';
import { computeShiftShare, snapYear } from '../lib/shiftShare';
import { useYearRange } from '../lib/yearRange';
import { parsePlaceSlug, citySlug } from '../lib/slug';
import type { ReactNode } from 'react';
import { useProto } from '../../proto/settings';
import { QuizGate, QuizCardSlot } from '../../shared/QuizBits';
import { QuizRecap } from '../../shared/QuizRecap';
import { quizForStage } from '../../content/quizzes';
import { DragDotQuizCard, TreeWalkQuizCard } from '../../proto/InstrumentCards';

// Quiz stage for each driver step on the default supply→amenity walk (see
// content/quizzes.ts stages 6–9; stage 6 is the walk-the-tree instrument on
// the housing-test step). Steps not listed render ungated.
const DRIVER_QUIZ_STAGE: Record<string, number> = {
  'supply-scatter': 6,
  'supply-amenity-msa': 7,
  'supply-amenity-explode': 8,
  'supply-amenity-choropleth': 9,
};

// The scroll-driven "city diagnosis". Six full-screen sections that argue from
// "how is my city doing" (population as the vote-with-your-feet signal) out to a
// labor-demand/supply diagnosis of its MSA. Reuses the existing maps, scatters,
// treemaps and shift-share components inside the story shell. The place-
// resolution plumbing mirrors the (snapshot) PlaceProfile.

export default function CityStory() {
  const { country = 'usa', placeSlug = '' } = useParams();
  const places = usePlaceDirectory();
  const placePanel = usePlacePanel();
  const placeHousing = usePlaceHousing();
  const placeRent = usePlaceRent();
  const placeFiscal = usePlaceFiscal();
  const cityDirectory = useCityDirectory();
  const cityPanel = useCityPanel();
  const cityComplexity = useCityComplexity();
  const housing = useHousing();
  const cityRent = useCityRent();

  const parsed = useMemo(() => parsePlaceSlug(placeSlug), [placeSlug]);

  const place = useMemo(() => {
    if (!parsed || !places.data || !placePanel.data) return null;
    const candidates = places.data.filter(
      (p) =>
        p.country === country &&
        p.state === parsed.state &&
        citySlug(p.place_name) === parsed.name,
    );
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const popByPlace = new Map<string, number>();
    const latestYear = Math.max(...placePanel.data.map((r) => r.year));
    for (const r of placePanel.data) {
      if (r.year === latestYear) popByPlace.set(r.place_id, r.population ?? 0);
    }
    candidates.sort((a, b) => {
      if (a.class !== b.class) return a.class === 'incorporated' ? -1 : 1;
      return (popByPlace.get(b.place_id) ?? 0) - (popByPlace.get(a.place_id) ?? 0);
    });
    return candidates[0];
  }, [places.data, placePanel.data, parsed, country]);

  const msa = useMemo(() => {
    if (!place || !cityDirectory.data) return null;
    return cityDirectory.data.find((c) => c.country === country && c.city_id === place.msa_id) ?? null;
  }, [cityDirectory.data, place, country]);

  const placePanelUsa = useMemo(
    () => (placePanel.data ?? []).filter((r) => r.country === country),
    [placePanel.data, country],
  );
  const placeHousingUsa = useMemo(
    () => (placeHousing.data ?? []).filter((r) => r.country === country),
    [placeHousing.data, country],
  );
  const placeRentUsa = useMemo(
    () => (placeRent.data ?? []).filter((r) => r.country === country),
    [placeRent.data, country],
  );
  const placeFiscalUsa = useMemo(
    () => (placeFiscal.data ?? []).filter((r) => r.country === country),
    [placeFiscal.data, country],
  );
  const placeDirUsa = useMemo(
    () => (places.data ?? []).filter((r) => r.country === country),
    [places.data, country],
  );
  const cityRentUsa = useMemo(
    () => (cityRent.data ?? []).filter((r) => r.country === country),
    [cityRent.data, country],
  );
  const housingUsa = useMemo(
    () => (housing.data ?? []).filter((r) => r.country === country),
    [housing.data, country],
  );
  const placeNames = useMemo(() => {
    const map = new Map<string, string>();
    if (places.data) {
      for (const p of places.data) map.set(p.place_id, `${p.place_name}, ${p.state}`);
    }
    return map;
  }, [places.data]);

  const msaPlaceIds = useMemo(() => {
    if (!places.data || !place) return [] as string[];
    return places.data
      .filter((p) => p.country === country && p.msa_id === place.msa_id)
      .map((p) => p.place_id);
  }, [places.data, country, place]);

  const cityPanelCountry = useMemo(
    () => (cityPanel.data ?? []).filter((r) => r.country === country),
    [cityPanel.data, country],
  );
  const cityComplexityCountry = useMemo(
    () => (cityComplexity.data ?? []).filter((r) => r.country === country),
    [cityComplexity.data, country],
  );

  const msaIndustry = useMsaIndustry(place?.msa_id ?? '');
  const nationalIndustry = useNationalIndustry();
  const industryAttributes = useIndustryAttributes();

  const { startYear, endYear } = useYearRange();

  // Prototype layer: every section's data sits behind a prior-check quiz.
  // Two stages are hands-on instruments graded like a quiz — their cards
  // compose the widget (drag-the-dot, walk-the-tree) into the same chrome.
  const { on } = useProto();
  const quizzesOn = on('quizzes');
  const gate = (stage: number, node: ReactNode): ReactNode => {
    if (!quizzesOn) return node;
    const quiz = quizForStage(stage);
    const card =
      quiz?.kind === 'instrument' ? (
        quiz.id === 'place-the-metro' ? <DragDotQuizCard quiz={quiz} /> : <TreeWalkQuizCard quiz={quiz} />
      ) : undefined;
    return <QuizGate quiz={quiz} card={card}>{node}</QuizGate>;
  };

  // Driver branch (section 5). Defaults to following the diagnosis; the toggle
  // sets an explicit override. null = follow the diagnosis as it loads/changes.
  const [viewOverride, setViewOverride] = useState<ConstraintType | null>(null);
  // Second bifurcation inside the supply branch (housing wall vs. amenities),
  // same override semantics.
  const [supplyOverride, setSupplyOverride] = useState<SupplySide | null>(null);

  const shiftShare = useMemo(() => {
    if (!msaIndustry.data || !nationalIndustry.data) return null;
    const t0 = snapYear(msaIndustry.data, startYear);
    const t1 = snapYear(msaIndustry.data, endYear);
    if (t0 == null || t1 == null || t0 === t1) return null;
    return computeShiftShare(msaIndustry.data, nationalIndustry.data, t0, t1);
  }, [msaIndustry.data, nationalIndustry.data, startYear, endYear]);

  const industryRowsForTreemap = useMemo<CityIndustryRow[]>(() => {
    if (!msaIndustry.data || !industryAttributes.data || !place) return [];
    const attrsByNaics = new Map(industryAttributes.data.map((a) => [a.naics4, a]));
    return msaIndustry.data.map((r) => {
      const a = attrsByNaics.get(r.naics4);
      return {
        country: r.country,
        city_id: place.msa_id,
        year: r.year,
        naics4: r.naics4,
        industry: a?.industry ?? null,
        sector_2d: a?.sector_2d ?? null,
        employment: r.employment,
        pci: a?.pci ?? null,
      };
    });
  }, [msaIndustry.data, industryAttributes.data, place]);

  const placeCards = useMemo(
    () => (place ? buildPlaceCards(place.place_id, msaPlaceIds, placePanelUsa, placeHousingUsa, startYear, endYear) : []),
    [place, msaPlaceIds, placePanelUsa, placeHousingUsa, startYear, endYear],
  );
  const msaCards = useMemo(
    () => (msa ? buildMsaCards(msa.city_id, cityPanelCountry, housingUsa, startYear, endYear) : []),
    [msa, cityPanelCountry, housingUsa, startYear, endYear],
  );
  const diagnosis = useMemo(
    () => (msa ? classifyMsa(cityPanelCountry, msa.city_id, startYear, endYear) : null),
    [msa, cityPanelCountry, startYear, endYear],
  );
  const supplyDiagnosis = useMemo(
    () => (msa ? classifySupply(housingUsa, msa.city_id, startYear, endYear) : null),
    [msa, housingUsa, startYear, endYear],
  );

  const eci = useMemo(() => {
    if (!msa) return null;
    const mine = cityComplexityCountry.filter((r) => r.city_id === msa.city_id && r.eci != null);
    if (mine.length === 0) return null;
    const latest = mine.reduce((a, b) => (b.year > a.year ? b : a));
    return { value: latest.eci as number, year: latest.year };
  }, [cityComplexityCountry, msa]);

  if (places.loading || placePanel.loading || cityDirectory.loading) {
    return <p className="loading">Loading…</p>;
  }
  if (!parsed) {
    return (
      <article>
        <p className="error">Unrecognised place "{placeSlug}".</p>
        <p className="muted">Use format <code>name-state</code>, e.g. <code>boston-ma</code>.</p>
      </article>
    );
  }
  if (!place || !msa) {
    return (
      <article>
        <p className="error">No place matches "{placeSlug}" in {parsed?.state}.</p>
      </article>
    );
  }

  const classLabel = place.lsad === '25' ? 'city' :
                     place.lsad === '43' ? 'town' :
                     place.lsad === '47' ? 'village' :
                     place.lsad === '21' ? 'borough' :
                     place.class === 'CDP' ? 'CDP' :
                     'place';

  // Section 5 expands into one step per driver chart. Indices are assigned
  // sequentially so the levers section lands right after, however many driver
  // steps the active branch produces.
  const driverView: ConstraintType = viewOverride ?? diagnosis?.constraintType ?? 'demand';
  const supplySide: SupplySide = supplyOverride ?? supplyDiagnosis?.side ?? 'housing';
  const DRIVERS_BASE = 5;
  const driverData: DriverData = {
    msa,
    place,
    shiftShare,
    industryAttributes: industryAttributes.data ?? null,
    cityPanelCountry,
    housingUsa,
    cityRentUsa,
    placeDirUsa,
    placePanelUsa,
    placeHousingUsa,
    placeRentUsa,
    placeFiscalUsa,
    msaPlaceIds,
    placeNames,
    startYear,
    endYear,
    baseIndex: DRIVERS_BASE,
    supplyDiagnosis,
    supplySide,
  };
  const driverSteps = buildDriverSteps(driverView, driverData);
  const leversIndex = DRIVERS_BASE + driverSteps.length;

  return (
    <StoryScroller chrome={<YearRangeSelector />} resetKey={place.place_id}>
      {/* Persistent zoom-out map behind the two lead sections. */}
      <MapBackdrop placeId={place.place_id} msaId={msa.city_id} />

      {/* 1 — How well is my city doing? */}
      <Section
        index={0}
        variant="panel"
        eyebrow={`${country.toUpperCase()} · ${place.state_name}`}
        title={place.place_name}
        narrative={
          <p>
            How well is a city doing? The clearest signal is whether people are
            arriving or leaving. Within a country, moving is relatively
            frictionless — so population change is residents{' '}
            <strong>voting with their feet</strong> on whether {place.place_name}{' '}
            is a good place to live and work.
          </p>
        }
      >
        <p className="story-sub muted">
          {place.place_long_name} ({classLabel}) ·{' '}
          part of the{' '}
          <Link to={`/${country}/${msaSlugFor(msa.city_name)}`}>{msa.city_name} MSA</Link>
        </p>
        <p className="story-sub">
          <a className="concept-link" href="#/concepts">
            New to the framework? Eight two-minute concepts →
          </a>
        </p>
        {gate(1, <StatCardRow cards={placeCards} rankLabel="in MSA" />)}
      </Section>

      {/* 2 — Your city is not an island */}
      <Section
        index={1}
        variant="panel"
        eyebrow="The labor market"
        title="Your city is not an island"
        narrative={
          <p>
            The administrative city is one piece of a larger machine. People
            commute, firms hire, and housing supply responds across a region far
            wider than the city line — the <strong>labor market</strong>. We
            approximate it with the Metropolitan Statistical Area. {place.place_name}{' '}
            sits inside the {msa.city_name} MSA, and most of what follows is read
            at that scale.
          </p>
        }
      >
        {gate(2, <StatCardRow cards={msaCards} rankLabel="of US metros" />)}
      </Section>

      {/* 3 — Your exports matter */}
      <Section
        index={2}
        eyebrow="Why size happens"
        title="Your exports matter"
        narrative={
          <p>
            A city's size tracks the size of its <strong>export sector</strong> —
            what it sells to people outside the region. No city makes everything
            it consumes (the beef, the chips, the software), so to buy from
            outside it has to sell outside. The export base is what a metro can
            ultimately support. Below is the {msa.city_name} MSA's industrial
            composition — every industry sized by employment and shaded by its
            economic complexity.
          </p>
        }
      >
        {eci && (
          <div className="story-inline-stat">
            <span className="stat-card-label">Economic Complexity Index ({eci.year})</span>
            <span className="stat-card-value">{eci.value.toFixed(2)}</span>
            <span className="stat-card-note">
              How much productive know-how the metro's industry mix embodies.
            </span>
          </div>
        )}
        {msaIndustry.loading && <p className="loading">Loading industry data…</p>}
        {msaIndustry.error && <p className="error">{msaIndustry.error.message}</p>}
        {gate(
          3,
          industryRowsForTreemap.length > 0 ? (
            <SectorEmploymentTreemap
              rows={industryRowsForTreemap}
              cityId={msa.city_id}
              country={country}
              sourceLabel="BLS QCEW (NAICS-2022), ML-imputed county panel by J. Canas, summed to MSA via OMB crosswalk"
            />
          ) : null,
        )}
      </Section>

      {/* 4 — How is the metro performing? (the metro on the plane + a first
          diagnostic read) */}
      <Section
        index={3}
        eyebrow="Performance"
        title="How is the metro performing?"
        narrative={
          <p>
            Plot every metro by how fast its population grew (x) against how fast
            its wages grew (y). Both rising is a <strong>positive demand
            shock</strong>; both falling, a negative one. Population rising while
            pay lags points to a <strong>supply shift</strong> (amenities, cheaper
            living); pay rising while population lags, a <strong>constrained
            supply</strong>. Where does {msa.city_name} land?
          </p>
        }
      >
        {gate(4, <>
        {diagnosis && (
          <div className={`diagnosis-callout is-${diagnosis.constraintType}${diagnosis.borderline ? ' is-borderline' : ''}`}>
            <span className="eyebrow">Diagnostic hypothesis · {msa.city_name} MSA</span>
            <h4 className="diagnosis-title">{diagnosis.title}</h4>
            <p className="diagnosis-blurb">{diagnosis.blurb}</p>
            <p className="diagnosis-figures muted">
              Population {fmtSigned(diagnosis.popCagr)}/yr (median {fmtSigned(diagnosis.popMedian)}) ·
              wages {fmtSigned(diagnosis.wageCagr)}/yr (median {fmtSigned(diagnosis.wageMedian)})
            </p>
          </div>
        )}
        <div className="chart-block">
          <h4>Every US metro: population growth × wage growth</h4>
          {housing.data && (
            <MigrationChangeScatter
              panel={cityPanelCountry}
              housing={housingUsa}
              rent={cityRentUsa}
              highlightCityId={msa.city_id}
              quadrants
            />
          )}
        </div>
        </>)}
      </Section>

      {/* 5 — Place vs. its metro. Opens on the metro scatter from the previous
          section, then the MSA dot explodes into its constituent places. */}
      <Section
        index={4}
        eyebrow="Participation"
        title={`Is ${place.place_name} pulling with the metro?`}
        narrative={
          <p>
            The {msa.city_name} dot is not one economy — watch it break apart
            into the <strong>places inside the MSA</strong>, with{' '}
            {place.place_name} highlighted. The dashed lines stay put: they are
            still the medians across US metros, so each place now reads against
            two benchmarks — its own metro (the dashed ring) and the typical
            metro (the dashed lines).
          </p>
        }
      >
        {gate(
          5,
          <div className="chart-block">
            <ExplodeScatterStep
              index={4}
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
              directory={placeDirUsa}
            />
          </div>,
        )}
      </Section>

      {/* 6 — What's driving the change? One screen per driver chart; the first
          step carries the demand/supply toggle. */}
      {driverSteps.map((step, i) => {
        const quizStage = DRIVER_QUIZ_STAGE[step.key] ?? 0;
        // Stage steps (the full-bleed maps) mirror the two lead map sections:
        // the quiz lives INSIDE the narrative card and the gate blurs only the
        // map behind it — no separate floating quiz card.
        const stageQuiz = step.layout === 'stage' && quizzesOn ? quizForStage(quizStage) : undefined;
        return (
          <Section
            key={step.key}
            index={DRIVERS_BASE + i}
            variant={step.layout === 'stage' ? 'stage' : 'full'}
            eyebrow={`Drivers · ${driverView === 'demand' ? 'industry' : supplySide === 'amenity' ? 'amenities' : 'housing'}`}
            title={step.title}
            narrative={
              stageQuiz ? (
                <>
                  {step.narrative}
                  <QuizCardSlot quiz={stageQuiz} />
                </>
              ) : (
                step.narrative
              )
            }
          >
            {/* Stage steps fill the screen — the chart provides its own framing,
                so skip the centered chart-block wrapper. Each step on the default
                diagnostic walk carries its own prior-check quiz (keyed by step
                key); off-path steps simply render ungated. The DriverTree rides
                INSIDE the first step's gate — it dots the branches the
                diagnostics point to, which would spoil the walk-the-tree quiz. */}
            {step.layout === 'stage' ? (
              stageQuiz ? (
                <QuizGate quiz={stageQuiz} hideCard>
                  {step.chart}
                </QuizGate>
              ) : (
                step.chart
              )
            ) : (
              gate(
                quizStage,
                <>
                  {i === 0 && (
                    <DriverTree
                      msaName={msa.city_name}
                      view={driverView}
                      supplySide={supplySide}
                      diagnosis={diagnosis}
                      supplyDiagnosis={supplyDiagnosis}
                      onViewChange={setViewOverride}
                      onSupplySideChange={setSupplyOverride}
                    />
                  )}
                  <div className="chart-block">{step.chart}</div>
                </>,
              )
            )}
          </Section>
        );
      })}

      {/* 7 — Levers for change (synthesis) */}
      <Section
        index={leversIndex}
        eyebrow="Synthesis"
        title="Levers for change"
        narrative={
          <p>
            Pulling the diagnosis together: {msa.city_name} reads as a{' '}
            <strong>{diagnosis ? diagnosis.title.toLowerCase() : 'mixed signal'}</strong>,
            and {place.place_name} is positioned {place.place_name === msa.city_name ? 'at its core' : 'within it'}.
            That diagnosis points to where the leverage lives — and to which
            levers belong to the city versus the wider metro.
          </p>
        }
      >
        {gate(10, <div className="levers-stub">
          <p>
            Three families of lever follow from the diagnosis, weighted toward
            whichever side — demand or supply — is the binding constraint:
          </p>
          <ul>
            <li>
              <strong>Export-sector support</strong> — deepen the tradable base
              that sets the ceiling on how large the metro can grow.
            </li>
            <li>
              <strong>Housing supply</strong> — let construction respond to
              demand, so growth shows up as people rather than only as prices.
            </li>
            <li>
              <strong>Amenity investment</strong> — the quality-of-life pull
              that draws residents independent of wages.
            </li>
          </ul>
          <p className="muted">
            Which of these moves the needle depends on the constraint above:
            a demand-constrained metro leans on the first, a supply-constrained
            one on the second and third.
          </p>
        </div>)}
      </Section>

      {/* Prototype · scorecard */}
      {quizzesOn && (
        <Section
          index={leversIndex + 1}
          eyebrow="Recap"
          title="Your intuitions vs the data"
          narrative={<p>Every checkpoint you met on the way down, replayed against the numbers.</p>}
        >
          <QuizRecap />
        </Section>
      )}
    </StoryScroller>
  );
}

// Reads the active section index from the story and drives the shared map's
// zoom (place → MSA) + visibility. Lives inside <StoryScroller> so it can use
// the story context.
function MapBackdrop({ placeId, msaId }: { placeId: string; msaId: string }) {
  const { activeIndex } = useStory();
  return <StoryMap placeId={placeId} msaId={msaId} zoom={activeIndex >= 1 ? 'msa' : 'place'} dim={activeIndex >= 2} />;
}

// Feeds the explode scatter its activation signal: the MSA-dot → places burst
// plays each time its section becomes the active one. Lives inside
// <StoryScroller> so it can read the story context.
function ExplodeScatterStep({
  index,
  ...props
}: { index: number } & Omit<ComponentProps<typeof PlaceExplodeScatter>, 'active'>) {
  const { activeIndex } = useStory();
  return <PlaceExplodeScatter {...props} active={activeIndex === index} />;
}

function fmtSigned(x: number): string {
  return `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
}

function msaSlugFor(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
