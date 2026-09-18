/* The collapsible explainer: a bulb, a question, a chevron. Two skins —
   `line` (a rule above and below, for reading columns) and `boxed` (the
   1px panel on plain pages). */
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { BulbIcon } from '@/components/chrome/icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface ExplainerProps {
  title: ReactNode
  skin?: 'line' | 'boxed'
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}

export function Explainer({ title, skin = 'line', defaultOpen = false, className, children }: ExplainerProps) {
  const [open, setOpen] = useState(defaultOpen)
  const boxed = skin === 'boxed'
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        boxed
          ? 'max-w-[680px] rounded-[4px] border border-[#91aaaf] bg-white transition-shadow hover:shadow-[0_2px_10px_rgba(37,88,98,.13)]'
          : cn('border-y border-line transition-colors hover:bg-teal-tint', open && 'bg-teal-tint'),
        className,
      )}
    >
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-3 text-left text-base leading-[1.4] text-ink',
          boxed ? 'px-4 py-3.5 font-normal' : 'px-3 py-2.5 font-semibold',
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center text-teal',
            boxed && 'size-8 rounded-full bg-white shadow-[0_1px_3px_rgba(37,88,98,.2)]',
          )}
        >
          <BulbIcon />
        </span>
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn('size-[18px] shrink-0 text-teal transition-transform duration-300', open && 'rotate-180')} strokeWidth={2} />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          'text-base leading-[1.6] text-ink [&_p+p]:mt-3',
          boxed ? 'px-4 pb-4 pl-[58px]' : 'px-3 pb-3.5 pl-[43px]',
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
