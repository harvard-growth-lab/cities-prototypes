// Generic number formatters. Currency formatter takes a country code so a
// future EU/MA city profile can be presented in its own currency.
const CURRENCY: Record<string, { code: string; locale: string }> = {
  usa: { code: 'USD', locale: 'en-US' },
};

export const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const fmtPct = (x: number | null | undefined, digits = 1) =>
  x == null || Number.isNaN(x) ? '—' : `${x.toFixed(digits)}%`;

// Chart formatters whose input is a FRACTION (0.042 → "4.2%"), unlike fmtPct
// above which expects a value already in percent units. Kept as plain unary
// functions so they can be passed directly as axis/tooltip formatters.
export const fmtPct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
export const fmtPct2 = (v: number) => `${(v * 100).toFixed(2)}%`;
/** Signed percentage-points, e.g. 0.042 → "+4.2 pp". */
export const fmtPp = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`;
/** Signed percent, e.g. 0.042 → "+4.2%". */
export const fmtSignedPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export function fmtMoney(x: number | null | undefined, country = 'usa'): string {
  if (x == null || Number.isNaN(x)) return '—';
  const c = CURRENCY[country] ?? CURRENCY.usa;
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    maximumFractionDigits: 0,
  }).format(x);
}

// Compact variants for headline numbers: whole compact units, but never fewer
// than two significant digits. A population reads "660K" rather than
// "660,491", a salary "$86K" rather than "$85,723" — yet $104,832 stays
// "$105K" (not a distorted "$100K") and 4.9M keeps its decimal.
const COMPACT_OPTS = {
  notation: 'compact',
  maximumFractionDigits: 0,
  maximumSignificantDigits: 2,
  roundingPriority: 'morePrecision',
} as const;

export const fmtCompact = new Intl.NumberFormat('en-US', COMPACT_OPTS);

export function fmtMoneyCompact(x: number | null | undefined, country = 'usa'): string {
  if (x == null || Number.isNaN(x)) return '—';
  const c = CURRENCY[country] ?? CURRENCY.usa;
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    ...COMPACT_OPTS,
  }).format(x);
}
