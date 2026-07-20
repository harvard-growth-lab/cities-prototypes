import { useMemo } from 'react';
import { useYearRange, MIN_YEAR, MAX_YEAR } from '../lib/yearRange';

// Small inline selector for the global compare window. Reads/writes the
// YearRangeContext, so any chart or table that derives off useYearRange()
// updates as the user changes the window.

export default function YearRangeSelector() {
  const { startYear, endYear, setStartYear, setEndYear } = useYearRange();
  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = MIN_YEAR; y <= MAX_YEAR; y++) out.push(y);
    return out;
  }, []);

  return (
    <div className="year-range-selector">
      <label className="control">
        <span className="control-label">Compare from</span>
        <select
          className="control-select"
          value={startYear}
          onChange={(e) => {
            const y = Number(e.target.value);
            setStartYear(y);
            if (y >= endYear) setEndYear(Math.min(MAX_YEAR, y + 1));
          }}
        >
          {yearOptions.filter((y) => y < endYear).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className="control">
        <span className="control-label">to</span>
        <select
          className="control-select"
          value={endYear}
          onChange={(e) => {
            const y = Number(e.target.value);
            setEndYear(y);
            if (y <= startYear) setStartYear(Math.max(MIN_YEAR, y - 1));
          }}
        >
          {yearOptions.filter((y) => y > startYear).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
