// Amenity-residual math shared by the "amenity drift" scatter modes.
//
// The levels version of this metric lives in MsaPlacesChoropleth: the residual
// of a national OLS of log(price) on log(avg salary), with MSA fixed effects
// fit by within-group demeaning (Frisch–Waugh–Lovell). A positive residual
// means housing costs more than local pay predicts — the premium people pay
// to be there, read as revealed amenity value.
//
// The drift version differences that residual between the two endpoints of
// the compare window. Each endpoint's cross-section is fit separately, so the
// national price–wage line can itself steepen or flatten across the window
// without polluting the per-entity delta: what remains is how far the entity
// moved relative to that year's national relationship.

export type AmenityObs = {
  id: string;
  // FE group for the within-demeaning. Pass one shared constant to reduce the
  // fit to plain OLS with an intercept (the MSA-grain case); pass msa_id at
  // place grain so the residual is net of the metro average.
  group: string;
  logWage: number;
  logPrice: number;
};

// Residual per id from OLS of logPrice ~ logWage + group FE, in log points.
export function amenityResiduals(obs: AmenityObs[]): Map<string, number> {
  const out = new Map<string, number>();
  if (obs.length < 3) return out;

  // Within-group means (the fixed effects).
  const sums = new Map<string, { sx: number; sy: number; n: number }>();
  for (const o of obs) {
    const s = sums.get(o.group) ?? { sx: 0, sy: 0, n: 0 };
    s.sx += o.logWage;
    s.sy += o.logPrice;
    s.n += 1;
    sums.set(o.group, s);
  }

  // Pooled within slope β (FWL): regress demeaned y on demeaned x.
  let sxx = 0;
  let sxy = 0;
  for (const o of obs) {
    const s = sums.get(o.group)!;
    const xd = o.logWage - s.sx / s.n;
    const yd = o.logPrice - s.sy / s.n;
    sxx += xd * xd;
    sxy += xd * yd;
  }
  if (sxx <= 0) return out;
  const beta = sxy / sxx;

  for (const o of obs) {
    const s = sums.get(o.group)!;
    const xd = o.logWage - s.sx / s.n;
    const yd = o.logPrice - s.sy / s.n;
    const r = yd - beta * xd;
    if (Number.isFinite(r)) out.set(o.id, r);
  }
  return out;
}

// End-minus-start residual per id, for ids present in both cross-sections.
export function residualDelta(
  start: Map<string, number>,
  end: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, rEnd] of end) {
    const rStart = start.get(id);
    if (rStart == null) continue;
    out.set(id, rEnd - rStart);
  }
  return out;
}
