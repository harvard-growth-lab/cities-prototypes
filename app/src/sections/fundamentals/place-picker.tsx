/* "Add a place" — a menu over the metro's places (the largest first,
   incorporated places before census-designated ones), and the switch for
   the metro's own column. Picking from the map lands in the same list. */
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import type { PlaceRow } from '@/data/types'
import { fmtCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface PlacePickerProps {
  /** every place but the admin one, already in picker order */
  places: PlaceRow[]
  picked: string[]
  onPick: (id: string) => void
  metroName: string
  metroOn: boolean
  onMetroChange: (on: boolean) => void
  className?: string
}

const LABEL = 'text-[13px] font-semibold text-ink'

export function PlacePicker({ places, picked, onPick, metroName, metroOn, onMetroChange, className }: PlacePickerProps) {
  const incorporated = places.filter((p) => p.class === 'incorporated')
  const cdps = places.filter((p) => p.class !== 'incorporated')
  const item = (p: PlaceRow) => (
    <SelectItem key={p.id} value={p.id} disabled={picked.includes(p.id)} className="text-[13.5px]">
      <span className="flex items-baseline gap-2">
        <span>{p.name}</span>
        <span className="nums text-[11.5px] text-ink-soft">{p.population !== null ? fmtCompact(p.population) : p.wage !== null ? `wage ${fmtCompact(p.wage)}` : ''}</span>
      </span>
    </SelectItem>
  )
  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2.5', className)}>
      {places.length > 0 && (
        <label className="flex items-center gap-2.5">
          <span className={LABEL}>Add a place</span>
          <Select value="" onValueChange={(id) => id && onPick(id)}>
            <SelectTrigger size="sm" className="h-[30px] rounded-[4px] border-line-strong bg-white text-[13px] text-ink hover:border-teal data-placeholder:text-ink" aria-label="Add a place to the table">
              <SelectValue placeholder="Choose a place…" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-[min(360px,var(--radix-select-content-available-height))] rounded-[6px]">
              {incorporated.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Incorporated places</SelectLabel>
                  {incorporated.map(item)}
                </SelectGroup>
              )}
              {cdps.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Census-designated places</SelectLabel>
                  {cdps.map(item)}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </label>
      )}
      <Toggle
        variant="outline"
        size="sm"
        pressed={metroOn}
        onPressedChange={onMetroChange}
        aria-label={`Show the ${metroName} metro column`}
        className="h-[30px] rounded-[4px] border-line-strong px-3 text-[12px] font-semibold text-teal hover:bg-teal-tint hover:text-teal data-[state=on]:bg-teal data-[state=on]:text-white"
      >
        Metro
      </Toggle>
    </div>
  )
}
