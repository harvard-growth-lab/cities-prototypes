/* The location control (`.citypick` in the prototype): a dropdown button
   that opens a searchable list of every metro in the atlas, each with its
   population verdict on the right. `lg` is the landing's full-width field;
   `bar` is the compact chip in the section bar. */
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { MetroSummary } from '@/data/types'
import { useIndex } from '@/data/queries'
import { fmtRate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BuildingIcon } from './icons'

export interface MetroPickerProps {
  value: string
  onChange: (metro: MetroSummary) => void
  size?: 'lg' | 'bar'
  className?: string
}

function Rate({ v }: { v: number | null }) {
  if (v === null) return <span className="text-xs text-ink-soft">no data</span>
  return (
    <span className={cn('nums text-[12.5px] font-bold whitespace-nowrap', v >= 0 ? 'text-rise' : 'text-fall')}>
      {v >= 0 ? '▲' : '▼'} {fmtRate(v)}
    </span>
  )
}

export function MetroPicker({ value, onChange, size = 'lg', className }: MetroPickerProps) {
  const index = useIndex()
  const [open, setOpen] = useState(false)
  const current = index.metros.find((m) => m.id === value)
  const bar = size === 'bar'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Select a location"
          className={cn(
            'flex items-center gap-2.5 rounded-[4px] border border-line-strong bg-white text-left font-semibold text-ink transition-[border-color,box-shadow] duration-150',
            'hover:border-teal focus-visible:border-teal focus-visible:shadow-[0_0_0_3px_rgba(37,88,98,.12)] focus-visible:outline-none aria-expanded:border-teal aria-expanded:shadow-[0_0_0_3px_rgba(37,88,98,.10)]',
            bar
              ? 'h-[38px] w-[300px] pr-3 pl-3 text-[13.5px] max-[1200px]:w-[184px] max-sm:h-[30px] max-sm:w-[158px]'
              : 'h-[42px] w-full pr-3 pl-3.5 text-[14.5px]',
            className,
          )}
        >
          {bar && <BuildingIcon width={14} height={17} className="shrink-0 text-ink" />}
          <span className="min-w-0 flex-1 truncate">
            {current ? (
              <>
                {current.name}
                <span className={cn('font-semibold text-ink', bar && 'max-[1200px]:hidden')}>, {current.state}</span>
              </>
            ) : (
              'Select a metro'
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-teal" strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[320px] rounded-md border border-line-strong p-[5px] shadow-md ring-0">
        <Command loop filter={(value, search, keywords) => ((value + ' ' + (keywords ?? []).join(' ')).toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search metros…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No metro matches.</CommandEmpty>
            {index.metros.map((m) => (
              <CommandItem
                key={m.id}
                value={m.displayName}
                keywords={[m.name, m.state, m.principalPlaceName]}
                data-checked={m.id === value}
                onSelect={() => {
                  setOpen(false)
                  if (m.id !== value) onChange(m)
                }}
                className="cursor-pointer rounded-[4px] px-2.5 py-2 data-selected:bg-teal-tint data-[checked=true]:bg-teal-tint [&>svg:last-child]:hidden"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.displayName}</span>
                <Rate v={m.popCagr} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
