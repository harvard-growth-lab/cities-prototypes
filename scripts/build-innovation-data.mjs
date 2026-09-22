#!/usr/bin/env node
/* Pull Boston's innovation indicators out of the Growth Lab's Innovation
   Module and write src/data/innovationData.ts.

   usage:  node scripts/build-innovation-data.mjs            (downloads the page)
           node scripts/build-innovation-data.mjs --src <saved page.html>

   THE SOURCE is one self-contained page —
   https://cities.taimur.sh/tools/innovation-module.html (cities-tool,
   tools/build-innovation-module.sh) — with its data inlined as
   `const DATA = {…}`: every metro (387), fourteen years of firm counts, and
   per-year patent and publication counts by category, ~3 MB. This script
   pools ONE window for ONE metro, the page's own way, and keeps the few
   figures the analysis section reads it against, so what ships is ~15 KB.

   WHAT IS KEPT — the team spec's three Innovation data points, and nothing
   the page draws beyond them (its annual entry/exit lines and its
   output-against-population fits stay on the page):

     firms          entry and exit rates: new employer firms, and firms whose
                    every establishment in the metro closed, per 100 firms
                    (the Davis–Haltiwanger–Schuh denominator), each
                    shift-share adjusted for the metro's industry mix. Pooled
                    over the window as a ratio of summed counts; the
                    benchmark is all metros pooled the same way. The quadrant
                    is the page's — Churn (both high), Decline (entry low,
                    exit high), Stasis (both low), Growth (entry high, exit
                    low), each rate against its benchmark — and `readEntry` /
                    `readExit` its rule for "similar": within a quarter of a
                    standard deviation across metros. `field` is every other
                    metro's pooled point, for the scatter.
     patents        fractional DOCDB families with a USPTO grant, dated by
                    earliest filing and split over the metros and IPC
                    subclasses they touch, pooled over the window, per
                    10,000 residents (the metro's mean population over the
                    window), with its rank among metros and every other
                    metro's rate for the strip. The page's own caveat: a
                    family enters only once a US grant has issued, so the
                    latest years are incomplete. RCA: the metro's share of
                    its families in a technology ÷ that technology's share
                    across all metros — `broad` the 8 IPC sections, `detailed`
                    the IPC4 subclasses, top 10 by RCA, both above the page's
                    floor of 10 families.
     publications   OpenAlex articles, credited whole to every metro with an
                    authoring institution, pooled, per 10,000 residents, same
                    rank and field; RCA in fractional counts — `broad` the 9
                    broad fields, `detailed` the level-1 concepts, top 10,
                    floor 5 fractional articles.

   THE WINDOW is the page's default: the latest `poolLength` years the table
   carries, read off the data as the page reads it (2019–2023 on the
   2026-09-15 build) — so a figure here is the one the page shows when it
   opens on Boston.

   Boston only, on purpose (Sept 2026): it is the one city this prototype
   carries. To add one, change CITY and merge the output. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_ = "https://cities.taimur.sh/tools/innovation-module.html";
const CITY = { short: "Boston", msaId: "14460" };
/** the rate's denominator: output per this many residents */
const PER = 10_000;

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
const { meta, metros } = DATA;
const YEARS = meta.years;
const NY = YEARS.length;
const me = metros.find((m) => m.id === CITY.msaId);
if (!me) throw new Error(`metro ${CITY.msaId} is not in the module`);

/* the page's default window: the latest poolLength years */
const I0 = Math.max(0, NY - meta.poolLength);
const I1 = NY - 1;
const window_ = { from: YEARS[I0], to: YEARS[I1] };

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const sumRange = (a, i0, i1, off = 0) => {
  let s = 0;
  for (let k = i0; k <= i1; k++) s += a[k + off] || 0;
  return s;
};

/* ---- firm creation: the page's pool(), verbatim in its arithmetic ---- */
const quadrantOf = (entry, exit, benchEntry, benchExit) =>
  entry >= benchEntry ? (exit >= benchExit ? "churn" : "growth") : exit >= benchExit ? "decline" : "stasis";
function pool(i0, i1) {
  let B = 0, D = 0, F = 0;
  const rows = metros.map((m) => {
    let b = 0, d = 0, f = 0, eb = 0, ed = 0, stock = 0;
    for (let k = i0; k <= i1; k++) {
      b += m.births[k]; d += m.deaths[k]; f += m.firms_avg[k];
      eb += m.exp_births[k]; ed += m.exp_deaths[k]; stock += m.firms[k];
    }
    B += b; D += d; F += f;
    return { m, b, d, f, eb, ed, firms: stock / (i1 - i0 + 1) };
  });
  const benchEntry = (B / F) * 100;
  const benchExit = (D / F) * 100;
  const out = new Map();
  for (const r of rows) {
    const entry = ((r.b - r.eb) / r.f) * 100 + benchEntry;
    const exit = ((r.d - r.ed) / r.f) * 100 + benchExit;
    out.set(r.m.id, { entry, exit, net: entry - exit, firms: r.firms, quad: quadrantOf(entry, exit, benchEntry, benchExit) });
  }
  const sd = (key, bench) => Math.sqrt([...out.values()].reduce((s, p) => s + (p[key] - bench) ** 2, 0) / out.size);
  return { benchEntry, benchExit, sdEntry: sd("entry", benchEntry), sdExit: sd("exit", benchExit), rows: out };
}
const POOL = pool(I0, I1);
const P = POOL.rows.get(CITY.msaId);
/* the page's "similar": within a quarter of a standard deviation across metros */
const SIMILAR_SD = 0.25;
const rel = (v, bench, sd) => (Math.abs(v - bench) < SIMILAR_SD * sd ? "similar" : v > bench ? "higher" : "lower");
const firms = {
  entry: r2(P.entry), exit: r2(P.exit), net: r2(P.net), firms: Math.round(P.firms), quad: P.quad,
  benchEntry: r2(POOL.benchEntry), benchExit: r2(POOL.benchExit),
  sdEntry: r2(POOL.sdEntry), sdExit: r2(POOL.sdExit),
  readEntry: rel(P.entry, POOL.benchEntry, POOL.sdEntry),
  readExit: rel(P.exit, POOL.benchExit, POOL.sdExit),
  rankEntry: [...POOL.rows.values()].filter((p) => p.entry > P.entry).length + 1,
  field: metros.filter((m) => m.id !== CITY.msaId).map((m) => {
    const p = POOL.rows.get(m.id);
    return [r2(p.entry), r2(p.exit)];
  }),
};

/* ---- patents and publications: output per resident, and RCA ---- */
const DS = {
  patents: {
    data: DATA.pat, floor: 10, unit: "patent families", floorUnit: "patent families",
    output: (m) => sumRange(m.pat.t, I0, I1), cat: (m) => m.pat,
    broadNoun: "IPC sections", detNoun: "IPC subclasses",
  },
  publications: {
    data: DATA.pub, floor: 5, unit: "publications", floorUnit: "fractional articles",
    output: (m) => sumRange(m.works, I0, I1), cat: (m) => m.pub,
    broadNoun: "broad fields", detNoun: "research concepts",
  },
};

/* the page's scaleFit(): mean population and pooled output for every metro,
   and the OLS fit of log output on log population — kept only for the
   metro's own distance from the line, which the page states under the chart */
function scaleFit(ds) {
  const pts = [];
  for (const m of metros) {
    const pops = m.pop.slice(I0, I1 + 1).filter((v) => v != null);
    const pop = pops.length ? pops.reduce((s, v) => s + v, 0) / pops.length : 0;
    const y = ds.output(m);
    if (pop > 0 && y > 0) pts.push({ m, pop, y, lx: Math.log10(pop), ly: Math.log10(y) });
  }
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.lx, 0) / n, my = pts.reduce((s, p) => s + p.ly, 0) / n;
  let sxy = 0, sxx = 0;
  for (const p of pts) { sxy += (p.lx - mx) * (p.ly - my); sxx += (p.lx - mx) ** 2; }
  const b = sxy / sxx, a = my - b * mx;
  for (const p of pts) p.resid = p.ly - (a + b * p.lx);
  return pts;
}

/* the page's rcaRows(): (x / X_c) / (X_i / X_W) in fractional counts, the
   floor hiding thin cells without moving any other RCA */
function rcaRows(ds, level) {
  const D = ds.data, mk = ds.cat(me);
  const xc = sumRange(mk.t, I0, I1), xw = sumRange(D.natTot, I0, I1);
  const rows = [];
  if (xc > 0) {
    const push = (code, name, b, x, xi) => {
      if (x >= ds.floor && xi > 0)
        rows.push({ ...(code ? { code } : {}), name, section: b, count: r1(x), share: r4(x / xc), nat: r4(xi / xw), rca: r3(x / xc / (xi / xw)) });
    };
    if (level === "broad") D.broad.forEach((c, k) => push(c.key !== c.name ? c.key : null, c.name, k, sumRange(mk.b[k], I0, I1), sumRange(D.natBroad[k], I0, I1)));
    else for (const row of mk.d) {
      const c = D.cats[row[0]];
      push(c.code ?? null, c.name, c.b, sumRange(row, I0, I1, 1), sumRange(D.nat[row[0]], I0, I1));
    }
  }
  rows.sort((p, q) => q.rca - p.rca || p.name.localeCompare(q.name));
  return level === "broad" ? rows : rows.slice(0, 10);
}

function specialization(key) {
  const ds = DS[key];
  const pts = scaleFit(ds);
  const mine = pts.find((p) => p.m.id === CITY.msaId);
  if (!mine) throw new Error(`${CITY.short} has no ${ds.unit} in ${window_.from}–${window_.to}`);
  const rate = (p) => (p.y / p.pop) * PER;
  const all = pts.map(rate).sort((a, b) => a - b);
  const median = all.length % 2 ? all[(all.length - 1) / 2] : (all[all.length / 2 - 1] + all[all.length / 2]) / 2;
  return {
    unit: ds.unit,
    floor: ds.floor,
    floorUnit: ds.floorUnit,
    output: r1(mine.y),
    pop: Math.round(mine.pop),
    per: PER,
    rate: r2(rate(mine)),
    rank: pts.filter((p) => rate(p) > rate(mine)).length + 1,
    n: pts.length,
    median: r2(median),
    fitFactor: r2(10 ** mine.resid),
    field: pts.filter((p) => p.m.id !== CITY.msaId).map((p) => r3(rate(p))).sort((a, b) => a - b),
    sections: ds.data.broad.map((c) => ({ key: c.key, name: c.name })),
    broad: rcaRows(ds, "broad"),
    detailed: rcaRows(ds, "detailed"),
  };
}

const out = {
  city: CITY.short,
  msaId: me.id,
  msaName: me.name,
  built: meta.built,
  window: window_,
  nMetro: meta.nMetro,
  firms,
  patents: specialization("patents"),
  publications: specialization("publications"),
};

const banner = `/** REAL innovation indicators for ${CITY.short} — pulled out of the Growth Lab's
 *  Innovation Module (${URL_},
 *  built ${meta.built}) by scripts/build-innovation-data.mjs, which documents
 *  each measure. Not synthesized, and not edited by hand: regenerate with
 *  \`node scripts/build-innovation-data.mjs\`.
 *
 *  These fill the team spec's three Innovation data points (figures.ts,
 *  MODULES.innovation) — Firm creation; Patents per capita and specialization
 *  (RCA); Publications per capita and specialization (RCA) — one chart each
 *  (src/components/pages/innovationCharts.tsx). Everything is pooled over
 *  \`window\`, the page's default (its latest ${meta.poolLength} years).
 *
 *    firms          entry and exit per 100 firms, industry-mix adjusted, the
 *                   all-metro benchmarks, the page's quadrant and its
 *                   similar / higher / lower reads; \`field\` = every other
 *                   metro's [entry, exit]
 *    patents        fractional patent families per \`per\` residents, rank among
 *    publications   the \`n\` metros with any, the median, every other metro's
 *                   rate (\`field\`, ascending); RCA rows by \`broad\` category
 *                   and the top 10 \`detailed\` ones (\`section\` indexes
 *                   \`sections\`); \`fitFactor\` = the metro's output over the
 *                   page's population fit
 */

export type FirmQuadrant = "churn" | "decline" | "stasis" | "growth";
export type BenchRead = "similar" | "higher" | "lower";

export interface RcaRow {
  /** the IPC section letter or subclass code — publications carry none */
  code?: string;
  name: string;
  /** index into the module's \`sections\` */
  section: number;
  /** fractional families / articles in the window */
  count: number;
  /** the metro's share of its own output */
  share: number;
  /** that category's share across all metros */
  nat: number;
  rca: number;
}

export interface SpecializationData {
  unit: string;
  floor: number;
  floorUnit: string;
  output: number;
  pop: number;
  per: number;
  rate: number;
  rank: number;
  n: number;
  median: number;
  fitFactor: number;
  field: number[];
  sections: { key: string; name: string }[];
  broad: RcaRow[];
  detailed: RcaRow[];
}

export interface InnovationData {
  city: string;
  msaId: string;
  msaName: string;
  built: string;
  window: { from: number; to: number };
  nMetro: number;
  firms: {
    entry: number; exit: number; net: number; firms: number; quad: FirmQuadrant;
    benchEntry: number; benchExit: number; sdEntry: number; sdExit: number;
    readEntry: BenchRead; readExit: BenchRead;
    rankEntry: number;
    field: [number, number][];
  };
  patents: SpecializationData;
  publications: SpecializationData;
}

const ${CITY.short.toUpperCase()}: InnovationData = ${JSON.stringify(out)};

/** keyed by the app's short city name */
export const INNOVATION_DATA: Record<string, InnovationData> = { ${JSON.stringify(CITY.short)}: ${CITY.short.toUpperCase()} };

export const innovationData = (cityShort: string): InnovationData | null => INNOVATION_DATA[cityShort] ?? null;
`;

const file = path.join(ROOT, "src/data/innovationData.ts");
fs.writeFileSync(file, banner);
console.log(`wrote src/data/innovationData.ts (${banner.length.toLocaleString()} chars)`);

/* ---- a read-back, in the page's own formats, to eyeball against it with
   Boston selected ---- */
const f1 = (v) => v.toFixed(1);
const sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + f1(Math.abs(v));
console.log(`${me.name} · pooled ${window_.from}–${window_.to}`);
console.log(`  firms: entry ${f1(firms.entry)}% · exit ${f1(firms.exit)}% · net ${sgn(firms.net)} pts · ${firms.quad} · entry ${firms.readEntry}, exit ${firms.readExit} vs all metros (entry ${f1(firms.benchEntry)}%, exit ${f1(firms.benchExit)}%)`);
for (const k of ["patents", "publications"]) {
  const s = out[k];
  console.log(`  ${k}: ${s.output.toLocaleString()} ${s.unit} · ${s.rate} per ${PER.toLocaleString()} · ${s.rank}th of ${s.n} (median ${s.median}) · ${s.fitFactor}× the fit`);
  console.log(`    broad: ${s.broad.map((r) => `${r.code ?? r.name} ${r.rca.toFixed(2)}`).join(" · ")}`);
  console.log(`    detailed: ${s.detailed.map((r) => `${r.code ? r.code + " " : ""}${r.name} ${r.rca.toFixed(2)}`).join(" · ")}`);
}
