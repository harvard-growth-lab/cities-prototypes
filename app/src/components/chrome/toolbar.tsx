/* The masthead the landing and the tool share: logo, the three links, the
   journey button. Inside the tool it scrolls away with the page (only the
   section bar is sticky). */
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { JourneyIcon } from './icons'

interface ToolbarProps {
  onJourney: () => void
  /** the landing's wider side padding vs the tool's frame */
  variant?: 'landing' | 'tool'
  className?: string
}

const NAV = 'text-sm font-semibold text-ink transition-colors hover:text-teal'

export function Toolbar({ onJourney, variant = 'tool', className }: ToolbarProps) {
  return (
    <header
      className={cn(
        'flex h-[72px] shrink-0 items-center gap-6 border-b border-line bg-white max-narrow:h-[60px] max-sm:h-14',
        variant === 'landing'
          ? 'px-[max(24px,calc((100vw_-_1140px)_/_2))] max-sm:px-4'
          : 'px-frame',
        className,
      )}
    >
      <Link to="/" title="Back to start" className="flex shrink-0 items-center">
        <img src="/assets/gl_logo.png" alt="Growth Lab" className="h-9 w-auto max-narrow:h-[30px] max-sm:h-6" />
      </Link>
      <div className="flex-1" />
      <nav className="flex items-center gap-7 max-narrow:hidden" aria-label="Site">
        <Link to="/" className={cn(NAV, 'text-teal')} aria-current="page">
          City Diagnosis
        </Link>
        <a href="#" className={NAV}>
          About
        </a>
        <a href="#" className={NAV}>
          Glossary
        </a>
      </nav>
      <button
        type="button"
        onClick={onJourney}
        className="inline-flex h-[42px] shrink-0 items-center gap-2.5 rounded-[4px] bg-teal px-5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-teal-dark max-sm:size-[38px] max-sm:justify-center max-sm:px-0"
      >
        <JourneyIcon className="max-sm:size-[18px]" />
        <span className="max-sm:sr-only">My Learning Journey</span>
      </button>
    </header>
  )
}
