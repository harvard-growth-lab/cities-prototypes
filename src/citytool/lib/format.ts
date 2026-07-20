// Generic number formatters. Currency formatter takes a country code so a
// future EU/MA city profile can be presented in its own currency.
const CURRENCY: Record<string, { code: string; locale: string }> = {
  usa: { code: 'USD', locale: 'en-US' },
};

export const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const fmtPct = (x: number | null | undefined, digits = 1) =>
  x == null || Number.isNaN(x) ? '—' : `${x.toFixed(digits)}%`;

export const fmtNum = (x: number | null | undefined, digits = 1) =>
  x == null || Number.isNaN(x) ? '—' : x.toFixed(digits);

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

export function pctChange(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || a === 0 || Number.isNaN(a) || Number.isNaN(b)) return null;
  return ((b - a) / a) * 100;
}
