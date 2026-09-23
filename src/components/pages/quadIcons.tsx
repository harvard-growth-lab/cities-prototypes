/** The quadrant dials, drawn with the tool's own icon vocabulary.
 *
 *  The other sections read a city off two dials — people and pay — and show
 *  each as a stat chip: a small mark for WHAT moved and a tinted ring with a
 *  trend arrow for WHICH WAY (v-3's `.q-si` chips; the people mark is copied
 *  verbatim from its markup so the constraints section carries the icon the
 *  reader learned upstream). A quadrant of the population vs wages chart is exactly two
 *  such dials, so its label and its tree head draw them. */

import { QUAD_DIR, type QuadSide } from "../../data/figures";

/* the direction scale, kept clear of the brand hues (v-3's --rise / --fall) */
const RISE = "#3d9a43";
const FALL = "#c0244a";
const RISE_TINT = "rgba(61, 154, 67, 0.14)";
const FALL_TINT = "rgba(192, 36, 74, 0.12)";

/* the marks, all in a 20×20 box and all STROKED at one weight, so the pair
   reads as a set: v-3's people mark, and a dollar sign for pay */
const PEOPLE =
  '<circle cx="8" cy="7.5" r="2.6"/><path d="M3.4 15.4c.5-2.6 2.4-3.9 4.6-3.9s4.1 1.3 4.6 3.9"/><path d="M13.6 5.6a2.4 2.4 0 0 1 0 4.4"/><path d="M15 11.9c1.6.4 2.7 1.6 3 3.5"/>';
/* pay is a DOLLAR SIGN (Sept 2026, the user's call). It was three rising
   bars, which say "a chart" before they say "wages" — and next to a trend
   arrow that already says which way, a second little chart said nothing the
   arrow did not. The sign is drawn the way the people mark is — an open
   stroke, round caps — rather than set as a glyph, so it takes the mark's
   weight at any size and needs no font: the S as two half-turns joined by
   straights (the form icon sets use, which stays open at 11px where a
   calligraphic S closes up), and the bar run through it top to bottom.
   Paths throughout, not <line> or <rect>: the tree's card rule paints every
   rect under a card white. It sits 2 units right of the box's centre: a $ is
   narrower than the people mark, and centred it stood further from its own
   trend ring than the people mark does from its — the pair should read as
   two dials, each mark with its arrow. */
const PAY =
  '<path d="M12 2v16"/><path d="M16.2 4.4h-6.1a2.8 2.8 0 0 0 0 5.6h3.8a2.8 2.8 0 0 1 0 5.6H7.4"/>';
/* the trend arrows: v-3's stat chips draw a kinked trend line, which at a
   16px ring collapses into a squiggle, so here the same rise/fall reads as a
   plain diagonal arrow — the chip's colour and tint carry the meaning */
const RISE_ARROW = '<path d="M5.5 14.5 14.5 5.5"/><path d="M8 5.5h6.5V12"/>';
const FALL_ARROW = '<path d="M5.5 5.5 14.5 14.5"/><path d="M8 14.5h6.5V8"/>';

/* one dial's footprint at k = 1: the mark, a gap, the trend ring */
const MARK = 14;
const GAP = 3;
const RING = 8;
const DIAL_W = MARK + GAP + RING * 2;
/** the room between the two dials */
const BETWEEN = 10;

/** the width of the pair, for anyone laying a card around it */
export const metricsWidth = (k = 1): number => (DIAL_W * 2 + BETWEEN) * k;

/** one metric's mark on its own — the people or pay glyph the dials
 *  wear — for anywhere else that names the metric: the plane's axis titles
 *  carry it (Sept 2026), so the two axes read as the two dials before the
 *  reader meets them as dials. `x`, `y` are the mark's top-left. */
export function MetricMark({
  what,
  x,
  y,
  size,
  className,
}: {
  what: "people" | "pay";
  x: number;
  y: number;
  size: number;
  className?: string;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: what === "pay" ? PAY : PEOPLE }}
    />
  );
}

/** one dial: what moved, and a trend chip for which way. `x` is the dial's
 *  left edge, `y` its centreline. */
function Dial({
  x,
  y,
  what,
  dir,
  k,
}: {
  x: number;
  y: number;
  what: "people" | "pay";
  dir: 1 | -1;
  k: number;
}) {
  const m = MARK * k;
  const r = RING * k;
  return (
    <g transform={`translate(${x},${y})`} className="nv-dial">
      <MetricMark what={what} x={0} y={-m / 2} size={m} className="nv-dial-mark" />
      <circle
        cx={m + GAP * k + r}
        cy={0}
        r={r}
        fill={dir > 0 ? RISE_TINT : FALL_TINT}
      />
      <svg
        x={m + GAP * k + r * 0.15}
        y={-r * 0.85}
        width={r * 1.7}
        height={r * 1.7}
        viewBox="0 0 20 20"
        fill="none"
        stroke={dir > 0 ? RISE : FALL}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: dir > 0 ? RISE_ARROW : FALL_ARROW }}
      />
    </g>
  );
}

/** the two dials that define a quadrant — people, then pay — centred on
 *  (x, y) or hung from it, per `align` (an SVG text-anchor, so a label and
 *  its dials can share one anchor). Nothing for a side that is not a
 *  quadrant. */
export function QuadMetrics({
  side,
  x,
  y,
  k = 1,
  align = "middle",
}: {
  side: string;
  x: number;
  y: number;
  k?: number;
  align?: "start" | "middle" | "end";
}) {
  const d = QUAD_DIR[side as keyof typeof QUAD_DIR];
  if (!d) return null;
  const total = metricsWidth(k);
  const x0 = align === "middle" ? x - total / 2 : align === "end" ? x - total : x;
  return (
    <g className="nv-metrics">
      <Dial x={x0} y={y} what="people" dir={d.pop} k={k} />
      <Dial x={x0 + (DIAL_W + BETWEEN) * k} y={y} what="pay" dir={d.pay} k={k} />
    </g>
  );
}

/* ---------- the diagnosis marks ----------
   main's landing verdict ("Boston is a Fortress") draws one mark per city
   type; these are its four drawings verbatim (cities-v-3 index.html,
   #lxVerdict), in their 40×40 box, so the tree and the chart wear the mark
   the reader met on the landing. */
const MARK_ART: Record<QuadSide, string> = {
  supplyneg:
    '<path d="M6 33V13h5V9h4v4h10V9h4v4h5v20"/><path d="M6 33h28"/><path d="M14 33v-7a3 3 0 0 1 6 0v7"/><path d="M11 18h4M25 18h4M11 24h4M25 24h4"/>',
  demandpos:
    '<path d="M10 8v13a10 10 0 0 0 20 0V8"/><path d="M16 8v13a4 4 0 0 0 8 0V8"/><path d="M10 8h6M24 8h6"/><path d="M10 13h6M24 13h6" stroke-width="3"/>',
  supplypos:
    '<rect x="6" y="14" width="28" height="18" rx="4"/><circle cx="13" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="21" cy="24" r="1.4" fill="currentColor" stroke="none"/><circle cx="27" cy="19" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="27" r="1.4" fill="currentColor" stroke="none"/><path d="M20 5v5M14 7l1.5 3M26 7l-1.5 3"/>',
  demandneg:
    '<path d="M9 9h22l-2.5 17H11.5Z"/><path d="M9 9a11 3.2 0 0 0 22 0"/><path d="M20 30c0 2.6-1.6 4-1.6 5.4a1.6 1.6 0 0 0 3.2 0C21.6 34 20 32.6 20 30Z" fill="currentColor" stroke="none"/><path d="M27 29.5c0 1.8-1.1 2.8-1.1 3.8a1.1 1.1 0 0 0 2.2 0c0-1-1.1-2-1.1-3.8Z" fill="currentColor" stroke="none"/>',
};

/** the landing's mark for a city type, `size` wide, its top-left at (x, y);
 *  nothing for a side that is not a quadrant. Colour is the caller's
 *  (currentColor), so a lit head's mark takes the branch's hue. */
export function QuadMark({
  side,
  x,
  y,
  size = 20,
  color,
}: {
  side: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
}) {
  const art = MARK_ART[side as QuadSide];
  if (!art) return null;
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="nv-mark"
      style={color ? { color } : undefined}
      dangerouslySetInnerHTML={{ __html: art }}
    />
  );
}

/** the same mark for HTML: inline beside a city type's name wherever prose
 *  or a heading names it (the analysis section's title, its trail, the
 *  sandbox's read). Sized by the text it sits in (see .qmark) and coloured
 *  by it — or by `color` where the text is not the branch's hue. Nothing
 *  for a side that is not a quadrant, so callers can pass any side. */
export function QuadGlyph({
  side,
  color,
}: {
  side: string;
  color?: string;
}) {
  const art = MARK_ART[side as QuadSide];
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="qmark"
      aria-hidden="true"
      style={color ? { color } : undefined}
      dangerouslySetInnerHTML={{ __html: art }}
    />
  );
}

/** the name's width at a given size, close enough to centre a mark beside
 *  it (Source Sans 3 bold; SVG text cannot be measured before it renders) */
const NAME_EM: Record<string, number> = {
  Magnet: 3.45,
  Sponge: 3.5,
  Fortress: 4.05,
  Leak: 2.3,
};
export const nameWidth = (name: string, size: number): number =>
  (NAME_EM[name] ?? name.length * 0.56) * size;
