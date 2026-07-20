/**
 * Static, hand-anchored replacement for cities-tool's parquet panels. NO real
 * data — a seeded field of ~240 US metros + the Boston-MSA's ~197 municipalities,
 * anchored on the illustrative Boston values from the sandbox profile so the
 * diagnosis lands where the narrative expects (supply-side → amenities):
 *
 *   • field median pop growth ≈ 0.5%/yr  (Boston MSA +0.4% → below → supply)
 *   • field median wage growth ≈ 3.8%/yr (Boston MSA +4.5% → above → supply)
 *   • field median home growth ≈ 8.8%/yr (Boston MSA +7.1% → below → amenity)
 *
 * Everything is generated deterministically at module load.
 */

import type {
  CityDirectoryRow,
  CityPanelRow,
  CityComplexityRow,
  HousingRow,
  CityRentRow,
  PlaceDirectoryRow,
  PlacePanelRow,
  PlaceHousingRow,
  PlaceRentRow,
  PlaceFiscalRow,
  MsaIndustryRow,
  NationalIndustryRow,
  IndustryAttributeRow,
} from "./types";
import { MSA_ID, BOSTON_PLACE_ID, MUNI_REFS } from "./staticGeo";

/* ————— seeded PRNG ————— */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260715);
function gauss() {
  let s = 0;
  for (let i = 0; i < 4; i++) s += rand();
  return (s - 2) / 1.15;
}
const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
const END = 2023;
/** exponential level series from a 2023 anchor + CAGR */
const series = (anchor: number, cagr: number) =>
  YEARS.map((y) => ({ year: y, v: anchor / Math.pow(1 + cagr, END - y) }));
/** slight linear drift for a rate (pp) */
const rateSeries = (end2023: number, ppTotal: number) =>
  YEARS.map((y) => ({ year: y, v: end2023 - (ppTotal * (END - y)) / (END - YEARS[0]) }));

/* ═══════════ metros (all-US field) ═══════════ */

const REAL_NAMES = [
  "New York", "Los Angeles", "Chicago", "Dallas", "Houston", "Washington", "Miami",
  "Philadelphia", "Atlanta", "Phoenix", "San Francisco", "Seattle", "Minneapolis",
  "Denver", "San Diego", "Austin", "Nashville", "Portland", "Pittsburgh", "Detroit",
  "Cleveland", "Charlotte", "Raleigh", "Columbus", "Indianapolis", "Kansas City",
  "Salt Lake City", "Boise", "El Paso", "Youngstown", "Buffalo", "Rochester",
  "Providence", "Hartford", "Richmond", "Louisville", "Memphis", "Oklahoma City",
];

interface MetroSeed {
  city_id: string;
  city_name: string;
  pop2023: number;
  popCagr: number;
  wage2023: number;
  wageCagr: number;
  zhvi2023: number;
  zhviCagr: number;
  zori2023: number;
  zoriCagr: number;
  unemp2023: number;
  unempPp: number;
  premium: number;
}

const metroSeeds: MetroSeed[] = [];
// Boston MSA — the subject, real anchors from the sandbox profile.
metroSeeds.push({
  city_id: MSA_ID,
  city_name: "Boston",
  pop2023: 4_900_000,
  popCagr: 0.004,
  wage2023: 83_000,
  wageCagr: 0.045,
  zhvi2023: 648_000,
  zhviCagr: 0.071,
  zori2023: 2_900,
  zoriCagr: 0.05,
  unemp2023: 3.3,
  unempPp: -0.1,
  premium: 0.14,
});
for (let i = 0; i < 240; i++) {
  const name = REAL_NAMES[i] ?? `Metro ${String(i + 1).padStart(3, "0")}`;
  metroSeeds.push({
    city_id: `9${String(1000 + i)}`,
    city_name: name,
    pop2023: Math.round(80_000 * Math.pow(10, rand() * 2)), // 80K … 8M, log-uniform
    popCagr: 0.005 + gauss() * 0.008,
    wage2023: Math.round(45_000 + rand() * 65_000),
    wageCagr: 0.038 + gauss() * 0.01,
    zhvi2023: Math.round(160_000 + rand() * 900_000),
    zhviCagr: 0.088 + gauss() * 0.03,
    zori2023: Math.round(1_100 + rand() * 2_400),
    zoriCagr: 0.045 + gauss() * 0.02,
    unemp2023: 2.6 + rand() * 3.4,
    unempPp: gauss() * 0.4,
    premium: gauss() * 0.12,
  });
}

export const CITY_DIRECTORY: CityDirectoryRow[] = [
  { country: "usa", city_id: MSA_ID, city_name: "Boston", city_long_name: "Boston–Cambridge–Newton, MA-NH" },
];

export const CITY_PANEL: CityPanelRow[] = metroSeeds.flatMap((m) => {
  const pop = series(m.pop2023, m.popCagr);
  const wage = series(m.wage2023, m.wageCagr);
  const unemp = rateSeries(m.unemp2023, m.unempPp);
  return YEARS.map((y, k) => ({
    country: "usa",
    city_id: m.city_id,
    city_name: m.city_name,
    city_long_name: null,
    year: y,
    population: Math.round(pop[k].v),
    mean_wage: Math.round(wage[k].v),
    median_wage: Math.round(wage[k].v * 0.86),
    wage_10th: null,
    wage_25th: null,
    wage_75th: null,
    wage_90th: null,
    wage_premium: m.premium,
    rpp_all_items: null,
    rpp_housing: null,
    real_pci: null,
    real_personal_income: null,
    labor_force: null,
    employed: null,
    unemployed: null,
    unemployment_rate: Math.round(unemp[k].v * 10) / 10,
  }));
});

export const CITY_HOUSING: HousingRow[] = metroSeeds.flatMap((m) => {
  const z = series(m.zhvi2023, m.zhviCagr);
  return YEARS.map((y, k) => ({
    country: "usa",
    city_id: m.city_id,
    year: y,
    tier: "all" as const,
    zhvi: Math.round(z[k].v),
  }));
});

export const CITY_RENT: CityRentRow[] = metroSeeds.flatMap((m) => {
  const r = series(m.zori2023, m.zoriCagr);
  return YEARS.map((y, k) => ({ country: "usa", city_id: m.city_id, year: y, zori: Math.round(r[k].v) }));
});

export const CITY_COMPLEXITY: CityComplexityRow[] = [
  { country: "usa", city_id: MSA_ID, year: 2023, eci: 2.23, employment: 2_318_573 },
];

/* ═══════════ places (Boston-MSA field) ═══════════ */

interface PlaceSeed {
  place_id: string;
  place_name: string;
  pop2023: number;
  popCagr: number;
  wage2023: number;
  wageCagr: number;
  zhvi2023: number;
  zhviCagr: number;
  unemp2023: number;
  unempPp: number;
}

const placeSeeds: PlaceSeed[] = MUNI_REFS.map((r) => {
  if (r.place_id === BOSTON_PLACE_ID) {
    return {
      place_id: r.place_id,
      place_name: "Boston",
      pop2023: 655_000,
      popCagr: -0.008,
      wage2023: 100_000,
      wageCagr: 0.058,
      zhvi2023: 971_000,
      zhviCagr: 0.036,
      unemp2023: 3.5,
      unempPp: 0.1,
    };
  }
  return {
    place_id: r.place_id,
    place_name: r.place_name,
    pop2023: Math.round(1_500 + rand() * 88_000),
    popCagr: 0.003 + gauss() * 0.012,
    wage2023: Math.round(55_000 + rand() * 95_000),
    wageCagr: 0.04 + gauss() * 0.015,
    zhvi2023: Math.round(380_000 + rand() * 1_200_000),
    zhviCagr: 0.05 + gauss() * 0.02,
    unemp2023: 2.4 + rand() * 3.2,
    unempPp: gauss() * 0.3,
  };
});

export const PLACE_DIRECTORY: PlaceDirectoryRow[] = placeSeeds.map((p) => ({
  country: "usa",
  place_id: p.place_id,
  place_name: p.place_name,
  place_long_name: p.place_id === BOSTON_PLACE_ID ? "Boston city" : `${p.place_name} town`,
  state: "MA",
  state_name: "Massachusetts",
  lsad: p.place_id === BOSTON_PLACE_ID ? "25" : "43",
  class: "incorporated",
  primary_county_id: "25025",
  msa_id: MSA_ID,
}));

export const PLACE_PANEL: PlacePanelRow[] = placeSeeds.flatMap((p) => {
  const pop = series(p.pop2023, p.popCagr);
  const wage = series(p.wage2023, p.wageCagr);
  const unemp = rateSeries(p.unemp2023, p.unempPp);
  return YEARS.map((y, k) => ({
    country: "usa",
    place_id: p.place_id,
    year: y,
    n_returns: null,
    population: Math.round(pop[k].v),
    n_returns_w_wages: null,
    total_wages: null,
    avg_wage: Math.round(wage[k].v),
    labor_force: null,
    employed: null,
    unemployed: null,
    unemployment_rate: Math.round(unemp[k].v * 10) / 10,
  }));
});

export const PLACE_HOUSING: PlaceHousingRow[] = placeSeeds.flatMap((p) => {
  const z = series(p.zhvi2023, p.zhviCagr);
  return YEARS.map((y, k) => ({
    country: "usa",
    place_id: p.place_id,
    year: y,
    tier: "all" as const,
    zhvi: Math.round(z[k].v),
  }));
});

export const PLACE_RENT: PlaceRentRow[] = [];
export const PLACE_FISCAL: PlaceFiscalRow[] = [];

/* ═══════════ industry (Boston MSA) + national + attributes ═══════════ */

interface IndSeed {
  naics4: string;
  sector_2d: string;
  industry: string;
  pci: number;
  emp2023: number;
}
const INDUSTRIES: IndSeed[] = [
  { naics4: "7225", sector_2d: "72", industry: "Restaurants and Other Eating Places", pci: 0.12, emp2023: 175_444 },
  { naics4: "6221", sector_2d: "62", industry: "General Medical and Surgical Hospitals", pci: 0.62, emp2023: 125_559 },
  { naics4: "5417", sector_2d: "54", industry: "Scientific Research and Development Services", pci: 0.93, emp2023: 96_682 },
  { naics4: "6113", sector_2d: "61", industry: "Colleges, Universities, and Professional Schools", pci: 0.76, emp2023: 85_523 },
  { naics4: "5511", sector_2d: "55", industry: "Management of Companies and Enterprises", pci: 0.81, emp2023: 64_860 },
  { naics4: "5415", sector_2d: "54", industry: "Computer Systems Design and Related Services", pci: 0.88, emp2023: 63_891 },
  { naics4: "4451", sector_2d: "44", industry: "Grocery and Convenience Stores", pci: 0.1, emp2023: 60_428 },
  { naics4: "6241", sector_2d: "62", industry: "Individual and Family Services", pci: 0.11, emp2023: 60_218 },
  { naics4: "6211", sector_2d: "62", industry: "Offices of Physicians", pci: 0.5, emp2023: 46_096 },
  { naics4: "2382", sector_2d: "23", industry: "Building Equipment Contractors", pci: 0.34, emp2023: 45_734 },
  { naics4: "5112", sector_2d: "51", industry: "Software Publishers", pci: 0.95, emp2023: 37_826 },
  { naics4: "6216", sector_2d: "62", industry: "Home Health Care Services", pci: 0.09, emp2023: 30_976 },
  { naics4: "5241", sector_2d: "52", industry: "Insurance Carriers", pci: 0.68, emp2023: 30_801 },
  { naics4: "6244", sector_2d: "62", industry: "Child Care Services", pci: 0.07, emp2023: 25_132 },
  { naics4: "5411", sector_2d: "54", industry: "Legal Services", pci: 0.55, emp2023: 24_743 },
  { naics4: "6231", sector_2d: "62", industry: "Nursing Care Facilities", pci: 0.1, emp2023: 24_036 },
  { naics4: "4522", sector_2d: "45", industry: "Department Stores", pci: 0.12, emp2023: 21_646 },
  { naics4: "5412", sector_2d: "54", industry: "Accounting, Tax Preparation, Bookkeeping, and Payroll Services", pci: 0.52, emp2023: 21_260 },
  { naics4: "6213", sector_2d: "62", industry: "Offices of Other Health Practitioners", pci: 0.42, emp2023: 19_242 },
];

const IND_YEARS = [2017, 2020, 2023];
export const MSA_INDUSTRY: MsaIndustryRow[] = INDUSTRIES.flatMap((ind, i) => {
  // per-industry local growth, gently varied so shift-share has signal
  const g = 0.008 + ((i % 5) - 2) * 0.006; // −0.4% … +2%/yr
  return IND_YEARS.map((y) => ({
    country: "usa",
    year: y,
    naics4: ind.naics4,
    employment: Math.round(ind.emp2023 / Math.pow(1 + g, END - y)),
  }));
});

export const NATIONAL_INDUSTRY: NationalIndustryRow[] = INDUSTRIES.flatMap((ind, i) => {
  const scale = 28 + (i % 7) * 4; // Boston is a few % of national
  const gN = 0.01; // national ~1%/yr
  return IND_YEARS.map((y) => ({
    country: "usa",
    year: y,
    naics4: ind.naics4,
    employment: Math.round((ind.emp2023 * scale) / Math.pow(1 + gN, END - y)),
  }));
});

export const INDUSTRY_ATTRIBUTES: IndustryAttributeRow[] = INDUSTRIES.map((ind) => ({
  country: "usa",
  naics4: ind.naics4,
  industry: ind.industry,
  sector_2d: ind.sector_2d,
  pci: ind.pci,
}));
