import { useMemo, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { CityIndustryRow } from '../../data/types';
import { fmtInt } from '../../lib/format';
import { sectorOf } from '../../lib/naicsSectors';
import { GL, lerp, rgbHex } from '../../lib/glColors';

// GL complexity color scale (Atlas of Economic Complexity). Diverging gradient
// from orange-tan (low PCI) → cream (mid) → teal-green (high PCI). Source:
// gl-design/design-library/visualization_colors/atlas/complexity_color_scale.csv
const PCI_LOW = -2.5;
const PCI_HIGH = 2.5;
const PCI_GRADIENT: Array<[number, [number, number, number]]> = [
  [0.0,    [227, 159,  96]],
  [0.2787, [231, 173, 120]],
  [0.3390, [235, 188, 143]],
  [0.3983, [240, 202, 168]],
  [0.4483, [244, 217, 191]],
  [0.4940, [248, 231, 215]],
  [0.4941, [192, 228, 225]],
  [0.5337, [154, 211, 207]],
  [0.5714, [116, 195, 189]],
  [0.6066, [ 77, 178, 171]],
  [0.6617, [ 40, 162, 153]],
  [1.0,    [  2, 146, 135]],
];
function sampleGradient(t: number): string {
  const u = Math.max(0, Math.min(1, t));
  for (let i = 1; i < PCI_GRADIENT.length; i++) {
    const [p1, c1] = PCI_GRADIENT[i - 1];
    const [p2, c2] = PCI_GRADIENT[i];
    if (u <= p2) {
      const span = p2 - p1;
      const local = span > 0 ? (u - p1) / span : 0;
      return rgbHex(
        lerp(c1[0], c2[0], local),
        lerp(c1[1], c2[1], local),
        lerp(c1[2], c2[2], local),
      );
    }
  }
  const [, last] = PCI_GRADIENT[PCI_GRADIENT.length - 1];
  return rgbHex(last[0], last[1], last[2]);
}
function pciColor(pci: number | null | undefined): string {
  if (pci == null || !Number.isFinite(pci)) return GL.mutedLight;
  const t = (pci - PCI_LOW) / (PCI_HIGH - PCI_LOW);
  return sampleGradient(t);
}

const truncateForBox = (s: string, w: number): string => {
  const cap = Math.max(0, Math.floor((w - 8) / 6.2));
  return s.length <= cap ? s : `${s.slice(0, Math.max(1, cap - 1))}…`;
};

type ColorMode = 'sector' | 'complexity';

type Leaf = {
  name: string;        // industry description (or NAICS4 if missing)
  size: number;        // employment
  naics4: string;
  pci: number | null;
  sectorCode: string;  // collapsed group code (e.g. "31-33")
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

type Props = {
  rows: CityIndustryRow[];
  cityId: string;
  country: string;
  // Wording used in the source line — distinguishes MSA scope ("aggregated to
  // MSA × NAICS4") from county scope ("at county × NAICS4"). Defaults to MSA.
  scopeLabel?: string;
  sourceLabel?: string;
};

export default function SectorEmploymentTreemap({
  rows,
  cityId,
  country,
  scopeLabel = 'aggregated to MSA × NAICS4',
  sourceLabel = 'US Census County Business Patterns, imputed by J. Daboin Pacheco',
}: Props) {
  const cityRows = useMemo(
    () => rows.filter((r) => r.country === country && r.city_id === cityId && r.employment),
    [rows, cityId, country],
  );

  const years = useMemo(
    () => Array.from(new Set(cityRows.map((r) => r.year))).sort((a, b) => a - b),
    [cityRows],
  );
  const [year, setYear] = useState<number | null>(null);
  const activeYear = year ?? (years.length ? years[years.length - 1] : null);
  const [colorMode, setColorMode] = useState<ColorMode>('sector');

  const { tree, totalWorkers, leafCount } = useMemo(() => {
    if (!activeYear) return { tree: [] as SectorNode[], totalWorkers: 0, leafCount: 0 };
    const buckets = new Map<string, SectorNode>();
    let total = 0;
    let count = 0;
    for (const r of cityRows) {
      if (r.year !== activeYear) continue;
      const emp = r.employment ?? 0;
      if (emp <= 0) continue;
      const meta = sectorOf(r.sector_2d);
      let bucket = buckets.get(meta.groupCode);
      if (!bucket) {
        bucket = {
          name: meta.name,
          groupCode: meta.groupCode,
          color: meta.color,
          children: [],
          totalSize: 0,
        };
        buckets.set(meta.groupCode, bucket);
      }
      bucket.children.push({
        name: r.industry ?? r.naics4,
        size: emp,
        naics4: r.naics4,
        pci: r.pci,
        sectorCode: meta.groupCode,
        sectorName: meta.name,
        sectorColor: meta.color,
      });
      bucket.totalSize += emp;
      total += emp;
      count += 1;
    }
    const sectors = Array.from(buckets.values())
      .map((b) => ({ ...b, children: b.children.sort((a, b) => b.size - a.size) }))
      .sort((a, b) => b.totalSize - a.totalSize);
    return { tree: sectors, totalWorkers: total, leafCount: count };
  }, [cityRows, activeYear]);

  if (!activeYear || tree.length === 0) {
    return <p className="muted">No industry composition available for this city.</p>;
  }

  return (
    <>
      <div className="chart-controls">
        <label>
          <span className="chart-controls-label">Year</span>
          <select
            value={activeYear}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="chart-controls-label">Color by</span>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
          >
            <option value="sector">Sector</option>
            <option value="complexity">Complexity (PCI)</option>
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={520}>
        <Treemap
          data={tree as unknown as Record<string, unknown>[]}
          dataKey="size"
          stroke="#fff"
          aspectRatio={4 / 3}
          isAnimationActive={false}
          content={<Cell colorMode={colorMode} />}
        >
          <Tooltip content={<LeafTooltip totalWorkers={totalWorkers} />} />
        </Treemap>
      </ResponsiveContainer>
      <p className="chart-source">
        <span className="chart-source-label">Source</span>
        {sourceLabel}; {scopeLabel}. {fmtInt.format(totalWorkers)} workers across{' '}
        {leafCount} 4-digit industries in {tree.length} sectors, {activeYear}.
      </p>
      {colorMode === 'complexity' && (
        <PciLegend />
      )}
    </>
  );
}

type CellProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  size?: number;
  // Recharts spreads node fields into props, so leaf payload arrives flat:
  pci?: number | null;
  sectorColor?: string;
  // For sector parents, our SectorNode fields:
  color?: string;
  colorMode: ColorMode;
};

function Cell(props: CellProps) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    depth = 0,
    name = '',
    size = 0,
    pci = null,
    sectorColor,
    color,
    colorMode,
  } = props;
  if (width <= 0 || height <= 0) return null;

  // depth 1 = sector parent. Draw a thin colored band across the top so the
  // sector is identifiable, plus an outline. We don't fill the parent body —
  // children render on top.
  if (depth === 1) {
    const fill = color ?? GL.muted;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke={fill}
          strokeWidth={2}
        />
        {width > 90 && height > 40 && (
          <text
            x={x + 7}
            y={y + 14}
            fontSize={11}
            fontWeight={700}
            fill={fill}
            style={{
              paintOrder: 'stroke',
              stroke: '#fff',
              strokeWidth: 3,
              strokeLinejoin: 'round',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {truncateForBox(name, width)}
          </text>
        )}
      </g>
    );
  }

  // depth 2 = industry leaf.
  if (depth !== 2) return null;
  const fill =
    colorMode === 'complexity' ? pciColor(pci) : sectorColor ?? GL.muted;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#fff"
        strokeWidth={1}
      />
      {width > 70 && height > 26 && (
        <>
          <text
            x={x + 6}
            y={y + 14}
            fontSize={10.5}
            fontWeight={600}
            fill={GL.ink}
            style={{
              paintOrder: 'stroke',
              stroke: '#fff',
              strokeWidth: 2.5,
              strokeLinejoin: 'round',
            }}
          >
            {truncateForBox(name, width)}
          </text>
          {height > 40 && (
            <text
              x={x + 6}
              y={y + 28}
              fontSize={10}
              fill={GL.ink}
              fillOpacity={0.78}
              style={{
                paintOrder: 'stroke',
                stroke: '#fff',
                strokeWidth: 2,
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

type TipPayload = {
  payload?: {
    name?: string;
    size?: number;
    naics4?: string;
    pci?: number | null;
    sectorName?: string;
    depth?: number;
  };
};
type TipProps = { active?: boolean; payload?: TipPayload[]; totalWorkers: number };

function LeafTooltip({ active, payload, totalWorkers }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  // Recharts hovers report sector parents too; we only show leaves.
  if (!p.naics4) return null;
  const size = p.size ?? 0;
  const share = totalWorkers > 0 ? (size / totalWorkers) * 100 : 0;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-name">{p.name}</div>
      <div className="chart-tooltip-sub">
        NAICS {p.naics4} · {p.sectorName}
      </div>
      <dl className="chart-tooltip-grid">
        <dt>Workers</dt>
        <dd>{fmtInt.format(size)}</dd>
        <dt>Share</dt>
        <dd>{share.toFixed(1)}%</dd>
        <dt>PCI</dt>
        <dd>{p.pci == null ? '—' : p.pci.toFixed(2)}</dd>
      </dl>
    </div>
  );
}

function PciLegend() {
  // 7 evenly-spaced PCI samples for the legend swatches.
  const stops = [-2.5, -1.5, -0.75, 0, 0.75, 1.5, 2.5];
  return (
    <div className="chart-legend">
      <span className="chart-legend-label">Less complex</span>
      <span className="chart-legend-bar">
        {stops.map((s) => (
          <span
            key={s}
            className="chart-legend-swatch"
            style={{ background: pciColor(s) }}
          />
        ))}
      </span>
      <span className="chart-legend-label">More complex</span>
    </div>
  );
}
