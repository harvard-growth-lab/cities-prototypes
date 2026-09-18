/* "Viewing: Boston Admin" / "Viewing: Boston Metro". The scale tag on a
   beat title is readable as city-or-metro before the words are: the admin
   city's building mark in its hue, the metro's dashed edge in its own. */
import { GeoIcon } from '@/components/chrome/icons'
import { useToolState, type Geo } from '@/lib/use-tool-state'
import { cn } from '@/lib/utils'

export interface GeoBadgeProps {
  geo: Geo
  /** boxed = the 1px-bordered control on plain pages; bare = a note hung on the title */
  boxed?: boolean
  className?: string
}

export function GeoBadge({ geo, boxed = false, className }: GeoBadgeProps) {
  const { cityName, metroName, openGeo } = useToolState()
  const city = geo === 'city'
  return (
    <button
      type="button"
      onClick={() => openGeo(geo)}
      title="See this geography on the map"
      className={cn(
        'inline-flex items-center gap-2 text-[13px] font-normal',
        city ? 'text-geo-city' : 'text-geo-metro',
        boxed
          ? cn('rounded-[4px] border bg-white py-[5px] pr-3 pl-2.5', city ? 'border-geo-city hover:bg-teal-tint' : 'border-geo-metro hover:bg-geo-metro-fill')
          : 'hover:underline hover:underline-offset-2',
        className,
      )}
    >
      <GeoIcon geo={geo} className="shrink-0" />
      <span className="text-xs text-ink-soft">Viewing:</span>
      <span className="font-semibold">{city ? `${cityName} Admin` : `${metroName} Metro`}</span>
    </button>
  )
}
