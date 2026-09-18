/* The vocabulary of the diagnosis plane, keyed by the atlas quadrant
   (src/data/types.ts). One place for the names the prototype uses in
   three registers: the landing verdict (a Fortress…), the scatter's corner
   buttons (Held back…), and the explainer's titles (Negative Supply Shock…). */
import type { Quadrant } from '@/data/types'

export interface QuadrantCopy {
  key: Quadrant
  /** landing verdict: "<City> is a Fortress" */
  name: string
  /** the article-less noun for icons and keys */
  noun: 'fortress' | 'magnet' | 'sponge' | 'leak'
  tagline: string
  /** the scatter's corner button */
  scatterLabel: string
  /** the explainer / hover title */
  shock: string
  /** the quadrant-button tooltip */
  tip: string
  /** the "what that tells you" paragraph in the diagnostic explainer */
  explainer: string
  /** where the quadrant sits on the plane */
  pop: 'up' | 'down'
  pay: 'up' | 'down'
  /** which side of the market the constraint sits on */
  constraint: 'demand' | 'supply'
}

export const QUADRANTS: Record<Quadrant, QuadrantCopy> = {
  supply_negative: {
    key: 'supply_negative',
    name: 'a Fortress',
    noun: 'fortress',
    tagline: 'High wages behind high walls. The demand is there; people cannot get in.',
    scatterLabel: 'Held back',
    shock: 'Negative Supply Shock',
    tip: 'Pay is bid up because workers cannot, or will not, move in — often a housing or cost-of-living wall. Demand for labor is there; the supply of people can’t follow it.',
    explainer:
      'Demand for workers is strong, and that is what bids pay up. What is missing is the supply of people: they cannot move in, or will not. The wall is usually housing. Too few homes get built, so the cost of living swallows the raise before anyone banks it, and the city is held back by its own capacity rather than by weak demand.',
    pop: 'down',
    pay: 'up',
    constraint: 'supply',
  },
  demand_positive: {
    key: 'demand_positive',
    name: 'a Magnet',
    noun: 'magnet',
    tagline: 'Pulls people in and pays them well. Demand is doing the work.',
    scatterLabel: 'Boomtown',
    shock: 'Positive Demand Shock',
    tip: 'People and pay rise together. Demand for what the city produces is growing, and the city is still able to absorb the workers it pulls in.',
    explainer:
      'Demand for what the city produces is growing, and both numbers move up together. Employers bid harder for workers, and workers arrive. Supply is keeping pace well enough that the newcomers do not drag pay back down, which is growth working roughly as intended.',
    pop: 'up',
    pay: 'up',
    constraint: 'demand',
  },
  supply_positive: {
    key: 'supply_positive',
    name: 'a Sponge',
    noun: 'sponge',
    tagline: 'Absorbs everyone who comes and soaks the wages away.',
    scatterLabel: 'Lifestyle magnet',
    shock: 'Positive Supply Shock',
    tip: 'People keep arriving even though pay lags. Amenities or cheaper living draw workers in, and that added supply of people holds wages down.',
    explainer:
      'People arrive for reasons other than pay: amenities, space, a lower cost of living. That inflow is itself an increase in labor supply, and more workers competing for the same jobs holds wages down. The draw is the place, not the paycheck.',
    pop: 'up',
    pay: 'down',
    constraint: 'supply',
  },
  demand_negative: {
    key: 'demand_negative',
    name: 'a Leak',
    noun: 'leak',
    tagline: 'People and earnings running out together.',
    scatterLabel: 'Cooling off',
    shock: 'Negative Demand Shock',
    tip: 'Fewer newcomers and slower raises at the same time. Demand for the city’s output has gone quiet, so neither wages nor population are being pulled up.',
    explainer:
      'Demand has gone quiet. Fewer employers competing for workers means slower raises, and slower raises mean fewer reasons to move in. Nothing is blocking supply here; there simply is not the pull. The constraint sits on the demand side.',
    pop: 'down',
    pay: 'down',
    constraint: 'demand',
  },
}

/** Corner of the plane each quadrant occupies (x = population, y = pay). */
export const QUADRANT_CORNER: Record<Quadrant, 'tl' | 'tr' | 'bl' | 'br'> = {
  supply_negative: 'tl',
  demand_positive: 'tr',
  demand_negative: 'bl',
  supply_positive: 'br',
}

/** Landing verdict words for the population and wage rates (per-year fractions). */
export function popWord(rate: number, national: number) {
  if (rate < 0) return 'shrinking'
  if (rate < national * 0.6) return 'growing slowly'
  if (rate > national * 1.6) return 'growing fast'
  return 'growing'
}
export function payWord(rate: number, national: number) {
  if (rate < 0) return 'falling'
  return rate >= national ? 'climbing fast' : 'climbing slowly'
}
