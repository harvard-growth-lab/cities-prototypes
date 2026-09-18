/* The prototype's line icons, as components. Everything takes currentColor
   so the geography tokens (text-geo-city / text-geo-metro) colour them. */
import type { SVGProps } from 'react'
import type { QuadrantCopy } from '@/lib/quadrants'

type P = SVGProps<SVGSVGElement>

/** The admin city: a row of buildings. */
export const BuildingIcon = ({ width = 15, height = 19, ...p }: P) => (
  <svg viewBox="0 0 24 30" width={width} height={height} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M2 26h20" />
    <path d="M4 26V15h6v11" />
    <path d="M12 26V8h7v18" />
    <path d="M14.6 12h1.8M14.6 16h1.8M14.6 20h1.8" />
  </svg>
)

/** The metro: buildings inside a dashed edge. Always paired with the metro hue. */
export const MetroIcon = ({ width = 24, height = 17, ...p }: P) => (
  <svg viewBox="0 0 30 22" width={width} height={height} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <ellipse cx="15" cy="11" rx="13" ry="8.6" strokeDasharray="2.6 3" />
    <path d="M10.5 15.5h9" />
    <path d="M12.2 15.5V10h3v5.5" />
    <path d="M16.6 15.5V7h3v8.5" />
  </svg>
)

export const GeoIcon = ({ geo, ...p }: P & { geo: 'city' | 'metro' }) =>
  geo === 'city' ? <BuildingIcon {...p} /> : <MetroIcon {...p} />

export const JourneyIcon = ({ width = 19, height = 19, ...p }: P) => (
  <svg viewBox="0 0 83 83.01" width={width} height={height} fill="currentColor" aria-hidden {...p}>
    <path d="M82.92,7.06s-.01-.05-.02-.07c-.05-.13-.12-.26-.2-.37-.02-.02-.03-.04-.05-.06-.09-.11-.2-.21-.32-.3-.01,0-.01-.01-.02-.01-.12-.08-.26-.14-.41-.18-.01,0-.02-.01-.04-.02L57.86.04c-.24-.06-.49-.06-.73,0l-24,6c-.67.17-1.14.77-1.14,1.46s.47,1.29,1.14,1.46l9.86,2.47v14.07c0,.22.14.42.36.48l14,4s.09.02.14.02.09-.01.14-.02l14-4c.21-.06.36-.26.36-.48v-14.08l8-2v10.08c0,.83.67,1.5,1.5,1.5s1.5-.67,1.5-1.5V7.5c.01-.16-.02-.31-.07-.45h0ZM57.5,11.95l-17.82-4.45,17.82-4.45,17.82,4.45-17.82,4.45ZM68.5,42.01h-35.71c-.66-2.3-2.77-4-5.29-4s-4.63,1.7-5.29,4h-7.71c-6.34,0-11.5-5.16-11.5-11.5s5.16-11.5,11.5-11.5h21c.83,0,1.5-.67,1.5-1.5s-.67-1.5-1.5-1.5H14.5C6.5,16.01,0,22.51,0,30.51s6.5,14.5,14.5,14.5h7.71c.66,2.3,2.77,4,5.29,4s4.63-1.7,5.29-4h35.71c6.34,0,11.5,5.16,11.5,11.5s-5.16,11.5-11.5,11.5h-7.71c-.66-2.3-2.77-4-5.29-4s-4.63,1.7-5.29,4H18l-15.6-11.7c-.46-.34-1.06-.4-1.57-.14-.51.25-.83.77-.83,1.34v24c0,.57.32,1.09.83,1.34.21.11.44.16.67.16.32,0,.64-.1.9-.3l15.6-11.7h32.21c.66,2.3,2.77,4,5.29,4s4.63-1.7,5.29-4h7.71c8,0,14.5-6.5,14.5-14.5s-6.5-14.5-14.5-14.5h0ZM27.5,46.01c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5,2.5-2.5,2.5,1.12,2.5,2.5-1.12,2.5-2.5,2.5ZM55.5,72.01c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5,2.5-2.5,2.5,1.12,2.5,2.5-1.12,2.5-2.5,2.5Z" />
  </svg>
)

export const BulbIcon = ({ width = 19, height = 19, ...p }: P) => (
  <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M12 2.75a6.25 6.25 0 0 0-3.75 11.25c.53.4.87 1 .96 1.66l.09.59h5.4l.09-.59c.09-.66.43-1.26.96-1.66A6.25 6.25 0 0 0 12 2.75Z" />
    <path d="M9.6 18.6h4.8" />
    <path d="M10.5 21h3" />
  </svg>
)

/** The small check that replaces a number once a stop is behind the reader. */
export const CheckMark = ({ width = 9, height = 7, ...p }: P) => (
  <svg viewBox="0 0 9 7" width={width} height={height} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M1 3.6 3.4 6 8 1" />
  </svg>
)

/** Three buildings, for the Diagnose button. */
export const CityBuildIcon = ({ width = 22, height = 22, ...p }: P) => (
  <svg viewBox="0 0 20 20" width={width} height={height} fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden {...p}>
    <path d="M2 17h16" />
    <path d="M3.5 17V9h4v8" />
    <path d="M8.5 17V4.5h4.5V17" />
    <path d="M14 17v-6h3v6" />
    <path d="M10.2 7h1.5M10.2 9.5h1.5M10.2 12h1.5" />
  </svg>
)

/** The verdict marks: castle, horseshoe magnet, sponge, bucket. */
export function QuadrantIcon({ noun, width = 36, height = 36, ...p }: P & { noun: QuadrantCopy['noun'] }) {
  const common: P = { viewBox: '0 0 40 40', width, height, fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p }
  switch (noun) {
    case 'fortress':
      return (
        <svg {...common}>
          <path d="M6 33V13h5V9h4v4h10V9h4v4h5v20" />
          <path d="M6 33h28" />
          <path d="M14 33v-7a3 3 0 0 1 6 0v7" />
          <path d="M11 18h4M25 18h4M11 24h4M25 24h4" />
        </svg>
      )
    case 'magnet':
      return (
        <svg {...common}>
          <path d="M10 8v13a10 10 0 0 0 20 0V8" />
          <path d="M16 8v13a4 4 0 0 0 8 0V8" />
          <path d="M10 8h6M24 8h6" />
          <path d="M10 13h6M24 13h6" strokeWidth={3} />
        </svg>
      )
    case 'sponge':
      return (
        <svg {...common}>
          <rect x="6" y="14" width="28" height="18" rx="4" />
          <circle cx="13" cy="20" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="21" cy="24" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="27" cy="19" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="15" cy="27" r="1.4" fill="currentColor" stroke="none" />
          <path d="M20 5v5M14 7l1.5 3M26 7l-1.5 3" />
        </svg>
      )
    case 'leak':
      return (
        <svg {...common}>
          <path d="M9 9h22l-2.5 17H11.5Z" />
          <path d="M9 9a11 3.2 0 0 0 22 0" />
          <path d="M20 30c0 2.6-1.6 4-1.6 5.4a1.6 1.6 0 0 0 3.2 0C21.6 34 20 32.6 20 30Z" fill="currentColor" stroke="none" />
          <path d="M27 29.5c0 1.8-1.1 2.8-1.1 3.8a1.1 1.1 0 0 0 2.2 0c0-1-1.1-2-1.1-3.8Z" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}

/** Landing pictograms: a city outline with three people, or three pay bars. */
const CityOutline = () => (
  <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 26h20" />
    <path d="M4 26V15h6v11" />
    <path d="M12 26V8h7v18" />
    <path d="M14.6 12h1.8M14.6 16h1.8M14.6 20h1.8" strokeWidth={1.2} />
  </g>
)
export const PeoplePictogram = (p: P) => (
  <svg viewBox="0 0 64 28" width={44} height={22} aria-hidden {...p}>
    <CityOutline />
    {[30, 41, 52].map((cx) => (
      <g key={cx} fill="currentColor">
        <circle cx={cx} cy="15" r="2.6" />
        <path d={`M${cx - 4.2} 26c.5-4.4 7.9-4.4 8.4 0Z`} />
      </g>
    ))}
  </svg>
)
export const PayPictogram = ({ down, ...p }: P & { down?: boolean }) => (
  <svg viewBox="0 0 64 28" width={44} height={22} aria-hidden {...p}>
    <CityOutline />
    <g fill="currentColor">
      {(down ? [19, 13, 8] : [8, 13, 19]).map((h, i) => (
        <rect key={i} x={28 + i * 10} y={26 - h} width="6" height={h} rx="1.4" />
      ))}
    </g>
  </svg>
)

/** Stat-row discs: people, a falling arrow, a rising arrow. */
export const PeopleIcon = (p: P) => (
  <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <circle cx="8" cy="7.5" r="2.6" />
    <path d="M3.4 15.4c.5-2.6 2.4-3.9 4.6-3.9s4.1 1.3 4.6 3.9" />
    <path d="M13.6 5.6a2.4 2.4 0 0 1 0 4.4" />
    <path d="M15 11.9c1.6.4 2.7 1.6 3 3.5" />
  </svg>
)
export const TrendIcon = ({ dir, ...p }: P & { dir: 'up' | 'down' }) => (
  <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    {dir === 'up' ? (
      <>
        <path d="M4.5 13.5 10 8l2.4 2.4L15.5 7" />
        <path d="M15.5 10.4V7h-3.4" />
      </>
    ) : (
      <>
        <path d="M4.5 6.5 10 12l2.4-2.4L15.5 13" />
        <path d="M15.5 9.6V13h-3.4" />
      </>
    )}
  </svg>
)
