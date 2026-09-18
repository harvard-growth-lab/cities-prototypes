/* The header zone of a plain page (design-spec §2.4): the lede on the
   left, a boxed explainer trigger in a 320px column on the right, and —
   open — a full-width peach tray beneath both, because the diagnostic
   grid inside cannot live in a 320px column. The shared <Explainer> keeps
   its content inside its own box, so this composes the Collapsible
   primitive directly with the same trigger anatomy. */
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Lede } from '@/components/beats/beat'
import { BulbIcon } from '@/components/chrome/icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface LedeRowProps {
  lede: ReactNode
  title: ReactNode
  className?: string
  children: ReactNode
}

export function LedeRow({ lede, title, className, children }: LedeRowProps) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('mt-4 mb-3.5 grid w-full max-w-[880px] grid-cols-[minmax(0,1fr)_320px] items-start gap-x-10 max-narrow:grid-cols-1 max-narrow:gap-y-4', className)}
    >
      <Lede className="my-0">{lede}</Lede>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-3 self-start rounded-[4px] border border-[#91aaaf] bg-white px-4 py-3.5 text-left text-base leading-[1.4] font-normal text-ink transition-shadow hover:shadow-[0_2px_10px_rgba(37,88,98,.13)]',
          open && 'self-stretch rounded-b-none',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-teal shadow-[0_1px_3px_rgba(37,88,98,.2)]">
          <BulbIcon />
        </span>
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn('size-[18px] shrink-0 text-teal transition-transform duration-300', open && 'rotate-180')} strokeWidth={2} />
      </CollapsibleTrigger>
      <CollapsibleContent className="col-span-full rounded-[4px_0_4px_4px] bg-orange-tint px-[22px] py-[18px] pl-[58px] text-base leading-[1.6] text-ink max-narrow:rounded-[4px] max-narrow:px-4 [&>p]:max-w-[680px]">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
