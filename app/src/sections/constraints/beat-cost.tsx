/* Beat 3 — "Cost, or the place itself?": the supply-side split. A strip of
   every metro's home-value growth against the typical metro, then the
   amenity residual for metro and admin city, with the method explained. */
import { Beat } from '@/components/beats/beat'
import { Explainer } from '@/components/beats/explainer'
import { fmtInt, fmtRate } from '@/lib/format'
import { QUADRANTS } from '@/lib/quadrants'
import { useToolState } from '@/lib/use-tool-state'
import { AmenityCards } from './amenity-cards'
import { CostGrowthStrip } from './cost-strip'

export function BeatCost({ n, of }: { n: number; of: number }) {
  const { index, summary, national, metroName } = useToolState()
  const supplySide = summary.quadrant ? QUADRANTS[summary.quadrant].constraint === 'supply' : false
  const fitOf = (grain: 'place' | 'metro') => national.amenityFits.find((f) => f.grain === grain && f.fit === 'level')
  const placeFit = fitOf('place')
  const metroFit = fitOf('metro')
  const endYear = index.window.end
  // when the two rates round to the same tenth the split is a hair either way;
  // say so rather than print hundredths the bundle's rounding cannot support
  const close = summary.costCagr !== null && fmtRate(summary.costCagr) === fmtRate(index.medians.costCagr)

  return (
    <Beat
      id="b3"
      section="constraints"
      n={n}
      of={of}
      title="Cost, or the place itself?"
      badge="metro"
      lede={
        <>
          When a metro sits on the supply side of the plane — people arriving faster than pay, or pay rising while people stay away — the next question is
          whether it is the cost of living or what living there is like. The atlas splits supply-side metros on cost-of-living growth against the typical
          metro, and reads “revealed pull” as a residual: how far home prices sit above or below what wages predict.
        </>
      }
    >
      <h3 className="mt-7 text-title font-semibold text-ink">Home-value growth against the typical metro</h3>
      <CostGrowthStrip />
      <p className="mt-2 max-w-[880px] text-note leading-[1.55] text-ink" aria-live="polite">
        {summary.costCagr === null || summary.supplySide === null ? (
          <>No home-value series for this metro, so the atlas cannot say which side of the split it falls on.</>
        ) : (
          <>
            <b className="font-semibold">{metroName}</b>’s home values rose{close ? ' a shade ' : ' '}
            <b className="font-semibold">{summary.supplySide === 'cost' ? 'faster' : 'slower'} than the typical metro’s</b>{' '}
            {close ? (
              <>
                (both about <span className="nums">{fmtRate(index.medians.costCagr)}</span>).
              </>
            ) : (
              <>
                (<span className="nums">{fmtRate(summary.costCagr)}</span> against <span className="nums">{fmtRate(index.medians.costCagr)}</span>).
              </>
            )}{' '}
            {supplySide ? (
              summary.supplySide === 'cost' ? (
                <>On the supply side, that points at the cost of living: the price of being there is what is moving people.</>
              ) : (
                <>On the supply side, that points at the place itself — what living there is like — rather than at its cost.</>
              )
            ) : (
              <>
                {metroName}’s metro reads on the demand side, so this split is context rather than verdict; it would decide between cost and amenities if
                the diagnosis turned on supply.
              </>
            )}
          </>
        )}
      </p>

      <h3 className="mt-9 text-title font-semibold text-ink">Revealed pull: the amenity residual</h3>
      <AmenityCards />

      <Explainer title="How is the amenity residual read?" skin="boxed" className="mt-5">
        <p>
          The atlas regresses the log of home value on the log of wage across every place in the country ({fmtInt(placeFit?.n)} places), with a fixed effect
          for each metro, so a place is judged against the other places in its own metro. The slope comes out at about β ≈ {placeFit?.beta.toFixed(2) ?? '—'} for
          places; the metro-level fit ({fmtInt(metroFit?.n)} metros), run without the fixed effect, is steeper at β ≈ {metroFit?.beta.toFixed(2) ?? '—'}. What the
          wage does not explain — the residual — is read as revealed pull: what people pay to be there for reasons the paycheck does not capture.
        </p>
        <p>
          The level is the end-year cross-section ({endYear}); the change differences two fits, one at each end of the window, so it says whether that
          premium grew or shrank rather than where prices went.
        </p>
        <p>
          It is not an index of amenities. Restaurants, culture and daily needs are counted separately in the atlas; this number only says how far prices
          sit from what wages predict.
        </p>
      </Explainer>
    </Beat>
  )
}
