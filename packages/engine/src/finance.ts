import type { Category, FixedExpense, Goal, Profile, Transaction } from "@arthmitra/schema";
import { spendCategories } from "./categories";
import { addMonths, monthKey, monthsBetween } from "./dates";
import { roundUpTo } from "./money";

// ---------- Classifying transactions (PRD "Financial rules") ----------

/** Debits that are not own-account transfers, investments or money lent. */
export function isSpending(t: Transaction): boolean {
  return t.amountPaise < 0 && !t.isTransfer && !t.isInvestment && t.category !== "lent";
}

/** Credits that are not refunds, own-account transfers, investment redemptions or money paid back. */
export function isIncome(t: Transaction): boolean {
  return t.amountPaise > 0 && !t.isTransfer && !t.isInvestment && t.category !== "refund" && t.category !== "lent";
}

export function isRefund(t: Transaction): boolean {
  return t.amountPaise > 0 && !t.isTransfer && t.category === "refund";
}

export interface MonthSummary {
  monthKey: string;
  incomePaise: number;
  /** Spending debits minus refunds, never below zero. */
  spendingPaise: number;
  /** Spending per category id; uncategorised debits sit under "uncategorised". */
  byCategory: Record<string, number>;
  investedPaise: number;
}

export function summariseMonth(txns: Transaction[], key: string): MonthSummary {
  let incomePaise = 0;
  let grossSpend = 0;
  let refunds = 0;
  let investedPaise = 0;
  const byCategory: Record<string, number> = {};
  for (const t of txns) {
    if (monthKey(t.date) !== key) continue;
    if (isIncome(t)) incomePaise += t.amountPaise;
    else if (isRefund(t)) refunds += t.amountPaise;
    else if (isSpending(t)) {
      const amount = -t.amountPaise;
      grossSpend += amount;
      const cat = t.status === "categorised" && t.category ? t.category : "uncategorised";
      byCategory[cat] = (byCategory[cat] ?? 0) + amount;
    } else if (t.isInvestment && t.amountPaise < 0) investedPaise += -t.amountPaise;
  }
  return {
    monthKey: key,
    incomePaise,
    spendingPaise: Math.max(0, grossSpend - refunds),
    byCategory,
    investedPaise,
  };
}

// ---------- Capacity and rates ----------

export function sumFixed(fixed: FixedExpense[]): number {
  return fixed.reduce((sum, f) => sum + f.amountPaise, 0);
}

export function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, v) => sum + v, 0);
}

/** Income − fixed expenses − variable spending. */
export function savingsCapacity(incomePaise: number, fixedPaise: number, variablePaise: number): number {
  return incomePaise - fixedPaise - variablePaise;
}

/** Capacity from the onboarding estimates (used until a full month of actuals exists). */
export function capacityFromProfile(profile: Profile): number {
  return savingsCapacity(
    profile.monthlyIncomePaise + profile.otherIncomePaise,
    sumFixed(profile.fixedExpenses),
    sumValues(profile.estimatedSpend),
  );
}

/** (Income − spending) ÷ income; null when income is 0 (shown as "—"). */
export function savingsRate(incomePaise: number, spendingPaise: number): number | null {
  if (incomePaise <= 0) return null;
  return (incomePaise - spendingPaise) / incomePaise;
}

// ---------- Goals ----------

/** (Target − already saved) ÷ months left, rounded up to ₹100. */
export function requiredMonthlySaving(targetPaise: number, savedPaise: number, monthsLeft: number): number {
  const remaining = Math.max(0, targetPaise - savedPaise);
  if (remaining === 0) return 0;
  return roundUpTo(Math.ceil(remaining / Math.max(1, monthsLeft)));
}

/** Today + remaining ÷ monthly contribution (in whole months); null when contribution ≤ 0. */
export function projectedCompletion(
  today: string,
  remainingPaise: number,
  monthlyContributionPaise: number,
): string | null {
  if (remainingPaise <= 0) return today;
  if (monthlyContributionPaise <= 0) return null;
  return addMonths(today, Math.ceil(remainingPaise / monthlyContributionPaise));
}

/** On track = monthly contribution ≥ required monthly saving. */
export function isOnTrack(contributionPaise: number, requiredPaise: number): boolean {
  return contributionPaise >= requiredPaise;
}

export interface GoalStatus {
  remainingPaise: number;
  monthsLeft: number;
  requiredPaise: number;
  contributionPaise: number;
  onTrack: boolean;
  /** How much the contribution falls short of the requirement each month. */
  gapPaise: number;
  projectedDate: string | null;
  /** 0–1 share of the target already saved. */
  progress: number;
  achieved: boolean;
}

export function goalStatus(args: {
  goal: Pick<Goal, "targetPaise" | "targetDate" | "monthlyContributionPaise">;
  savedPaise: number;
  capacityPaise: number;
  today: string;
}): GoalStatus {
  const { goal, savedPaise, capacityPaise, today } = args;
  const remainingPaise = Math.max(0, goal.targetPaise - savedPaise);
  const monthsLeft = monthsBetween(today, goal.targetDate);
  const requiredPaise = requiredMonthlySaving(goal.targetPaise, savedPaise, monthsLeft);
  const contributionPaise = goal.monthlyContributionPaise ?? Math.max(0, capacityPaise);
  return {
    remainingPaise,
    monthsLeft,
    requiredPaise,
    contributionPaise,
    onTrack: isOnTrack(contributionPaise, requiredPaise),
    gapPaise: Math.max(0, requiredPaise - contributionPaise),
    projectedDate: projectedCompletion(today, remainingPaise, contributionPaise),
    progress: Math.min(1, savedPaise / goal.targetPaise),
    achieved: remainingPaise === 0,
  };
}

/**
 * Future value of a monthly contribution (paid at month end, compounded monthly),
 * plus anything already saved. Used only with return rates the user entered.
 */
export function futureValue(
  monthlyPaise: number,
  months: number,
  annualPct: number,
  startingPaise = 0,
): number {
  const r = annualPct / 100 / 12;
  if (r === 0) return startingPaise + monthlyPaise * months;
  const growth = (1 + r) ** months;
  return Math.round(startingPaise * growth + (monthlyPaise * (growth - 1)) / r);
}

/** Corpus at the user's low and high assumptions — never one guaranteed figure. */
export function projectionRange(args: {
  monthlyPaise: number;
  months: number;
  lowPct: number;
  highPct: number;
  startingPaise: number;
}): { lowPaise: number; highPaise: number } {
  const { monthlyPaise, months, lowPct, highPct, startingPaise } = args;
  const lo = Math.min(lowPct, highPct);
  const hi = Math.max(lowPct, highPct);
  return {
    lowPaise: futureValue(monthlyPaise, months, lo, startingPaise),
    highPaise: futureValue(monthlyPaise, months, hi, startingPaise),
  };
}

// ---------- Where to cut ----------

export interface CutSuggestion {
  category: string;
  roomPaise: number;
  reason: "over_estimate" | "share_of_spend";
}

/** Share of discretionary spend offered as room when nothing ran over its estimate. */
const FALLBACK_CUT_SHARE = 0.2;

/**
 * Categories with most room to cut. Room = last month's spend above the user's own
 * estimate, for discretionary categories. If nothing ran over, offer 20% of each
 * discretionary category's spend instead.
 */
export function topCutCategories(args: {
  estimates: Record<string, number>;
  actualByCategory: Record<string, number>;
  discretionary: string[];
  count?: number;
}): CutSuggestion[] {
  const { estimates, actualByCategory, discretionary, count = 2 } = args;
  const over: CutSuggestion[] = discretionary
    .map((category) => ({
      category,
      roomPaise: Math.max(0, (actualByCategory[category] ?? 0) - (estimates[category] ?? 0)),
      reason: "over_estimate" as const,
    }))
    .filter((c) => c.roomPaise > 0);
  const pool: CutSuggestion[] = over.length
    ? over
    : discretionary
        .map((category) => ({
          category,
          roomPaise: roundUpTo(Math.round((actualByCategory[category] ?? 0) * FALLBACK_CUT_SHARE)),
          reason: "share_of_spend" as const,
        }))
        .filter((c) => c.roomPaise > 0);
  return pool.sort((a, b) => b.roomPaise - a.roomPaise).slice(0, count);
}

// ---------- Budgets ----------

export type BudgetLevel = "ok" | "near" | "over";

export interface BudgetRow {
  category: string;
  spentPaise: number;
  budgetPaise: number;
  /** spent ÷ budget; can pass 1. */
  share: number;
  level: BudgetLevel;
  /** True when the budget is the user's onboarding estimate, not a limit they set. */
  fromEstimate: boolean;
}

/** 80% used is "near", 100% or more is "over". */
export function budgetLevel(spentPaise: number, budgetPaise: number): BudgetLevel {
  if (spentPaise >= budgetPaise) return "over";
  return spentPaise >= budgetPaise * 0.8 ? "near" : "ok";
}

/** One row per spend category that has a budget: its monthly limit if set, else the user's estimate. */
export function budgetRows(categories: Category[], estimates: Record<string, number>, spentByCategory: Record<string, number>): BudgetRow[] {
  return spendCategories(categories).flatMap((c) => {
    const budget = c.monthlyLimitPaise ?? estimates[c.id] ?? 0;
    if (budget <= 0) return [];
    const spent = spentByCategory[c.id] ?? 0;
    return [{ category: c.id, spentPaise: spent, budgetPaise: budget, share: spent / budget, level: budgetLevel(spent, budget), fromEstimate: c.monthlyLimitPaise === null }];
  });
}

// ---------- Splitting a payment ----------

/** Equal shares in paise that add up to the total; leftover paise go to the first share (yours). */
export function splitEqually(totalPaise: number, people: number): number[] {
  if (!Number.isInteger(people) || people < 1) throw new Error("Need at least one person");
  const each = Math.floor(totalPaise / people);
  return Array.from({ length: people }, (_, i) => (i === 0 ? totalPaise - each * (people - 1) : each));
}
