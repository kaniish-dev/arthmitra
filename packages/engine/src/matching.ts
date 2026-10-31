import type { Investment, Transaction } from "@arthmitra/schema";
import { daysBetween, laterOf } from "./dates";

const TRANSFER_WORDS = ["self", "own account", "to self", "transfer", "neft", "imps", "rtgs", "sweep"];

export function hasTransferWords(text: string): boolean {
  const lower = text.toLowerCase();
  return TRANSFER_WORDS.some((w) => lower.includes(w));
}

/**
 * Own-account transfer: same amount, opposite sign, two different linked accounts,
 * within 3 days, with transfer words on either side. Suggested only — the user confirms.
 */
export function findTransferCounterpart(
  txn: Transaction,
  others: Transaction[],
  maxDays = 3,
): Transaction | null {
  if (!txn.accountId) return null;
  return (
    others.find(
      (o) =>
        o.id !== txn.id &&
        o.accountId !== null &&
        o.accountId !== txn.accountId &&
        o.amountPaise === -txn.amountPaise &&
        !o.isTransfer &&
        !o.isInvestment &&
        Math.abs(daysBetween(txn.date, o.date)) <= maxDays &&
        (hasTransferWords(txn.merchantRaw) || hasTransferWords(o.merchantRaw)),
    ) ?? null
  );
}

/** Bank debit that pays for a planned investment: same amount, within ±3 days, not already used. */
export function findInvestmentDebit(
  investment: Pick<Investment, "amountPaise" | "date">,
  txns: Transaction[],
  maxDays = 3,
): Transaction | null {
  const candidates = txns.filter(
    (t) =>
      t.amountPaise === -investment.amountPaise &&
      !t.isTransfer &&
      !t.isInvestment &&
      t.source !== "cash" &&
      Math.abs(daysBetween(investment.date, t.date)) <= maxDays,
  );
  candidates.sort(
    (a, b) => Math.abs(daysBetween(investment.date, a.date)) - Math.abs(daysBetween(investment.date, b.date)),
  );
  return candidates[0] ?? null;
}

/** When money in a holding is free for the goal: latest of maturity, lock-in end and exit-load end. */
export function withdrawableDate(
  inv: Pick<Investment, "date" | "maturityDate" | "lockInUntil" | "exitLoadUntil">,
): string {
  return [inv.maturityDate, inv.lockInUntil, inv.exitLoadUntil].reduce<string>(
    (latest, d) => (d ? laterOf(latest, d) : latest),
    inv.date,
  );
}

/** Confirmed investments count toward the goal; planned and paid ones do not yet. */
export function savedForGoal(investments: Investment[], goalId: string): number {
  return investments
    .filter((i) => i.goalId === goalId && i.status === "confirmed")
    .reduce((sum, i) => sum + i.amountPaise, 0);
}

/** Units × published NAV (rupees) → paise. */
export function navValuePaise(units: number, navRupees: number): number {
  return Math.round(units * navRupees * 100);
}

export function currentValuePaise(inv: Investment): number {
  return inv.currentValuePaise ?? inv.amountPaise;
}
