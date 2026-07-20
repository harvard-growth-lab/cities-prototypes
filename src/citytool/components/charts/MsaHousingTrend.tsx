import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { HousingRow, PlaceHousingRow } from '../../data/types';
import { fmtMoney } from '../../lib/format';
import { useYearRange } from '../../lib/yearRange';
import { GL } from '../../lib/glColors';

// Home values over time, three lines: the active MSA, the median MSA in the same
// year (so the trajectory reads relative to the typical metro), and the active
// place (the within-MSA neighbourhood-level price). `housing` is the full
// national MSA set; `placeHousing` is the place-level ZHVI.

// The active MSA is the focus (c-2 identity red); the within-MSA place is a
// second series (c-1 blue); the median metro is the muted reference line.
const HIGHLIGHT = GL.c2;
const PLACE_LINE = GL.c1;
const MUTED = GL.ink3;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function MsaHousingTrend({
  housing,
  placeHousing,
  cityId,
  placeId,
  placeName = 'This place',
  country = 'usa',
}: {
  housing: HousingRow[];
  placeHousing?: PlaceHousingRow[];
  cityId: string;
  placeId?: string;
  placeName?: string;
  country?: string;
}) {
  const data = useMemo(() => {
    // Cross-MSA median ZHVI per year (all-tier) — the benchmark line.
    const byYear = new Map<number, number[]>();
    for (const r of housing) {
      if (r.tier !== 'all' || r.zhvi == null || r.zhvi <= 0) continue;
      const arr = byYear.get(r.year) ?? [];
      arr.push(r.zhvi);
      byYear.set(r.year, arr);
    }
    const medianByYear = new Map<number, number | null>();
    for (const [year, xs] of byYear) medianByYear.set(year, median(xs));

    // The active place's ZHVI per year (all-tier).
    const placeByYear = new Map<number, number>();
    if (placeId && placeHousing) {
      for (const r of placeHousing) {
        if (r.place_id !== placeId || r.tier !== 'all' || r.zhvi == null || r.zhvi <= 0) continue;
        placeByYear.set(r.year, r.zhvi);
      }
    }

    // This MSA's series is the spine; join the benchmark + place onto it.
    return housing
      .filter((r) => r.city_id === cityId && r.tier === 'all' && r.zhvi != null)
      .map((r) => ({
        year: r.year,
        zhvi: r.zhvi as number,
        medianMsa: medianByYear.get(r.year) ?? null,
        place: placeByYear.get(r.year) ?? null,
      }))
      .sort((a, b) => a.year - b.year);
  }, [housing, placeHousing, cityId, placeId]);

  const hasPlace = data.some((d) => d.place != null);

  // Mark the compare window on the x-axis. Snap each end to the nearest year
  // actually in the series so the marker always lands on the axis even when the
  // window's exact year is outside ZHVI coverage.
  const { startYear, endYear } = useYearRange();
  const years = data.map((d) => d.year);
  const snap = (t: number) => (years.length ? years.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a)) : t);
  const startMark = snap(startYear);
  const endMark = snap(endYear);

  if (data.length < 2) {
    return <p className="muted">No home-value series for this metro.</p>;
  }

  return (
    <>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={GL.gridline} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: MUTED, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GL.ink2 }}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v) => fmtMoney(v as number, country)}
            />
            <Tooltip
              formatter={(v, name) => [fmtMoney(v as number, country), name as string]}
              labelFormatter={(l) => `Year ${l}`}
              contentStyle={{ fontSize: 12, border: `1px solid ${GL.rule}` }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Compare-window markers. */}
            <ReferenceLine
              x={startMark}
              stroke={MUTED}
              strokeDasharray="4 3"
              label={{ value: `${startMark}`, position: 'top', fontSize: 11, fill: MUTED }}
            />
            {endMark !== startMark && (
              <ReferenceLine
                x={endMark}
                stroke={MUTED}
                strokeDasharray="4 3"
                label={{ value: `${endMark}`, position: 'top', fontSize: 11, fill: MUTED }}
              />
            )}
            <Line
              type="monotone"
              dataKey="medianMsa"
              name="Median MSA"
              stroke={MUTED}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
            <Line type="monotone" dataKey="zhvi" name="This MSA" stroke={HIGHLIGHT} strokeWidth={2} dot={false} />
            {hasPlace && (
              <Line
                type="monotone"
                dataKey="place"
                name={placeName}
                stroke={PLACE_LINE}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-source">
        <span className="chart-source-label">Source</span>
        Zillow ZHVI, all-tier (monthly → year-mean). MSA-level for the metro and
        the median benchmark{hasPlace ? '; the place line is ZHVI aggregated from constituent ZIPs via Census ZCTA × Place areal weights' : ''}.
        The dashed line is the median across all MSAs we cover in each year.
      </p>
    </>
  );
}
