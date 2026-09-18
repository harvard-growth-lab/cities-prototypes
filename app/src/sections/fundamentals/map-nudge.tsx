/* "Add a place" — the card at the map's foot while the picker is live and
   nothing has been picked yet. */
import { Pointer } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MapNudge({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none flex items-center gap-3 rounded-[8px] border border-line bg-white py-3 pr-4 pl-3.5 text-sm font-semibold text-ink shadow-md', className)} role="status">
      <Pointer className="size-6 text-teal motion-safe:animate-bounce" strokeWidth={1.8} aria-hidden />
      Add a place
    </div>
  )
}
