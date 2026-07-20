// Adaptive axis-tick formatters.
//
// The "nice" tick step can be fractional (e.g. 0.5% population-CAGR steps over
// a tight MSA-only point cloud). Rounding every tick to a whole percent then
// collapses adjacent labels into duplicates — "1%, 1%, 2%, 2%". These pick the
// *fewest* decimal places that keep every visible tick label distinct, so the
// axis only spends decimals when the spacing actually needs them.

// Smallest decimal count in [0, max] for which no two ticks (scaled by `scale`)
// render to the same string.
function minDecimals(ticks: number[], scale: number, max = 3): number {
  for (let d = 0; d < max; d++) {
    const seen = new Set<string>();
    let unique = true;
    for (const t of ticks) {
      const s = (t * scale).toFixed(d);
      if (seen.has(s)) { unique = false; break; }
      seen.add(s);
    }
    if (unique) return d;
  }
  return max;
}

// Percent ticks ("12%", "1.5%"). Decimals chosen so no two labels collide.
export function pctTickFormatter(ticks: number[]): (v: number) => string {
  const d = minDecimals(ticks, 100);
  return (v: number) => `${(v * 100).toFixed(d)}%`;
}

// Signed percentage-point ticks ("+2", "-1.5"). Used for the wage-premium
// delta axis. Same adaptive-decimal logic as the percent formatter.
export function ppTickFormatter(ticks: number[]): (v: number) => string {
  const d = minDecimals(ticks, 100);
  return (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(d)}`;
}
