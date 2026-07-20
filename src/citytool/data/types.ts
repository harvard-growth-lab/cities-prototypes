// Standardized cross-country shapes — produced by scripts/build-data.sh.
//
// Country-specific raw data is normalized into these schemas so the React
// layer can stay country-agnostic. When adding a country, the build step is
// responsible for producing rows matching these types.

export interface CityDirectoryRow {
  country: string;
  city_id: string;
  city_name: string;
  city_long_name: string | null;
}

export interface CityPanelRow {
  country: string;
  city_id: string;
  city_name: string;
  city_long_name: string | null;
  year: number;
  population: number | null;
  mean_wage: number | null;
  median_wage: number | null;
  wage_10th: number | null;
  wage_25th: number | null;
  wage_75th: number | null;
  wage_90th: number | null;
  wage_premium: number | null;
  rpp_all_items: number | null;
  rpp_housing: number | null;
  real_pci: number | null;
  real_personal_income: number | null;
  // BLS LAUS annual averages (metro grain). Counts are persons; rate is percent.
  labor_force: number | null;
  employed: number | null;
  unemployed: number | null;
  unemployment_rate: number | null;
}

export interface SectorEmploymentRow {
  country: string;
  city_id: string;
  year: number;
  sector: string;
  sector_title: string;
  employment: number | null;
}

export interface NationalSectorRow {
  country: string;
  year: number;
  sector_title: string;
  employment: number | null;
}

export interface HousingRow {
  country: string;
  city_id: string;
  year: number;
  tier: 'all' | 'top' | 'bottom';
  zhvi: number | null;
}

// Annual Zillow Observed Rent Index by MSA. Smoothed all-homes series (SFR +
// condo + multifamily). No tier split — Zillow doesn't publish ZORI by tier.
// Coverage: 2015 onward, all 258 MSAs in our directory.
export interface CityRentRow {
  country: string;
  city_id: string;
  year: number;
  zori: number | null;
}

// Source: Jesus's pooled US+MX 4-digit complexity pipeline (eci_4d / pci_4d).
// Pooled-year mapping: 2018 ← MX 2018 + US 2018; 2023 ← MX 2023 + US 2022.

export interface CityIndustryRow {
  country: string;
  city_id: string;
  year: number;
  naics4: string;            // 4-digit harmonised NAICS code
  industry: string | null;
  sector_2d: string | null;  // 2-digit NAICS parent ("31", "54", …)
  employment: number | null;
  pci: number | null;        // industry complexity at this pooled year
}

export interface CityComplexityRow {
  country: string;
  city_id: string;
  year: number;
  eci: number | null;
  employment: number | null;
}

// Annual MSA × NAICS-4 × year employment from Johan's QCEW (own_code=5,
// agglvl=76 — private sector × NAICS-4). Per-MSA parquet under
// /data/msa_industry_employment/<msa_id>.parquet, lazy-loaded per route.
// One row's keyspace is implicit from the URL — the file doesn't carry
// msa_id since that's redundant with the filename.
export interface MsaIndustryRow {
  country: string;
  year: number;
  naics4: string;
  employment: number | null;
}

// Same shape, summed across all counties in Johan's panel — used as the
// national denominator for shift-share decomposition.
export interface NationalIndustryRow {
  country: string;
  year: number;
  naics4: string;
  employment: number | null;
}

// Static per-NAICS-4 attributes: industry title, 2-digit sector parent,
// and PCI. PCI is pinned to the 2023 pooled US+MX complexity vintage and
// used as a permanent industry-level attribute across all annual employment
// vintages.
export interface IndustryAttributeRow {
  country: string;
  naics4: string;
  industry: string | null;
  sector_2d: string;
  pci: number | null;
}

// County-level extensions. Source: J. Canas's ML-imputed QCEW panel
// (cluster:/n/holystore01/LABS/hausmann_lab/lab/jcanas/QCEW/data/final/).
// Only treemap-relevant tables are built for now; population, wages, ECI etc.
// remain MSA-grain.

export interface CountyDirectoryRow {
  country: string;
  msa_id: string;          // parent CBSA — joins to CityDirectoryRow.city_id
  county_id: string;       // 5-char FIPS (SSCCC)
  county_name: string;     // e.g. "Middlesex County"
  county_long_name: string | null;  // e.g. "Middlesex County, Massachusetts"
}

export interface CountyIndustryRow {
  country: string;
  county_id: string;
  year: number;
  naics4: string;
  industry: string | null;   // NAICS-2022 title (Census), null if no match
  sector_2d: string | null;
  employment: number | null;
  pci: number | null;        // null until county PCI is computed upstream
}

export interface CountyPanelRow {
  country: string;
  county_id: string;
  year: number;
  employment: number | null;   // QCEW total covered employment (agglvl 70)
  total_wages: number | null;  // QCEW total annual wages, imputed where suppressed
  mean_wage: number | null;    // total_wages / employment
  population: number | null;   // Census PEP county population
}

export interface CountyHousingRow {
  country: string;
  county_id: string;
  year: number;
  tier: 'all' | 'top' | 'bottom';
  zhvi: number | null;
}

// One row per county. UWisc Applied Population Lab's 2010s net-migration totals
// (all-race × all-sex × all-age). Powers the X-axis of the county scatter.
export interface CountyMigrationRow {
  country: string;
  county_id: string;
  population_2020: number | null;
  net_migrants_decade: number | null;
  expected_pop_2020: number | null;
  migration_rate_decade: number | null;  // already in percent
}

// ZIP-level extensions. ZCTA = Census's polygon-approximation of USPS ZIPs.
// Coverage limited to ZIPs whose dominant county sits in county_directory.

export interface ZipDirectoryRow {
  country: string;
  zip: string;                  // 5-digit ZCTA / USPS ZIP
  primary_county_id: string;    // dominant-county FIPS by land-area share
  msa_id: string;               // inherited from the primary county
  primary_county_name: string;
}

// IRS SOI ZIP-code "noagi" panel. Wages are filed at the worker's *residence*,
// not workplace — keep that framing in the UI to distinguish from QCEW.
export interface ZipPanelRow {
  country: string;
  zip: string;
  year: number;
  n_returns: number | null;
  population: number | null;       // IRS exemptions ≈ population
  n_returns_w_wages: number | null;
  total_wages: number | null;      // USD (already × 1000 from A00200)
  avg_wage: number | null;         // total_wages / n_returns_w_wages
}

export interface ZipHousingRow {
  country: string;
  zip: string;
  year: number;
  tier: 'all' | 'top' | 'bottom';
  zhvi: number | null;
}

// Place = Census incorporated municipality or CDP. The user-facing primary
// unit in the narrative view (what someone means when they say "Boston").

export interface PlaceDirectoryRow {
  country: string;
  place_id: string;           // 7-digit GEOID = STATEFP+PLACEFP, e.g. 2507000
  place_name: string;         // e.g. "Boston"
  place_long_name: string;    // e.g. "Boston city"
  state: string;              // 2-letter, e.g. "MA"
  state_name: string;         // e.g. "Massachusetts"
  lsad: string;               // 25 = city, 21 = borough, 43 = town, 57 = CDP, ...
  class: 'incorporated' | 'CDP';
  primary_county_id: string;
  msa_id: string;             // parent MSA via primary county
}

// IRS-derived (residence-based) aggregated up from zip_panel via areal weights.
export interface PlacePanelRow {
  country: string;
  place_id: string;
  year: number;
  n_returns: number | null;
  population: number | null;        // IRS exemptions ≈ pop (weighted sum)
  n_returns_w_wages: number | null;
  total_wages: number | null;
  avg_wage: number | null;
  // BLS LAUS annual averages (city/town grain, incorporated places ≥25k keyed
  // by Census place FIPS). Counts are persons; rate is percent. Null for CDPs
  // and places LAUS doesn't track (no matching Census place FIPS).
  labor_force: number | null;
  employed: number | null;
  unemployed: number | null;
  unemployment_rate: number | null;
}

export interface PlaceHousingRow {
  country: string;
  place_id: string;
  year: number;
  tier: 'all' | 'top' | 'bottom';
  zhvi: number | null;              // weighted mean across constituent ZIPs
}

// ZORI aggregated from zip_rent via the same ZCTA × Place areal weights as
// place_housing. ZIP-level ZORI covers ~8.3k ZIPs (vs ~30k for ZHVI) so place
// coverage is materially thinner — small CDPs and suburbs frequently render
// no-data.
export interface PlaceRentRow {
  country: string;
  place_id: string;
  year: number;
  zori: number | null;
}

// Municipal finance, FY2022, sourced from the 2022 Census of Governments
// Individual Unit File. One row per incorporated place. All monetary values
// are USD (raw $, not thousands). "General" aggregates follow Census's
// classification — they exclude utility (water/electric/gas/transit) and
// liquor-store enterprise revenue/expenditure, which are reported separately
// so cross-city comparisons aren't dominated by which cities run their own
// utilities. Joined on place_id via a 4-entry crosswalk for consolidated
// city-counties (Louisville, Nashville, Methuen, Watertown).
export interface PlaceFiscalRow {
  country: string;
  place_id: string;
  year: number;                            // 2022 for the COG snapshot
  cog_id: string;                          // 12-char Census government ID
  cog_name: string;
  cog_pop: number | null;                  // population on COG file (own vintage)
  // General-government aggregates (exclude utility & liquor enterprise)
  general_revenue: number | null;
  own_source_general: number | null;       // taxes + charges + misc (no IG)
  ig_revenue_total: number | null;
  general_expenditure: number | null;
  net_balance: number | null;              // general_revenue − general_expenditure
  // Debt stock at end of FY (LT + ST). LT covers ~13.5k cities, ST only ~1k.
  debt_outstanding_total: number | null;
  debt_lt_outstanding_end: number | null;
  debt_st_outstanding_end: number | null;
  // Revenue detail
  rev_taxes_total: number | null;
  rev_charges_general: number | null;
  rev_misc_general: number | null;
  ig_revenue_federal: number | null;
  ig_revenue_state: number | null;
  ig_revenue_local: number | null;
  tax_property: number | null;
  tax_sales_general: number | null;
  tax_sales_selective_other: number | null;
  tax_income_individual: number | null;
  // Expenditure detail
  exp_current_general: number | null;
  exp_capital_general: number | null;
  exp_interest_general: number | null;
  ig_expenditure_to_local: number | null;
  exp_police: number | null;
  exp_fire: number | null;
  public_safety_current: number | null;    // exp_police + exp_fire
  // K-12 spending — only populated for "dependent school systems" (~282
  // cities including NYC, Boston, Baltimore, DC, Chicago). Elsewhere schools
  // are operated by separate independent school district governments and
  // this column is 0.
  exp_education_current: number | null;
  cap_education: number | null;
  exp_highways: number | null;
  cap_highways: number | null;
  exp_parks_rec: number | null;
  exp_libraries: number | null;
  exp_health: number | null;
  exp_hospitals: number | null;
  exp_judicial: number | null;
  exp_sewerage: number | null;
  cap_sewerage: number | null;
  interest_general_debt: number | null;
  // Utility enterprise (reported separately)
  utility_revenue: number | null;
  utility_expenditure: number | null;
  exp_water_util: number | null;
  cap_water_util: number | null;
  exp_electric_util: number | null;
  // Liquor stores enterprise
  rev_liquor: number | null;
  exp_current_liquor: number | null;
}
