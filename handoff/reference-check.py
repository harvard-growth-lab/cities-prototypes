#!/usr/bin/env python3
"""Check cities-v-5's 2024 industry data, and the numbers its Metro Industries
text quotes, against a reference "What We Produce" page saved as one HTML file.

    python3 handoff/reference-check.py /path/to/boston-ma-industries.html

It pulls the page's embedded JSON (one JSON.parse(`...`) blob), compares every
row of cities-v-5/industries-2024.js with it, and prints the figures the three
beats and their answers rest on, recomputed from the reference."""
import json, re, subprocess, sys, os

html = open(sys.argv[1], encoding='utf8').read()
m = re.search(r'JSON\.parse\(`', html)
blob = json.loads(html[m.end():html.index('`)', m.end())].replace('\\`', '`'))
ref_rows = blob['usa/metros/14460/industries.json']
cat = {i['code']: i for i in blob['usa/industries.json']['industries']}

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
v5 = json.loads(subprocess.check_output(['node', '-e',
    'global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.BOSTON_INDUSTRIES_2024))',
    os.path.join(root, 'cities-v-5', 'industries-2024.js')]))
ix = {f: i for i, f in enumerate(v5['fields'])}
rows = {r[ix['code']]: r for r in v5['rows']}
TIER = {'traded': 0, 'partly_traded': 1, 'local': 2, None: None}
diffs = {}
def note(k, *a): diffs.setdefault(k, []).append(a)
def close(a, b, tol): return (a is None and b is None) or (a is not None and b is not None and abs(a - b) <= tol)
for r in ref_rows['rows']:
    v, k = rows.get(r['code']), cat[r['code']]
    if v is None: note('missing in v-5', r['code']); continue
    g = lambda f: v[ix[f]]
    if g('employ') != r['employment']: note('jobs', r['code'], r['employment'], g('employ'))
    if not close(g('rca'), r['rca'], 5e-4): note('rca', r['code'], r['rca'], g('rca'))
    if not close(g('peerRca'), r.get('peerRca'), 5e-4): note('peerRca', r['code'], r.get('peerRca'), g('peerRca'))
    if g('name') != k['name']: note('name', r['code'], k['name'], g('name'))
    if g('sectorKey') != k['sector']: note('sector', r['code'], k['sector'], g('sectorKey'))
    if not close(g('pci'), k['pci'], 5e-4): note('pci', r['code'], k['pci'], g('pci'))
    if TIER[k['tier']] != g('tier'): note('tier', r['code'], k['tier'], g('tier'))
    if not close(g('trad'), k['tradability'], 5e-4): note('tradability', r['code'], k['tradability'], g('trad'))
extra = set(rows) - {r['code'] for r in ref_rows['rows']}
print('rows', len(ref_rows['rows']), len(rows), '| total', ref_rows['total'], v5['total'],
      '| rank', ref_rows['complexity'] == v5.get('complexity'), '| peers', [p['name'] for p in ref_rows['peers']] == v5.get('peers'))
for k, v in diffs.items(): print('MISMATCH', k, len(v), v[:5])
if extra: print('extra in v-5', sorted(extra)[:10])
if not diffs and not extra: print('the data file matches the reference row for row')

# the figures the beats quote
T = ref_rows['total']; R = []
for r in ref_rows['rows']:
    k = cat[r['code']]; R.append(dict(code=r['code'], short=rows[r['code']][ix['short']], sector=k['sector'], tier=k['tier'], pci=k['pci'], jobs=r['employment'], rca=r['rca'], peer=r.get('peerRca')))
pct = lambda a: round(a / T * 100, 1)
sec = {}
for r in R: sec[r['sector']] = sec.get(r['sector'], 0) + r['jobs']
print('\nbeat 1: sectors', [(k, pct(v)) for k, v in sorted(sec.items(), key=lambda x: -x[1])[:3]],
      '| largest', [(r['short'], pct(r['jobs'])) for r in sorted(R, key=lambda r: -r['jobs'])[:3]])
tiers = {t: sum(r['jobs'] for r in R if r['tier'] == t) for t in ('traded', 'partly_traded', 'local')}
print('beat 2: tiers (null tier in none, over the total)', {k: pct(v) for k, v in tiers.items()})
CUTS = [-0.72, -0.4, 0.08, 0.65]
hi = lambda p: p is not None and p >= CUTS[2]
for s_ in ('professional', 'education-health'):
    print('  b1q2', s_, 'teal share', round(sum(r['jobs'] for r in R if r['sector'] == s_ and hi(r['pci'])) / sec[s_] * 100, 1))
for t in ('traded', 'local'):
    tj = [r for r in R if r['tier'] == t]; print('  b2q1', t, 'teal share', round(sum(r['jobs'] for r in tj if hi(r['pci'])) / sum(r['jobs'] for r in tj) * 100, 1))
pool = sorted([r for r in R if r['tier'] in ('traded', 'partly_traded') and r['rca'] > 1], key=lambda r: -r['rca'])[:12]
print('beat 3: top 12 (rca, jobs, against peers)')
for i, r in enumerate(pool): print('  %2d %-28s %6.3f %7d %s' % (i + 1, r['short'], r['rca'], r['jobs'], r['peer']))
print('  jobs in the 12', sum(r['jobs'] for r in pool), '| cut-off', pool[-1]['rca'])
