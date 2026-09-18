/* Where the metro's ideas concentrate: the patent sections and publication
   fields it does an unusual amount of, as RCA (1× = the national mix).
   Rows under the atlas's count floor stay in the list, greyed. */
import { useMemo } from 'react'
import type { Metro, National } from '@/data/types'
import { fmtMult } from '@/lib/format'
import { CHROME, RANK_MUTED } from '@/lib/palette'
import { cn } from '@/lib/utils'

/* IPC section titles, for the patent list (the atlas ships terser labels). */
const IPC_SECTION: Record<string, string> = {
  A: 'Human necessities',
  B: 'Performing operations; transporting',
  C: 'Chemistry; metallurgy',
  D: 'Textiles; paper',
  E: 'Fixed constructions',
  F: 'Mechanical engineering; lighting; heating; weapons; blasting',
  G: 'Physics',
  H: 'Electricity',
}

const TOP = 5

interface Row {
  key: string
  label: string
  rca: number
  aboveFloor: boolean
}

function RcaList({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.rca))
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {rows.length ? (
        <ol className="mt-2 flex flex-col gap-1.5" aria-label={title}>
          {rows.map((r) => (
            <li key={r.key} className={cn('grid grid-cols-[minmax(0,1fr)_52px] items-center gap-x-3 text-[13px]', !r.aboveFloor && 'opacity-55')}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-ink" title={r.aboveFloor ? r.label : `${r.label} — below the count floor`}>
                  {r.label}
                </span>
                <span className="mt-0.5 h-[5px] w-full overflow-hidden rounded-[2px] bg-[#e6eaec]" aria-hidden>
                  <span
                    className="block h-full rounded-[2px]"
                    style={{ width: `${(r.rca / max) * 100}%`, background: r.rca >= 1 ? CHROME.teal : RANK_MUTED }}
                  />
                </span>
              </span>
              <span className="nums text-right font-semibold text-ink">{fmtMult(r.rca)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">{empty}</p>
      )}
    </div>
  )
}

const topRows = (rows: Row[]) => [...rows].sort((a, b) => Number(b.aboveFloor) - Number(a.aboveFloor) || b.rca - a.rca).slice(0, TOP)

export function InnovationLists({ metro, national }: { metro: Metro; national: National }) {
  const patents = useMemo(
    () =>
      topRows(
        metro.patentRca
          .filter((r) => r.level === 'section')
          .map((r) => ({ key: r.key, label: `${r.key} · ${IPC_SECTION[r.key] ?? national.patentLabels[r.key] ?? r.key}`, rca: r.rca, aboveFloor: r.aboveFloor })),
      ),
    [metro, national],
  )
  const pubs = useMemo(
    () =>
      topRows(
        metro.publicationRca
          .filter((r) => r.level === 'broad_field')
          .map((r) => ({ key: r.key, label: national.publicationLabels[r.key] ?? r.key, rca: r.rca, aboveFloor: r.aboveFloor })),
      ),
    [metro, national],
  )
  const anyBelow = [...patents, ...pubs].some((r) => !r.aboveFloor)

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 max-sm:grid-cols-1">
        <RcaList title="Patent strengths · IPC sections, 2020–2024" rows={patents} empty="No patent sections for this metro." />
        <RcaList title="Publication strengths · broad fields, 2020–2024" rows={pubs} empty="No publication fields for this metro." />
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        RCA = the section’s share of the metro’s patents (or a field’s share of its publications) ÷ its share nationally. 1× is the national mix; teal bars are above it.
        {anyBelow && ' Greyed rows are under the atlas’s count floor (10 patents) — small numbers, read loosely.'}
      </p>
    </div>
  )
}
