import { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { ShiftShareResult } from '../../lib/shiftShare';
import type { IndustryAttributeRow } from '../../data/types';
import { fmtInt } from '../../lib/format';
import { sectorOf } from '../../lib/naicsSectors';
import { GL } from '../../lib/glColors';

// Industries that didn't exist in this MSA at the start year but appeared by
// the end year — the "new industries" bucket from the shift-share. Sized by
// end-year employment, grouped by NAICS-2 sector parent (same hierarchical
// layout as the main workers-by-industry treemap so visual continuity is
// preserved).

type Props = {
  result: ShiftShareResult;
  attributes: IndustryAttributeRow[];
  msaName: string;
};

const truncateForBox = (s: string, w: number): string => {
  const cap = Math.max(0, Math.floor((w - 8) / 6.2));
  return s.length <= cap ? s : `${s.slice(0, Math.max(1, cap - 1))}…`;
};

type Leaf = {
  name: string;
  size: number;
  naics4: string;
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

export default function NewIndustriesTreemap({ result, attributes, msaName }: Props) {
  const attrsByNaics = useMemo(
    () => new Map(attributes.map((a) => [a.naics4, a])),
    [attributes],
  );

  const { tree, total, leafCount } = useMemo(() => {
    const buckets = new Map<string, SectorNode>();
    let totalSize = 0;
    let count = 0;
    for (const r of result.newIndustries) {
      if (r.e_r_t1 <= 0) continue;
      const a = attrsByNaics.get(r.naics4);
      const meta = sectorOf(a?.sector_2d);
      let bucket = buckets.get(meta.groupCode);
      if (!bucket) {
        bucket = { name: meta.name, groupCode: meta.groupCode, color: meta.color, children: [], totalSize: 0 };
        buckets.set(meta.groupCode, bucket);
      }
      const leaf: Leaf = {
        name: a?.industry ?? r.naics4,
        size: r.e_r_t1,
        naics4: r.naics4,
        industry: a?.industry ?? r.naics4,
        sectorCode: meta.groupCode,
        sectorName: meta.name,
        sectorColor: meta.color,
      };
      bucket.children.push(leaf);
      bucket.totalSize += leaf.size;
      totalSize += leaf.size;
      count += 1;
    }
    const sectors = Array.from(buckets.values())
      .map((b) => ({ ...b, children: b.children.sort((a, b) => b.size - a.size) }))
      .sort((a, b) => b.totalSize - a.totalSize);
    return { tree: sectors, total: totalSize, leafCount: count };
  }, [result, attrsByNaics]);

  if (leafCount === 0) {
    return (
      <p className="muted">
        No "new" 4-digit industries appeared in {msaName} between {result.t0} and {result.t1}.
      </p>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={tree as unknown as Record<string, unknown>[]}
          dataKey="size"
          stroke="#fff"
          aspectRatio={4 / 3}
          isAnimationActive={false}
          content={<Cell />}
        >
          <Tooltip content={<LeafTooltip total={total} />} />
        </Treemap>
      </ResponsiveContainer>

      <p className="chart-source">
        <span className="chart-source-label">Reading</span>
        Industries that had zero {msaName} employment in {result.t0} but appeared
        by {result.t1}. Area is {result.t1} employment ({fmtInt.format(total)}{' '}
        workers across {leafCount} new industries in {tree.length} sectors).
      </p>
    </>
  );
}

type CellProps = {
  x?: number; y?: number; width?: number; height?: number; depth?: number;
  name?: string; size?: number;
  // For sector parents:
  color?: string;
  // For leaves (spread flat by Recharts):
  sectorColor?: string;
};

function Cell(props: CellProps) {
  const { x = 0, y = 0, width = 0, height = 0, depth = 0, name = '', size = 0, color, sectorColor } = props;
  if (width <= 0 || height <= 0) return null;

  if (depth === 1) {
    const fill = color ?? GL.muted;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="none" stroke={fill} strokeWidth={2} />
        {width > 90 && height > 40 && (
          <text
            x={x + 7} y={y + 14}
            fontSize={11} fontWeight={700} fill={fill}
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
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={sectorColor ?? GL.muted} stroke="#fff" strokeWidth={1} />
      {width > 70 && height > 26 && (
        <>
          <text
            x={x + 6} y={y + 14}
            fontSize={10.5} fontWeight={600} fill={GL.ink}
            style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2.5, strokeLinejoin: 'round' }}
          >
            {truncateForBox(name, width)}
          </text>
          {height > 40 && (
            <text
              x={x + 6} y={y + 28}
              fontSize={10} fill={GL.ink} fillOpacity={0.78}
              style={{
                paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2, strokeLinejoin: 'round',
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

type TipPayload = { payload?: Leaf };
type TipProps = { active?: boolean; payload?: TipPayload[]; total: number };

function LeafTooltip({ active, payload, total }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p?.naics4) return null;
  const share = total > 0 ? (p.size / total) * 100 : 0;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-name">{p.industry}</div>
      <div className="chart-tooltip-sub">NAICS {p.naics4} · {p.sectorName}</div>
      <dl className="chart-tooltip-grid">
        <dt>Workers</dt>
        <dd>{fmtInt.format(p.size)}</dd>
        <dt>Share of new</dt>
        <dd>{share.toFixed(1)}%</dd>
      </dl>
    </div>
  );
}
