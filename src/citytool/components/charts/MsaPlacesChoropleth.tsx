import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMsaPlacesGeo } from '../../data/useMsaGeo';
import { useYearRange } from '../../lib/yearRange';
import type { PlacePanelRow, PlaceHousingRow, PlaceRentRow, PlaceFiscalRow, PlaceDirectoryRow } from '../../data/types';
import { fmtMoney, fmtInt } from '../../lib/format';
import { GL, sequentialColor, divergingColor } from '../../lib/glColors';
import { nearestRow } from '../../lib/panelRows';
import { amenityResiduals, residualDelta, type AmenityObs } from '../../lib/amenityResidual';

// Choropleth of every place in the MSA. The user picks a metric — population /
// salary / home value either as latest level or as CAGR over the compare window
// — and each place is filled by where its value sits in the MSA's distribution.
// The active place is outlined in red so the user can spot it among neighbours.
//
// Bundled MSA-places GeoJSON keeps this to one fetch per MSA (see
// scripts/build-msa-places-geo.mjs).

const HIGHLIGHT = GL.c2;        // active place outline — identity red
const NO_DATA = GL.mutedLight;  // places with no value for the metric
// Placeholder mode: this prototype ships without the real data behind this
// metric, so every place is painted a flat neutral grey to signal "illustrative,
// not actual figures" rather than dressing fake numbers in a real colour ramp.
const PLACEHOLDER_FILL = GL.muted;

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

type Metric =
  | 'pop_level'
  | 'pop_cagr'
  | 'salary_level'
  | 'salary_cagr'
  | 'zhvi_level'
  | 'zhvi_cagr'
  | 'zori_level'
  | 'zori_cagr'
  | 'real_wage_zhvi_cagr'
  | 'real_wage_zori_cagr'
  | 'amenity_zhvi'
  | 'amenity_zori'
  | 'amenity_zhvi_delta'
  | 'amenity_zori_delta'
  | 'fiscal_gen_rev_pc'
  | 'fiscal_property_tax_pc'
  | 'fiscal_net_balance_pc'
  | 'fiscal_debt_pc'
  | 'fiscal_debt_to_rev'
  | 'fiscal_effective_rate'
  | 'fiscal_public_safety_pc'
  | 'fiscal_education_pc';

// `ratio` is unit-less (e.g., debt / revenue); displayed as Nx (1 decimal).
// `pp` is a signed log-point delta shown as percentage points ("+4.2 pp").
type ValueKind = 'money' | 'count' | 'pct' | 'ratio' | 'pp';

const METRICS: Record<Metric, { label: string; group: string; diverging: boolean; kind: ValueKind }> = {
  pop_level:               { label: 'Population — latest',                  group: 'Population', diverging: false, kind: 'count' },
  pop_cagr:                { label: 'Population — CAGR',                    group: 'Population', diverging: true,  kind: 'pct'   },
  salary_level:            { label: 'Avg salary — latest',                  group: 'Salary',     diverging: false, kind: 'money' },
  salary_cagr:             { label: 'Avg salary — CAGR',                    group: 'Salary',     diverging: true,  kind: 'pct'   },
  zhvi_level:              { label: 'Home value — latest',                  group: 'Home value', diverging: false, kind: 'money' },
  zhvi_cagr:               { label: 'Home value — CAGR',                    group: 'Home value', diverging: true,  kind: 'pct'   },
  zori_level:              { label: 'Rent — latest (mo.)',                  group: 'Rent',       diverging: false, kind: 'money' },
  zori_cagr:               { label: 'Rent — CAGR',                          group: 'Rent',       diverging: true,  kind: 'pct'   },
  real_wage_zhvi_cagr:     { label: 'Real wage (vs. home value) — CAGR',    group: 'Real wage',  diverging: true,  kind: 'pct'   },
  real_wage_zori_cagr:     { label: 'Real wage (vs. rent) — CAGR',          group: 'Real wage',  diverging: true,  kind: 'pct'   },
  amenity_zhvi:            { label: 'Housing vs. salary (residual)',        group: 'Amenity score', diverging: true,  kind: 'pct'   },
  amenity_zori:            { label: 'Rent vs. salary (residual)',           group: 'Amenity score', diverging: true,  kind: 'pct'   },
  amenity_zhvi_delta:      { label: 'Housing vs. salary — change (Δ residual)', group: 'Amenity score', diverging: true, kind: 'pp' },
  amenity_zori_delta:      { label: 'Rent vs. salary — change (Δ residual, 2015+)', group: 'Amenity score', diverging: true, kind: 'pp' },
  fiscal_gen_rev_pc:       { label: 'General revenue / capita (FY22)',      group: 'Fiscal',     diverging: false, kind: 'money' },
  fiscal_property_tax_pc:  { label: 'Property tax / capita (FY22)',         group: 'Fiscal',     diverging: false, kind: 'money' },
  fiscal_net_balance_pc:   { label: 'Net balance / capita (FY22)',          group: 'Fiscal',     diverging: true,  kind: 'money' },
  fiscal_debt_pc:          { label: 'Debt outstanding / capita (FY22)',     group: 'Fiscal',     diverging: false, kind: 'money' },
  fiscal_debt_to_rev:      { label: 'Debt / general revenue (FY22)',        group: 'Fiscal',     diverging: false, kind: 'ratio' },
  fiscal_effective_rate:   { label: 'Effective interest rate on debt (FY22)', group: 'Fiscal',   diverging: false, kind: 'pct'   },
  fiscal_public_safety_pc: { label: 'Police + fire spending / cap (FY22)',  group: 'Fiscal',     diverging: false, kind: 'money' },
  fiscal_education_pc:     { label: 'Education spending / cap (FY22)',      group: 'Fiscal',     diverging: false, kind: 'money' },
};

type Props = {
  msaId: string;
  msaName: string;
  placeId: string;
  placeName: string;
  panel: PlacePanelRow[];
  housing: PlaceHousingRow[];
  rent: PlaceRentRow[];
  fiscal: PlaceFiscalRow[];
  directory: PlaceDirectoryRow[];
  msaPlaceIds: string[];
  // When true, render full-bleed: the map fills its container and every UI
  // chrome (metric picker, zoom, legend, source) floats over it as an overlay.
  // Used by the story's "stage" section so the map can claim the whole screen.
  fill?: boolean;
  // DOM id of an element to adopt as the home for the metric picker + legend
  // (full-bleed only). The story's stage card renders an empty slot div; we
  // portal the tools into it so narrative, controls and legend share one
  // surface. Falls back to the floating overlay if the id isn't found.
  toolsPortalId?: string;
  // Which metric to open on (user can still switch via the picker).
  initialMetric?: Metric;
  // When true, the map is decorative: every place fills a flat neutral grey and
  // the legend/tooltip/source say so. Used where the prototype hasn't wired the
  // real data yet and we don't want fake numbers reading as genuine.
  placeholder?: boolean;
};


function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.max(0, Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))));
  return sorted[i];
}

// Min year ZORI is published from (Zillow's ZORI series starts Jan 2015).
// Used to short-circuit rent CAGR + both real-wage CAGRs when the window
// starts before ZORI exists — those cells render no-data.
const ZORI_MIN_YEAR = 2015;

function placeCagr<T>(rows: T[], yr: (r: T) => number, val: (r: T) => number | null, startYear: number, endYear: number): number | null {
  const pred = (r: T) => {
    const v = val(r);
    return v != null && v > 0;
  };
  const a = rows.filter(pred).reduce<T | null>((best, r) => best == null || Math.abs(yr(r) - startYear) < Math.abs(yr(best) - startYear) ? r : best, null);
  const b = rows.filter(pred).reduce<T | null>((best, r) => best == null || Math.abs(yr(r) - endYear) < Math.abs(yr(best) - endYear) ? r : best, null);
  if (!a || !b) return null;
  const ya = yr(a), yb = yr(b);
  if (ya === yb) return null;
  const va = val(a)!, vb = val(b)!;
  const c = (vb / va) ** (1 / (yb - ya)) - 1;
  return Number.isFinite(c) ? c : null;
}

function computeValues(
  metric: Metric,
  msaPlaceIdsSet: Set<string>,
  panel: PlacePanelRow[],
  housing: PlaceHousingRow[],
  rent: PlaceRentRow[],
  fiscal: PlaceFiscalRow[],
  directory: PlaceDirectoryRow[],
  startYear: number,
  endYear: number,
): Map<string, number> {
  const byPlace = new Map<string, PlacePanelRow[]>();
  for (const r of panel) {
    if (!msaPlaceIdsSet.has(r.place_id)) continue;
    const arr = byPlace.get(r.place_id) ?? [];
    arr.push(r);
    byPlace.set(r.place_id, arr);
  }
  const housingByPlace = new Map<string, PlaceHousingRow[]>();
  const needsHousing =
    metric === 'zhvi_level' || metric === 'zhvi_cagr' || metric === 'real_wage_zhvi_cagr';
  if (needsHousing) {
    for (const h of housing) {
      if (!msaPlaceIdsSet.has(h.place_id)) continue;
      if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
      const arr = housingByPlace.get(h.place_id) ?? [];
      arr.push(h);
      housingByPlace.set(h.place_id, arr);
    }
  }
  const rentByPlace = new Map<string, PlaceRentRow[]>();
  const needsRent =
    metric === 'zori_level' || metric === 'zori_cagr' || metric === 'real_wage_zori_cagr';
  if (needsRent) {
    for (const r of rent) {
      if (!msaPlaceIdsSet.has(r.place_id)) continue;
      if (r.zori == null || r.zori <= 0) continue;
      const arr = rentByPlace.get(r.place_id) ?? [];
      arr.push(r);
      rentByPlace.set(r.place_id, arr);
    }
  }

  const out = new Map<string, number>();

  if (metric === 'pop_level') {
    for (const [pid, rows] of byPlace) {
      const r = nearestRow(rows, endYear, (x) => x.population != null && x.population > 0);
      if (r?.population != null) out.set(pid, r.population);
    }
  } else if (metric === 'salary_level') {
    for (const [pid, rows] of byPlace) {
      const r = nearestRow(rows, endYear, (x) => x.avg_wage != null && x.avg_wage > 0);
      if (r?.avg_wage != null) out.set(pid, r.avg_wage);
    }
  } else if (metric === 'zhvi_level') {
    for (const [pid, rows] of housingByPlace) {
      const r = nearestRow(rows, endYear, (x) => x.zhvi != null && x.zhvi > 0);
      if (r?.zhvi != null) out.set(pid, r.zhvi);
    }
  } else if (metric === 'pop_cagr') {
    // PEP only tracks incorporated places — for CDPs population is null. We
    // fall back to IRS n_returns (household-level) CAGR for those, since CAGR
    // is unit-less and household growth closely tracks population growth.
    for (const [pid, rows] of byPlace) {
      const a = nearestRow(rows, startYear, (x) => x.population != null && x.population > 0);
      const b = nearestRow(rows, endYear,   (x) => x.population != null && x.population > 0);
      if (a && b && a.year !== b.year) {
        const c = (b.population! / a.population!) ** (1 / (b.year - a.year)) - 1;
        if (Number.isFinite(c)) { out.set(pid, c); continue; }
      }
      const a2 = nearestRow(rows, startYear, (x) => x.n_returns != null && x.n_returns > 0);
      const b2 = nearestRow(rows, endYear,   (x) => x.n_returns != null && x.n_returns > 0);
      if (!a2 || !b2 || a2.year === b2.year) continue;
      const c = (b2.n_returns! / a2.n_returns!) ** (1 / (b2.year - a2.year)) - 1;
      if (Number.isFinite(c)) out.set(pid, c);
    }
  } else if (metric === 'salary_cagr') {
    for (const [pid, rows] of byPlace) {
      const a = nearestRow(rows, startYear, (x) => x.avg_wage != null && x.avg_wage > 0);
      const b = nearestRow(rows, endYear,   (x) => x.avg_wage != null && x.avg_wage > 0);
      if (!a || !b || a.year === b.year) continue;
      const c = (b.avg_wage! / a.avg_wage!) ** (1 / (b.year - a.year)) - 1;
      if (Number.isFinite(c)) out.set(pid, c);
    }
  } else if (metric === 'zhvi_cagr') {
    for (const [pid, rows] of housingByPlace) {
      const a = nearestRow(rows, startYear);
      const b = nearestRow(rows, endYear);
      if (!a?.zhvi || !b?.zhvi || a.year === b.year) continue;
      const c = (b.zhvi / a.zhvi) ** (1 / (b.year - a.year)) - 1;
      if (Number.isFinite(c)) out.set(pid, c);
    }
  } else if (metric === 'zori_level') {
    for (const [pid, rows] of rentByPlace) {
      const r = nearestRow(rows, endYear, (x) => x.zori != null && x.zori > 0);
      if (r?.zori != null) out.set(pid, r.zori);
    }
  } else if (metric === 'zori_cagr') {
    // ZORI starts in 2015 — if the user's window opens earlier we'd otherwise
    // silently snap to 2015 and present a shorter compare than was asked for.
    // Show no-data so the gap is honest (matches the "no-data outside ZORI
    // coverage" design choice).
    if (startYear < ZORI_MIN_YEAR) return out;
    for (const [pid, rows] of rentByPlace) {
      const c = placeCagr(rows, (r) => r.year, (r) => r.zori, startYear, endYear);
      if (c != null) out.set(pid, c);
    }
  } else if (metric === 'real_wage_zhvi_cagr' || metric === 'real_wage_zori_cagr') {
    // Real-wage = (1 + wage_cagr) / (1 + price_cagr) − 1. Skip the whole metric
    // when the requested window predates ZORI coverage so the choropleth
    // doesn't silently mix windows.
    if (metric === 'real_wage_zori_cagr' && startYear < ZORI_MIN_YEAR) return out;
    const priceByPlace = metric === 'real_wage_zhvi_cagr' ? housingByPlace : rentByPlace;
    for (const [pid, panelRows] of byPlace) {
      const wage = placeCagr(panelRows, (r) => r.year, (r) => r.avg_wage, startYear, endYear);
      if (wage == null) continue;
      const priceRows = priceByPlace.get(pid);
      if (!priceRows) continue;
      const price = metric === 'real_wage_zhvi_cagr'
        ? placeCagr(priceRows as PlaceHousingRow[], (r) => r.year, (r) => r.zhvi, startYear, endYear)
        : placeCagr(priceRows as PlaceRentRow[],    (r) => r.year, (r) => r.zori, startYear, endYear);
      if (price == null) continue;
      const real = (1 + wage) / (1 + price) - 1;
      if (Number.isFinite(real)) out.set(pid, real);
    }
  } else if (metric === 'amenity_zhvi' || metric === 'amenity_zori') {
    // Amenity score = residual of a NATIONAL regression
    //   log(price) ~ log(avg salary) + MSA fixed effects
    // fit by within-MSA demeaning (Frisch–Waugh–Lovell): demean both logs by
    // their MSA mean, regress the demeaned series through the origin for one
    // pooled slope β, then each place's residual is how far its rent / home
    // value sits above (+) or below (−) the price its salary predicts, net of
    // the metro average. Positive = pricier than expected = stronger revealed
    // amenity demand. Reported as exp(residual) − 1, i.e. % above/below.
    //
    // The fit uses every place nationally (not just this MSA), so β is the same
    // line every metro is judged against; we only emit the displayed MSA's
    // residuals. Rent vs. home value differ only by which price series is used —
    // the wage and MSA-label inputs are identical.

    // National latest-year wage per place (nearest endYear, positive only).
    const wageNat = new Map<string, number>();
    {
      const grp = new Map<string, PlacePanelRow[]>();
      for (const r of panel) {
        const arr = grp.get(r.place_id) ?? [];
        arr.push(r);
        grp.set(r.place_id, arr);
      }
      for (const [pid, rows] of grp) {
        const r = nearestRow(rows, endYear, (x) => x.avg_wage != null && x.avg_wage > 0);
        if (r?.avg_wage != null) wageNat.set(pid, r.avg_wage);
      }
    }

    // National latest-year price per place.
    const priceNat = new Map<string, number>();
    if (metric === 'amenity_zhvi') {
      const grp = new Map<string, PlaceHousingRow[]>();
      for (const h of housing) {
        if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
        const arr = grp.get(h.place_id) ?? [];
        arr.push(h);
        grp.set(h.place_id, arr);
      }
      for (const [pid, rows] of grp) {
        const r = nearestRow(rows, endYear, (x) => x.zhvi != null && x.zhvi > 0);
        if (r?.zhvi != null) priceNat.set(pid, r.zhvi);
      }
    } else {
      const grp = new Map<string, PlaceRentRow[]>();
      for (const r of rent) {
        if (r.zori == null || r.zori <= 0) continue;
        const arr = grp.get(r.place_id) ?? [];
        arr.push(r);
        grp.set(r.place_id, arr);
      }
      for (const [pid, rows] of grp) {
        const r = nearestRow(rows, endYear, (x) => x.zori != null && x.zori > 0);
        if (r?.zori != null) priceNat.set(pid, r.zori);
      }
    }

    // Assemble observations with their MSA label.
    const msaOf = new Map<string, string>();
    for (const d of directory) msaOf.set(d.place_id, d.msa_id);
    const obs: { pid: string; msa: string; x: number; y: number }[] = [];
    for (const [pid, price] of priceNat) {
      const wage = wageNat.get(pid);
      const msa = msaOf.get(pid);
      if (wage == null || !msa) continue;
      obs.push({ pid, msa, x: Math.log(wage), y: Math.log(price) });
    }
    if (obs.length < 3) return out;

    // Within-MSA means (the fixed effects).
    const grpSum = new Map<string, { sx: number; sy: number; n: number }>();
    for (const o of obs) {
      const s = grpSum.get(o.msa) ?? { sx: 0, sy: 0, n: 0 };
      s.sx += o.x; s.sy += o.y; s.n += 1;
      grpSum.set(o.msa, s);
    }

    // Pooled within slope β (FWL): regress demeaned y on demeaned x.
    let sxx = 0, sxy = 0;
    for (const o of obs) {
      const s = grpSum.get(o.msa)!;
      const xd = o.x - s.sx / s.n;
      const yd = o.y - s.sy / s.n;
      sxx += xd * xd;
      sxy += xd * yd;
    }
    if (sxx <= 0) return out;
    const beta = sxy / sxx;

    // Emit residuals for the displayed MSA's places, as exp(resid) − 1.
    for (const o of obs) {
      if (!msaPlaceIdsSet.has(o.pid)) continue;
      const s = grpSum.get(o.msa)!;
      const xd = o.x - s.sx / s.n;
      const yd = o.y - s.sy / s.n;
      const pct = Math.exp(yd - beta * xd) - 1;
      if (Number.isFinite(pct)) out.set(o.pid, pct);
    }
  } else if (metric === 'amenity_zhvi_delta' || metric === 'amenity_zori_delta') {
    // Change in the amenity score over the compare window: the same national
    // FE regression as the levels metric (see lib/amenityResidual), fit
    // separately at each end of the window (per-place nearest-year snap) and
    // differenced. Fitting per endpoint lets the national price–wage line
    // itself move without polluting the delta, and the MSA FE absorbs the
    // metro-wide drift — so each place's value reads as gaining (+) or losing
    // (−) appeal relative to its own metro. Only places observable at BOTH
    // ends enter either fit, so the two cross-sections cover the same sample.
    const msaOf = new Map<string, string>();
    for (const d of directory) msaOf.set(d.place_id, d.msa_id);

    // National panel grouping — deliberately NOT filtered to this MSA.
    const panelGrp = new Map<string, PlacePanelRow[]>();
    for (const r of panel) {
      const arr = panelGrp.get(r.place_id) ?? [];
      arr.push(r);
      panelGrp.set(r.place_id, arr);
    }
    const priceSeries = new Map<string, { year: number; v: number }[]>();
    if (metric === 'amenity_zhvi_delta') {
      for (const h of housing) {
        if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
        const arr = priceSeries.get(h.place_id) ?? [];
        arr.push({ year: h.year, v: h.zhvi });
        priceSeries.set(h.place_id, arr);
      }
    } else {
      for (const r of rent) {
        if (r.zori == null || r.zori <= 0) continue;
        const arr = priceSeries.get(r.place_id) ?? [];
        arr.push({ year: r.year, v: r.zori });
        priceSeries.set(r.place_id, arr);
      }
    }
    const obsStart: AmenityObs[] = [];
    const obsEnd: AmenityObs[] = [];
    for (const [pid, rows] of panelGrp) {
      const msa = msaOf.get(pid);
      const prices = priceSeries.get(pid);
      if (!msa || !prices) continue;
      const wS = nearestRow(rows, startYear, (r) => r.avg_wage != null && r.avg_wage > 0);
      const wE = nearestRow(rows, endYear,   (r) => r.avg_wage != null && r.avg_wage > 0);
      if (!wS || !wE || wS.year === wE.year) continue;
      const pS = nearestRow(prices, startYear);
      const pE = nearestRow(prices, endYear);
      if (!pS || !pE || pS.year === pE.year) continue;
      obsStart.push({ id: pid, group: msa, logWage: Math.log(wS.avg_wage!), logPrice: Math.log(pS.v) });
      obsEnd.push({ id: pid, group: msa, logWage: Math.log(wE.avg_wage!), logPrice: Math.log(pE.v) });
    }
    const delta = residualDelta(amenityResiduals(obsStart), amenityResiduals(obsEnd));
    for (const [pid, d] of delta) {
      if (!msaPlaceIdsSet.has(pid)) continue;
      out.set(pid, d);
    }
  } else if (metric === 'fiscal_debt_to_rev') {
    // Unit-less ratio — no per-capita normalization. Skip places with zero or
    // missing general_revenue (no meaningful ratio).
    for (const r of fiscal) {
      if (!msaPlaceIdsSet.has(r.place_id)) continue;
      if (!r.general_revenue || r.general_revenue <= 0) continue;
      const d = r.debt_outstanding_total;
      if (d == null) continue;
      out.set(r.place_id, d / r.general_revenue);
    }
  } else if (metric === 'fiscal_effective_rate') {
    // Interest paid ÷ end-of-FY debt outstanding. Floor at $50/cap of debt so
    // tiny-denominator noise doesn't dominate the palette.
    for (const r of fiscal) {
      if (!msaPlaceIdsSet.has(r.place_id)) continue;
      const debt = r.debt_outstanding_total;
      const interest = r.interest_general_debt;
      if (debt == null || debt <= 0 || interest == null) continue;
      if (!r.cog_pop || r.cog_pop <= 0) continue;
      if (debt / r.cog_pop < 50) continue;
      out.set(r.place_id, interest / debt);
    }
  } else if (metric.startsWith('fiscal_')) {
    // Per-capita fiscal metrics. FY2022 snapshot. Always per-capita using
    // same-vintage cog_pop so the denominator stays internally consistent
    // with the numerator. Places not in COG (53 small villages in tail, plus
    // all CDPs) fall through as no-data — they render with the NO_DATA fill.
    const pick = (r: PlaceFiscalRow): number | null =>
      metric === 'fiscal_gen_rev_pc'      ? r.general_revenue :
      metric === 'fiscal_property_tax_pc' ? r.tax_property :
      metric === 'fiscal_net_balance_pc'  ? r.net_balance :
      metric === 'fiscal_debt_pc'         ? r.debt_outstanding_total :
      metric === 'fiscal_public_safety_pc'? r.public_safety_current :
      metric === 'fiscal_education_pc'    ? r.exp_education_current :
                                            null;
    for (const r of fiscal) {
      if (!msaPlaceIdsSet.has(r.place_id)) continue;
      if (!r.cog_pop || r.cog_pop <= 0) continue;
      const v = pick(r);
      if (v == null) continue;
      out.set(r.place_id, v / r.cog_pop);
    }
  }

  return out;
}

function fmtValue(v: number | undefined, kind: ValueKind): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (kind === 'money') return fmtMoney(v);
  if (kind === 'count') return fmtInt.format(v);
  if (kind === 'ratio') return `${v.toFixed(2)}×`;
  if (kind === 'pp') return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`;
  return `${(v * 100).toFixed(2)}%`;
}

function extendBbox(bbox: number[], coords: unknown): void {
  if (Array.isArray(coords) && typeof coords[0] === 'number') {
    const [x, y] = coords as [number, number];
    if (x < bbox[0]) bbox[0] = x;
    if (y < bbox[1]) bbox[1] = y;
    if (x > bbox[2]) bbox[2] = x;
    if (y > bbox[3]) bbox[3] = y;
    return;
  }
  if (Array.isArray(coords)) for (const c of coords) extendBbox(bbox, c);
}

function ResetViewControl({ bounds, position = 'topleft' }: { bounds: L.LatLngBoundsExpression; position?: L.ControlPosition }) {
  const map = useMap();
  useEffect(() => {
    const ctl = new L.Control({ position });
    ctl.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control msa-reset-control');
      const btn = L.DomUtil.create('a', '', div) as HTMLAnchorElement;
      btn.href = '#';
      btn.title = 'Reset view';
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', 'Reset map view to MSA');
      btn.textContent = '⤾';
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        map.flyToBounds(bounds, { padding: [16, 16], duration: 0.4 });
      });
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    ctl.addTo(map);
    return () => { ctl.remove(); };
  }, [map, bounds, position]);
  return null;
}

export default function MsaPlacesChoropleth({
  msaId,
  msaName,
  placeId,
  placeName,
  panel,
  housing,
  rent,
  fiscal,
  directory,
  msaPlaceIds,
  fill = false,
  toolsPortalId,
  initialMetric = 'salary_level',
  placeholder = false,
}: Props) {
  const placesGeo = useMsaPlacesGeo(msaId);
  const { startYear, endYear } = useYearRange();
  const [metric, setMetric] = useState<Metric>(initialMetric);
  // We only track the hovered id; the metric value is read on render from the
  // current `values` map so switching metric while hovered updates the tooltip.
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Cursor position in map-container pixels — the tooltip rides beside it.
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);
  // The map lives in STATE, not a ref: react-leaflet v4 assigns forwarded refs
  // a commit after creation, and with all-static data the fit effect's deps
  // (`bounds`) never change — a ref-guarded effect would run once against null
  // and never re-fit (see StoryMap for the same pattern + full rationale).
  const [map, setMap] = useState<L.Map | null>(null);
  const mapRefCb = useCallback((m: L.Map | null) => setMap(m), []);
  const layerRef = useRef<L.GeoJSON | null>(null);

  // The stage card's tools slot — resolved after mount (the slot div commits
  // in the same render pass as this chart, so the effect always finds it).
  const [toolsEl, setToolsEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setToolsEl(toolsPortalId ? document.getElementById(toolsPortalId) : null);
  }, [toolsPortalId]);

  const msaSet = useMemo(() => new Set(msaPlaceIds), [msaPlaceIds]);
  const values = useMemo(
    () => computeValues(metric, msaSet, panel, housing, rent, fiscal, directory, startYear, endYear),
    [metric, msaSet, panel, housing, rent, fiscal, directory, startYear, endYear],
  );

  const meta = METRICS[metric];

  // Robust 5–95 percentile domain so a single outlier place doesn't flatten
  // the whole MSA into one colour. For diverging metrics (CAGRs) we anchor 0
  // at the cream midpoint but stretch the two halves to the actual local lo/hi,
  // so within-MSA variation reads cleanly even when growth is mostly positive.
  const { domain, ticks } = useMemo(() => {
    const xs = Array.from(values.values()).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (xs.length === 0) return { domain: [0, 1] as [number, number], ticks: [] as number[] };
    let lo = percentile(xs, 0.05);
    let hi = percentile(xs, 0.95);
    if (hi === lo) hi = lo + 1e-9;
    if (meta.diverging && lo < 0 && hi > 0) {
      return { domain: [lo, hi] as [number, number], ticks: [lo, 0, hi] };
    }
    return { domain: [lo, hi] as [number, number], ticks: [lo, (lo + hi) / 2, hi] };
  }, [values, meta.diverging]);

  const colorFor = useCallback(
    (v: number | undefined): string => {
      if (placeholder) return PLACEHOLDER_FILL;
      if (v == null || !Number.isFinite(v)) return NO_DATA;
      const [lo, hi] = domain;
      if (hi === lo) return sequentialColor(0.5);
      if (meta.diverging) {
        // When 0 is *inside* [lo, hi] the data has both signs — anchor cream
        // at 0 and stretch each half to its own end. When 0 is *outside* the
        // data lives entirely on one side, so use the full cream → end ramp
        // for that side (otherwise the visible variation gets squished into a
        // narrow slice of the palette).
        if (lo >= 0) {
          const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
          return divergingColor(t);            // cream → teal across full range
        }
        if (hi <= 0) {
          const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
          return divergingColor(-(1 - t));     // orange → cream across full range
        }
        if (v >= 0) {
          const t = Math.max(0, Math.min(1, v / hi));
          return divergingColor(t);
        }
        const t = Math.max(0, Math.min(1, -v / -lo));
        return divergingColor(-t);
      }
      return sequentialColor((v - lo) / (hi - lo));
    },
    [domain, meta.diverging, placeholder],
  );

  // Refs follow the latest values/colorFor so closures captured by Leaflet
  // event handlers (mouseover) always read fresh data even though the handler
  // itself was installed once at GeoJSON-mount time.
  const valuesRef = useRef(values);
  const colorForRef = useRef(colorFor);
  useEffect(() => {
    valuesRef.current = values;
    colorForRef.current = colorFor;
  }, [values, colorFor]);

  const { bounds, fc } = useMemo(() => {
    if (!placesGeo.data || placesGeo.data.features.length === 0) {
      return { bounds: null, fc: null } as const;
    }
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of placesGeo.data.features) {
      if (f.geometry && 'coordinates' in f.geometry) extendBbox(bbox, f.geometry.coordinates);
    }
    const [w, s, e, n] = bbox;
    return { bounds: L.latLngBounds([s, w], [n, e]), fc: placesGeo.data };
  }, [placesGeo.data]);

  // Latest bounds, readable from the resize observer below without re-observing.
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    if (!map || !bounds) return;
    // Re-measure before fitting: the container can be zero-height when Leaflet
    // initialises (the theme <link> loads after mount), leaving the creation-
    // time `bounds` fit garbage. Instant fit — this runs on arrival, not on a
    // user-visible transition.
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [16, 16] });
  }, [map, bounds]);

  // And keep the fit honest if the container gets its real size late (or the
  // window resizes): only act when Leaflet's cached size disagrees with the
  // real one, so hover/metric re-renders never snap the view.
  useEffect(() => {
    if (!map) return;
    const el = map.getContainer();
    const ro = new ResizeObserver(() => {
      const real = el.getBoundingClientRect();
      const cached = map.getSize();
      if (Math.abs(real.width - cached.x) < 2 && Math.abs(real.height - cached.y) < 2) return;
      map.invalidateSize();
      if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: [16, 16] });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  // Re-style polygons when the metric or year window changes. Driving all
  // subsequent styling through this imperative path (rather than the GeoJSON
  // `style` prop) keeps a hover-induced re-render from clobbering the hover
  // weight — see the stable styleFn below.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((sub) => {
      const feat = (sub as L.Path & { feature?: GeoJSON.Feature }).feature;
      const pid = (feat?.properties as { place_id?: string } | undefined)?.place_id;
      if (!pid) return;
      const v = values.get(pid);
      const isActive = pid === placeId;
      (sub as L.Path).setStyle({
        color: isActive ? HIGHLIGHT : GL.ink3,
        weight: isActive ? 2.5 : 0.4,
        fillColor: colorFor(v),
        fillOpacity: placeholder ? 0.5 : v == null ? 0.35 : 0.85,
      });
      if (isActive) (sub as L.Path).bringToFront();
    });
  }, [values, colorFor, placeId, placeholder]);

  // Stable style fn for the GeoJSON `style` prop. react-leaflet calls setStyle
  // on every layer whenever this prop's reference changes, so we keep the
  // reference fixed across hover-induced re-renders and let the effect above
  // do the per-metric restyling. Reads via refs so the initial mount still
  // shows the right colours.
  const styleFn = useCallback(
    (feature?: GeoJSON.Feature): L.PathOptions => {
      const pid = (feature?.properties as { place_id?: string } | undefined)?.place_id;
      const v = pid ? valuesRef.current.get(pid) : undefined;
      const isActive = pid === placeId;
      return {
        color: isActive ? HIGHLIGHT : GL.ink3,
        weight: isActive ? 2.5 : 0.4,
        fillColor: colorForRef.current(v),
        fillOpacity: placeholder ? 0.5 : v == null ? 0.35 : 0.85,
      };
    },
    [placeId, placeholder],
  );

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: L.Layer) => {
      const props = feature.properties as { place_id?: string; place_name?: string } | undefined;
      const pid = props?.place_id;
      layer.on({
        mouseover: (e) => {
          (e.target as L.Path).setStyle({ weight: 2.5 });
          if (pid) setHoverId(pid);
          const me = e as L.LeafletMouseEvent;
          setHoverPt({ x: me.containerPoint.x, y: me.containerPoint.y });
        },
        // Follow the cursor across the polygon so the tooltip stays beside it.
        mousemove: (e) => {
          const me = e as L.LeafletMouseEvent;
          setHoverPt({ x: me.containerPoint.x, y: me.containerPoint.y });
        },
        mouseout: (e) => {
          const isActive = pid === placeId;
          (e.target as L.Path).setStyle({ weight: isActive ? 2.5 : 0.4 });
          setHoverId(null);
          setHoverPt(null);
        },
      });
    },
    [placeId],
  );

  if (placesGeo.loading) return <p className="loading">Loading map…</p>;
  if (placesGeo.error) return <p className="error">Could not load MSA places: {placesGeo.error.message}</p>;
  if (!fc || !bounds) return <p className="muted">No place geometries for this MSA.</p>;

  const hoverName = hoverId
    ? (fc.features.find((f) => (f.properties as { place_id?: string }).place_id === hoverId)
        ?.properties as { place_name?: string } | undefined)?.place_name ?? hoverId
    : null;
  const hoverValue = hoverId ? values.get(hoverId) : undefined;

  const controls = (
    <div className="chart-controls">
      <label>
        <span className="chart-controls-label">Fill</span>
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
          {Array.from(
            Object.entries(METRICS).reduce((acc, [k, m]) => {
              const list = acc.get(m.group) ?? [];
              list.push([k, m.label] as const);
              acc.set(m.group, list);
              return acc;
            }, new Map<string, (readonly [string, string])[]>()),
          ).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );

  // Source/methodology text — placed below the map normally, or folded into a
  // collapsible inside the legend when the map runs full-bleed.
  const sourceInner = placeholder ? (
    <>
      <strong>Placeholder.</strong> This prototype ships without the real
      appeal-shift figures, so every place is drawn a flat neutral grey — the map
      shows the {msaName} MSA's geography only, not actual data. The red outline
      marks {placeName}.
    </>
  ) : (
    <>
      {metric === 'pop_level' && `Census PEP subcounty (incorporated places only — CDPs are blank).`}
      {metric === 'pop_cagr'  && `Census PEP for incorporated places; IRS SOI n_returns (household proxy) for CDPs where PEP is unavailable.`}
      {meta.group === 'Salary' && `IRS SOI ZIP → place via Census ZCTA × Place areal weights. Residence-based.`}
      {meta.group === 'Home value' && `Zillow ZHVI all-tier, aggregated ZIP → place via the same weights.`}
      {meta.group === 'Rent' && `Zillow ZORI (smoothed all-homes), aggregated ZIP → place via the same weights. Series begins 2015.`}
      {meta.group === 'Real wage' && `(1 + salary CAGR) / (1 + ${metric === 'real_wage_zhvi_cagr' ? 'home value' : 'rent'} CAGR) − 1. Both inputs use the same ZIP → place areal weights. ${metric === 'real_wage_zori_cagr' ? 'Rent series begins 2015 — windows starting earlier are blank.' : ''}`}
      {meta.group === 'Amenity score' && `Residual from a national OLS of log(${metric.startsWith('amenity_zhvi') ? 'home value' : 'rent'}) on log(avg salary) with MSA fixed effects — how far each place's ${metric.startsWith('amenity_zhvi') ? 'home value' : 'rent'} sits above (+) or below (−) the level its salary predicts, net of the metro average. A Rosen-Roback amenity proxy: pricier-than-predicted housing signals stronger revealed demand to live there.${metric.endsWith('_delta') ? ' The change metric fits that regression separately at each end of the compare window and differences each place’s residual — only places observable at both ends enter the fit.' : ''} Inputs share the same ZIP → place areal weights.${metric.startsWith('amenity_zori') ? ' Rent series begins 2015.' : ''}`}
      {meta.group === 'Fiscal' && `2022 Census of Governments Individual Unit File, FY2022. Incorporated places only — CDPs have no government. "General" excludes utility & liquor enterprise.`}
      {' '}
      {meta.group === 'Amenity score'
        ? metric.endsWith('_delta')
          ? `Change in the residual over ${startYear}–${endYear}, in log points (≈ pp); red = losing appeal relative to what salaries predict, green = gaining, both net of the metro-wide trend. The palette stretches to the local 5–95 percentile range. The model is fit nationally but residuals are shown for this MSA only.`
          : `Residual in % above/below the salary-predicted price (latest year near ${endYear}); red = cheaper than predicted, green = pricier. The palette stretches to the local 5–95 percentile range, so colours show within-MSA variation. The model is fit nationally but residuals are shown for this MSA only.`
        : meta.diverging
        ? `CAGR over ${startYear}–${endYear}; red = decline, green = growth. The palette stretches to the local 5–95 percentile range, so colours show within-MSA variation rather than a national scale.`
        : meta.group === 'Fiscal'
        ? `Per-capita FY2022 figures; palette stretched to the local 5–95 percentile range. Grey places have no COG record for this metric.`
        : `Latest available year in ${endYear}±. Grey places have no data for this metric.`}
      {' '}The red outline marks {placeName} within the {msaName} MSA.
    </>
  );

  const legend = (
    <div className={`choropleth-legend${placeholder ? ' is-placeholder' : ''}${fill ? ' is-inline' : ''}`}>
      <span className="chart-legend-label">{meta.label}</span>
      {placeholder ? (
        <div className="choropleth-legend-placeholder">
          <span className="choropleth-legend-swatch" style={{ background: PLACEHOLDER_FILL }} />
          Placeholder — illustrative geometry only, not actual figures.
        </div>
      ) : (
        <>
          <div className="choropleth-legend-bar">
            {Array.from({ length: 24 }).map((_, i) => {
              const t = i / 23;
              const v = domain[0] + t * (domain[1] - domain[0]);
              return (
                <span
                  key={i}
                  className="choropleth-legend-cell"
                  style={{ background: colorFor(v) }}
                />
              );
            })}
          </div>
          <div className="choropleth-legend-ticks">
            {ticks.map((t, i) => (
              <span key={i}>{fmtValue(t, meta.kind)}</span>
            ))}
          </div>
        </>
      )}
      {fill && (
        <details className="choropleth-legend-source">
          <summary>Source &amp; method</summary>
          <div className="chart-source">{sourceInner}</div>
        </details>
      )}
    </div>
  );

  const mapBlock = (
    <div className={`msa-map${fill ? ' is-fill' : ''}`} style={{ position: 'relative' }}>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [16, 16] }}
        scrollWheelZoom={false}
        style={fill ? { width: '100%', height: '100%' } : { width: '100%', aspectRatio: '720 / 480' }}
        ref={mapRefCb}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={18} />
        <GeoJSON
          key={`${msaId}`}
          data={fc}
          style={styleFn}
          ref={(g) => { layerRef.current = g as unknown as L.GeoJSON | null; }}
          onEachFeature={onEachFeature}
        />
        {/* Zoom + reset stay top-left (leaflet's default corner) — the whole
            right edge belongs to the story's year selector, rail and arrows. */}
        {bounds && <ResetViewControl bounds={bounds} position="topleft" />}
      </MapContainer>

      {/* In full-bleed the legend rides in the top-left overlay column; inline
          here it stays pinned to the map's bottom-right corner. */}
      {!fill && legend}

      {hoverId && hoverName && hoverPt && (() => {
        // Beside the cursor, flipping to the other side near the right/bottom
        // edges so it never runs off the map.
        const size = map?.getSize();
        const flipX = size != null && hoverPt.x > size.x - 240;
        const flipY = size != null && hoverPt.y > size.y - 110;
        return (
          <div
            className="chart-tooltip choropleth-tooltip"
            style={{
              left: hoverPt.x + (flipX ? -14 : 14),
              top: hoverPt.y + (flipY ? -14 : 14),
              transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
            }}
          >
            <div className="chart-tooltip-name">{hoverName}</div>
            <dl className="chart-tooltip-grid">
              <div style={{ display: 'contents' }}>
                <dt>{meta.label}</dt>
                <dd>{placeholder ? 'placeholder' : fmtValue(hoverValue, meta.kind)}</dd>
              </div>
            </dl>
          </div>
        );
      })()}
    </div>
  );

  if (fill) {
    const tools = (
      <>
        {!placeholder && controls}
        {legend}
      </>
    );
    return (
      <div className="msa-choropleth-fill">
        {mapBlock}
        {/* Tools + legend live inside the stage narrative card when it offers
            a slot; otherwise they stack top-left, clear of the zoom bar. */}
        {toolsEl ? (
          createPortal(tools, toolsEl)
        ) : (
          <div className="msa-choropleth-overlay">{tools}</div>
        )}
      </div>
    );
  }

  return (
    <>
      {!placeholder && controls}
      {mapBlock}
      <p className="chart-source">
        <span className="chart-source-label">Source</span>
        {sourceInner}
      </p>
    </>
  );
}
