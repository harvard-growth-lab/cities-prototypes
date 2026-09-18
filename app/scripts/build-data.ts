/* scripts/build-data.ts — City Atlas parquet bundle → public/data/** static JSON.

   Reads data/city_atlas/usa/** with DuckDB and writes the files the app fetches
   (src/data/queries.ts), shaped exactly as src/data/types.ts declares. Every
   output object is built under an explicit type annotation so `pnpm typecheck`
   enforces the contract; the only widening is the industries table (see
   CONTRACT GAP below).

   Usage
     node scripts/build-data.ts                    full build: index, national, 387 metros, 16,943 places, geo
     node scripts/build-data.ts --only 14460,35620 those metros (+ their places and geo); index/national stay full
     node scripts/build-data.ts --skip-places --skip-geo
     node scripts/build-data.ts --verify           only re-run the Boston assertions against public/data

   Method: every table is read once (ordered / grouped by id in SQL), grouped in
   memory by metro or place, then the files are assembled and written. No
   per-unit queries.

   Rounding policy (nulls stay null, never NaN/undefined)
     money and counts                         integers
     CAGRs, log-point residuals               5 dp
     shares, probabilities, densities, pct    4 dp
     RCA                                      2 dp
     percent rates (unemployment, firm rates) 2 dp
     indices: eci/coi/remoteness 4 dp, intensity/education 3 dp, crime/air 1 dp
     patents (fractional families)            1 dp; per-100k 2 dp
     coordinates                              5 dp per metro, 4 dp in geo/metros.json */

import { DuckDBInstance, type DuckDBConnection, type JS } from '@duckdb/node-api'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { isBorderline, median, quadrantOf, rankOf } from '../src/data/derive.ts'
import { NAICS_SECTOR_NAME, sectorOf } from '../src/data/sectors.ts'
import {
  INDUSTRY_COLUMNS,
  OPPORTUNITY_COLUMNS,
  PLACE_COLUMNS,
  SHIFT_SHARE_COLUMNS,
  type AmenityResidual,
  type AtlasIndex,
  type Diagnosis,
  type Industry,
  type IndustryRow,
  type Medians,
  type Metro,
  type MetroGeo,
  type MetroSummary,
  type National,
  type NationalYear,
  type OpportunityRow,
  type PanelYear,
  type Place,
  type PlaceRow,
  type Quadrant,
  type ShiftShareRow,
  type SupplySide,
  type TradabilityClass,
  type Window,
} from '../src/data/types.ts'

/* ------------------------------------------------------------------ setup */

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = join(APP_ROOT, 'data', 'city_atlas', 'usa')
const OUT = join(APP_ROOT, 'public', 'data')

const WINDOW_START = 2014
const WINDOW_END = 2024
/* growth rates keep six decimals: five rounds 0.0656477 to 0.06565, which reads
   as 6.57%/yr where the parquet says 6.56 */
const RATE_DP = 6

/* Six consolidated city-county governments carry their legal form in the
   directory ("Indianapolis city (balance)", "Nashville-Davidson metropolitan
   government (balance)"). The UI names the city; the directory row keeps the
   full form. */
const displayPlaceName = (name: string) =>
  name
    .replace(/\s+city \(balance\)$/, '')
    .replace(/[-/].*?\b(?:metropolitan|metro|consolidated|unified) government \(balance\)$/, '')
    .trim()
const INDUSTRY_YEARS = range(WINDOW_START, WINDOW_END)
const PLACE_SERIES_FROM = 2010 // trim place housing/commute to keep the 16,943 files small
const PATENT_YEAR = 2019 // last complete filing year (spec §1.6-11)
const PUBLICATION_YEAR = 2024
const FIRM_YEAR = 2023
const METRO_FILE_LIMIT = 500 * 1024

const args = parseArgs({
  options: {
    only: { type: 'string' },
    'skip-places': { type: 'boolean', default: false },
    'skip-geo': { type: 'boolean', default: false },
    verify: { type: 'boolean', default: false },
  },
}).values

const T0 = performance.now()
const log = (msg: string) => console.log(`[${((performance.now() - T0) / 1000).toFixed(1).padStart(6)}s] ${msg}`)

function fail(msg: string): never {
  throw new Error(msg)
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(`assertion failed: ${msg}`)
}
function must<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) fail(`missing ${what}`)
  return v
}
function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

/* --------------------------------------------------------------- rounding */

/** Round to `dp` decimals; null stays null; −0 becomes 0. */
function r(x: number | null | undefined, dp: number): number | null {
  if (x === null || x === undefined) return null
  const f = 10 ** dp
  return Math.round(x * f) / f || 0
}
const int = (x: number | null | undefined): number | null => r(x, 0)
/** Same as `r` for a value that must exist. */
function rn(x: number | null | undefined, dp: number, what: string): number {
  return must(r(x, dp), what)
}

/* ---------------------------------------------------------------- duckdb */

type Row = Record<string, unknown>
let conn: DuckDBConnection

const T = (name: string) => `read_parquet('${BUNDLE}/tables/${name}.parquet')`
const D = (name: string) => `read_parquet('${BUNDLE}/derived/${name}.parquet')`
const G = (name: string) => `read_parquet('${BUNDLE}/geo/${name}.parquet')`

/** DuckDB JS value → plain JSON-able value: bigint → number, NaN/±Inf → null, lists → arrays. */
function fromDuck(v: JS, col: string): unknown {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'bigint') {
    if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < -BigInt(Number.MAX_SAFE_INTEGER)) fail(`${col}: bigint out of range`)
    return Number(v)
  }
  if (Array.isArray(v)) return v.map((x) => fromDuck(x, col))
  return fail(`${col}: unsupported DuckDB value type (${Object.prototype.toString.call(v)})`)
}

/** Run a query; assert the result columns are exactly `cols` (in order) so the
 *  row interface `T` and the SQL cannot drift apart silently. */
async function q<T extends Row>(text: string, cols: (keyof T & string)[]): Promise<T[]> {
  const reader = await conn.runAndReadAll(text)
  const names = reader.columnNames()
  assert(
    names.length === cols.length && names.every((n, i) => n === cols[i]),
    `columns [${names.join(', ')}] ≠ expected [${cols.join(', ')}] for:\n${text}`,
  )
  const src = reader.getRowObjectsJS()
  const out: Row[] = new Array(src.length)
  for (let i = 0; i < src.length; i++) {
    const s = src[i]
    const d: Row = {}
    for (const c of cols) d[c] = fromDuck(s[c], c)
    out[i] = d
  }
  return out as T[]
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = m.get(k)
    if (list) list.push(row)
    else m.set(k, [row])
  }
  return m
}
function indexBy<T>(rows: T[], key: (row: T) => string, what: string): Map<string, T> {
  const m = new Map<string, T>()
  for (const row of rows) {
    const k = key(row)
    if (m.has(k)) fail(`duplicate key ${k} in ${what}`)
    m.set(k, row)
  }
  return m
}
const sql = (strings: TemplateStringsArray, ...vals: string[]) =>
  strings.reduce((acc, s, i) => acc + s + (i < vals.length ? vals[i] : ''), '')
const inList = (ids: string[]) => ids.map((id) => `'${id}'`).join(', ')

/* ------------------------------------------------------------- validation */

const QUADRANTS: readonly Quadrant[] = ['demand_positive', 'demand_negative', 'supply_positive', 'supply_negative']
function quadrant(v: unknown, what: string): Quadrant | null {
  if (v === null) return null
  const q = QUADRANTS.find((x) => x === v)
  return q ?? fail(`${what}: bad quadrant ${String(v)}`)
}
function supplySide(v: unknown, what: string): SupplySide | null {
  if (v === null) return null
  if (v === 'cost' || v === 'amenity') return v
  return fail(`${what}: bad supply_side ${String(v)}`)
}
function tier(v: unknown, what: string): TradabilityClass | null {
  if (v === null) return null
  if (v === 'traded' || v === 'partly_traded' || v === 'local') return v
  return fail(`${what}: bad tradability_class ${String(v)}`)
}
function placeClass(v: unknown, what: string): 'incorporated' | 'CDP' {
  if (v === 'incorporated' || v === 'CDP') return v
  return fail(`${what}: bad class ${String(v)}`)
}
function years(a: number | null, b: number | null): [number, number] | null {
  return a === null || b === null ? null : [a, b]
}

/** No undefined / NaN / Infinity / bigint anywhere — JSON.stringify would drop
 *  or mangle them and silently break the contract. */
function assertClean(v: unknown, path: string): void {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) fail(`${path}: non-finite number`)
    return
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) assertClean(v[i], `${path}[${i}]`)
    return
  }
  if (typeof v === 'object') {
    for (const k of Object.keys(v)) assertClean((v as Row)[k], `${path}.${k}`)
    return
  }
  fail(`${path}: ${typeof v} is not JSON`)
}

/** Every key present before stringify is present after parse (the round-trip check). */
function assertRoundTrip(obj: unknown, label: string): void {
  const back: unknown = JSON.parse(JSON.stringify(obj))
  const walk = (a: unknown, b: unknown, path: string): void => {
    if (Array.isArray(a)) {
      assert(Array.isArray(b) && b.length === a.length, `${path}: array length changed`)
      a.forEach((x, i) => walk(x, (b as unknown[])[i], `${path}[${i}]`))
    } else if (a !== null && typeof a === 'object') {
      assert(b !== null && typeof b === 'object', `${path}: object lost`)
      const ka = Object.keys(a)
      const kb = new Set(Object.keys(b as Row))
      for (const k of ka) {
        assert(kb.has(k), `${path}.${k}: key lost in JSON round trip (undefined value?)`)
        walk((a as Row)[k], (b as Row)[k], `${path}.${k}`)
      }
    } else {
      assert(Object.is(a, b) || (a === 0 && b === 0), `${path}: value changed (${String(a)} → ${String(b)})`)
    }
  }
  walk(obj, back, label)
}

function writeJson(path: string, obj: unknown, label: string): number {
  assertClean(obj, label)
  const s = JSON.stringify(obj)
  writeFileSync(path, s)
  return Buffer.byteLength(s)
}

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const cagr = (start: number, end: number, n: number) => Math.pow(end / start, 1 / n) - 1

/* -------------------------------------------------------------- row types */

type MetroDirRow = {
  metro_id: string
  metro_name: string
}
type PlaceDirRow = {
  place_id: string
  place_name: string
  state: string
  state_name: string
  lsad: string | null
  class: string
  metro_id: string
}
type PrincipalRow = {
  metro_id: string
  place_id: string
  place_name: string
  state: string
}
type PanelRow = {
  id: string
  year: number
  population: number | null
  unemployment_rate: number | null
  wage_nowcast: number | null
  wage_nowcast_n: number | null
  wage_nowcast_obs: number | null
  real_wage: number | null
}
type YearValueRow = {
  id: string
  year: number
  value: number
}
type DiagRow = {
  id: string
  pop_year_start: number | null
  pop_year_end: number | null
  pop_start: number | null
  pop_end: number | null
  pop_cagr: number | null
  wage_year_start: number | null
  wage_year_end: number | null
  wage_start: number | null
  wage_end: number | null
  wage_cagr: number | null
  cost_cagr: number | null
  quadrant: string | null
  borderline: boolean | null
  supply_side: string | null
}
type MetroDiagRow = DiagRow & {
  wage_source: string
  cost_series: string
  start_year: number
  end_year: number
  pop_cagr_median: number
  wage_cagr_median: number
  cost_cagr_median: number
}
type AmenityRow = {
  id: string
  wage_year_start: number
  wage_year_end: number
  price_year_start: number
  price_year_end: number
  residual: number
  residual_pct: number
  residual_delta: number | null
}
type ShiftShareTotalsRow = {
  id: string
  start_employment: number
  end_employment: number
  ns_total: number
  im_total: number
  ls_total: number
  new_industries_total: number
}
type ShiftShareSrcRow = {
  id: string
  industry_code: string
  e_r_t0: number
  e_r_t1: number
  ns: number
  im: number
  ls: number
  is_new: boolean
}
type OpportunitySrcRow = {
  id: string
  industry_code: string
  density: number
  present: boolean
  rca: number | null
  employment: number
}
type ComplexityRow = {
  id: string
  year: number
  eci: number
  eci_rank: number
}
type OutlookRow = {
  id: string
  year: number
  coi: number
  coi_rank: number
}
type InnovationRow = {
  id: string
  year: number
  patents: number | null
  patents_per_100k: number | null
  publications: number | null
  publications_per_100k: number | null
}
type PatentRcaRow = {
  id: string
  level: string
  key: string
  patents: number
  rca: number
  above_floor: boolean
}
type PublicationRcaRow = {
  id: string
  level: string
  key: string
  appearances: number
  rca: number
  above_floor: boolean
}
type LabelRow = {
  key: string
  label: string
}
type FirmRow = {
  id: string
  year: number
  startup_rate_adj: number
  firm_exit_rate_adj: number
  net_rate_adj: number
}
type RemotenessRow = {
  id: string
  remoteness_index: number | null
}
type InputRow = {
  id: string
  year: number
  input: string
  intensity: number
}
type IndustryWideRow = {
  id: string
  industry_code: string
  ys: number[]
  es: number[]
  rs: number[]
  ms: number[]
}
type NationalEmpRow = {
  industry_code: string
  year: number
  employment: number
}
type AttrRow = {
  industry_code: string
  industry: string
  sector_2d: string
  pci: number | null
  tradability: number | null
  tradability_class: string | null
}
type FitRow = {
  grain: string
  fit: string
  beta: number
  n: number
}
type MetroGeoRow = {
  id: string
  name: string
  area: number | null
  lng: number
  lat: number
  g5: string
  g4: string
}
type PlaceGeoRow = {
  id: string
  metro_id: string
  name: string
  lsad: string | null
  area: number | null
  g5: string
}
type PlacePanelRow = {
  id: string
  year: number
  population: number | null
  unemployment_rate: number | null
  wage_nowcast: number | null
  wage_nowcast_obs: number | null
  real_wage: number | null
}
type CommuteRow = {
  id: string
  year: number
  resident_workers: number
  jobs_here: number
  live_work_here: number
  out_commuters: number
  in_commuters: number
}
type AirRow = {
  id: string
  year: number
  value: number
  national: number
}
type JobAccessRow = {
  id: string
  isochrone: number
  total_employment: number
  flag: number | null
  rank_city: number | null
  rank_national: number | null
}
type FeaturesRow = {
  id: string
  restaurant_count: number
  culture_count: number
  daily_needs_count: number
}

type Geometry = MetroGeo['features'][number]['geometry']
type Feature = MetroGeo['features'][number]

/* --------------------------------------------------------------- geometry */

function roundCoords(v: unknown, dp: number, path: string): unknown {
  if (Array.isArray(v)) return v.map((x, i) => roundCoords(x, dp, `${path}[${i}]`))
  if (typeof v === 'number') return rn(v, dp, path)
  return fail(`${path}: coordinate is ${typeof v}`)
}
/** Parse DuckDB's ST_AsGeoJSON output; null for an empty geometry. */
function parseGeometry(text: string, dp: number, what: string): Geometry | null {
  const g: unknown = JSON.parse(text)
  assert(g !== null && typeof g === 'object', `${what}: geometry is not an object`)
  const { type, coordinates } = g as { type?: unknown; coordinates?: unknown }
  assert(type === 'Polygon' || type === 'MultiPolygon', `${what}: geometry type ${String(type)}`)
  assert(Array.isArray(coordinates), `${what}: no coordinates`)
  if (coordinates.length === 0) return null
  const rounded = roundCoords(coordinates, dp, what)
  return type === 'Polygon'
    ? { type, coordinates: rounded as number[][][] }
    : { type, coordinates: rounded as number[][][][] }
}

/* -------------------------------------------------------------- the build */

interface PlaceLatest {
  population: number | null
  wage: number | null
  unemployment: number | null
  homeValue: number | null
  jobsHere: number | null
  residentWorkers: number | null
}

function diagnosisOf(d: DiagRow, what: string): Diagnosis {
  return {
    popYears: years(d.pop_year_start, d.pop_year_end),
    popStart: int(d.pop_start),
    popEnd: int(d.pop_end),
    popCagr: r(d.pop_cagr, RATE_DP),
    wageYears: years(d.wage_year_start, d.wage_year_end),
    wageStart: int(d.wage_start),
    wageEnd: int(d.wage_end),
    wageCagr: r(d.wage_cagr, RATE_DP),
    costCagr: r(d.cost_cagr, RATE_DP),
    quadrant: quadrant(d.quadrant, what),
    borderline: d.borderline === true,
    supplySide: supplySide(d.supply_side, what),
  }
}
function amenityOf(a: AmenityRow | undefined, what: string): AmenityResidual | null {
  if (!a) return null
  return {
    residual: rn(a.residual, 5, `${what}.residual`),
    residualPct: rn(a.residual_pct, 4, `${what}.residual_pct`),
    residualDelta: r(a.residual_delta, 5),
    wageYears: [a.wage_year_start, a.wage_year_end],
    priceYears: [a.price_year_start, a.price_year_end],
  }
}
function panelYearOf(p: {
  year: number
  population: number | null
  unemployment_rate: number | null
  wage_nowcast: number | null
  wage_nowcast_obs: number | null
  real_wage: number | null
}): PanelYear {
  return {
    year: p.year,
    population: int(p.population),
    unemployment: r(p.unemployment_rate, 2),
    wage: int(p.wage_nowcast),
    wageObs: p.wage_nowcast_obs,
    realWage: int(p.real_wage),
  }
}
const series = (rows: YearValueRow[] | undefined, dp: number) =>
  (rows ?? []).map((x) => ({ year: x.year, value: rn(x.value, dp, 'series value') }))

async function build(): Promise<void> {
  const onlyIds = args.only ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null
  const buildPlaces = !args['skip-places']
  const buildGeo = !args['skip-geo']

  log(`bundle ${BUNDLE}`)
  const inst = await DuckDBInstance.create(':memory:')
  conn = await inst.connect()
  await conn.run('INSTALL spatial; LOAD spatial;')

  /* ------------------------------------------------ directories, principal */
  const metroDir = await q<MetroDirRow>(sql`SELECT metro_id, metro_name FROM ${T('metro_directory')} ORDER BY metro_id`, [
    'metro_id',
    'metro_name',
  ])
  const placeDir = await q<PlaceDirRow>(
    sql`SELECT place_id, place_name, state, state_name, lsad, class, metro_id FROM ${T('place_directory')} ORDER BY metro_id, place_id`,
    ['place_id', 'place_name', 'state', 'state_name', 'lsad', 'class', 'metro_id'],
  )
  assert(metroDir.length === 387, `expected 387 metros, got ${metroDir.length}`)
  assert(placeDir.length === 16943, `expected 16,943 places, got ${placeDir.length}`)
  assert(metroDir.every((m) => /^[0-9]{5}$/.test(m.metro_id)), 'metro ids are 5 digits')
  assert(placeDir.every((p) => /^[0-9]{7}$/.test(p.place_id)), 'place ids are 7 digits')
  const universe = new Set(metroDir.map((m) => m.metro_id))
  assert(placeDir.every((p) => universe.has(p.metro_id)), 'every place resolves to a metro')
  const placesByMetro = groupBy(placeDir, (p) => p.metro_id)
  const placeDirById = indexBy(placeDir, (p) => p.place_id, 'place_directory')

  // The principal-place rule, verbatim from the data spec §4.
  const principal = indexBy(
    await q<PrincipalRow>(
      sql`WITH pop AS (SELECT place_id, population FROM ${T('place_panel')} WHERE year = 2024),
           lodes AS (SELECT place_id, resident_workers FROM ${T('place_commute')} WHERE year = 2023)
      SELECT metro_id, place_id, place_name, state FROM (
        SELECT p.metro_id, p.place_id, p.place_name, p.state,
               row_number() OVER (PARTITION BY p.metro_id ORDER BY
                 (p.place_name = m.metro_name OR p.place_name LIKE m.metro_name || '-%'
                  OR p.place_name LIKE m.metro_name || '/%'
                  OR p.place_name LIKE m.metro_name || ' city (balance)') DESC,
                 pop.population DESC NULLS LAST, lodes.resident_workers DESC NULLS LAST, p.place_id) AS rn
        FROM ${T('place_directory')} p JOIN ${T('metro_directory')} m USING (metro_id)
        LEFT JOIN pop USING (place_id) LEFT JOIN lodes USING (place_id)) WHERE rn = 1`,
      ['metro_id', 'place_id', 'place_name', 'state'],
    ),
    (p) => p.metro_id,
    'principal',
  )
  assert(principal.size === 387, 'a principal place for every metro')

  /* ------------------------------------------------------- metro tables */
  log('loading metro tables')
  const metroPanel = groupBy(
    await q<PanelRow>(
      sql`SELECT metro_id AS id, year, population, unemployment_rate, wage_nowcast, wage_nowcast_n, wage_nowcast_obs, real_wage
          FROM ${T('metro_panel')} ORDER BY metro_id, year`,
      ['id', 'year', 'population', 'unemployment_rate', 'wage_nowcast', 'wage_nowcast_n', 'wage_nowcast_obs', 'real_wage'],
    ),
    (x) => x.id,
  )
  const metroHousing = groupBy(
    await q<YearValueRow>(
      sql`SELECT metro_id AS id, year, value FROM ${T('metro_housing')} WHERE value IS NOT NULL ORDER BY metro_id, year`,
      ['id', 'year', 'value'],
    ),
    (x) => x.id,
  )
  const DIAG_COLS: (keyof DiagRow & string)[] = [
    'id',
    'pop_year_start',
    'pop_year_end',
    'pop_start',
    'pop_end',
    'pop_cagr',
    'wage_year_start',
    'wage_year_end',
    'wage_start',
    'wage_end',
    'wage_cagr',
    'cost_cagr',
    'quadrant',
    'borderline',
    'supply_side',
  ]
  const metroDiagRows = await q<MetroDiagRow>(
    sql`SELECT metro_id AS id, ${DIAG_COLS.slice(1).join(', ')}, wage_source, cost_series, start_year, end_year,
               pop_cagr_median, wage_cagr_median, cost_cagr_median
        FROM ${D('metro_diagnosis')} ORDER BY metro_id`,
    [...DIAG_COLS, 'wage_source', 'cost_series', 'start_year', 'end_year', 'pop_cagr_median', 'wage_cagr_median', 'cost_cagr_median'],
  )
  const metroDiag = indexBy(metroDiagRows, (x) => x.id, 'metro_diagnosis')
  assert(metroDiag.size === 387, 'a diagnosis for every metro')
  const AMEN_COLS: (keyof AmenityRow & string)[] = [
    'id',
    'wage_year_start',
    'wage_year_end',
    'price_year_start',
    'price_year_end',
    'residual',
    'residual_pct',
    'residual_delta',
  ]
  const metroAmenity = indexBy(
    await q<AmenityRow>(
      sql`SELECT metro_id AS id, ${AMEN_COLS.slice(1).join(', ')} FROM ${D('metro_amenity_residual')} ORDER BY metro_id`,
      AMEN_COLS,
    ),
    (x) => x.id,
    'metro_amenity_residual',
  )
  const sst = indexBy(
    await q<ShiftShareTotalsRow>(
      sql`SELECT metro_id AS id, start_employment, end_employment, ns_total, im_total, ls_total, new_industries_total
          FROM ${D('metro_shift_share_totals')} ORDER BY metro_id`,
      ['id', 'start_employment', 'end_employment', 'ns_total', 'im_total', 'ls_total', 'new_industries_total'],
    ),
    (x) => x.id,
    'metro_shift_share_totals',
  )
  const shiftShare = groupBy(
    await q<ShiftShareSrcRow>(
      sql`SELECT metro_id AS id, industry_code, e_r_t0, e_r_t1, ns, im, ls, is_new
          FROM ${D('metro_shift_share')} ORDER BY metro_id, industry_code`,
      ['id', 'industry_code', 'e_r_t0', 'e_r_t1', 'ns', 'im', 'ls', 'is_new'],
    ),
    (x) => x.id,
  )
  const opportunities = groupBy(
    await q<OpportunitySrcRow>(
      sql`SELECT metro_id AS id, industry_code, density, present, rca, employment
          FROM ${D('metro_opportunities')} ORDER BY metro_id, industry_code`,
      ['id', 'industry_code', 'density', 'present', 'rca', 'employment'],
    ),
    (x) => x.id,
  )
  const complexityAll = await q<ComplexityRow>(
    sql`SELECT metro_id AS id, year, eci, eci_rank FROM ${T('metro_complexity')} ORDER BY metro_id, year`,
    ['id', 'year', 'eci', 'eci_rank'],
  )
  const complexity = groupBy(complexityAll, (x) => x.id)
  // eci_rank spans 917 CBSAs; rank again inside the 387-metro universe, per year.
  const rankUniverse = new Map<string, number>()
  for (const [year, rows] of groupBy(
    complexityAll.filter((x) => universe.has(x.id)),
    (x) => String(x.year),
  )) {
    const ecis = rows.map((x) => x.eci)
    for (const x of rows) rankUniverse.set(`${x.id}|${year}`, rankOf(x.eci, ecis))
  }
  const outlook = groupBy(
    await q<OutlookRow>(sql`SELECT metro_id AS id, year, coi, coi_rank FROM ${T('metro_outlook')} ORDER BY metro_id, year`, [
      'id',
      'year',
      'coi',
      'coi_rank',
    ]),
    (x) => x.id,
  )
  const innovation = groupBy(
    await q<InnovationRow>(
      sql`SELECT metro_id AS id, year, patents, patents_per_100k, publications, publications_per_100k
          FROM ${D('metro_innovation_per_capita')} ORDER BY metro_id, year`,
      ['id', 'year', 'patents', 'patents_per_100k', 'publications', 'publications_per_100k'],
    ),
    (x) => x.id,
  )
  const patentRca = groupBy(
    await q<PatentRcaRow>(
      sql`SELECT metro_id AS id, level, class_key AS key, patents, rca, above_floor FROM ${D('metro_patent_rca')}
          WHERE level = 'section' OR above_floor ORDER BY metro_id, level, rca DESC, class_key`,
      ['id', 'level', 'key', 'patents', 'rca', 'above_floor'],
    ),
    (x) => x.id,
  )
  const publicationRca = groupBy(
    await q<PublicationRcaRow>(
      sql`SELECT metro_id AS id, level, field_key AS key, appearances, rca, above_floor FROM ${D('metro_publication_rca')}
          WHERE level = 'broad_field' OR above_floor ORDER BY metro_id, level, rca DESC, field_key`,
      ['id', 'level', 'key', 'appearances', 'rca', 'above_floor'],
    ),
    (x) => x.id,
  )
  const labelsOf = (rows: LabelRow[], what: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const { key, label } of rows) {
      if (key in out && out[key] !== label) fail(`${what}: key ${key} has two labels`)
      out[key] = label
    }
    return out
  }
  const patentLabels = labelsOf(
    await q<LabelRow>(sql`SELECT DISTINCT class_key AS key, class_label AS label FROM ${D('metro_patent_rca')} ORDER BY 1, 2`, [
      'key',
      'label',
    ]),
    'patent labels',
  )
  const publicationLabels = labelsOf(
    await q<LabelRow>(
      sql`SELECT DISTINCT field_key AS key, field_label AS label FROM ${D('metro_publication_rca')} ORDER BY 1, 2`,
      ['key', 'label'],
    ),
    'publication labels',
  )
  const firmRows = await q<FirmRow>(
    sql`SELECT metro_id AS id, year, startup_rate_adj, firm_exit_rate_adj, net_rate_adj FROM ${T('metro_firm_dynamics')} ORDER BY metro_id, year`,
    ['id', 'year', 'startup_rate_adj', 'firm_exit_rate_adj', 'net_rate_adj'],
  )
  const firm = groupBy(firmRows, (x) => x.id)
  const remotenessRows = await q<RemotenessRow>(
    sql`SELECT metro_id AS id, remoteness_index FROM ${T('metro_remoteness_index')} ORDER BY metro_id`,
    ['id', 'remoteness_index'],
  )
  const remoteness = indexBy(remotenessRows, (x) => x.id, 'metro_remoteness_index')
  const inputIntensity = groupBy(
    await q<InputRow>(
      sql`SELECT metro_id AS id, year, input, intensity FROM ${T('metro_input_intensity')} ORDER BY metro_id, year, input`,
      ['id', 'year', 'input', 'intensity'],
    ),
    (x) => x.id,
  )
  const yearValue = async (table: string, col: string, key: string) =>
    groupBy(
      await q<YearValueRow>(sql`SELECT ${key} AS id, year, ${col} AS value FROM ${table} WHERE ${col} IS NOT NULL ORDER BY ${key}, year`, [
        'id',
        'year',
        'value',
      ]),
      (x) => x.id,
    )
  const metroCrime = await yearValue(T('metro_crime'), 'severity_pc_ratio_s3', 'metro_id')
  const metroEducation = await yearValue(T('metro_education'), 'grade_level', 'metro_id')
  const metroAir = await yearValue(T('metro_air_quality'), 'air_quality_index', 'metro_id')

  log('loading industries (window, wide)')
  const industriesWide = groupBy(
    await q<IndustryWideRow>(
      sql`SELECT e.metro_id AS id, e.industry_code,
                 list(e.year ORDER BY e.year) AS ys,
                 list(round(e.employment)::INTEGER ORDER BY e.year) AS es,
                 list(round(e.rca, 2) ORDER BY e.year) AS rs,
                 list(round(m.market_share, 4) ORDER BY e.year) AS ms
          FROM ${T('metro_industry_employment')} e
          JOIN ${D('metro_industry_market_share')} m USING (metro_id, year, industry_code)
          WHERE e.year BETWEEN ${String(WINDOW_START)} AND ${String(WINDOW_END)}
          GROUP BY 1, 2 ORDER BY 1, 2`,
      ['id', 'industry_code', 'ys', 'es', 'rs', 'ms'],
    ),
    (x) => x.id,
  )

  /* ----------------------------------------------------------- national */
  log('national tables')
  const nationalEmpRows = await q<NationalEmpRow>(
    sql`SELECT industry_code, year, employment FROM ${T('national_industry_employment')} ORDER BY industry_code, year`,
    ['industry_code', 'year', 'employment'],
  )
  const industryYears = [...new Set(nationalEmpRows.map((x) => x.year))].sort((a, b) => a - b)
  assert(industryYears[0] === 2004 && industryYears[industryYears.length - 1] === 2024, 'national employment 2004–2024')
  const nationalEmployment: Record<string, (number | null)[]> = {}
  for (const [code, rows] of groupBy(nationalEmpRows, (x) => x.industry_code)) {
    const byYear = new Map(rows.map((x) => [x.year, x.employment]))
    nationalEmployment[code] = industryYears.map((y) => int(byYear.get(y)))
  }

  const attrs = await q<AttrRow>(
    sql`SELECT a.industry_code, a.industry, a.sector_2d, a.pci, a.tradability, t.tradability_class
        FROM ${T('industry_attributes')} a LEFT JOIN ${D('industry_tradability')} t USING (industry_code) ORDER BY 1`,
    ['industry_code', 'industry', 'sector_2d', 'pci', 'tradability', 'tradability_class'],
  )
  const industries: Record<string, Industry> = {}
  for (const a of attrs) {
    assert(a.sector_2d in NAICS_SECTOR_NAME, `unknown NAICS sector ${a.sector_2d} for ${a.industry_code}`)
    const ind: Industry = {
      code: a.industry_code,
      name: a.industry,
      sector2d: a.sector_2d,
      sector: sectorOf(a.sector_2d),
      pci: r(a.pci, 4),
      tradability: r(a.tradability, 4),
      tier: tier(a.tradability_class, a.industry_code),
    }
    industries[a.industry_code] = ind
  }
  const unclassified: Industry = {
    code: '9999',
    name: 'Unclassified',
    sector2d: '99',
    sector: 'Other',
    pci: null,
    tradability: null,
    tier: null,
  }
  industries['9999'] = unclassified
  for (const code of Object.keys(nationalEmployment)) assert(code in industries, `industry ${code} has employment but no attributes`)

  // All-metro benchmark series from the panels (raw, then rounded for output).
  const nationalRaw = new Map<number, { pop: number; wage: number | null; unemployment: number | null; homeValue: number | null }>()
  const housingByYear = new Map<number, number[]>()
  for (const rows of metroHousing.values())
    for (const h of rows) {
      const list = housingByYear.get(h.year)
      if (list) list.push(h.value)
      else housingByYear.set(h.year, [h.value])
    }
  const panelByYear = new Map<number, PanelRow[]>()
  for (const rows of metroPanel.values())
    for (const p of rows) {
      const list = panelByYear.get(p.year)
      if (list) list.push(p)
      else panelByYear.set(p.year, [p])
    }
  const panelYears = [...panelByYear.keys()].sort((a, b) => a - b)
  for (const year of panelYears) {
    const rows = must(panelByYear.get(year), 'panel year')
    let pop = 0
    let wageNum = 0
    let wageDen = 0
    let uNum = 0
    let uDen = 0
    for (const p of rows) {
      if (p.population !== null) pop += p.population
      if (p.wage_nowcast !== null && p.wage_nowcast_n !== null) {
        wageNum += p.wage_nowcast * p.wage_nowcast_n
        wageDen += p.wage_nowcast_n
      }
      if (p.unemployment_rate !== null && p.population !== null) {
        uNum += p.unemployment_rate * p.population
        uDen += p.population
      }
    }
    const hv = housingByYear.get(year)
    nationalRaw.set(year, {
      pop,
      wage: wageDen > 0 ? wageNum / wageDen : null,
      unemployment: uDen > 0 ? uNum / uDen : null,
      homeValue: hv && hv.length ? median(hv) : null,
    })
  }
  const allMetros: NationalYear[] = panelYears.map((year) => {
    const x = must(nationalRaw.get(year), 'national year')
    return { year, population: rn(x.pop, 0, 'population'), wage: int(x.wage), unemployment: r(x.unemployment, 2), homeValue: int(x.homeValue) }
  })
  const n0 = must(nationalRaw.get(WINDOW_START), 'window start')
  const n1 = must(nationalRaw.get(WINDOW_END), 'window end')
  const national: AtlasIndex['national'] = {
    popCagr: rn(cagr(n0.pop, n1.pop, WINDOW_END - WINDOW_START), RATE_DP, 'national pop cagr'),
    wageCagr: rn(cagr(must(n0.wage, 'wage 2014'), must(n1.wage, 'wage 2024'), WINDOW_END - WINDOW_START), RATE_DP, 'national wage cagr'),
    costCagr: rn(cagr(must(n0.homeValue, 'hv 2014'), must(n1.homeValue, 'hv 2024'), WINDOW_END - WINDOW_START), RATE_DP, 'national cost cagr'),
  }
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol
  assert(near(national.popCagr, 0.00765, 5e-5), `national popCagr ${national.popCagr} ≉ 0.00765`)
  assert(near(national.wageCagr, 0.04051, 5e-5), `national wageCagr ${national.wageCagr} ≉ 0.04051`)
  assert(near(national.costCagr, 0.06474, 5e-5), `national costCagr ${national.costCagr} ≉ 0.06474`)
  log(`national CAGRs pop ${national.popCagr} wage ${national.wageCagr} cost ${national.costCagr}`)

  const medianOf = (xs: (number | null)[]) => median(xs.filter((x): x is number => x !== null))
  const innovByYear = (year: number, pick: (x: InnovationRow) => number | null) =>
    [...innovation.values()].map((rows) => rows.find((x) => x.year === year)).map((x) => (x ? pick(x) : null))
  const firmLatest = firmRows.filter((x) => x.year === FIRM_YEAR)
  const leverMedians: National['leverMedians'] = {
    startupRate: r(medianOf(firmLatest.map((x) => x.startup_rate_adj)), 2),
    exitRate: r(medianOf(firmLatest.map((x) => x.firm_exit_rate_adj)), 2),
    remoteness: r(medianOf(remotenessRows.map((x) => x.remoteness_index)), 4),
    patentsPer100k: r(medianOf(innovByYear(PATENT_YEAR, (x) => x.patents_per_100k)), 2),
    publicationsPer100k: r(medianOf(innovByYear(PUBLICATION_YEAR, (x) => x.publications_per_100k)), 2),
  }
  const fits = await q<FitRow>(sql`SELECT grain, fit, beta, n::INTEGER AS n FROM ${D('amenity_residual_fit')} ORDER BY grain, fit`, [
    'grain',
    'fit',
    'beta',
    'n',
  ])
  const amenityFits: National['amenityFits'] = fits.map((f) => {
    assert(f.grain === 'metro' || f.grain === 'place', `fit grain ${f.grain}`)
    assert(f.fit === 'level' || f.fit === 'start' || f.fit === 'end', `fit kind ${f.fit}`)
    return { grain: f.grain, fit: f.fit, beta: rn(f.beta, 5, 'beta'), n: f.n }
  })
  const nationalDoc: National = {
    industryYears,
    industries,
    nationalEmployment,
    allMetros,
    leverMedians,
    amenityFits,
    patentLabels,
    publicationLabels,
  }

  /* ------------------------------------------------- index: summaries */
  log('metro geometry + summaries')
  const metroGeo = indexBy(
    await q<MetroGeoRow>(
      sql`SELECT metro_id AS id, metro_name AS name, area_land_m2::DOUBLE AS area,
                 ST_X(ST_Centroid(geometry)) AS lng, ST_Y(ST_Centroid(geometry)) AS lat,
                 ST_AsGeoJSON(ST_ReducePrecision(geometry, 0.00001)) AS g5,
                 ST_AsGeoJSON(ST_ReducePrecision(geometry, 0.0001)) AS g4
          FROM ${G('metro_boundaries')} ORDER BY metro_id`,
      ['id', 'name', 'area', 'lng', 'lat', 'g5', 'g4'],
    ),
    (x) => x.id,
    'metro_boundaries',
  )
  assert(metroGeo.size === 387, 'a boundary for every metro')

  const d0 = metroDiagRows[0]
  assert(
    metroDiagRows.every(
      (d) =>
        d.wage_source === d0.wage_source &&
        d.cost_series === d0.cost_series &&
        d.start_year === d0.start_year &&
        d.end_year === d0.end_year &&
        d.pop_cagr_median === d0.pop_cagr_median &&
        d.wage_cagr_median === d0.wage_cagr_median &&
        d.cost_cagr_median === d0.cost_cagr_median,
    ),
    'one window and one set of medians on metro_diagnosis',
  )
  assert(d0.wage_source === 'wage_nowcast' && d0.cost_series === 'home_value', 'window series')
  assert(d0.start_year === WINDOW_START && d0.end_year === WINDOW_END, 'window years')
  const window: Window = { start: WINDOW_START, end: WINDOW_END, wageSource: 'wage_nowcast', costSeries: 'home_value' }

  // Medians and the borderline band (0.35 × MAD), reproduced from the 387 rows.
  const popCagrs = metroDiagRows.map((d) => must(d.pop_cagr, `pop_cagr ${d.id}`))
  const wageCagrs = metroDiagRows.map((d) => must(d.wage_cagr, `wage_cagr ${d.id}`))
  assert(near(median(popCagrs), d0.pop_cagr_median, 1e-12), 'pop median reproduces')
  assert(near(median(wageCagrs), d0.wage_cagr_median, 1e-12), 'wage median reproduces')
  const mad = (xs: number[], m: number) => median(xs.map((x) => Math.abs(x - m)))
  const popBandExact = 0.35 * mad(popCagrs, d0.pop_cagr_median)
  const wageBandExact = 0.35 * mad(wageCagrs, d0.wage_cagr_median)
  const exactMedians: Medians = {
    popCagr: d0.pop_cagr_median,
    wageCagr: d0.wage_cagr_median,
    costCagr: d0.cost_cagr_median,
    popBand: popBandExact,
    wageBand: wageBandExact,
  }
  let borderlineN = 0
  let borderlineMismatch = 0
  let quadrantMismatch = 0
  for (const d of metroDiagRows) {
    const pop = must(d.pop_cagr, 'pop')
    const wage = must(d.wage_cagr, 'wage')
    const b = isBorderline(pop, wage, exactMedians)
    if (b) borderlineN++
    if (b !== d.borderline) borderlineMismatch++
    if (quadrantOf(pop, wage, exactMedians) !== d.quadrant) quadrantMismatch++
  }
  assert(near(popBandExact, 0.001715, 1e-6) && near(wageBandExact, 0.001171, 1e-6), `bands ${popBandExact} / ${wageBandExact}`)
  assert(borderlineN === 16 && borderlineMismatch === 0, `borderline: ${borderlineN} flagged, ${borderlineMismatch} mismatches`)
  assert(quadrantMismatch === 0, `${quadrantMismatch} quadrant mismatches vs the app rule`)
  log(`medians reproduce: bands ${popBandExact.toFixed(6)} / ${wageBandExact.toFixed(6)}, 16 borderline metros`)
  const medians: Medians = {
    popCagr: rn(d0.pop_cagr_median, RATE_DP, 'pop median'),
    wageCagr: rn(d0.wage_cagr_median, RATE_DP, 'wage median'),
    costCagr: rn(d0.cost_cagr_median, RATE_DP, 'cost median'),
    popBand: rn(popBandExact, 6, 'pop band'),
    wageBand: rn(wageBandExact, 6, 'wage band'),
  }

  const summaries = new Map<string, MetroSummary>()
  const slugs = new Set<string>()
  let roundedQuadrantFlips = 0
  let roundedBorderlineFlips = 0
  for (const m of metroDir) {
    const pr = must(principal.get(m.metro_id), `principal ${m.metro_id}`)
    const d = must(metroDiag.get(m.metro_id), `diagnosis ${m.metro_id}`)
    const geo = must(metroGeo.get(m.metro_id), `geometry ${m.metro_id}`)
    const panel = must(metroPanel.get(m.metro_id), `panel ${m.metro_id}`)
    const latestPop = [...panel].reverse().find((p) => p.population !== null)
    const slug = slugify(`${m.metro_name}-${pr.state}`)
    assert(!slugs.has(slug), `duplicate slug ${slug}`)
    slugs.add(slug)
    const s: MetroSummary = {
      id: m.metro_id,
      slug,
      name: m.metro_name,
      state: pr.state,
      displayName: `${m.metro_name}, ${pr.state}`,
      principalPlaceId: pr.place_id,
      principalPlaceName: displayPlaceName(pr.place_name),
      lat: rn(geo.lat, 5, 'lat'),
      lng: rn(geo.lng, 5, 'lng'),
      population: int(latestPop?.population),
      popCagr: r(d.pop_cagr, RATE_DP),
      wageCagr: r(d.wage_cagr, RATE_DP),
      costCagr: r(d.cost_cagr, RATE_DP),
      quadrant: quadrant(d.quadrant, m.metro_id),
      borderline: d.borderline === true,
      supplySide: supplySide(d.supply_side, m.metro_id),
      popYears: years(d.pop_year_start, d.pop_year_end),
      wageYears: years(d.wage_year_start, d.wage_year_end),
      nPlaces: placesByMetro.get(m.metro_id)?.length ?? 0,
    }
    if (s.popCagr !== null && s.wageCagr !== null) {
      if (quadrantOf(s.popCagr, s.wageCagr, medians) !== s.quadrant) roundedQuadrantFlips++
      if (isBorderline(s.popCagr, s.wageCagr, medians) !== s.borderline) roundedBorderlineFlips++
    }
    summaries.set(m.metro_id, s)
  }
  assert(slugs.size === 387, 'slugs unique across the 387')
  if (roundedQuadrantFlips || roundedBorderlineFlips)
    log(`note: with 5-dp cagrs the app rule flips ${roundedQuadrantFlips} quadrants / ${roundedBorderlineFlips} borderline flags`)
  const displayNames = new Set([...summaries.values()].map((s) => s.displayName))
  assert(displayNames.size === 387, 'display names unique')

  const metrosSorted = [...summaries.values()].sort(
    (a, b) => (b.population ?? -1) - (a.population ?? -1) || a.id.localeCompare(b.id),
  )
  const latestComplexityYear = Math.max(...complexityAll.map((x) => x.year))
  const index: AtlasIndex = {
    generatedAt: new Date().toISOString(),
    window,
    medians,
    national,
    counts: {
      metros: metrosSorted.length,
      withComplexity: complexityAll.filter((x) => x.year === latestComplexityYear && universe.has(x.id)).length,
      withCost: metrosSorted.filter((m) => m.costCagr !== null).length,
      withAmenity: metrosSorted.filter((m) => metroAmenity.has(m.id)).length,
    },
    metros: metrosSorted,
  }
  log(`counts: ${JSON.stringify(index.counts)}`)

  /* -------------------------------------------- place tables (summary) */
  log('loading place tables')
  const placePanel = groupBy(
    await q<PlacePanelRow>(
      sql`SELECT place_id AS id, year, population, unemployment_rate, wage_nowcast, wage_nowcast_obs, real_wage
          FROM ${T('place_panel')} ORDER BY place_id, year`,
      ['id', 'year', 'population', 'unemployment_rate', 'wage_nowcast', 'wage_nowcast_obs', 'real_wage'],
    ),
    (x) => x.id,
  )
  const placeHousing = groupBy(
    await q<YearValueRow>(
      sql`SELECT place_id AS id, year, value FROM ${T('place_housing')} WHERE value IS NOT NULL ORDER BY place_id, year`,
      ['id', 'year', 'value'],
    ),
    (x) => x.id,
  )
  const placeCommute = groupBy(
    await q<CommuteRow>(
      sql`SELECT place_id AS id, year, resident_workers, jobs_here, live_work_here, out_commuters, in_commuters
          FROM ${T('place_commute')} ORDER BY place_id, year`,
      ['id', 'year', 'resident_workers', 'jobs_here', 'live_work_here', 'out_commuters', 'in_commuters'],
    ),
    (x) => x.id,
  )
  const placeDiag = indexBy(
    await q<DiagRow>(sql`SELECT place_id AS id, ${DIAG_COLS.slice(1).join(', ')} FROM ${D('place_diagnosis')} ORDER BY place_id`, DIAG_COLS),
    (x) => x.id,
    'place_diagnosis',
  )
  const placeAmenity = indexBy(
    await q<AmenityRow>(
      sql`SELECT place_id AS id, ${AMEN_COLS.slice(1).join(', ')} FROM ${D('place_amenity_residual')} ORDER BY place_id`,
      AMEN_COLS,
    ),
    (x) => x.id,
    'place_amenity_residual',
  )
  const latestOf = <R extends { year: number }, K extends keyof R>(rows: R[] | undefined, key: K): R[K] | null => {
    if (!rows) return null
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = rows[i][key]
      if (v !== null && v !== undefined) return v
    }
    return null
  }
  const placeLatest = new Map<string, PlaceLatest>()
  for (const p of placeDir) {
    const panel = placePanel.get(p.place_id)
    const commute = placeCommute.get(p.place_id)
    const last = commute?.[commute.length - 1]
    placeLatest.set(p.place_id, {
      population: latestOf(panel, 'population'),
      wage: latestOf(panel, 'wage_nowcast'),
      unemployment: latestOf(panel, 'unemployment_rate'),
      // the window's end year, so the level matches costCagr; the housing
      // series runs on into a partial 2026 which would otherwise win
      homeValue: latestOf(placeHousing.get(p.place_id)?.filter((h) => h.year <= WINDOW_END), 'value'),
      jobsHere: last?.jobs_here ?? null,
      residentWorkers: last?.resident_workers ?? null,
    })
  }
  let placeQuadrantFlips = 0
  for (const d of placeDiag.values())
    if (d.pop_cagr !== null && d.wage_cagr !== null && d.quadrant !== null) {
      const pop = rn(d.pop_cagr, RATE_DP, 'pop')
      const wage = rn(d.wage_cagr, RATE_DP, 'wage')
      if (quadrantOf(pop, wage, medians) !== d.quadrant) placeQuadrantFlips++
    }
  if (placeQuadrantFlips) log(`note: with 5-dp cagrs the app rule flips ${placeQuadrantFlips} place quadrants`)

  /* ------------------------------------------------------------ writing */
  const metroIds = onlyIds ? onlyIds : metrosSorted.map((s) => s.id)
  for (const id of metroIds) assert(universe.has(id), `--only: unknown metro ${id}`)
  const fullBuild = onlyIds === null

  mkdirSync(OUT, { recursive: true })
  const wipe = (dir: string) => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  }
  if (fullBuild) wipe(join(OUT, 'metros'))
  else mkdirSync(join(OUT, 'metros'), { recursive: true })
  if (buildPlaces) {
    if (fullBuild) wipe(join(OUT, 'places'))
    else mkdirSync(join(OUT, 'places'), { recursive: true })
  }
  if (buildGeo) {
    if (fullBuild) wipe(join(OUT, 'geo'))
    mkdirSync(join(OUT, 'geo', 'metros'), { recursive: true })
  }

  writeJson(join(OUT, 'index.json'), index, 'index')
  writeJson(join(OUT, 'national.json'), nationalDoc, 'national')
  log('wrote index.json, national.json')

  /* ------------------------------------------------------------- metros */
  const buildMetro = (id: string): Metro => {
    const summary = must(summaries.get(id), `summary ${id}`)
    const panelRows = must(metroPanel.get(id), `panel ${id}`)
    const panel: PanelYear[] = panelRows.map(panelYearOf)
    const d = must(metroDiag.get(id), `diagnosis ${id}`)

    const placeRows: PlaceRow[] = (placesByMetro.get(id) ?? []).map((p) => {
      const pd = placeDiag.get(p.place_id)
      const pa = placeAmenity.get(p.place_id)
      const latest = must(placeLatest.get(p.place_id), `latest ${p.place_id}`)
      const row: PlaceRow = {
        id: p.place_id,
        name: displayPlaceName(p.place_name),
        state: p.state,
        class: placeClass(p.class, p.place_id),
        population: int(pd?.pop_end ?? latest.population),
        popCagr: r(pd?.pop_cagr, RATE_DP),
        wage: int(pd?.wage_end ?? latest.wage),
        wageCagr: r(pd?.wage_cagr, RATE_DP),
        homeValue: int(latest.homeValue),
        costCagr: r(pd?.cost_cagr, RATE_DP),
        unemployment: r(latest.unemployment, 2),
        quadrant: quadrant(pd?.quadrant ?? null, p.place_id),
        borderline: pd?.borderline === true,
        supplySide: supplySide(pd?.supply_side ?? null, p.place_id),
        amenityPct: r(pa?.residual_pct, 4),
        amenityDelta: r(pa?.residual_delta, 5),
        jobsHere: latest.jobsHere,
        residentWorkers: latest.residentWorkers,
      }
      return row
    })
    placeRows.sort((a, b) => {
      if (a.population !== b.population) {
        if (a.population === null) return 1
        if (b.population === null) return -1
        return b.population - a.population
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1
    })
    const places: Metro['places'] = { columns: PLACE_COLUMNS, rows: placeRows.map((p) => PLACE_COLUMNS.map((c) => p[c])) }

    const industryRows: IndustryRow[] = (industriesWide.get(id) ?? []).map((w) => {
      assert(w.industry_code in industries, `industry ${w.industry_code} unknown`)
      const at = new Map(w.ys.map((y, i) => [y, i]))
      const pick = (xs: number[]) => INDUSTRY_YEARS.map((y) => (at.has(y) ? xs[must(at.get(y), 'idx')] : null))
      return { code: w.industry_code, employment: pick(w.es), rca: pick(w.rs), marketShare: pick(w.ms) }
    })
    // per-year arrays sit in the cells (Cell admits number[]); the app reads
    // them back through columnar<IndustryRow>()
    const industryCells = industryRows.map((x) => INDUSTRY_COLUMNS.map((c) => x[c]))
    const industriesTable: Metro['industries'] = {
      columns: INDUSTRY_COLUMNS,
      rows: industryCells,
    }

    const totals = sst.get(id)
    const shiftShareTotals: Metro['shiftShareTotals'] = totals
      ? {
          startEmployment: rn(totals.start_employment, 0, 'start_employment'),
          endEmployment: rn(totals.end_employment, 0, 'end_employment'),
          ns: rn(totals.ns_total, 0, 'ns'),
          im: rn(totals.im_total, 0, 'im'),
          ls: rn(totals.ls_total, 0, 'ls'),
          newIndustries: rn(totals.new_industries_total, 0, 'new'),
        }
      : null
    const ssRows: ShiftShareRow[] = (shiftShare.get(id) ?? []).map((x) => ({
      code: x.industry_code,
      t0: rn(x.e_r_t0, 0, 't0'),
      t1: rn(x.e_r_t1, 0, 't1'),
      ns: rn(x.ns, 0, 'ns'),
      im: rn(x.im, 0, 'im'),
      ls: rn(x.ls, 0, 'ls'),
      isNew: x.is_new,
    }))
    const shiftShareTable: Metro['shiftShare'] = {
      columns: SHIFT_SHARE_COLUMNS,
      rows: ssRows.map((x) => SHIFT_SHARE_COLUMNS.map((c) => x[c])),
    }
    const oppRows: OpportunityRow[] = (opportunities.get(id) ?? []).map((x) => ({
      code: x.industry_code,
      density: rn(x.density, 4, 'density'),
      present: x.present,
      rca: r(x.rca, 2),
      employment: rn(x.employment, 0, 'employment'),
    }))
    const opportunitiesTable: Metro['opportunities'] = {
      columns: OPPORTUNITY_COLUMNS,
      rows: oppRows.map((x) => OPPORTUNITY_COLUMNS.map((c) => x[c])),
    }

    const metro: Metro = {
      summary,
      years: panel.map((p) => p.year),
      panel,
      housing: series(metroHousing.get(id), 0),
      diagnosis: diagnosisOf(d, id),
      amenity: amenityOf(metroAmenity.get(id), id),
      places,
      industryYears: INDUSTRY_YEARS,
      industries: industriesTable,
      shiftShareTotals,
      shiftShare: shiftShareTable,
      opportunities: opportunitiesTable,
      complexity: (complexity.get(id) ?? []).map((x) => ({
        year: x.year,
        eci: rn(x.eci, 4, 'eci'),
        rankAll: x.eci_rank,
        rankUniverse: rankUniverse.get(`${id}|${x.year}`) ?? null,
      })),
      outlook: (outlook.get(id) ?? []).map((x) => ({ year: x.year, coi: rn(x.coi, 4, 'coi'), rank: x.coi_rank })),
      innovation: (innovation.get(id) ?? []).map((x) => ({
        year: x.year,
        patents: r(x.patents, 1),
        patentsPer100k: r(x.patents_per_100k, 2),
        publications: int(x.publications),
        publicationsPer100k: r(x.publications_per_100k, 2),
      })),
      patentRca: (patentRca.get(id) ?? []).map((x) => {
        assert(x.level === 'section' || x.level === 'subclass', `patent level ${x.level}`)
        assert(x.key in patentLabels, `patent key ${x.key} has no label`)
        return { level: x.level, key: x.key, patents: rn(x.patents, 1, 'patents'), rca: rn(x.rca, 2, 'rca'), aboveFloor: x.above_floor }
      }),
      publicationRca: (publicationRca.get(id) ?? []).map((x) => {
        assert(x.level === 'broad_field' || x.level === 'concept', `publication level ${x.level}`)
        assert(x.key in publicationLabels, `publication key ${x.key} has no label`)
        return {
          level: x.level,
          key: x.key,
          appearances: rn(x.appearances, 0, 'appearances'),
          rca: rn(x.rca, 2, 'rca'),
          aboveFloor: x.above_floor,
        }
      }),
      firmDynamics: (firm.get(id) ?? []).map((x) => ({
        year: x.year,
        startup: rn(x.startup_rate_adj, 2, 'startup'),
        exit: rn(x.firm_exit_rate_adj, 2, 'exit'),
        net: rn(x.net_rate_adj, 2, 'net'),
      })),
      remoteness: r(remoteness.get(id)?.remoteness_index, 4),
      inputIntensity: (inputIntensity.get(id) ?? []).map((x) => {
        assert(x.input === 'Water' || x.input === 'Electricity', `input ${x.input}`)
        return { year: x.year, input: x.input, intensity: rn(x.intensity, 3, 'intensity') }
      }),
      crime: series(metroCrime.get(id), 1),
      education: series(metroEducation.get(id), 3),
      airQuality: series(metroAir.get(id), 1),
    }
    return metro
  }

  log(`building ${metroIds.length} metros`)
  let roundTripped = false
  let n = 0
  for (const id of metroIds) {
    const metro = buildMetro(id)
    if (!roundTripped) {
      assertRoundTrip(metro, `metros/${id}`)
      roundTripped = true
    }
    const bytes = writeJson(join(OUT, 'metros', `${id}.json`), metro, `metros/${id}`)
    assert(bytes < METRO_FILE_LIMIT, `metros/${id}.json is ${bytes} bytes (limit ${METRO_FILE_LIMIT})`)
    if (++n % 50 === 0 || n === metroIds.length) log(`  metros ${n}/${metroIds.length}`)
  }

  /* ------------------------------------------------------------- places */
  if (buildPlaces) {
    log('loading place amenity tables')
    const placeCrime = await yearValue(T('place_crime'), 'severity_pc_ratio_s3', 'place_id')
    const placeEducation = await yearValue(T('place_education'), 'grade_level', 'place_id')
    const placeAir = groupBy(
      await q<AirRow>(
        sql`SELECT place_id AS id, year, air_quality_index AS value, air_quality_index_national AS national
            FROM ${T('place_air_quality')} WHERE air_quality_index IS NOT NULL ORDER BY place_id, year`,
        ['id', 'year', 'value', 'national'],
      ),
      (x) => x.id,
    )
    const jobAccess = groupBy(
      await q<JobAccessRow>(
        sql`SELECT place_id AS id, isochrone, total_employment, flag,
                   total_employment_rank_city AS rank_city, total_employment_rank_national AS rank_national
            FROM ${T('place_job_accessibility_values')} WHERE daytime = 'peak' ORDER BY place_id, isochrone`,
        ['id', 'isochrone', 'total_employment', 'flag', 'rank_city', 'rank_national'],
      ),
      (x) => x.id,
    )
    const features = indexBy(
      await q<FeaturesRow>(
        sql`SELECT place_id AS id, restaurant_count, culture_count, daily_needs_count FROM ${T('place_features')} ORDER BY place_id`,
        ['id', 'restaurant_count', 'culture_count', 'daily_needs_count'],
      ),
      (x) => x.id,
      'place_features',
    )

    const buildPlace = (p: PlaceDirRow): Place => {
      const pd = placeDiag.get(p.place_id)
      const f = features.get(p.place_id)
      const place: Place = {
        id: p.place_id,
        metroId: p.metro_id,
        name: displayPlaceName(p.place_name),
        state: p.state,
        stateName: p.state_name,
        class: placeClass(p.class, p.place_id),
        lsad: p.lsad,
        panel: (placePanel.get(p.place_id) ?? []).map(panelYearOf),
        housing: series(
          (placeHousing.get(p.place_id) ?? []).filter((x) => x.year >= PLACE_SERIES_FROM),
          0,
        ),
        commute: (placeCommute.get(p.place_id) ?? [])
          .filter((x) => x.year >= PLACE_SERIES_FROM)
          .map((x) => ({
            year: x.year,
            residentWorkers: x.resident_workers,
            jobsHere: x.jobs_here,
            liveWorkHere: x.live_work_here,
            outCommuters: x.out_commuters,
            inCommuters: x.in_commuters,
          })),
        diagnosis: pd ? diagnosisOf(pd, p.place_id) : null,
        amenity: amenityOf(placeAmenity.get(p.place_id), p.place_id),
        crime: series(placeCrime.get(p.place_id), 1),
        education: series(placeEducation.get(p.place_id), 3),
        airQuality: (placeAir.get(p.place_id) ?? []).map((x) => ({
          year: x.year,
          value: rn(x.value, 1, 'air'),
          national: rn(x.national, 1, 'air national'),
        })),
        jobAccess: (jobAccess.get(p.place_id) ?? []).map((x) => {
          assert(x.isochrone === 15 || x.isochrone === 30 || x.isochrone === 60, `isochrone ${x.isochrone}`)
          const undercount = x.flag === 1
          return {
            minutes: x.isochrone,
            jobs: rn(x.total_employment, 0, 'jobs'),
            rankInMetro: undercount ? null : x.rank_city,
            rankNational: undercount ? null : x.rank_national,
            undercount,
          }
        }),
        features: f ? { restaurants: f.restaurant_count, culture: f.culture_count, dailyNeeds: f.daily_needs_count } : null,
      }
      return place
    }

    const placeList = metroIds.flatMap((id) => placesByMetro.get(id) ?? [])
    log(`building ${placeList.length} places`)
    let np = 0
    for (const p of placeList) {
      writeJson(join(OUT, 'places', `${p.place_id}.json`), buildPlace(p), `places/${p.place_id}`)
      if (++np % 5000 === 0 || np === placeList.length) log(`  places ${np}/${placeList.length}`)
    }
  }

  /* ---------------------------------------------------------------- geo */
  if (buildGeo) {
    log('loading place boundaries')
    const where = fullBuild ? '' : ` AND metro_id IN (${inList(metroIds)})`
    const placeGeo = groupBy(
      await q<PlaceGeoRow>(
        sql`SELECT place_id AS id, metro_id, place_name AS name, lsad, area_land_m2::DOUBLE AS area,
                   ST_AsGeoJSON(ST_ReducePrecision(geometry, 0.00001)) AS g5
            FROM ${G('place_boundaries')} WHERE in_universe${where} ORDER BY metro_id, place_id`,
        ['id', 'metro_id', 'name', 'lsad', 'area', 'g5'],
      ),
      (x) => x.metro_id,
    )
    let skipped = 0
    let ng = 0
    for (const id of metroIds) {
      const mg = must(metroGeo.get(id), `geometry ${id}`)
      const metroGeometry = must(parseGeometry(mg.g5, 5, `metro ${id}`), `metro ${id} has an empty geometry`)
      const features: Feature[] = [
        { type: 'Feature', id, properties: { kind: 'metro', id, name: mg.name, areaLandM2: int(mg.area) }, geometry: metroGeometry },
      ]
      for (const pg of placeGeo.get(id) ?? []) {
        const dir = placeDirById.get(pg.id)
        assert(dir !== undefined && dir.metro_id === id, `boundary ${pg.id} is not a directory place of ${id}`)
        const geometry = parseGeometry(pg.g5, 5, `place ${pg.id}`)
        if (!geometry) {
          skipped++
          continue
        }
        features.push({
          type: 'Feature',
          id: pg.id,
          properties: { kind: 'place', id: pg.id, name: dir.place_name ? displayPlaceName(dir.place_name) : pg.name, lsad: dir.lsad ?? pg.lsad, areaLandM2: int(pg.area) },
          geometry,
        })
      }
      const fc: MetroGeo = { type: 'FeatureCollection', features }
      writeJson(join(OUT, 'geo', 'metros', `${id}.json`), fc, `geo/metros/${id}`)
      if (++ng % 50 === 0 || ng === metroIds.length) log(`  geo ${ng}/${metroIds.length}`)
    }
    if (skipped) log(`note: skipped ${skipped} place boundaries with empty geometries`)

    // The overview layer: every metro polygon at 4 dp.
    interface OverviewFeature {
      type: 'Feature'
      id: string
      properties: { id: string; name: string; displayName: string; slug: string }
      geometry: Geometry
    }
    const overview: { type: 'FeatureCollection'; features: OverviewFeature[] } = {
      type: 'FeatureCollection',
      features: metrosSorted.map((s) => {
        const mg = must(metroGeo.get(s.id), `geometry ${s.id}`)
        return {
          type: 'Feature',
          id: s.id,
          properties: { id: s.id, name: s.name, displayName: s.displayName, slug: s.slug },
          geometry: must(parseGeometry(mg.g4, 4, `metro ${s.id}`), `metro ${s.id} empty at 4 dp`),
        }
      }),
    }
    writeJson(join(OUT, 'geo', 'metros.json'), overview, 'geo/metros')
    log('wrote geo/metros.json')
  }

  conn.closeSync()
  inst.closeSync()

  if (metroIds.includes('14460')) verify(buildPlaces)
  else log('verify: skipped (Boston 14460 not in this build)')
  sizeReport()
  log('done')
}

/* ------------------------------------------------------------- verify */

function verify(withPlaces: boolean): void {
  const read = <T>(rel: string): T => JSON.parse(readFileSync(join(OUT, rel), 'utf8')) as T
  const checks: [string, boolean, string][] = []
  const check = (what: string, ok: boolean, got: unknown) => checks.push([what, ok, String(got)])
  const approx = (a: number | null | undefined, b: number, tol: number) => a !== null && a !== undefined && Math.abs(a - b) <= tol

  const m = read<Metro>('metros/14460.json')
  check("summary.displayName = 'Boston, MA'", m.summary.displayName === 'Boston, MA', m.summary.displayName)
  check("summary.slug = 'boston-ma'", m.summary.slug === 'boston-ma', m.summary.slug)
  check("summary.principalPlaceId = '2507000'", m.summary.principalPlaceId === '2507000', m.summary.principalPlaceId)
  check('diagnosis.popCagr ≈ 0.0057193', approx(m.diagnosis.popCagr, 0.0057193, 1e-5), m.diagnosis.popCagr)
  check('diagnosis.wageCagr ≈ 0.0431191', approx(m.diagnosis.wageCagr, 0.0431191, 1e-5), m.diagnosis.wageCagr)
  check("diagnosis.quadrant = 'demand_positive'", m.diagnosis.quadrant === 'demand_positive', m.diagnosis.quadrant)
  check("diagnosis.supplySide = 'amenity'", m.diagnosis.supplySide === 'amenity', m.diagnosis.supplySide)
  check('places rows = 130', m.places.rows.length === 130, m.places.rows.length)
  check(
    'places columns = PLACE_COLUMNS',
    m.places.columns.length === PLACE_COLUMNS.length && m.places.columns.every((c, i) => c === PLACE_COLUMNS[i]),
    m.places.columns.join(','),
  )
  const nInd = m.industries.rows.length
  check('industries rows ≈ 291–295 (distinct codes over the window)', nInd >= 285 && nInd <= 305, nInd)
  const codeIx = m.industries.columns.indexOf('code')
  const empIx = m.industries.columns.indexOf('employment')
  const rcaIx = m.industries.columns.indexOf('rca')
  const row5417 = m.industries.rows.find((x) => x[codeIx] === '5417')
  const last = m.industryYears.length - 1
  const emp = row5417 ? (row5417[empIx] as unknown as (number | null)[])[last] : null
  const rca = row5417 ? (row5417[rcaIx] as unknown as (number | null)[])[last] : null
  check('industry 5417 employment[last] = 96682', emp === 96682, emp)
  check('industry 5417 rca[last] ≈ 5.76', approx(rca, 5.76, 0.005), rca)
  check('shiftShareTotals.ls ≈ −158167', approx(m.shiftShareTotals?.ls, -158167, 1), m.shiftShareTotals?.ls)
  check('amenity.residualPct ≈ 0.0238', approx(m.amenity?.residualPct, 0.0238, 5e-5), m.amenity?.residualPct)
  check('complexity 2024 rankAll = 8', m.complexity.find((c) => c.year === 2024)?.rankAll === 8, m.complexity.find((c) => c.year === 2024)?.rankAll)

  if (withPlaces) {
    const p = read<Place>('places/2507000.json')
    const c = p.commute.find((x) => x.year === 2023)
    check('place 2507000 commute 2023 jobsHere = 718571', c?.jobsHere === 718571, c?.jobsHere)
    check('place 2507000 commute 2023 residentWorkers = 347517', c?.residentWorkers === 347517, c?.residentWorkers)
  }

  let failed = 0
  for (const [what, ok, got] of checks) {
    if (!ok) failed++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}  (got ${got})`)
  }
  if (failed) fail(`${failed} verification check(s) failed`)
  log(`verify: ${checks.length} checks passed`)
}

/* -------------------------------------------------------- size report */

function sizeReport(): void {
  const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
  const files = (dir: string): [string, number][] =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => [f, statSync(join(dir, f)).size])
      : []
  const folders: [string, [string, number][]][] = [
    ['public/data (index, national)', files(OUT)],
    ['metros/', files(join(OUT, 'metros'))],
    ['places/', files(join(OUT, 'places'))],
    ['geo/metros/', files(join(OUT, 'geo', 'metros'))],
    ['geo/ (metros.json)', files(join(OUT, 'geo'))],
  ]
  console.log('size report')
  let total = 0
  for (const [name, fs] of folders) {
    const bytes = fs.reduce((a, [, b]) => a + b, 0)
    total += bytes
    console.log(`  ${name.padEnd(30)} ${String(fs.length).padStart(6)} files  ${mb(bytes).padStart(10)}`)
  }
  console.log(`  ${'total'.padEnd(30)} ${''.padStart(6)}        ${mb(total).padStart(10)}`)
  const top = (name: string, fs: [string, number][]) => {
    const sorted = [...fs].sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(`  largest ${name}: ${sorted.map(([f, b]) => `${f} ${kb(b)}`).join(', ')}`)
  }
  top('metro files', folders[1][1])
  top('geo files', folders[3][1])
  const over = folders[1][1].filter(([, b]) => b >= METRO_FILE_LIMIT)
  assert(over.length === 0, `metro files over 500 KB: ${over.map(([f]) => f).join(', ')}`)
}

/* --------------------------------------------------------------- main */

if (args.verify) {
  verify(existsSync(join(OUT, 'places', '2507000.json')))
  sizeReport()
} else {
  await build()
}
