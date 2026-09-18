/* Number formatting for prose and headline figures (ported from
   tz-prototypes citytool/lib/format.ts). Axis ticks use d3-format instead;
   these are for text, where Intl handles locale and currency. */

const CURRENCY: Record<string, { code: string; locale: string }> = {
  usa: { code: 'USD', locale: 'en-US' },
}

const DASH = '—'
const isBlank = (x: number | null | undefined): x is null | undefined =>
  x == null || Number.isNaN(x)

export const fmtInt = (x: number | null | undefined) =>
  isBlank(x) ? DASH : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x)

/** Input already in percent units: 4.2 → "4.2%". */
export const fmtPct = (x: number | null | undefined, digits = 1) =>
  isBlank(x) ? DASH : `${x.toFixed(digits)}%`

/** Input is a fraction: 0.042 → "+4.2%". */
export const fmtSignedPct = (v: number | null | undefined, digits = 1) =>
  isBlank(v) ? DASH :
  `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`

/** Signed percentage points from a fraction: 0.042 → "+4.2 pp". */
export const fmtPp = (v: number | null | undefined, digits = 1) =>
  isBlank(v) ? DASH :
  `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)} pp`

/* Compact headline numbers: whole compact units, never fewer than two
   significant digits. "660K" not "660,491"; "$105K" not "$100K"; 4.9M keeps
   its decimal. */
const COMPACT: Intl.NumberFormatOptions = {
  notation: 'compact',
  maximumFractionDigits: 0,
  maximumSignificantDigits: 2,
  roundingPriority: 'morePrecision',
}

export const fmtCompact = (x: number | null | undefined) =>
  isBlank(x) ? DASH : new Intl.NumberFormat('en-US', COMPACT).format(x)

export function fmtMoney(x: number | null | undefined, country = 'usa', compact = false) {
  if (isBlank(x)) return DASH
  const c = CURRENCY[country] ?? CURRENCY.usa
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    maximumFractionDigits: 0,
    ...(compact ? COMPACT : {}),
  }).format(x)
}

/** A per-year rate from a fraction: 0.0057 → "+0.6%/yr". */
export const fmtRate = (v: number | null | undefined, digits = 1) => {
  if (isBlank(v)) return DASH
  const mag = (Math.abs(v) * 100).toFixed(digits)
  // a rate that rounds to zero carries no sign ("0.0%/yr", never "−0.0%/yr")
  const sign = Number(mag) === 0 ? '' : v > 0 ? '+' : '−'
  return `${sign}${mag}%/yr`
}

/** A multiple: 5.76 → "5.8×"; two decimals under 1. */
export const fmtMult = (v: number | null | undefined) =>
  isBlank(v) ? DASH : `${v < 1 ? v.toFixed(2) : v.toFixed(1)}×`

/** Signed percentage points from a difference of fractions, or of percents when `alreadyPct`. */
export const fmtSignedPp = (v: number | null | undefined, alreadyPct = false, digits = 1) =>
  isBlank(v) ? DASH : `${v >= 0 ? '+' : '−'}${(Math.abs(v) * (alreadyPct ? 1 : 100)).toFixed(digits)} pp`

/** "+40%" from a fraction, no decimals unless small. */
export const fmtSignedPctInt = (v: number | null | undefined) =>
  isBlank(v) ? DASH : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100) < 10 ? Math.abs(v * 100).toFixed(1) : Math.abs(v * 100).toFixed(0)}%`

/** Years read: [2014, 2024] → "2014–2024". */
export const fmtYears = (y: [number, number] | null | undefined) => (y ? `${y[0]}–${y[1]}` : DASH)
