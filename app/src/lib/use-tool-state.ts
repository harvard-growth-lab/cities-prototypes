/* What every section reads: the metro, the admin place, the benchmarks, and
   the two dialogs. Provided by the shell route (src/routes/city.$slug.tsx),
   which owns the URL state behind it (`?place`, `?journey`). */
import { useLocation } from '@tanstack/react-router'
import { createContext, useContext } from 'react'
import type { AtlasIndex, Metro, MetroGeo, MetroSummary, National, PlaceRow } from '@/data/types'
import { SECTIONS, sectionBySlug, type Section } from './sections'

export type Geo = 'city' | 'metro'

export interface ToolState {
  index: AtlasIndex
  national: National
  metro: Metro
  summary: MetroSummary
  /** the admin city being read; the metro's principal place unless ?place says otherwise */
  placeId: string
  place: PlaceRow
  /** navigates with ?place (replace) */
  setPlace: (id: string) => void
  /** "Boston" — the admin city */
  cityName: string
  /** "Boston" — the metro's short name */
  metroName: string
  /** "Boston, MA" */
  displayName: string
  /** the metro's polygons; undefined until fetched (prefetched by the loader) */
  geo: MetroGeo | undefined
  openJourney: () => void
  closeJourney: () => void
  /** the "Viewing: …" map dialog */
  openGeo: (geo: Geo) => void
  closeGeo: () => void
}

export const ToolStateContext = createContext<ToolState | null>(null)

export function useToolState(): ToolState {
  const s = useContext(ToolStateContext)
  if (!s) throw new Error('useToolState() must be used inside /city/$slug')
  return s
}

/** The section whose route is showing, read from the pathname (/city/:slug/:section). */
export function useActiveSection(): Section {
  const { pathname } = useLocation()
  const slug = pathname.split('/').filter(Boolean)[2]
  return sectionBySlug(slug ?? '') ?? SECTIONS[0]
}
