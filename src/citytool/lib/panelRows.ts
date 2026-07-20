// Shared helpers for reading year-indexed panel rows (population, wages,
// housing, rent, …). Chart components snap to the nearest available year so a
// place doesn't drop out just because its exact window endpoints are sparse.

/** The row whose `year` is closest to `target` among those passing `pred`. */
export function nearestRow<T extends { year: number }>(
  rows: T[],
  target: number,
  pred: (r: T) => boolean = () => true,
): T | null {
  let best: T | null = null;
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
