import type { AllocationLine, InstrumentType } from "@arthmitra/schema";
import { DEFAULT_ALLOCATION, type AllocationConfig } from "./allocation";

/**
 * Goal success probability: a Monte Carlo simulation of many possible market paths. Each month,
 * every instrument in the mix earns its assumed return plus a random shock sized by its
 * volatility; the share of paths that end at or above the target is the chance of reaching the
 * goal on time. Deterministic for a given seed, so the same plan always shows the same figure.
 */

/** Assumed annual volatility (standard deviation of yearly returns), in percent. */
export const VOLATILITY_PCT: Record<InstrumentType, number> = {
  savings: 0,
  fd: 0,
  rd: 0,
  tbill: 0.5,
  liquid: 0.8,
  gsec: 4,
  short_debt: 2,
  debt: 3,
  bonds: 3,
  gold: 14,
  hybrid: 10,
  index: 17,
  equity: 19,
  stocks: 26,
};

/** Small seeded generator (mulberry32), so results repeat for the same plan. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw (Box–Muller). */
function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export interface SimulationInput {
  allocation: AllocationLine[];
  monthlyPaise: number;
  months: number;
  startPaise: number;
  targetPaise: number;
  paths?: number;
  seed?: number;
}

export interface SimulationResult {
  /** 0–1 share of simulated paths that reach the target. */
  probability: number;
  /** 10th, 50th and 90th percentile end values: a bad, typical and good market. */
  p10Paise: number;
  p50Paise: number;
  p90Paise: number;
  paths: number;
}

export function simulateGoal(input: SimulationInput, cfg: AllocationConfig = DEFAULT_ALLOCATION, volatility = VOLATILITY_PCT): SimulationResult {
  const paths = input.paths ?? 2000;
  const months = Math.max(1, Math.round(input.months));
  const rand = rng(input.seed ?? 42);
  const lines = input.allocation.filter((l) => l.pct > 0);
  // Monthly drift and shock per instrument (log-normal growth).
  const params = lines.map((l) => {
    const mu = Math.log(1 + cfg.returnsPct[l.type] / 100) / 12;
    const sigma = volatility[l.type] / 100 / Math.sqrt(12);
    return { share: l.pct / 100, mu: mu - (sigma * sigma) / 2, sigma };
  });
  const ends: number[] = [];
  for (let p = 0; p < paths; p++) {
    // One pot per instrument, so a crash in shares doesn't touch the FD.
    const pots = params.map((x) => x.share * input.startPaise);
    for (let m = 0; m < months; m++) {
      for (let i = 0; i < params.length; i++) {
        const x = params[i]!;
        pots[i] = (pots[i]! + x.share * input.monthlyPaise) * Math.exp(x.mu + x.sigma * normal(rand));
      }
    }
    ends.push(pots.reduce((s, v) => s + v, 0));
  }
  ends.sort((a, b) => a - b);
  const at = (q: number) => Math.round(ends[Math.min(ends.length - 1, Math.floor(q * ends.length))]!);
  return {
    probability: ends.filter((v) => v >= input.targetPaise).length / paths,
    p10Paise: at(0.1),
    p50Paise: at(0.5),
    p90Paise: at(0.9),
    paths,
  };
}

// ---------- This year's outlook ----------

export interface YearOutlook {
  months: number;
  /** Money put in over the period, including what is already invested. */
  paidInPaise: number;
  p10Paise: number;
  p50Paise: number;
  p90Paise: number;
  /**
   * Chance the value at the end of the period is enough that, with the same monthly amount at the
   * assumed return, the goal is still reached on time.
   */
  onTrackProbability: number;
  /** Chance of ending the period below what was paid in. */
  lossProbability: number;
  /** The value needed at the end of the period to still be on track. */
  onTrackPaise: number;
}

/**
 * Outlook for the next 12 months (or until the goal, if sooner): a range of outcomes from the same
 * simulation, not a market prediction.
 */
export function yearOutlook(
  input: { allocation: AllocationLine[]; monthlyPaise: number; startPaise: number; targetPaise: number; monthsLeft: number; expectedReturnPct: number; seed?: number },
  cfg: AllocationConfig = DEFAULT_ALLOCATION,
  volatility = VOLATILITY_PCT,
): YearOutlook {
  const months = Math.max(1, Math.min(12, input.monthsLeft));
  const rest = Math.max(0, input.monthsLeft - months);
  const r = Math.pow(1 + input.expectedReturnPct / 100, 1 / 12) - 1;
  const restFactor = rest === 0 ? 0 : r === 0 ? rest : ((Math.pow(1 + r, rest) - 1) / r) * (1 + r);
  const onTrackPaise = Math.max(0, Math.round((input.targetPaise - input.monthlyPaise * restFactor) / Math.pow(1 + r, rest)));
  const paidInPaise = input.startPaise + input.monthlyPaise * months;
  const base = { allocation: input.allocation, monthlyPaise: input.monthlyPaise, months, startPaise: input.startPaise, seed: input.seed ?? 7 };
  const track = simulateGoal({ ...base, targetPaise: onTrackPaise }, cfg, volatility);
  const loss = simulateGoal({ ...base, targetPaise: paidInPaise }, cfg, volatility);
  return {
    months,
    paidInPaise,
    p10Paise: track.p10Paise,
    p50Paise: track.p50Paise,
    p90Paise: track.p90Paise,
    onTrackProbability: track.probability,
    lossProbability: Math.max(0, 1 - loss.probability),
    onTrackPaise,
  };
}
