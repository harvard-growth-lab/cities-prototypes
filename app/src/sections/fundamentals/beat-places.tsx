/* Beat 3 — "Explore the admins in your metro": the admin place beside the
   metro and up to two picked places, each measure ranked among the
   metro's places. The picked list is shared with the map. */
import { useMemo, useState } from 'react'
import { Beat } from '@/components/beats/beat'
import { placesOf } from '@/data/derive'
import { useToolState } from '@/lib/use-tool-state'
import { metroColumn, pickerOrder, placeColumn, rankTable, type TableColumn } from './place-metrics'
import { PlacePicker } from './place-picker'
import { PlacesTable } from './places-table'

export interface PlacesBeatProps {
  n: number
  of: number
  picked: string[]
  onPick: (id: string) => void
  onRemove: (id: string) => void
}

export function PlacesBeat({ n, of, picked, onPick, onRemove }: PlacesBeatProps) {
  const { metro, place, cityName, metroName, index } = useToolState()
  const [metroOn, setMetroOn] = useState(true)
  const places = useMemo(() => placesOf(metro), [metro])
  const others = useMemo(() => places.filter((p) => p.id !== place.id).sort(pickerOrder), [places, place.id])
  const ranks = useMemo(() => rankTable(places), [places])
  const columns = useMemo<TableColumn[]>(() => {
    const cols: TableColumn[] = [{ ...placeColumn(place, 'admin'), name: `${cityName} Admin` }]
    if (metroOn) cols.push(metroColumn(metro, `${metroName} Metro`, index.window.end))
    for (const id of picked) {
      const p = places.find((x) => x.id === id)
      if (p) cols.push(placeColumn(p))
    }
    return cols
  }, [place, cityName, metroOn, metro, metroName, index.window.end, picked, places])

  const alone = others.length === 0
  return (
    <Beat
      id="b3"
      section="fundamentals"
      n={n}
      of={of}
      title="Explore the admins in your metro"
      badge="city"
      lede={
        alone ? (
          <>
            {cityName} is the only place the atlas lists inside its metro, so the table sets the admin beside the metro as a whole. Every figure is the
            place’s own, read at the window’s end.
          </>
        ) : (
          <>
            {cityName} is one of many places inside its metro — the map shows them all. The table sets the admin beside the metro as a whole;{' '}
            <b className="font-semibold">add any place from the menu, or click it on the map</b>, and every figure carries its rank among the metro’s
            places.
          </>
        )
      }
    >
      <PlacePicker
        className="mt-5"
        places={others}
        picked={picked}
        onPick={onPick}
        metroName={metroName}
        metroOn={metroOn}
        onMetroChange={setMetroOn}
      />
      <PlacesTable className="mt-4" columns={columns} ranks={ranks} onRemove={(c) => (c.kind === 'metro' ? setMetroOn(false) : onRemove(c.id))} />
      <p className="mt-2 text-xs text-ink-soft">
        Ranks are among the metro’s places that carry the measure
        {places.some((p) => p.class === 'CDP') ? '; census-designated places have no population estimate.' : '.'}
      </p>
    </Beat>
  )
}
