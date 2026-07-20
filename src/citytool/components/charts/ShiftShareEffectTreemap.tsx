import { useMemo, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { ShiftShareResult } from '../../lib/shiftShare';
import type { IndustryAttributeRow } from '../../data/types';
import { fmtInt } from '../../lib/format';
import { sectorOf } from '../../lib/naicsSectors';
import { GL } from '../../lib/glColors';

// Treemap of the starting-year employment composition, with each industry
// tinted by its **local-share** or **industry-mix** effect on the way to
// the end-year. Diverging palette: red = negative effect (the local growth
// came in below what national / industry-mix trends predicted), neutral
// cream = no effect, green = positive (over-performed).
//
// Red/green is used here (rather than the orange/teal complexity palette)
// because the dimension is value-laden — over- vs. under-performance — and
// the cultural read of "green = good, red = bad" is the desired signal.
// Orange/teal is reserved for PCI / complexity throughout the app.
//
// Size = E_ir(t0). Industries absent at t0 (the "new industries" set) are
// excluded — they appear in a separate NewIndustriesTreemap component.

type Mode = 'ls' | 'im';

type Props = {
  result: ShiftShareResult;
  attributes: IndustryAttributeRow[];
  msaName: string;
};

// Diverging effect ramp pinned to GL tones: c-2 (red) for under-performance,
// c-3 (green) for over-performance, warm paper at the neutral midpoint. The
// green tail stays distinct from the complexity teal (orange/teal) palette.
const RED_DARK:   [number, number, number] = [138,  44,  43];   // c-2-dark  #8a2c2b
const RED_MID:    [number, number, number] = [220, 111, 110];   // c-2 seq-mid #dc6f6e
const NEUTRAL:    [number, number, number] = [244, 241, 234];   // paper-warm #f4f1ea
const GREEN_MID:  [number, number, number] = [ 91, 192, 160];   // c-3       #5bc0a0
const GREEN_DARK: [number, number, number] = [ 26, 107,  83];   // c-3-dark  #1a6b53

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rgbHex(r: number, g: number, b: number) {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
function divergingColor(t: number) {
  // t in [-1, 1]: -1 → dark red, 0 → neutral, +1 → dark green.
  const u = Math.max(-1, Math.min(1, t));
  if (u >= 0) {
    if (u < 0.5) {
      const k = u / 0.5;
      return rgbHex(lerp(NEUTRAL[0], GREEN_MID[0], k), lerp(NEUTRAL[1], GREEN_MID[1], k), lerp(NEUTRAL[2], GREEN_MID[2], k));
    }
    const k = (u - 0.5) / 0.5;
    return rgbHex(lerp(GREEN_MID[0], GREEN_DARK[0], k), lerp(GREEN_MID[1], GREEN_DARK[1], k), lerp(GREEN_MID[2], GREEN_DARK[2], k));
  }
  const v = -u;
  if (v < 0.5) {
    const k = v / 0.5;
    return rgbHex(lerp(NEUTRAL[0], RED_MID[0], k), lerp(NEUTRAL[1], RED_MID[1], k), lerp(NEUTRAL[2], RED_MID[2], k));
  }
  const k = (v - 0.5) / 0.5;
  return rgbHex(lerp(RED_MID[0], RED_DARK[0], k), lerp(RED_MID[1], RED_DARK[1], k), lerp(RED_MID[2], RED_DARK[2], k));
}

const truncateForBox = (s: string, w: number): string => {
  const cap = Math.max(0, Math.floor((w - 8) / 6.2));
  return s.length <= cap ? s : `${s.slice(0, Math.max(1, cap - 1))}…`;
};

type Leaf = {
  name: string;
  size: number;       // E_ir(t0)
  naics4: string;
  effect: number;     // ls or im, in employment units
  industry: string;
  sectorCode: string;
  sectorName: string;
  sectorColor: string;
};

type SectorNode = {
  name: string;
  groupCode: string;
  color: string;
  children: Leaf[];
  totalSize: number;
};

export default function ShiftShareEffectTreemap({ result, attributes, msaName }: Props) {
  const [mode, setMode] = useState<Mode>('ls');

  const attrsByNaics = useMemo(
    () => new Map(attributes.map((a) => [a.naics4, a])),
    [attributes],
  );

  const { tree, palette } = useMemo(() => {
    const buckets = new Map<string, SectorNode>();
    const allLeaves: Leaf[] = [];
    for (const r of result.industries) {
      if (r.e_r_t0 <= 0) continue;
      const a = attrsByNaics.get(r.naics4);
      const meta = sectorOf(a?.sector_2d);
      const leaf: Leaf = {
        name: a?.industry ?? r.naics4,
        size: r.e_r_t0,
        naics4: r.naics4,
        effect: mode === 'ls' ? r.ls : r.im,
        industry: a?.industry ?? r.naics4,
        sectorCode: meta.groupCode,
        sectorName: meta.name,
        sectorColor: meta.color,
      };
      allLeaves.push(leaf);
      let bucket = buckets.get(meta.groupCode);
      if (!bucket) {
        bucket = { name: meta.name, groupCode: meta.groupCode, color: meta.color, children: [], totalSize: 0 };
        buckets.set(meta.groupCode, bucket);
      }
      bucket.children.push(leaf);
      bucket.totalSize += leaf.size;
    }
    const sectors = Array.from(buckets.values())
      .map((b) => ({ ...b, children: b.children.sort((a, b) => b.size - a.size) }))
      .sort((a, b) => b.totalSize - a.totalSize);
    // Robust palette domain: 95th percentile of |effect| so a single huge
    // industry doesn't flatten the whole metro into cream.
    const abs = allLeaves.map((l) => Math.abs(l.effect)).sort((a, b) => a - b);
    const p95 = abs.length ? abs[Math.floor(abs.length * 0.95)] : 1;
    return { tree: sectors, palette: { lo: -p95, hi: p95 } };
  }, [result, attrsByNaics, mode]);

  if (tree.length === 0) return <p className="muted">No baseline industries to decompose.</p>;

  const colorFor = (effect: number): string => {
    const range = palette.hi || 1;
    const t = effect / range;
    return divergingColor(t);
  };

  return (
    <>
      <div className="chart-controls">
        <label>
          <span className="chart-controls-label">Color by</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="ls">Local-share effect</option>
            <option value="im">Industry-mix effect</option>
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={460}>
        <Treemap
          data={tree as unknown as Record<string, unknown>[]}
          dataKey="size"
          stroke="#fff"
          aspectRatio={4 / 3}
          isAnimationActive={false}
          content={<EffectCell colorFor={colorFor} />}
        >
          <Tooltip content={<EffectTooltip mode={mode} />} />
        </Treemap>
      </ResponsiveContainer>

      <div className="gradient-legend">
        <span className="chart-legend-label gradient-legend-title">
          {mode === 'ls' ? 'Local share' : 'Industry-mix'} effect
        </span>
        <div className="choropleth-legend-bar">
          {Array.from({ length: 24 }).map((_, i) => {
            const t = -1 + (i / 23) * 2;
            return (
              <span
                key={i}
                className="choropleth-legend-cell"
                style={{ background: divergingColor(t) }}
              />
            );
          })}
        </div>
        <div className="choropleth-legend-ticks">
          <span>−{fmtInt.format(Math.round(palette.hi))}</span>
          <span>0</span>
          <span>+{fmtInt.format(Math.round(palette.hi))}</span>
        </div>
      </div>

      <p className="chart-source">
        <span className="chart-source-label">Reading</span>
        Each cell is one NAICS-4 industry; area is {msaName}'s employment in
        that industry at {result.t0}.
        {mode === 'ls'
          ? ' Green cells grew faster locally than the national rate for that industry — a local-share advantage. Red cells lagged.'
          : ' Green cells are industries that grew faster nationally than the all-industry average — they pulled the metro upward by composition alone, independent of local performance. Red cells are industries in national decline.'}
      </p>
    </>
  );
}

type EffectCellProps = {
  x?: number; y?: number; width?: number; height?: number;
  depth?: number; name?: string;
  // Sector parents pass `color`; leaves spread `effect`, `size`, `sectorColor`.
  color?: string;
  effect?: number;
  size?: number;
  colorFor: (effect: number) => string;
};

function EffectCell(props: EffectCellProps) {
  const { x = 0, y = 0, width = 0, height = 0, depth = 0, name = '', color, effect, size = 0, colorFor } = props;
  if (width <= 0 || height <= 0) return null;

  if (depth === 1) {
    const stroke = color ?? GL.muted;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="none" stroke={stroke} strokeWidth={2} />
        {width > 90 && height > 40 && (
          <text
            x={x + 7} y={y + 14}
            fontSize={11} fontWeight={700} fill={stroke}
            style={{
              paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
          >
            {truncateForBox(name, width)}
          </text>
        )}
      </g>
    );
  }

  if (depth !== 2) return null;
  const fill = effect == null ? GL.mutedLight : colorFor(effect);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1} />
      {width > 70 && height > 26 && (
        <>
          <text
            x={x + 6} y={y + 14}
            fontSize={10.5} fontWeight={600} fill={GL.ink}
            style={{
              paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2.5,
              strokeLinejoin: 'round',
            }}
          >
            {truncateForBox(name, width)}
          </text>
          {height > 40 && (
            <text
              x={x + 6} y={y + 28}
              fontSize={10} fill={GL.ink} fillOpacity={0.78}
              style={{
                paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2,
                strokeLinejoin: 'round',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtInt.format(size)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

type TipProps = {
  active?: boolean;
  payload?: { payload?: Leaf }[];
  mode: Mode;
};

function EffectTooltip({ active, payload, mode }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p?.naics4) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-name">{p.industry}</div>
      <div className="chart-tooltip-sub">NAICS {p.naics4} · {p.sectorName}</div>
      <dl className="chart-tooltip-grid">
        <dt>Start-year employment</dt>
        <dd>{fmtInt.format(p.size)}</dd>
        <dt>{mode === 'ls' ? 'Local-share effect' : 'Industry-mix effect'}</dt>
        <dd>
          {p.effect >= 0 ? '+' : ''}{fmtInt.format(Math.round(p.effect))}
        </dd>
      </dl>
    </div>
  );
}
