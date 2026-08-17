// Area-true bubble radius: r ∝ √population, anchored so the most populous
// point gets rMax. Pure proportionality (no additive offset) keeps point AREA
// proportional to population — so a metro's dot area is roughly the sum of its
// places' dot areas when both use the same anchor. rMin is a visibility floor.
// (Lifted from the live tool's MigrationChangeScatter.)
export function radiusFor(pop: number, popMax: number, rMax: number, rMin: number): number {
  if (!(popMax > 0) || !(pop > 0)) return rMin;
  return Math.max(rMin, rMax * Math.sqrt(pop / popMax));
}
