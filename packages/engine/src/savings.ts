import type { Transaction } from "@arthmitra/schema";
import { addMonths, monthKey } from "./dates";
import { summariseMonth } from "./finance";

/**
 * Savings insights read from past transactions, month on month: income, spend by category,
 * fixed vs variable, money left, and a realistic monthly saving for this user.
 */

/** Fixed costs: rent, EMIs, bills and subscriptions. Everything else spent is variable. */
export const FIXED_CATEGORY_IDS = ["rent", "emi", "bills", "subscriptions"];

export interface MonthFlow {
  monthKey: string;
  incomePaise: number;
  spendingPaise: number;
  fixedPaise: number;
  variablePaise: number;
  /** Income − spending; negative when the month ran over. */
  leftPaise: number;
  byCategory: Record<string, number>;
}

export function monthFlow(txns: Transaction[], key: string, fixedIds: string[] = FIXED_CATEGORY_IDS): MonthFlow {
  const m = summariseMonth(txns, key);
  const fixedPaise = Object.entries(m.byCategory)
    .filter(([c]) => fixedIds.includes(c))
    .reduce((s, [, v]) => s + v, 0);
  return {
    monthKey: key,
    incomePaise: m.incomePaise,
    spendingPaise: m.spendingPaise,
    fixedPaise: Math.min(fixedPaise, m.spendingPaise),
    variablePaise: Math.max(0, m.spendingPaise - fixedPaise),
    leftPaise: m.incomePaise - m.spendingPaise,
    byCategory: m.byCategory,
  };
}

/** The last `count` complete months before today's month that have any transactions, oldest first. */
export function pastMonthFlows(txns: Transaction[], today: string, count = 6): MonthFlow[] {
  const keys = new Set(txns.map((t) => monthKey(t.date)));
  const flows: MonthFlow[] = [];
  for (let i = count; i >= 1; i--) {
    const key = monthKey(addMonths(`${monthKey(today)}-01`, -i));
    if (keys.has(key)) flows.push(monthFlow(txns, key));
  }
  return flows;
}

const average = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export interface RealisticSaving {
  /** Rule-based monthly saving to aim for, rounded down to ₹500. */
  monthlyPaise: number;
  /** Average money left per month over the months read. */
  averageSurplusPaise: number;
  averageIncomePaise: number;
  averageSpendPaise: number;
  averageFixedPaise: number;
  averageVariablePaise: number;
  monthsRead: number;
  /** Months that ended with less than the realistic saving left. */
  tightMonths: number;
}

/** Share of the average surplus suggested as saving; the rest absorbs surprises. */
export const SAVING_SHARE = 0.8;

/**
 * Realistic monthly saving = 80% of the average monthly surplus (income − spending) over the
 * past complete months, rounded down to ₹500, never below zero. Months that ran over pull
 * the average down, so the target stays one the user has actually managed.
 */
export function realisticSaving(flows: MonthFlow[], share = SAVING_SHARE): RealisticSaving {
  const averageSurplusPaise = Math.round(average(flows.map((f) => f.leftPaise)));
  const step = 50_000;
  const monthlyPaise = Math.max(0, Math.floor((averageSurplusPaise * share) / step) * step);
  return {
    monthlyPaise,
    averageSurplusPaise,
    averageIncomePaise: Math.round(average(flows.map((f) => f.incomePaise))),
    averageSpendPaise: Math.round(average(flows.map((f) => f.spendingPaise))),
    averageFixedPaise: Math.round(average(flows.map((f) => f.fixedPaise))),
    averageVariablePaise: Math.round(average(flows.map((f) => f.variablePaise))),
    monthsRead: flows.length,
    tightMonths: flows.filter((f) => f.leftPaise < monthlyPaise).length,
  };
}

/** Average monthly spend per category over the months read, biggest first. */
export function averageByCategory(flows: MonthFlow[]): Array<{ category: string; paise: number }> {
  const totals: Record<string, number> = {};
  for (const f of flows) for (const [c, v] of Object.entries(f.byCategory)) totals[c] = (totals[c] ?? 0) + v;
  return Object.entries(totals)
    .map(([category, total]) => ({ category, paise: Math.round(total / Math.max(1, flows.length)) }))
    .sort((a, b) => b.paise - a.paise);
}
