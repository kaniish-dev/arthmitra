import type { Transaction } from "@arthmitra/schema";
import { addMonths, daysBetween, monthKey } from "./dates";

/**
 * Categories whose repeats are bills or subscriptions. Food and travel repeat too,
 * but two Swiggy orders a month are a habit, not a bill.
 */
export const RECURRING_CATEGORIES = ["rent", "bills", "emi", "subscriptions", "education", "entertainment", "investment"];

export interface RecurringPayment {
  merchantKey: string;
  category: string;
  /** Latest amount, positive paise. */
  amountPaise: number;
  lastDate: string;
  nextDate: string;
  /** Days from today to nextDate; negative once the expected date has passed. */
  daysUntil: number;
  paidThisMonth: boolean;
  months: number;
}

/**
 * Monthly repeats: one debit a month to the same merchant in at least two of the
 * last four months, every amount within 10% of the latest, all within 5 days of
 * each other in the month.
 */
export function findRecurring(txns: Transaction[], today: string, categories: string[] = RECURRING_CATEGORIES): RecurringPayment[] {
  const since = monthKey(addMonths(today, -3));
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.amountPaise >= 0 || t.isTransfer || t.status !== "categorised" || !t.category || !categories.includes(t.category)) continue;
    if (monthKey(t.date) < since || t.date > today) continue;
    groups.set(t.merchantKey, [...(groups.get(t.merchantKey) ?? []), t]);
  }

  const out: RecurringPayment[] = [];
  for (const [merchantKey, list] of groups) {
    const months = new Set(list.map((t) => monthKey(t.date)));
    if (months.size < 2 || months.size !== list.length) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = sorted[sorted.length - 1]!;
    const amount = -latest.amountPaise;
    if (sorted.some((t) => Math.abs(-t.amountPaise - amount) > amount * 0.1)) continue;
    const days = sorted.map((t) => Number(t.date.slice(8, 10)));
    if (Math.max(...days) - Math.min(...days) > 5) continue;
    const nextDate = addMonths(latest.date, 1);
    out.push({
      merchantKey,
      category: latest.category!,
      amountPaise: amount,
      lastDate: latest.date,
      nextDate,
      daysUntil: daysBetween(today, nextDate),
      paidThisMonth: monthKey(latest.date) === monthKey(today),
      months: months.size,
    });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil || b.amountPaise - a.amountPaise);
}
