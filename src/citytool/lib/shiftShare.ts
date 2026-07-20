// Shift-share decomposition of an MSA's employment change between two years.
//
// Given E_ir(t) = MSA r employment in industry i at year t, the classical
// decomposition splits ΔE_r = E_r(t1) − E_r(t0) into four effects:
//
//   NS_i  =  E_ir(t0) × (g_N − 1)             national share
//   IM_i  =  E_ir(t0) × (g_i − g_N)           industry-mix
//   LS_i  =  E_ir(t1) − E_ir(t0) × g_i        local share (residual)
//   new   =  Σ E_ir(t1) over i where E_ir(t0) = 0
//
// where g_N = E_N(t1)/E_N(t0), g_i = E_iN(t1)/E_iN(t0). For industries that
// disappear locally (E_ir(t0) > 0 but E_ir(t1) = 0) the local share absorbs
// the negative residual. The identity Σ(NS+IM+LS) + new = E_r(t1) − E_r(t0)
// holds exactly.
//
// National denominator: Johan's QCEW summed over all counties (private
// sector × NAICS-4). Same source as the MSA numerator, so the decomposition
// is internally consistent.

import type { MsaIndustryRow, NationalIndustryRow } from '../data/types';

export interface ShiftShareIndustry {
  naics4: string;
  e_r_t0: number;
  e_r_t1: number;
  e_n_t0: number;
  e_n_t1: number;
  g_i: number | null;     // null if e_n_t0 = 0 (industry doesn't exist nationally at t0)
  ns: number;
  im: number;
  ls: number;
  isNew: boolean;         // local industry absent at t0, present at t1
}

export interface ShiftShareTotals {
  startEmployment: number;
  endEmployment: number;
  g_N: number;
  nsTotal: number;
  imTotal: number;
  lsTotal: number;
  newIndustriesTotal: number;
}

export interface ShiftShareResult {
  t0: number;
  t1: number;
  industries: ShiftShareIndustry[];
  newIndustries: ShiftShareIndustry[];
  totals: ShiftShareTotals;
}

// Snap a requested year to the nearest year present in the panel. The global
// year-range selector ranges 2008–2024 while QCEW covers 2004–2024; for now
// they align, but this guards against future drift.
export function snapYear(rows: { year: number }[], target: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  const seen = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.year)) continue;
    seen.add(r.year);
    const d = Math.abs(r.year - target);
    if (d < bestDist) { best = r.year; bestDist = d; }
  }
  return best;
}

export function computeShiftShare(
  msaRows: MsaIndustryRow[],
  nationalRows: NationalIndustryRow[],
  t0: number,
  t1: number,
): ShiftShareResult | null {
  if (t0 === t1) return null;

  // Build year × naics4 → employment lookups.
  const mByYearNaics = new Map<string, number>();
  for (const r of msaRows) {
    if (r.employment == null) continue;
    mByYearNaics.set(`${r.year}|${r.naics4}`, r.employment);
  }
  const nByYearNaics = new Map<string, number>();
  for (const r of nationalRows) {
    if (r.employment == null) continue;
    nByYearNaics.set(`${r.year}|${r.naics4}`, r.employment);
  }

  // National totals at each year.
  let nE0 = 0;
  let nE1 = 0;
  for (const r of nationalRows) {
    if (r.employment == null) continue;
    if (r.year === t0) nE0 += r.employment;
    else if (r.year === t1) nE1 += r.employment;
  }
  if (nE0 <= 0 || nE1 <= 0) return null;
  const g_N = nE1 / nE0;

  // Union of NAICS4 codes seen in this MSA across t0 and t1.
  const naicsSet = new Set<string>();
  for (const r of msaRows) {
    if (r.year === t0 || r.year === t1) naicsSet.add(r.naics4);
  }

  const industries: ShiftShareIndustry[] = [];
  const newIndustries: ShiftShareIndustry[] = [];

  for (const n of naicsSet) {
    const e_r_t0 = mByYearNaics.get(`${t0}|${n}`) ?? 0;
    const e_r_t1 = mByYearNaics.get(`${t1}|${n}`) ?? 0;
    const e_n_t0 = nByYearNaics.get(`${t0}|${n}`) ?? 0;
    const e_n_t1 = nByYearNaics.get(`${t1}|${n}`) ?? 0;
    const g_i = e_n_t0 > 0 ? e_n_t1 / e_n_t0 : null;
    const isNew = e_r_t0 === 0 && e_r_t1 > 0;

    if (isNew) {
      // All new-industry employment is bucketed separately; NS/IM/LS are 0
      // by definition since e_r_t0 = 0.
      newIndustries.push({
        naics4: n, e_r_t0, e_r_t1, e_n_t0, e_n_t1, g_i,
        ns: 0, im: 0, ls: 0, isNew: true,
      });
      continue;
    }

    if (e_r_t0 === 0 && e_r_t1 === 0) continue;    // industry absent both years — skip

    const ns = e_r_t0 * (g_N - 1);
    // If g_i is null (industry doesn't exist nationally at t0), fall back to
    // treating IM as 0 and putting the full local change in LS. Rare edge case.
    const im = g_i != null ? e_r_t0 * (g_i - g_N) : 0;
    const ls = g_i != null ? e_r_t1 - e_r_t0 * g_i : e_r_t1 - e_r_t0;

    industries.push({
      naics4: n, e_r_t0, e_r_t1, e_n_t0, e_n_t1, g_i,
      ns, im, ls, isNew: false,
    });
  }

  let startEmployment = 0;
  let endEmployment = 0;
  let nsTotal = 0;
  let imTotal = 0;
  let lsTotal = 0;
  let newIndustriesTotal = 0;
  for (const r of industries) {
    startEmployment += r.e_r_t0;
    endEmployment += r.e_r_t1;
    nsTotal += r.ns;
    imTotal += r.im;
    lsTotal += r.ls;
  }
  for (const r of newIndustries) {
    endEmployment += r.e_r_t1;
    newIndustriesTotal += r.e_r_t1;
  }

  return {
    t0, t1,
    industries,
    newIndustries,
    totals: {
      startEmployment,
      endEmployment,
      g_N,
      nsTotal,
      imTotal,
      lsTotal,
      newIndustriesTotal,
    },
  };
}
