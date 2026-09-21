#!/usr/bin/env node
/* Pull Boston's amenity indicators out of the Growth Lab's Amenities Module
   and write src/data/amenityData.ts.

   usage:  node scripts/build-amenity-data.mjs            (downloads the page)
           node scripts/build-amenity-data.mjs --src <saved page.html>

   THE SOURCE is one self-contained page —
   https://cities.taimur.sh/tools/amenities-module.html (cities-tool,
   tools/build-amenities-module.sh) — with its data inlined as
   `const DATA = {…}`: every US place the module covers (2,688) and every
   metro, ~12 MB. This script keeps ONE place, its metro, and the few national
   figures its charts are read against, so what ships is a few KB.

   WHAT IS KEPT, and how each is read (the page's own "Definitions and
   sources", condensed — the analysis section shows none of its prose):

     crime     crime severity: the social cost of reported Part I offences
               per resident, as a % of the national figure that year (100 =
               the national level; lower is safer). Yearly, 2012 →, place and
               metro; `smooth` is the page's 3-year average (offence counts
               smoothed before weighting — not a moving average of the line),
               which is what the page draws by default.
     edu       school achievement against the national average of the same
               year, in student-level standard deviations (math + reading,
               grades 3–8; 0 = national). × gradeFactor = grade levels.
               2020–21 are interpolated on the page. `smooth` = centred
               3-year mean, the page's default.
     aqi       EPA's Air Quality Index, averaged by calendar month from
               Jan 2010 (lower is cleaner; ≤50 Good, 51–100 Moderate), place
               and metro. Drawn unsmoothed on the page; annual means are
               added here so a small chart has a line it can label.
     jobs      jobs reachable by car within 15 / 30 / 60 minutes of the
               place's population-weighted centre (LODES 2023, Mapbox
               drive-time areas, 08:00 on a Wednesday), with the place's rank
               among its metro's places and nationally (1 = most), and the
               median place in each. A snapshot, not a series.
     vitality  operating establishments inside the boundary (Google Places
               Aggregate, Sept 2026) per 1,000 residents, for three kinds —
               non-fast-food restaurants, daily needs, arts/culture/recreation
               — against the NATIONAL RATE, which the page defines as every
               counted place pooled (sum of counts over sum of population).
               Recomputed here the same way, from the same records.

   The module has no composite, so the spec's "Overall amenities score" stays
   a data point to come.

   Boston only, on purpose (Sept 2026): it is the one city this prototype
   carries. To add one, change CITY and merge the output. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_ = "https://cities.taimur.sh/tools/amenities-module.html";
const CITY = { short: "Boston", placeId: "2507000" };

const args = process.argv.slice(2);
const srcIdx = args.indexOf("--src");
let html;
if (srcIdx >= 0 && args[srcIdx + 1]) {
  html = fs.readFileSync(path.resolve(args[srcIdx + 1]), "utf8");
  console.log(`read ${args[srcIdx + 1]} (${html.length.toLocaleString()} chars)`);
} else {
  const res = await fetch(URL_);
  if (!res.ok) throw new Error(`${URL_}: HTTP ${res.status}`);
  html = await res.text();
  console.log(`fetched ${URL_} (${html.length.toLocaleString()} chars)`);
}

/* the inlined object: from `const DATA = ` to the brace that closes it,
   stepping over strings so a brace inside one is not counted */
const MARK = "const DATA = ";
const at = html.indexOf(MARK);
if (at < 0) throw new Error("`const DATA = ` not found — the page's build changed");
let i = at + MARK.length;
if (html[i] !== "{") throw new Error("DATA does not open with an object");
let depth = 0, inStr = false;
const start = i;
for (; i < html.length; i++) {
  const ch = html[i];
  if (inStr) {
    if (ch === "\\") i++;
    else if (ch === '"') inStr = false;
  } else if (ch === '"') inStr = true;
  else if (ch === "{") depth++;
  else if (ch === "}" && --depth === 0) break;
}
const DATA = JSON.parse(html.slice(start, i + 1));

const place = DATA.places.find((p) => p.id === CITY.placeId);
if (!place) throw new Error(`place ${CITY.placeId} is not in the module`);
const metro = DATA.metros[place.msa];
if (!metro) throw new Error(`metro ${place.msa} is not in the module`);
for (const k of ["crime", "edu", "aqi", "jobs", "vit"])
  if (!place[k]) throw new Error(`${CITY.short} has no ${k} record`);

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);

/* ---- air quality: the monthly series, and a mean per calendar year ---- */
const { y0, n: nMonths } = DATA.meta.aqi;
const annual = (monthly) => {
  const out = [];
  for (let m = 0; m < nMonths; m += 12) {
    const vs = monthly.slice(m, m + 12).filter((v) => v != null);
    /* a year with fewer than 9 months on record is not a year's mean */
    out.push(vs.length >= 9 ? r1(vs.reduce((s, v) => s + v, 0) / vs.length) : null);
  }
  return out;
};

/* ---- urban vitality: the page's national rate, recomputed its way ---- */
const VIT = [
  { key: "r", label: "Restaurants", full: "Non fast-food restaurants" },
  { key: "d", label: "Daily needs", full: "Daily needs (grocers, pharmacies, gyms, libraries…)" },
  { key: "c", label: "Arts & culture", full: "Arts, culture and recreation" },
];
const counted = DATA.places.filter((p) => p.vit);
const pooledPop = counted.reduce((s, p) => s + p.vit.pop, 0);
const vitality = VIT.map((t) => {
  const national = (1000 * counted.reduce((s, p) => s + p.vit[t.key], 0)) / pooledPop;
  const rate = (1000 * place.vit[t.key]) / place.vit.pop;
  return {
    key: t.key, label: t.label, full: t.full,
    count: place.vit[t.key],
    rate: Math.round(rate * 100) / 100,
    national: Math.round(national * 100) / 100,
    ratio: Math.round((rate / national) * 100) / 100,
  };
});

const J = place.jobs;
const out = {
  city: CITY.short,
  placeId: place.id,
  msaId: place.msa,
  msaName: metro.name,
  built: DATA.meta.built,
  years: DATA.meta.years,
  crime: {
    place: place.crime.s.map(r1), metro: metro.crime.s.map(r1),
    placeRaw: place.crime.r.map(r1), metroRaw: metro.crime.r.map(r1),
  },
  edu: {
    gradeFactor: DATA.meta.gradeFactor,
    place: place.edu.s.map(r4), metro: metro.edu.s.map(r4),
    placeRaw: place.edu.r.map(r4), metroRaw: metro.edu.r.map(r4),
  },
  aqi: {
    y0,
    place: place.aqi.map(r1), metro: (metro.aqi ?? []).map(r1),
    placeAnnual: annual(place.aqi), metroAnnual: annual(metro.aqi ?? []),
  },
  jobs: {
    dataYear: 2023,
    minutes: [15, 30, 60],
    reach: J.j, estimatedShare: J.f,
    rankMetro: J.rc, nMetro: J.nc, medianMetro: J.mc,
    rankNation: J.rn, nNation: J.nn, medianNation: J.mn,
  },
  /* `asOf` is the page's own statement of when the counts were taken (its
     "Definitions and sources": Google Places Aggregate API, September 2026) */
  vitality: { asOf: "Sept 2026", counted: counted.length, pop: place.vit.pop, popYear: J.popYear, types: vitality },
};

const banner = `/** REAL amenity indicators for ${CITY.short} — pulled out of the Growth Lab's
 *  Amenities Module (${URL_},
 *  built ${DATA.meta.built}) by scripts/build-amenity-data.mjs, which documents each
 *  measure. Not synthesized, and not edited by hand: regenerate with
 *  \`node scripts/build-amenity-data.mjs\`.
 *
 *  These fill the team spec's own Amenities data points (figures.ts, MODULES
 *  .amenities) — Education, Crime, Transportation, Air quality index, Quality
 *  of life — one chart each (src/components/pages/amenityCharts.tsx). The
 *  module publishes no composite, so "Overall amenities score" stays to come.
 *
 *    crime     crime-cost index, % of the national figure (100 = national;
 *              lower is safer), yearly; \`place\` / \`metro\` are the page's
 *              3-year average, \`…Raw\` the annual values
 *    edu       school achievement vs the national average, in student-level
 *              SDs (0 = national; × gradeFactor = grade levels), yearly
 *    aqi       EPA AQI by calendar month from Jan \`y0\` (lower is cleaner),
 *              plus a mean per calendar year
 *    jobs      jobs reachable by car in 15 / 30 / 60 min (LODES ${out.jobs.dataYear}), ranks
 *              among the metro's places and nationally (1 = most), medians
 *    vitality  establishments per 1,000 residents against the national rate
 *              (all ${counted.length.toLocaleString()} counted places pooled)
 */

export interface AmenityData {
  city: string;
  placeId: string;
  msaId: string;
  msaName: string;
  built: string;
  years: number[];
  crime: { place: (number | null)[]; metro: (number | null)[]; placeRaw: (number | null)[]; metroRaw: (number | null)[] };
  edu: { gradeFactor: number; place: (number | null)[]; metro: (number | null)[]; placeRaw: (number | null)[]; metroRaw: (number | null)[] };
  aqi: { y0: number; place: (number | null)[]; metro: (number | null)[]; placeAnnual: (number | null)[]; metroAnnual: (number | null)[] };
  jobs: {
    dataYear: number;
    minutes: number[];
    reach: number[];
    estimatedShare: number[];
    rankMetro: number[]; nMetro: number[]; medianMetro: number[];
    rankNation: number[]; nNation: number[]; medianNation: number[];
  };
  vitality: {
    asOf: string;
    counted: number;
    pop: number;
    popYear: number;
    types: { key: string; label: string; full: string; count: number; rate: number; national: number; ratio: number }[];
  };
}

const ${CITY.short.toUpperCase()}: AmenityData = ${JSON.stringify(out)};

/** keyed by the app's short city name */
export const AMENITY_DATA: Record<string, AmenityData> = { ${JSON.stringify(CITY.short)}: ${CITY.short.toUpperCase()} };

export const amenityData = (cityShort: string): AmenityData | null => AMENITY_DATA[cityShort] ?? null;
`;

const file = path.join(ROOT, "src/data/amenityData.ts");
fs.writeFileSync(file, banner);
console.log(`wrote src/data/amenityData.ts (${banner.length.toLocaleString()} chars)`);

/* ---- a read-back, to eyeball against the page with Boston selected ---- */
const last = (xs) => { for (let k = xs.length - 1; k >= 0; k--) if (xs[k] != null) return [out.years[k], xs[k]]; return [null, null]; };
const [cy, cv] = last(out.crime.place), [, cm] = last(out.crime.metro);
const [ey, ev] = last(out.edu.place), [, em] = last(out.edu.metro);
console.log(`${place.name}, ${place.st} · ${metro.name}`);
console.log(`  crime (3-yr avg, ${cy}): ${cv} · metro ${cm}   [100 = national]`);
console.log(`  education (3-yr avg, ${ey}): ${ev} SD · metro ${em} SD   [0 = national]`);
console.log(`  AQI ${y0 + out.aqi.placeAnnual.length - 1} mean: ${out.aqi.placeAnnual.at(-1)} · metro ${out.aqi.metroAnnual.at(-1)}`);
console.log(`  jobs within 15/30/60 min: ${out.jobs.reach.map((v) => v.toLocaleString()).join(" / ")} · rank in metro ${out.jobs.rankMetro.join("/")} of ${out.jobs.nMetro[0]} · nationally ${out.jobs.rankNation.join("/")} of ${out.jobs.nNation[0].toLocaleString()}`);
for (const t of out.vitality.types) console.log(`  ${t.label}: ${t.count.toLocaleString()} = ${t.rate}/1,000 · national ${t.national} · ${t.ratio}×`);
