/**
 * Single source of truth for everything the framework *derives* from a
 * profile — the Figure-31 wedge, the constraint side, the Table-2
 * quadrant — plus display formatting. Every variant calls these; none
 * hard-codes a verdict.
 */

import {
  scenarioOf,
  wedgeOf,
  type Fig31Scenario,
  type WedgeId,
} from "../content/figures";
import type { CityProfile, Indicator, Side } from "./types";
import { MEDIANS } from "./metros";

/* ————— wedge → side ————— */

const WEDGE_SIDE: Record<WedgeId, Side> = {
  "1a": "supply", // potential supply constraint (or superstar — tests decide)
  "1b": "none",
  "2a": "none",
  "2c": "demand",
  "3c": "demand",
  "3d": "demand",
  "4e": "supply",
  "4f": "supply",
};

const SPIRAL_WEDGES: WedgeId[] = ["3d", "4e"];

export interface Verdict {
  dPop: number;
  dWage: number;
  wedge: WedgeId;
  scenario: Fig31Scenario;
  side: Side;
  spiralRisk: boolean;
}

function verdictFor(popCagr: number, wageCagr: number, p: CityProfile): Verdict {
  const dPop = popCagr - p.diagnosis.medians.popCagr;
  const dWage = wageCagr - p.diagnosis.medians.wageCagr;
  const wedge = wedgeOf(dPop, dWage);
  return {
    dPop,
    dWage,
    wedge,
    scenario: scenarioOf(dPop, dWage),
    side: WEDGE_SIDE[wedge],
    spiralRisk: SPIRAL_WEDGES.includes(wedge),
  };
}

/** The metro's verdict — the one the journey branches on. */
export function msaVerdict(p: CityProfile): Verdict {
  return verdictFor(p.diagnosis.msa.popCagr, p.diagnosis.msa.wageCagr, p);
}

/** The admin city's own point on the same plane (stage 3/5 comparison). */
export function cityVerdict(p: CityProfile): Verdict {
  return verdictFor(p.diagnosis.city.popCagr, p.diagnosis.city.wageCagr, p);
}

export const sideLabel: Record<Side, string> = {
  demand: "labor demand",
  supply: "labor supply",
  none: "no apparent constraint",
};

/** Verdict for an arbitrary (popCagr, wageCagr) point vs the US medians —
 *  used by the interactive toys. */
export function verdictAt(popCagr: number, wageCagr: number): {
  wedge: WedgeId;
  scenario: Fig31Scenario;
  side: Side;
  spiralRisk: boolean;
} {
  const dPop = popCagr - MEDIANS.popCagr;
  const dWage = wageCagr - MEDIANS.wageCagr;
  const wedge = wedgeOf(dPop, dWage);
  return {
    wedge,
    scenario: scenarioOf(dPop, dWage),
    side: WEDGE_SIDE[wedge],
    spiralRisk: SPIRAL_WEDGES.includes(wedge),
  };
}

/* ————— Table 2 ————— */

export type Table2Quadrant = "star" | "goodGreat" | "resilientDecline" | "critical";

export function table2Quadrant(vsNationPp: number, vsPeersPp: number): Table2Quadrant {
  if (vsNationPp >= 0) return vsPeersPp >= 0 ? "star" : "goodGreat";
  return vsPeersPp >= 0 ? "resilientDecline" : "critical";
}

/* ————— formatting ————— */

export function fmtCount(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

export function fmtUsd(n: number): string {
  return `$${fmtCount(n)}`;
}

export function fmtLevel(ind: Indicator): string {
  if (ind.unit === "usd") return fmtUsd(ind.level);
  if (ind.unit === "pct") return `${ind.level}%`;
  return fmtCount(ind.level);
}

export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}

/** "−0.8%/yr" or "+0.1 pp" depending on the indicator's unit. */
export function fmtChange(ind: Indicator): string {
  return ind.unit === "pct"
    ? `${signed(ind.changePct)} pp`
    : `${signed(ind.changePct)}%/yr`;
}

export function fmtShare(x: number): string {
  return `${Math.round(x * 100)}%`;
}
