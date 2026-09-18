/* When the admin place has no LODES rows (29 directory places; data-spec
   §6.5), the section says so plainly and still shows the one figure the
   metro's own rows can draw: its places ranked by jobs per resident worker. */
import { useState } from 'react'
import { Beat } from '@/components/beats/beat'
import { Checkpoint } from '@/components/beats/checkpoint'
import { useToolState } from '@/lib/use-tool-state'
import type { PlaceRatio } from './commute'
import { PlacesRatioChart } from './places-ratio-chart'
import { rankingQuestions } from './questions'

export function NoCommuteSection({ places }: { places: PlaceRatio[] }) {
  const { placeId, cityName, metroName } = useToolState()
  const [selected, setSelected] = useState(placeId)
  return (
    <>
      <Beat
        id="b1"
        section="admin"
        n={1}
        of={1}
        title="One city, two workforces"
        badge="city"
        lede={
          <>
            Two counts sit behind every city: the jobs inside the boundary, whoever fills them, and the jobs its residents hold, wherever those jobs are. The atlas has no commuting rows for {cityName}, so this section cannot read the two for it.
          </>
        }
        className="mb-10"
      >
        <p className="mt-1 mb-6 text-note font-semibold text-ink-soft">No commuting data for {cityName}.</p>
        <div className="max-w-[880px] rounded-[10px] border border-line bg-white p-5 max-sm:p-3">
          <p className="mb-1.5 text-xs font-semibold text-ink-soft">
            Jobs here per resident worker · {places.length === 1 ? 'the one place' : `${places.length} places`} in the {metroName} metro
          </p>
          <PlacesRatioChart places={places} cityId={placeId} selectedId={selected} onSelect={setSelected} maxHeight={520} />
        </div>
      </Beat>
      <Checkpoint
        section="admin"
        questions={rankingQuestions(places, metroName)}
        applyPrompt="Which part of your city’s workforce surprised you, and what does it suggest about who the city’s jobs are for?"
        applyPlaceholder="The commuter share suggests…"
      />
    </>
  )
}
