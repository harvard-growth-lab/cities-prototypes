import { createContext, useContext, useState, type ReactNode } from 'react';

// App-wide compare window. Used as the (start, end) anchors for every
// "change since" / CAGR computation — levels tables, scatters, etc.
// Each consuming component should snap to the nearest year for which it
// has data, so picking 2024 won't break an indicator that only goes to 2022.

export type YearRange = {
  startYear: number;
  endYear: number;
  setStartYear: (y: number) => void;
  setEndYear: (y: number) => void;
};

const YearRangeContext = createContext<YearRange | null>(null);

// 2017 → 2022 = 5-year window where every source we have (BEA MSA pop,
// Census PEP at county+place, IRS at ZIP, Zillow) carries observations.
export const DEFAULT_START = 2017;
export const DEFAULT_END = 2023;

// Selector option range. Bounded by what our data actually contains.
export const MIN_YEAR = 2008;
export const MAX_YEAR = 2024;

export function YearRangeProvider({ children }: { children: ReactNode }) {
  const [startYear, setStartYear] = useState(DEFAULT_START);
  const [endYear, setEndYear] = useState(DEFAULT_END);
  return (
    <YearRangeContext.Provider value={{ startYear, endYear, setStartYear, setEndYear }}>
      {children}
    </YearRangeContext.Provider>
  );
}

export function useYearRange(): YearRange {
  const ctx = useContext(YearRangeContext);
  if (!ctx) throw new Error('useYearRange must be used inside YearRangeProvider');
  return ctx;
}

// Snap a requested year to the nearest year present in `availableYears`,
// preferring years ≤ requested (e.g. if IRS has 2022 and user asked 2024,
// returns 2022). Returns null if availableYears is empty.
export function snapYear(requested: number, availableYears: number[]): number | null {
  if (availableYears.length === 0) return null;
  let best = availableYears[0];
  let bestDist = Math.abs(best - requested);
  for (const y of availableYears) {
    const dist = Math.abs(y - requested);
    if (dist < bestDist || (dist === bestDist && y <= requested && best > requested)) {
      best = y;
      bestDist = dist;
    }
  }
  return best;
}
