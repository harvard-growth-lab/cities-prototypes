#!/usr/bin/env node
/* Pull the data behind the live tool's Diagnosis + Drivers visualizations,
   and write it as the section's two data files — ONE pull, ONE window:

     src/data/metrosData.ts   the walk: every US metro on the population ×
                              pay plane, the walk's city at both
                              geographies, the medians every fork reads
     src/data/driverData.ts   the analysis charts, for one place

   usage:  node scripts/build-driver-data.mjs [--cache <dir>] [--refresh]

   WHAT IT READS. The same files the live tool's rendered page fetches
   (https://cities.taimur.sh/usa/place/boston-ma → /data/usa/*.parquet,
   /data/usa/msa_industry_employment/<msa>.parquet and
   /data/geo/usa/msa_places_geo/<msa>.geojson). Nothing is synthesized: every
   number below is computed from those files.

   HOW IT COMPUTES. The functions here are ports of the live tool's own
   (cities-tool, src/lib/shiftShare.ts and the buildPoints of
   MigrationChangeScatter / PlaceChangeScatter) — same nearest-year snapping,
   same filters — so a number read off a chart here is the number the live
   page draws. Two of them are checked at the end against what the rendered
   Boston page states. (Its amenity residual, src/lib/amenityResidual.ts, was
   ported here too until Sept 2026; it went with the three Drivers steps that
   drew it, which answer no data point of the team's Amenities module — that
   module is filled from scripts/build-amenity-data.mjs instead.)

   THE WINDOW is the live tool's default, 2014 → 2024 on its default wage
   series (`wage_nowcast`, the IRS wage carried past its frontier), and BOTH
   files are written on it from the same pull — so a fork's threshold, the
   city it is tested against and the chart that follows it can never sit on
   different windows. (The walk used to be a separate, older extraction
   pinned to 2017 → 2022 on raw IRS wages. The diagnostic-tree EXPLAINER
   under src/explainers still is: it is its own piece with its own data.)

   NEEDS the `duckdb` CLI on the PATH to read parquet (brew install duckdb);
   everything else is plain Node. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const CACHE = opt("--cache", path.join(os.tmpdir(), "cities-driver-data"));
const REFRESH = argv.includes("--refresh");
const BASE = "https://cities.taimur.sh/data";

/* the place the live page was rendered for, and the app's name for it */
const CITY = { short: "Boston", placeId: "2507000", msaId: "14460" };
/* the walk's cities (src/data/content.ts), at both geographies. Boston only
   since Sept 2026 — the prototype carries one city, the one whose charts are
   real; Memphis, San Antonio and San Jose were sample cities until then. A
   list still, so a second city is one more entry. */
const SAMPLES = [CITY];
const START = 2014;
const END = 2024;

mkdirSync(path.join(CACHE, "geo"), { recursive: true });

async function fetchTo(url, file) {
  if (existsSync(file) && !REFRESH) return file;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
const table = (name) =>
  fetchTo(`${BASE}/usa/${name}.parquet`, path.join(CACHE, `${name.replace("/", "_")}.parquet`));

/** run a query over a parquet file through the duckdb CLI, as JSON rows */
function query(sql) {
  const out = path.join(CACHE, `q-${Math.random().toString(36).slice(2)}.json`);
  execFileSync("duckdb", ["-c", `COPY (${sql}) TO '${out}' (FORMAT JSON, ARRAY true)`], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return JSON.parse(readFileSync(out, "utf8"));
}

/* ---------- the live tool's helpers, ported ---------- */

function nearestRow(rows, target, pred = () => true) {
  let best = null;
  let bestDist = Infinity;
  for (const r of rows) {
    if (!pred(r)) continue;
    const d = Math.abs(r.year - target);
    if (d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best;
}
const cagr = (a, b, va, vb) => (vb / va) ** (1 / (b.year - a.year)) - 1;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    const arr = m.get(r[key]) ?? [];
    arr.push(r);
    m.set(r[key], arr);
  }
  return m;
};

/** population, wage and price growth for one unit's rows, snapped the way
 *  the live scatters snap them. Each read stands alone: a CDP has no
 *  population series (so it is on the map but not on a scatter, as in the
 *  live tool) and still has pay and prices. */
function growthOf(rows, prices) {
  const pop = (r) => r.population != null && r.population > 0;
  const wage = (r) => r.avg_wage != null && r.avg_wage > 0;
  const pS = nearestRow(rows, START, pop);
  const pE = nearestRow(rows, END, pop);
  let x = pS && pE && pS.year !== pE.year ? cagr(pS, pE, pS.population, pE.population) : null;
  /* the scatters' plausibility band on annual population growth */
  if (x != null && (!Number.isFinite(x) || x < -0.1 || x > 0.15)) x = null;
  const wS = nearestRow(rows, START, wage);
  const wE = nearestRow(rows, END, wage);
  const hS = prices && nearestRow(prices, START);
  const hE = prices && nearestRow(prices, END);
  return {
    pop: x,
    size: pE?.population ?? null,
    wage: wS && wE && wS.year !== wE.year ? cagr(wS, wE, wS.avg_wage, wE.avg_wage) : null,
    home: hS && hE && hS.year !== hE.year ? cagr(hS, hE, hS.value, hE.value) : null,
  };
}

/* ---------- the map: project, simplify, write as SVG paths ---------- */

/** Douglas–Peucker on one CLOSED ring, in projected units. A ring's first
 *  and last points coincide, so the chord between them has no length and
 *  every point would measure zero from it — the ring is split at the point
 *  farthest from its start, and each half simplified on its own chord. */
function simplify(ring, tol) {
  if (ring.length < 6) return ring;
  let far = 0;
  let farD = -1;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = simplifyOpen(ring.slice(0, far + 1), tol);
  const b = simplifyOpen(ring.slice(far), tol);
  return [...a, ...b.slice(1)];
}
function simplifyOpen(ring, tol) {
  if (ring.length < 3) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = 0;
    let at = -1;
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - ring[i][1]) - (ax - ring[i][0]) * (by - ay)) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

/** Fit the metro's places to a w × h box and write each as an SVG path.
 *  The frame is fitted to where the places ARE — the 10–90% band of their
 *  centroids, with a margin — not to the metro's full extent: a handful of
 *  far-flung places would otherwise shrink the core to a smudge at this
 *  size. What falls outside is clipped by the chart. Returns the projection
 *  too, so the metro's own outline can be drawn in the same frame. */
function projectPlaces(geo, w, h) {
  const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
  const cx = [];
  const cy = [];
  for (const f of geo.features) {
    const ring = polys(f.geometry)[0]?.[0];
    if (!ring) continue;
    cx.push(ring.reduce((s, p) => s + p[0], 0) / ring.length);
    cy.push(ring.reduce((s, p) => s + p[1], 0) / ring.length);
  }
  const q = (xs, t) => [...xs].sort((a, b) => a - b)[Math.round(t * (xs.length - 1))];
  const mx = (q(cx, 0.9) - q(cx, 0.1)) * 0.15;
  const my = (q(cy, 0.9) - q(cy, 0.1)) * 0.15;
  const x0 = q(cx, 0.1) - mx, x1 = q(cx, 0.9) + mx;
  const y0 = q(cy, 0.1) - my, y1 = q(cy, 0.9) + my;
  /* equirectangular with the latitude correction — plenty at a metro's span */
  const kx = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const s = Math.min(w / ((x1 - x0) * kx), h / (y1 - y0));
  const ox = (w - (x1 - x0) * kx * s) / 2;
  const oy = (h - (y1 - y0) * s) / 2;
  const pt = ([lon, lat]) => [ox + (lon - x0) * kx * s, oy + (y1 - lat) * s];
  const pathOf = (geometry, tol) => {
    let d = "";
    for (const poly of polys(geometry))
      for (const ring of poly) {
        const pts = simplify(ring.map(pt), tol);
        if (pts.length < 4) continue;
        d += "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
      }
    return d;
  };
  const paths = new Map();
  for (const f of geo.features) {
    const d = pathOf(f.geometry, 0.3);
    const id = String(f.properties.place_id ?? "");
    if (d && id) paths.set(id, d);
  }
  return { paths, pathOf };
}

/* ---------- sectors (lib/naicsSectors.ts) ---------- */
const SECTOR = {
  11: ["11", "Agriculture", "Agriculture, Forestry & Fishing"], 21: ["21", "Mining", "Mining"],
  22: ["22", "Utilities", "Utilities"], 23: ["23", "Construction", "Construction"],
  31: ["31-33", "Manufacturing", "Manufacturing"], 32: ["31-33", "Manufacturing", "Manufacturing"],
  33: ["31-33", "Manufacturing", "Manufacturing"], 42: ["42", "Wholesale", "Wholesale Trade"],
  44: ["44-45", "Retail", "Retail Trade"], 45: ["44-45", "Retail", "Retail Trade"],
  48: ["48-49", "Transport", "Transportation & Warehousing"], 49: ["48-49", "Transport", "Transportation & Warehousing"],
  51: ["51", "Information", "Information"], 52: ["52", "Finance", "Finance & Insurance"],
  53: ["53", "Real Estate", "Real Estate"], 54: ["54", "Professional", "Professional Services"],
  55: ["55", "Management", "Management of Companies"], 56: ["56", "Admin", "Administrative & Support"],
  61: ["61", "Education", "Educational Services"], 62: ["62", "Health Care", "Health Care & Social"],
  71: ["71", "Arts & Rec", "Arts & Recreation"], 72: ["72", "Food & Hotels", "Accommodation & Food"],
  81: ["81", "Other", "Other Services"], 92: ["92", "Public Admin", "Public Administration"],
};
const sectorOf = (code2) => {
  const s = SECTOR[String(code2).slice(0, 2)];
  return s ? { code: s[0], short: s[1], name: s[2] } : { code: String(code2), short: "Other", name: "Other" };
};

/* ---------- run ---------- */

console.log(`cache: ${CACHE}`);
const [fCityPanel, fCityHousing, fPlacePanel, fPlaceHousing, fPlaceDir, fNational, fAttrs, fMsaInd] =
  await Promise.all([
    table("city_panel"), table("city_housing"), table("place_panel"), table("place_housing"),
    table("place_directory"), table("national_industry_employment"), table("industry_attributes"),
    table(`msa_industry_employment/${CITY.msaId}`),
  ]);
const fGeo = await fetchTo(
  `${BASE}/geo/usa/msa_places_geo/${CITY.msaId}.geojson`,
  path.join(CACHE, "geo", `msa_places_${CITY.msaId}.geojson`),
);
const fMsaGeo = await fetchTo(
  `${BASE}/geo/usa/msa_geo/${CITY.msaId}.geojson`,
  path.join(CACHE, "geo", `msa_${CITY.msaId}.geojson`),
);

/* the default wage series is applied where the live tool applies it: every
   consumer reads `avg_wage`, and gets the nowcast (lib/wageSource) */
const cityPanel = query(
  `SELECT city_id, city_name, year, population, wage_nowcast AS avg_wage FROM '${fCityPanel}' WHERE country='usa' ORDER BY city_id, year`,
);
const cityHousing = query(
  `SELECT city_id, year, value FROM '${fCityHousing}' WHERE country='usa' AND tier='all' AND value > 0 ORDER BY city_id, year`,
);
const placePanel = query(
  `SELECT place_id, year, population, wage_nowcast AS avg_wage FROM '${fPlacePanel}' WHERE country='usa' ORDER BY place_id, year`,
);
const placeHousing = query(
  `SELECT place_id, year, value FROM '${fPlaceHousing}' WHERE country='usa' AND tier='all' AND value > 0 ORDER BY place_id, year`,
);
const placeDir = query(`SELECT place_id, place_name, msa_id FROM '${fPlaceDir}' WHERE country='usa'`);
const national = query(`SELECT year, naics4, employment FROM '${fNational}' WHERE country='usa' AND employment IS NOT NULL`);
const msaInd = query(`SELECT year, naics4, employment FROM '${fMsaInd}' WHERE country='usa' AND employment IS NOT NULL`);
const attrs = new Map(query(`SELECT naics4, industry, sector_2d FROM '${fAttrs}' WHERE country='usa'`).map((a) => [a.naics4, a]));

/* ----- metros: the field every chart is read against ----- */
const cityRows = groupBy(cityPanel, "city_id");
const cityPrices = groupBy(cityHousing, "city_id");
const metros = [];
for (const [id, rows] of cityRows) {
  const g = growthOf(rows, cityPrices.get(id));
  if (g.pop == null) continue;
  metros.push({ id, name: rows[0].city_name, ...g });
}
const med = {
  pop: median(metros.map((m) => m.pop)),
  wage: median(metros.filter((m) => m.wage != null).map((m) => m.wage)),
  home: median(metros.filter((m) => m.home != null).map((m) => m.home)),
};

/* ----- the metro's places ----- */
const msaOf = new Map(placeDir.map((d) => [d.place_id, d.msa_id]));
const nameOf = new Map(placeDir.map((d) => [d.place_id, d.place_name]));
const placeRows = groupBy(placePanel, "place_id");
const placePrices = groupBy(placeHousing, "place_id");
const { paths, pathOf } = projectPlaces(JSON.parse(readFileSync(fGeo, "utf8")), 272, 176);
/* the metro's own boundary, in the same frame — the ground the places sit on */
const msaGeo = JSON.parse(readFileSync(fMsaGeo, "utf8"));
const msaOutline = (msaGeo.features ?? [msaGeo]).map((f) => pathOf(f.geometry, 0.5)).join("");
const places = [];
for (const [id, rows] of placeRows) {
  if (msaOf.get(id) !== CITY.msaId) continue;
  const g = growthOf(rows, placePrices.get(id));
  const shape = paths.get(id) ?? null;
  places.push({
    id,
    name: nameOf.get(id) ?? id,
    pop: g.pop,
    size: g.size,
    /* the live scatter's plausibility band on an annual growth rate */
    wage: g.wage != null && g.wage >= -0.15 && g.wage <= 0.3 ? g.wage : null,
    home: g.home != null && g.home >= -0.15 && g.home <= 0.3 ? g.home : null,
    d: shape,
  });
}
/* the supply fork's benchmark at place grain: the median across every place */
const placeHomeMedian = median(
  [...placeRows].map(([id, rows]) => growthOf(rows, placePrices.get(id)).home).filter((v) => v != null),
);

/* ----- home values over time: the metro, the place, the median metro ----- */
const yearsH = [...new Set(cityHousing.map((r) => r.year))].sort((a, b) => a - b);
const byYear = groupBy(cityHousing, "year");
const costTrend = yearsH.map((year) => ({
  year,
  metro: cityPrices.get(CITY.msaId)?.find((r) => r.year === year)?.value ?? null,
  place: placePrices.get(CITY.placeId)?.find((r) => r.year === year)?.value ?? null,
  median: Math.round(median(byYear.get(year).map((r) => r.value))),
}));

/* ----- shift-share (lib/shiftShare.ts, the classical form) ----- */
const snapYear = (rows, target) => nearestRow([...new Set(rows.map((r) => r.year))].map((year) => ({ year })), target).year;
const t0 = snapYear(msaInd, START);
const t1 = snapYear(msaInd, END);
const at = (rows) => new Map(rows.map((r) => [`${r.year}|${r.naics4}`, r.employment]));
const mAt = at(msaInd);
const nAt = at(national);
const sumYear = (rows, y) => rows.reduce((s, r) => s + (r.year === y ? r.employment : 0), 0);
const gN = sumYear(national, t1) / sumYear(national, t0);
const industries = [];
const newIndustries = [];
for (const n of new Set(msaInd.filter((r) => r.year === t0 || r.year === t1).map((r) => r.naics4))) {
  const e0 = mAt.get(`${t0}|${n}`) ?? 0;
  const e1 = mAt.get(`${t1}|${n}`) ?? 0;
  const n0 = nAt.get(`${t0}|${n}`) ?? 0;
  const n1 = nAt.get(`${t1}|${n}`) ?? 0;
  const gi = n0 > 0 ? n1 / n0 : null;
  const a = attrs.get(n);
  const sector = sectorOf(a?.sector_2d ?? n);
  const base = { naics: n, name: a?.industry ?? n, sector: sector.short };
  if (e0 === 0 && e1 > 0) {
    newIndustries.push({ ...base, jobs: e1 });
    continue;
  }
  if (e0 === 0 && e1 === 0) continue;
  const ns = e0 * (gN - 1);
  const im = gi == null ? 0 : e0 * (gi - gN);
  industries.push({ ...base, e0, e1, ns, im, ls: e1 - e0 - ns - im });
}
const tot = (k) => industries.reduce((s, r) => s + r[k], 0);
const fresh = newIndustries.reduce((s, r) => s + r.jobs, 0);
const endEmployment = tot("e1") + fresh;

/* ranked bars: the 2-digit level, ranked on the local-share effect, capped
   to the fifteen biggest movers either way and drawn in signed order */
const twoDigit = new Map();
for (const r of industries) {
  const code = [...new Set(r.naics.split("+").map((c) => c.slice(0, 2)))].join("+");
  const b = twoDigit.get(code) ?? { code, name: sectorOf(code).name, e0: 0, e1: 0, ns: 0, im: 0, ls: 0 };
  for (const k of ["e0", "e1", "ns", "im", "ls"]) b[k] += r[k];
  twoDigit.set(code, b);
}
const bars = [...twoDigit.values()]
  .sort((a, b) => Math.abs(b.ls) - Math.abs(a.ls))
  .slice(0, 15)
  .sort((a, b) => b.ls - a.ls);

/* share paths: the same buckets, year by year inside the window — the
   metro's jobs against its share of the national industry; the twelve
   biggest by the metro's jobs at the end of the trace */
const bucketOf = (naics) => [...new Set(naics.split("+").map((c) => c.slice(0, 2)))].join("+");
const yearsIn = [...new Set(msaInd.map((r) => r.year))].filter((y) => y >= t0 && y <= t1).sort((a, b) => a - b);
const cells = new Map();
const cellOf = (code, year) => {
  const k = `${code}|${year}`;
  if (!cells.has(k)) cells.set(k, { metro: 0, national: 0 });
  return cells.get(k);
};
for (const r of msaInd) if (yearsIn.includes(r.year)) cellOf(bucketOf(r.naics4), r.year).metro += r.employment;
for (const r of national) if (yearsIn.includes(r.year)) cellOf(bucketOf(r.naics4), r.year).national += r.employment;
const sharePaths = [...twoDigit.keys()]
  .map((code) => ({
    code,
    name: sectorOf(code).name,
    pts: yearsIn
      .map((year) => ({ year, ...cellOf(code, year) }))
      .filter((c) => c.metro > 0 && c.national > 0)
      .map((c) => ({ year: c.year, emp: Math.round(c.metro), share: c.metro / c.national })),
  }))
  .filter((s) => s.pts.length >= 2)
  .sort((a, b) => b.pts.at(-1).emp - a.pts.at(-1).emp)
  .slice(0, 12);
const lastYear = yearsIn.at(-1);
const overallShare = sumYear(msaInd, lastYear) / sumYear(national, lastYear);

/* the effect treemap: start-year jobs, tinted by the local-share effect.
   The long tail is folded per sector so the file stays small — every
   industry above 0.15% of the metro's jobs keeps its own tile */
const floor = tot("e0") * 0.0015;
const tiles = [];
const tail = new Map();
for (const r of industries) {
  if (r.e0 <= 0) continue;
  if (r.e0 >= floor) tiles.push({ name: r.name, sector: r.sector, e0: Math.round(r.e0), ls: Math.round(r.ls) });
  else {
    const t = tail.get(r.sector) ?? { name: `Other ${r.sector.toLowerCase()}`, sector: r.sector, e0: 0, ls: 0, n: 0 };
    t.e0 += r.e0; t.ls += r.ls; t.n += 1;
    tail.set(r.sector, t);
  }
}
for (const t of tail.values()) tiles.push({ name: `${t.name} (${t.n})`, sector: t.sector, e0: Math.round(t.e0), ls: Math.round(t.ls) });
const absLs = industries.map((r) => Math.abs(r.ls)).sort((a, b) => a - b);

/* ---------- write ---------- */
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
const data = {
  city: CITY.short,
  placeId: CITY.placeId,
  msaId: CITY.msaId,
  window: { from: START, to: END },
  medians: { pop: r4(med.pop), wage: r4(med.wage), home: r4(med.home), placeHome: r4(placeHomeMedian) },
  metros: metros.map((m) => ({ id: m.id, name: m.name, pop: r4(m.pop), wage: r4(m.wage), home: r4(m.home), size: Math.round(m.size) })),
  places: places.map((p) => ({ ...p, pop: r4(p.pop), wage: r4(p.wage), home: r4(p.home) })),
  msaOutline,
  costTrend,
  shiftShare: {
    t0,
    t1,
    start: Math.round(tot("e0")),
    national: Math.round(tot("ns")),
    mix: Math.round(tot("im")),
    local: Math.round(tot("ls")),
    fresh: Math.round(fresh),
    end: Math.round(endEmployment),
    /* lib/shiftShare.ts, newIndustriesAreMaterial */
    freshMaterial: fresh >= 500 && fresh / endEmployment >= 0.002,
    bars: bars.map((b) => ({ code: b.code, name: b.name, e0: Math.round(b.e0), e1: Math.round(b.e1), ls: Math.round(b.ls) })),
    sharePaths: sharePaths.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, share: Math.round(p.share * 1e5) / 1e5 })) })),
    overallShare: Math.round(overallShare * 1e5) / 1e5,
    tiles: tiles.sort((a, b) => b.e0 - a.e0),
    /* the palette's domain: the 95th percentile of |effect| across industries */
    tileScale: Math.round(absLs[Math.floor(absLs.length * 0.95)] ?? 1),
    newIndustries: newIndustries.sort((a, b) => b.jobs - a.jobs).map((n) => ({ ...n, jobs: Math.round(n.jobs) })),
  },
};

const header = `/** REAL data behind the analysis section's charts, for ${CITY.short} — pulled from
 *  the live tool's own files (the ones its rendered page fetches:
 *  cities.taimur.sh/usa/place/boston-ma → /data/usa/*.parquet, the metro's
 *  industry panel and its places' boundaries) by scripts/build-driver-data.mjs,
 *  which ports the live tool's computations. Not synthesized, and not edited
 *  by hand: regenerate with \`node scripts/build-driver-data.mjs\`.
 *
 *  WINDOW ${START} → ${END}, on the live tool's default wage series — its default
 *  view, and the SAME window as the walk's data (src/data/metrosData.ts, written
 *  by the same run of the same script).
 *
 *    metros      every US metro: population, pay and home-value growth (CAGR)
 *    places      every place in the ${CITY.short} MSA: the same three reads, and
 *                its boundary as an SVG path
 *                (a 272 × 176 frame fitted to where the places are, not to
 *                the metro's full extent; the chart clips the rest)
 *    costTrend   Zillow home values by year: the MSA, the place, the median metro
 *    shiftShare  the MSA's employment change ${t0} → ${t1}, decomposed; the 2-digit
 *                movers; their share paths; the start-year treemap
 */

export interface DriverMetro { id: string; name: string; pop: number; wage: number | null; home: number | null; size: number }
export interface DriverPlace { id: string; name: string; pop: number | null; size: number | null; wage: number | null; home: number | null; d: string | null }
export interface DriverData {
  city: string;
  placeId: string;
  msaId: string;
  window: { from: number; to: number };
  medians: { pop: number; wage: number; home: number; placeHome: number };
  metros: DriverMetro[];
  places: DriverPlace[];
  /** the metro's boundary, in the places' frame */
  msaOutline: string;
  costTrend: { year: number; metro: number | null; place: number | null; median: number }[];
  shiftShare: {
    t0: number; t1: number;
    start: number; national: number; mix: number; local: number; fresh: number; end: number;
    freshMaterial: boolean;
    bars: { code: string; name: string; e0: number; e1: number; ls: number }[];
    sharePaths: { code: string; name: string; pts: { year: number; emp: number; share: number }[] }[];
    overallShare: number;
    tiles: { name: string; sector: string; e0: number; ls: number }[];
    tileScale: number;
    newIndustries: { naics: string; name: string; sector: string; jobs: number }[];
  };
}

`;
const outFile = path.join(ROOT, "src/data/driverData.ts");
writeFileSync(
  outFile,
  header +
    `const ${CITY.short.toUpperCase()}: DriverData = ${JSON.stringify(data)};\n\n` +
    `/** keyed by the app's short city name; a city without an entry keeps the schematic charts */\n` +
    `export const DRIVER_DATA: Record<string, DriverData> = { ${JSON.stringify(CITY.short)}: ${CITY.short.toUpperCase()} };\n\n` +
    `export const driverData = (cityShort: string): DriverData | null => DRIVER_DATA[cityShort] ?? null;\n`,
);

/* ---------- the walk's data: same pull, same window ---------- */
const p4 = (v) => (v == null ? null : Math.round(v * 1e6) / 1e4); // fraction → %/yr, 4 dp
const levelAt = (prices) => (prices ? (nearestRow(prices, END)?.value ?? null) : null);
/* the plane needs both dials, so a metro with no pay series is not on it */
const field = metros
  .filter((m) => m.wage != null)
  .sort((a, b) => b.size - a.size)
  .map((m) => ({ name: m.name, pop: p4(m.pop), wage: p4(m.wage), home: p4(m.home), size: Math.round(m.size) }));
const fieldMed = {
  pop: median(field.map((m) => m.pop)),
  wage: median(field.map((m) => m.wage)),
  home: median(field.filter((m) => m.home != null).map((m) => m.home)),
};
const samplePlaces = {};
const sampleMetros = {};
const placeHousingOut = {};
const metroHousingOut = {};
for (const smp of SAMPLES) {
  const g = growthOf(placeRows.get(smp.placeId) ?? [], placePrices.get(smp.placeId));
  samplePlaces[smp.short] = { name: smp.short, pop: p4(g.pop), wage: p4(g.wage), home: p4(g.home), size: Math.round(g.size ?? 0) };
  placeHousingOut[smp.short] = { zhvi: p4(g.home), level: levelAt(placePrices.get(smp.placeId)) };
  const m = metros.find((x) => x.id === smp.msaId);
  sampleMetros[smp.short] = { name: smp.short, pop: p4(m.pop), wage: p4(m.wage), home: p4(m.home), size: Math.round(m.size) };
  metroHousingOut[smp.short] = { zhvi: p4(m.home), level: levelAt(cityPrices.get(smp.msaId)) };
}
/* how far the planes reach either side of their medians: wide enough for
   ~96% of the metro field AND for the walk's own city, which sits well off
   the metro median by construction (an admin city is not its metro) */
const reach = (vals, medianV, extra) => {
  const dev = vals.map((v) => Math.abs(v - medianV)).sort((a, b) => a - b);
  const q = dev[Math.floor(dev.length * 0.96)];
  return Math.ceil(Math.max(q, ...extra.map((v) => Math.abs(v - medianV) * 1.08)) * 10) / 10;
};
const smpPlaces = Object.values(samplePlaces);
const span = {
  pop: reach(field.map((m) => m.pop), fieldMed.pop, []),
  wage: reach(field.map((m) => m.wage), fieldMed.wage, []),
};
const priceSpan = {
  pop: reach(field.map((m) => m.pop), fieldMed.pop, smpPlaces.map((c) => c.pop)),
  home: reach(field.filter((m) => m.home != null).map((m) => m.home), fieldMed.home, smpPlaces.map((c) => c.home)),
};

const walkFile = path.join(ROOT, "src/data/metrosData.ts");
writeFileSync(
  walkFile,
  `/** REAL data for the walk — the population × pay plane, its medians, and the
 *  walk's city at both geographies — pulled from the live tool's own files
 *  (cities.taimur.sh → /data/usa/city_panel, city_housing, place_panel,
 *  place_housing) by scripts/build-driver-data.mjs. Not synthesized, and not
 *  edited by hand: regenerate with \`node scripts/build-driver-data.mjs\`.
 *
 *    window   ${START} → ${END}, the live tool's default; each end snapped to the
 *             nearest year a series has (the live tool's own rule)
 *    pay      the live tool's default wage series (\`wage_nowcast\`: the IRS
 *             wage carried past its frontier)
 *    values   growth as CAGR in %/yr, FOUR decimals — round for display only:
 *             a fork is an exact comparison against a median, and a value
 *             rounded onto the median flips it
 *
 *  src/data/metros.ts wraps this file with the app's helpers; driverData.ts is
 *  the same run's other output, so the two always share a window. */

export const DATA_WINDOW = { from: ${START}, to: ${END} } as const;

export interface MetroRow {
  name: string;
  /** population growth, CAGR %/yr */
  pop: number;
  /** average-pay growth, CAGR %/yr */
  wage: number;
  /** home-value growth (Zillow ZHVI, all homes), CAGR %/yr — null where
   *  Zillow publishes no series */
  home: number | null;
  /** latest population (dot sizing) */
  size: number;
}

/** every US metro with both dials over the window (n = ${field.length}), largest first */
export const METRO_ROWS: MetroRow[] = ${JSON.stringify(field)};

/** the walk's cities' ADMIN places, keyed by the app's short city name */
export const SAMPLE_PLACES: Record<string, MetroRow> = ${JSON.stringify(samplePlaces)};
/** ...and their metros, resolved by id rather than by matching names */
export const SAMPLE_METROS: Record<string, MetroRow> = ${JSON.stringify(sampleMetros)};

/** home values: growth over the window, and the latest level (USD) */
export const PLACE_HOUSING_ROWS: Record<string, { zhvi: number | null; level: number | null }> = ${JSON.stringify(placeHousingOut)};
export const METRO_HOUSING_ROWS: Record<string, { zhvi: number | null; level: number | null }> = ${JSON.stringify(metroHousingOut)};

/** the median metro's home-value growth — the dashed line the supply fork's
 *  plane draws, and the benchmark the fork tests against (n = ${field.filter((m) => m.home != null).length}). The
 *  live tool's place-grain test reads the median across every US PLACE
 *  instead: ${(placeHomeMedian * 100).toFixed(2)} on this window, against this ${fieldMed.home.toFixed(2)} — no sample city sits
 *  between the two. */
export const METRO_MEDIAN_HOME = ${fieldMed.home};
export const PLACE_MEDIAN_HOME = ${Math.round(placeHomeMedian * 1e6) / 1e4};

/** how far each plane reaches either side of its medians, %/yr: the
 *  population × pay plane covers ~96% of the metro field; the price plane
 *  also has to hold the sample ADMIN cities, which sit off the metro median */
export const PLANE_SPAN = ${JSON.stringify(span)};
export const PRICE_PLANE_SPAN = ${JSON.stringify(priceSpan)};
`,
);
console.log(`wrote ${path.relative(ROOT, walkFile)} (${(readFileSync(walkFile).length / 1024).toFixed(0)} KB) — ${field.length} metros`);
const side = (c) => {
  const popUp = c.pop >= fieldMed.pop;
  const wageUp = c.wage >= fieldMed.wage;
  return popUp === wageUp ? (popUp ? "Magnet" : "Leak") : popUp ? "Sponge" : "Fortress";
};
console.log(`medians: pop ${fieldMed.pop.toFixed(2)} · pay ${fieldMed.wage.toFixed(2)} · home ${fieldMed.home.toFixed(2)} (places ${(placeHomeMedian * 100).toFixed(2)})`);
for (const smp of SAMPLES) {
  const c = samplePlaces[smp.short];
  const m = sampleMetros[smp.short];
  const q = side(c);
  const leaf =
    q === "Magnet" ? "" : q === "Leak" ? (m.pop < fieldMed.pop ? " › MSA-wide" : " › Admin-specific") : c.home >= fieldMed.home ? " › Housing" : " › Amenities";
  console.log(`  ${smp.short.padEnd(12)} pop ${c.pop.toFixed(2)} pay ${c.wage.toFixed(2)} home ${c.home.toFixed(2)} | MSA pop ${m.pop.toFixed(2)} pay ${m.wage.toFixed(2)} → ${q}${leaf}`);
}

/* ---------- check against what the rendered page states ---------- */
const me = places.find((p) => p.id === CITY.placeId);
const pc = (v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}`;
console.log(`wrote ${path.relative(ROOT, outFile)} (${(readFileSync(outFile).length / 1024).toFixed(0)} KB)`);
console.log(`metros ${metros.length} · places in the MSA ${places.length} (boundary ${places.filter((p) => p.d).length}, with a population series ${places.filter((p) => p.pop != null).length})`);
console.log(`${CITY.short}: population ${pc(me.pop)}%/yr, pay ${pc(me.wage)}%/yr   [the page: +0.2, +4.8]`);
console.log(`home values ${pc(me.home)}%/yr against a place median of ${pc(placeHomeMedian)} → ${me.home >= placeHomeMedian ? "housing" : "amenities"}`);
console.log(`shift-share ${t0}→${t1}: ${data.shiftShare.start} + ${data.shiftShare.national} + ${data.shiftShare.mix} + ${data.shiftShare.local} + ${data.shiftShare.fresh} = ${data.shiftShare.end}`);
