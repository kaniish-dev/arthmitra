import type { Loan, Transaction } from "@arthmitra/schema";
import { daysBetween } from "./dates";

/** Money lent to people: what is still owed, whether it is late, and spotting it when it comes back. */

export function returnedPaise(loan: Pick<Loan, "returns">, until?: string): number {
  return loan.returns.filter((r) => !until || r.date <= until).reduce((sum, r) => sum + r.amountPaise, 0);
}

/** Still owed; nothing once forgiven. `until` judges it as of a past date. */
export function outstandingPaise(loan: Pick<Loan, "amountPaise" | "returns" | "forgiven">, until?: string): number {
  if (loan.forgiven) return 0;
  return Math.max(0, loan.amountPaise - returnedPaise(loan, until));
}

export type LoanState = "open" | "due_soon" | "overdue" | "returned" | "forgiven";

export function loanState(loan: Loan, today: string): LoanState {
  if (loan.forgiven) return "forgiven";
  if (outstandingPaise(loan) === 0) return "returned";
  if (loan.dueDate && loan.dueDate < today) return "overdue";
  if (loan.dueDate && daysBetween(today, loan.dueDate) <= 3) return "due_soon";
  return "open";
}

export function totalOutstanding(loans: Loan[]): number {
  return loans.reduce((sum, l) => sum + outstandingPaise(l), 0);
}

/** Loans past their due date with money still owed on `date`. */
export function overdueLoans(loans: Loan[], date: string): Loan[] {
  return loans.filter((l) => l.date <= date && l.dueDate !== null && l.dueDate < date && outstandingPaise(l, date) > 0);
}

/** The person's first name (3+ letters), or their whole name when it is shorter. */
function firstName(person: string): string {
  const words = person.toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean);
  return words.find((w) => w.length >= 3) ?? words.join(" ");
}

/**
 * The open loan a credit most likely pays back: the person's first name is in the bank
 * narration and the amount is no more than what they still owe. Oldest loan first.
 */
export function matchLoanReturn(loans: Loan[], txn: Pick<Transaction, "amountPaise" | "merchantKey" | "merchantRaw">): Loan | null {
  if (txn.amountPaise <= 0) return null;
  const text = `${txn.merchantKey} ${txn.merchantRaw.toLowerCase()}`;
  return (
    loans
      .filter((l) => {
        const name = firstName(l.person);
        return name !== "" && new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(text) && txn.amountPaise <= outstandingPaise(l);
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null
  );
}
