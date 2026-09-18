import { useSyncExternalStore } from 'react'

/* Same lines as the CSS breakpoints in src/styles/index.css, in Tailwind's
   max-* form (`max-sm:` is `width < 640px`). Use these when a layout switch
   has to be mirrored in JS — stage geometry, an observer's root margin. */
export const MQ = {
  phone: '(width < 640px)',
  narrow: '(width < 920px)',
  touch: '(hover: none)',
} as const

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
export const useIsNarrow = () => useMediaQuery(MQ.narrow)
export const useIsPhone = () => useMediaQuery(MQ.phone)
