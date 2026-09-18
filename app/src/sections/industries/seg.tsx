/* The figure's segmented controls (`.seg` in the prototype) over the
   shadcn ToggleGroup: a label, then joined 30px buttons in teal, the active
   one filled. Single-select, never empty. */
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export interface SegOption<V extends string> {
  value: V
  label: string
}

export interface SegProps<V extends string> {
  label: string
  value: V
  options: SegOption<V>[]
  onChange: (v: V) => void
  className?: string
}

export function Seg<V extends string>({ label, value, options, onChange, className }: SegProps<V>) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as V)
        }}
        aria-label={label}
        spacing={0}
        className="overflow-hidden rounded-[4px] border border-line-strong bg-white"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className="h-[30px] rounded-none border-l border-line-strong px-3 text-xs font-semibold text-teal first:border-l-0 hover:bg-teal-tint hover:text-teal data-[state=on]:bg-teal data-[state=on]:text-white max-narrow:h-7 max-narrow:px-2.5 max-narrow:text-[11.5px]"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
