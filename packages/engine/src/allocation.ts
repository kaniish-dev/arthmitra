import type { AllocationLine, InstrumentType, RiskComfort, Timeline } from "@arthmitra/schema";
import { roundUpTo } from "./money";

/**
 * Timeline + risk appetite → investment mix → monthly amount and projection. Every table here
 * is a default the app can override (apps/web/src/lib/plan/allocation.ts passes its config).
 * The money split stays at instrument-category level; returns are assumptions shown to the user,
 * never promises.
 */

// ---------- Timeline ----------

export interface TimelineConfig {
  /** Under this many months is short term (default 3 years). */
  shortBelowMonths: number;
  /** Over this many months is long term (default 7 years). */
  longAboveMonths: number;
  /** Years a Wealth Generator plan aims for at each timeline (how aggressive the user is). */
  wealthYears: Record<Timeline, number>;
}

export const DEFAULT_TIMELINE: TimelineConfig = {
  shortBelowMonths: 36,
  longAboveMonths: 84,
  wealthYears: { short: 5, medium: 10, long: 15 },
};

export function timelineFor(monthsLeft: number, cfg: TimelineConfig = DEFAULT_TIMELINE): Timeline {
  if (monthsLeft < cfg.shortBelowMonths) return "short";
  if (monthsLeft <= cfg.longAboveMonths) return "medium";
  return "long";
}

// ---------- Allocation ----------

export interface AllocationConfig {
  /** Base mix for each risk appetite, as weights out of 100. */
  mix: Record<RiskComfort, Partial<Record<InstrumentType, number>>>;
  /** How much of each instrument counts as equity (hybrid funds are about half shares). */
  equityShare: Partial<Record<InstrumentType, number>>;
  /** Most equity a timeline allows, in percent: short timelines cap equity even at High risk. */
  equityCapPct: Record<Timeline, number>;
  /** Where weight trimmed by the cap goes, as weights summing to 1. */
  capFallback: Record<Timeline, Partial<Record<InstrumentType, number>>>;
  /** Assumed annual return per instrument type, in percent. */
  returnsPct: Record<InstrumentType, number>;
}

export const DEFAULT_ALLOCATION: AllocationConfig = {
  mix: {
    low: { fd: 30, rd: 20, gsec: 20, tbill: 10, bonds: 10, gold: 10 },
    medium: { index: 30, debt: 20, hybrid: 20, gold: 10, fd: 10, rd: 10 },
    high: { equity: 50, index: 30, stocks: 20 },
  },
  equityShare: { equity: 1, index: 1, stocks: 1, hybrid: 0.5 },
  equityCapPct: { short: 20, medium: 60, long: 100 },
  capFallback: {
    short: { rd: 0.5, fd: 0.5 },
    medium: { debt: 0.5, gsec: 0.5 },
    long: { debt: 1 },
  },
  returnsPct: {
    savings: 3,
    fd: 7,
    rd: 6.5,
    liquid: 6.5,
    short_debt: 7,
    debt: 7.5,
    bonds: 8,
    gsec: 7,
    tbill: 6.5,
    gold: 8,
    hybrid: 9.5,
    index: 11,
    equity: 12,
    stocks: 13,
  },
};

/** Equity share of a mix, in percent. */
export function equityPct(lines: AllocationLine[], cfg: AllocationConfig = DEFAULT_ALLOCATION): number {
  return lines.reduce((sum, l) => sum + l.pct * (cfg.equityShare[l.type] ?? 0), 0);
}

/** Whole percentages that add up to exactly 100 (largest remainder), biggest first. */
function toLines(weights: Partial<Record<InstrumentType, number>>): AllocationLine[] {
  const entries = Object.entries(weights).filter(([, w]) => (w ?? 0) > 0) as Array<[InstrumentType, number]>;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return [];
  const raw = entries.map(([type, w]) => ({ type, exact: (w / total) * 100 }));
  const lines = raw.map((r) => ({ type: r.type, pct: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let left = 100 - lines.reduce((s, l) => s + l.pct, 0);
  for (const l of [...lines].sort((a, b) => b.rem - a.rem)) {
    if (left <= 0) break;
    l.pct += 1;
    left -= 1;
  }
  return lines
    .filter((l) => l.pct > 0)
    .map(({ type, pct }) => ({ type, pct }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * The mix for a risk appetite, with equity trimmed to the timeline's cap. A monthly plan can't add
 * to a fixed deposit every month, so in "monthly" mode the FD share goes to a recurring deposit;
 * money available today is placed by recommendSavings (recommend.ts), not here.
 */
export function allocate(risk: RiskComfort, timeline: Timeline, cfg: AllocationConfig = DEFAULT_ALLOCATION, mode: "monthly" | "lump" = "monthly"): AllocationLine[] {
  const weights: Partial<Record<InstrumentType, number>> = { ...cfg.mix[risk] };
  const total = Object.values(weights).reduce((s, w) => s + (w ?? 0), 0);
  const equity = Object.entries(weights).reduce((s, [t, w]) => s + (w ?? 0) * (cfg.equityShare[t as InstrumentType] ?? 0), 0);
  const cap = (cfg.equityCapPct[timeline] / 100) * total;
  if (equity > cap) {
    const keep = cap / equity;
    let trimmed = 0;
    for (const [t, w] of Object.entries(weights) as Array<[InstrumentType, number]>) {
      if (!(cfg.equityShare[t] ?? 0)) continue;
      trimmed += w * (1 - keep);
      weights[t] = w * keep;
    }
    for (const [t, share] of Object.entries(cfg.capFallback[timeline]) as Array<[InstrumentType, number]>) {
      weights[t] = (weights[t] ?? 0) + trimmed * share;
    }
  }
  if (mode === "monthly" && weights.fd) {
    weights.rd = (weights.rd ?? 0) + weights.fd;
    delete weights.fd;
  }
  return toLines(weights);
}

/** Weighted assumed annual return of a mix, in percent (one decimal). */
export function blendedReturnPct(lines: AllocationLine[], cfg: AllocationConfig = DEFAULT_ALLOCATION): number {
  const r = lines.reduce((sum, l) => sum + (l.pct / 100) * cfg.returnsPct[l.type], 0);
  return Math.round(r * 10) / 10;
}

// ---------- Projection ----------

/** Monthly rate equivalent to an annual return. */
export function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/** Growth of ₹1 a month, paid at the start of each month, over n months. */
function sipFactor(months: number, r: number): number {
  if (months <= 0) return 0;
  if (r === 0) return months;
  return ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
}

/** Value after `months` of a monthly SIP/deposit plus what is already invested. */
export function sipFutureValue(monthlyPaise: number, months: number, annualPct: number, startPaise = 0): number {
  const r = monthlyRate(annualPct);
  return Math.round(startPaise * Math.pow(1 + r, Math.max(0, months)) + monthlyPaise * sipFactor(months, r));
}

/** Monthly SIP/deposit needed to reach the target in `months`, rounded up to ₹100. */
export function sipNeeded(targetPaise: number, savedPaise: number, months: number, annualPct: number): number {
  const r = monthlyRate(annualPct);
  const n = Math.max(1, months);
  const remaining = targetPaise - savedPaise * Math.pow(1 + r, n);
  if (remaining <= 0) return 0;
  return roundUpTo(remaining / sipFactor(n, r));
}

// ---------- Wealth Generator ----------

/** Share of the corpus that can be withdrawn each year as passive income (the "4% rule"). */
export const SAFE_WITHDRAWAL_PCT = 4;

/** Corpus whose passive income covers monthly expenses: expenses × 12 ÷ 4%. */
export function wealthTarget(monthlyExpensesPaise: number, withdrawalPct = SAFE_WITHDRAWAL_PCT): number {
  return roundUpTo((monthlyExpensesPaise * 12 * 100) / withdrawalPct, 100_000);
}

/** Estimated monthly passive income from a portfolio value. */
export function passiveIncomeMonthly(valuePaise: number, withdrawalPct = SAFE_WITHDRAWAL_PCT): number {
  return Math.round((valuePaise * withdrawalPct) / 100 / 12);
}

// ---------- A full plan ----------

// ---------- Practical monthly split ----------

/** Smallest monthly amount worth a separate investment (most SIPs and RDs start around here). */
export const MIN_LINE_PAISE = 50_000;

/**
 * Rupees per line each month, rounded to ₹100. Lines that would get less than the minimum are
 * folded into the rest (smallest first), so a low monthly amount isn't spread into ₹150 slices
 * nobody can actually invest; with very little, it all goes into the biggest line.
 */
export function practicalSplit(allocation: AllocationLine[], monthlyPaise: number, minPaise = MIN_LINE_PAISE): Array<AllocationLine & { paise: number }> {
  let lines = [...allocation].filter((l) => l.pct > 0).sort((a, b) => b.pct - a.pct);
  while (lines.length > 1) {
    const total = lines.reduce((s, l) => s + l.pct, 0);
    const smallest = lines[lines.length - 1]!;
    if ((monthlyPaise * smallest.pct) / total >= minPaise) break;
    lines = lines.slice(0, -1);
  }
  const total = lines.reduce((s, l) => s + l.pct, 0) || 1;
  const split = lines.map((l) => ({ type: l.type, pct: Math.round((l.pct / total) * 100), paise: Math.round((monthlyPaise * l.pct) / total / 10_000) * 10_000 }));
  if (split.length) {
    split[0]!.paise += monthlyPaise - split.reduce((s, l) => s + l.paise, 0);
    split[0]!.pct += 100 - split.reduce((s, l) => s + l.pct, 0);
  }
  return split;
}

export interface PlanInput {
  targetPaise: number;
  savedPaise: number;
  monthsLeft: number;
  risk: RiskComfort;
  timeline: Timeline;
  /** What the user can put in each month (the realistic saving); caps the default monthly amount. */
  affordablePaise: number;
  /** A monthly amount the user typed; overrides the default. */
  monthlyPaise?: number | null;
}

export interface PlanResult {
  allocation: AllocationLine[];
  expectedReturnPct: number;
  requiredPaise: number;
  monthlyPaise: number;
  projectedPaise: number;
  onTrack: boolean;
  /** Extra a month needed to be on track; 0 when on track. */
  shortfallPaise: number;
  /** Rupees per instrument each month, same order as allocation. */
  split: Array<AllocationLine & { paise: number }>;
}

export function buildPlan(input: PlanInput, cfg: AllocationConfig = DEFAULT_ALLOCATION): PlanResult {
  const allocation = allocate(input.risk, input.timeline, cfg);
  const expectedReturnPct = blendedReturnPct(allocation, cfg);
  const requiredPaise = sipNeeded(input.targetPaise, input.savedPaise, input.monthsLeft, expectedReturnPct);
  const monthlyPaise = Math.max(0, input.monthlyPaise ?? Math.min(requiredPaise, Math.max(0, input.affordablePaise)));
  const projectedPaise = sipFutureValue(monthlyPaise, input.monthsLeft, expectedReturnPct, input.savedPaise);
  const onTrack = projectedPaise >= input.targetPaise;
  // Rupees per line: rounded to ₹100, with the rounding left on the biggest line.
  const split = practicalSplit(allocation, monthlyPaise);
  return {
    allocation,
    expectedReturnPct,
    requiredPaise,
    monthlyPaise,
    projectedPaise,
    onTrack,
    shortfallPaise: onTrack ? 0 : Math.max(0, requiredPaise - monthlyPaise),
    split,
  };
}
