/* The prototype's segmented control (`.seg` / `.seg-btn`, design-spec
   §2.4) over shadcn's ToggleGroup: 30px buttons, 12px 600 teal, the active
   one filled teal. Local to this section until a shared skin exists. */
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
      <span className="text-[13px] font-semibold text-[#2c2823]">{label}</span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as V)}
        spacing={0}
        aria-label={label}
        className="overflow-hidden rounded-[4px] border border-line-strong bg-white"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className="h-[30px] rounded-none border-l border-line-strong px-3 text-xs font-semibold text-teal first:border-l-0 hover:bg-teal-tint hover:text-teal data-[state=on]:bg-teal data-[state=on]:text-white"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
