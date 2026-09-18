/* Every figure is an SVG drawn in a fixed viewBox and scaled by width.
   `useMeasure` is for the few that size their viewBox to the container. */
import { useLayoutEffect, useRef, useState, type ReactNode, type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export interface ChartFrameProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** viewBox units */
  width: number
  height: number
  preserveAspectRatio?: string
  className?: string
  children: ReactNode
}

export function ChartFrame({ width, height, preserveAspectRatio = 'xMidYMid meet', className, style, children, ...rest }: ChartFrameProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      preserveAspectRatio={preserveAspectRatio}
      fontFamily="inherit"
      className={cn('block max-w-full', className)}
      style={{ height: 'auto', ...style }}
      {...rest}
    >
      {children}
    </svg>
  )
}

export interface Size {
  width: number
  height: number
}

/** The element's content box, live (ResizeObserver). */
export function useMeasure<T extends HTMLElement = HTMLDivElement>(): [React.RefObject<T | null>, Size] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}
