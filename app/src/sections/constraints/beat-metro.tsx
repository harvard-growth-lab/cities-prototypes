/* Beat 1 — "How is the metro performing?": the lede, the diagnostic
   explainer beside it, the all-metros scatter, and the one-line verdict
   that says where the home metro lands. */
import { Beat } from '@/components/beats/beat'
import { fmtRate, fmtSignedPct } from '@/lib/format'
import { QUADRANTS } from '@/lib/quadrants'
import { useToolState } from '@/lib/use-tool-state'
import { DxExplainer } from './dx-explainer'
import { spanLabel } from './frame'
import { LedeRow } from './lede-row'
import { MetroScatter } from './metro-scatter'

export function BeatMetro({ n, of }: { n: number; of: number }) {
  const { index, summary, metroName } = useToolState()
  const q = summary.quadrant ? QUADRANTS[summary.quadrant] : null
  const wageSpan = spanLabel(index.window, summary.wageYears)
  const wageNote = wageSpan !== spanLabel(index.window) ? ` (wages read ${wageSpan})` : ''

  return (
    <Beat id="b1" section="constraints" n={n} of={of} title="How is the metro performing?" badge="metro">
      <LedeRow
        title="Understand the diagnostic hypothesis"
        lede={
          <>
            Plot every metro by how fast its population grew (x) against how fast its wages grew (y). Both rising is a{' '}
            <b className="font-semibold">positive demand shock</b>; both falling, a negative one. Population rising while pay lags points to a{' '}
            <b className="font-semibold">supply shift</b> (amenities, cheaper living); pay rising while population lags, a{' '}
            <b className="font-semibold">constrained supply</b>. Where does {metroName} land?
          </>
        }
      >
        <DxExplainer initial={summary.quadrant} />
      </LedeRow>

      <MetroScatter />

      <p className="mt-4 max-w-[880px] text-note leading-[1.55] text-ink" aria-live="polite">
        {q ? (
          <>
            <b className="font-semibold">{metroName}</b>’s metro {summary.borderline ? 'leans toward' : 'lands in'} the{' '}
            <b className="font-semibold">{q.scatterLabel}</b> quarter ({q.shock}): people <span className="nums">{fmtRate(summary.popCagr)}</span> against a
            typical <span className="nums">{fmtSignedPct(index.medians.popCagr)}</span>, pay <span className="nums">{fmtRate(summary.wageCagr)}</span> against{' '}
            <span className="nums">{fmtSignedPct(index.medians.wageCagr)}</span>
            {wageNote}.{summary.borderline && ' Both readings sit inside the borderline band around the typical city, so the quarter is a lean rather than a verdict.'}
          </>
        ) : (
          <>
            <b className="font-semibold">{metroName}</b>’s metro cannot be placed: people {fmtRate(summary.popCagr)}, pay {fmtRate(summary.wageCagr)}
            {wageNote} — one of the two readings is missing from the atlas.
          </>
        )}
      </p>
    </Beat>
  )
}
