import { describe, expect, it } from "vitest";
import type { Loan } from "@arthmitra/schema";
import { isIncome, isSpending } from "./finance";
import { loanState, matchLoanReturn, outstandingPaise, overdueLoans, totalOutstanding } from "./loans";
import { makeTxn } from "./testing";

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "l1",
  person: "Ramesh Kumar",
  amountPaise: 80_000,
  date: "2026-10-10",
  dueDate: "2026-10-28",
  note: null,
  txnId: null,
  returns: [],
  forgiven: false,
  createdAt: "2026-10-10T08:00:00.000Z",
  ...overrides,
});

describe("loans", () => {
  it("tracks what is still owed, including part payments and forgiving", () => {
    const part = loan({ returns: [{ id: "r1", amountPaise: 30_000, date: "2026-10-20", txnId: null, handled: false }] });
    expect(outstandingPaise(part)).toBe(50_000);
    expect(outstandingPaise(part, "2026-10-15")).toBe(80_000);
    expect(outstandingPaise({ ...part, forgiven: true })).toBe(0);
    expect(totalOutstanding([part, loan({ id: "l2", amountPaise: 20_000 })])).toBe(70_000);
  });

  it("knows when a loan is due soon, overdue or settled", () => {
    expect(loanState(loan(), "2026-10-20")).toBe("open");
    expect(loanState(loan(), "2026-10-26")).toBe("due_soon");
    expect(loanState(loan(), "2026-10-30")).toBe("overdue");
    expect(loanState(loan({ returns: [{ id: "r", amountPaise: 80_000, date: "2026-10-29", txnId: null, handled: false }] }), "2026-10-30")).toBe("returned");
    expect(loanState(loan({ forgiven: true }), "2026-10-30")).toBe("forgiven");
    expect(overdueLoans([loan(), loan({ id: "l2", dueDate: null })], "2026-10-30").map((l) => l.id)).toEqual(["l1"]);
  });

  it("spots a payback by the person's first name and an amount within what is owed", () => {
    const credit = (merchantRaw: string, amountPaise: number) => makeTxn({ merchantRaw, merchantKey: merchantRaw.toLowerCase(), amountPaise });
    expect(matchLoanReturn([loan()], credit("UPI-RAMESH KUMAR-ramesh@oksbi", 80_000))?.id).toBe("l1");
    expect(matchLoanReturn([loan()], credit("UPI-RAMESH KUMAR-ramesh@oksbi", 90_000))).toBeNull();
    expect(matchLoanReturn([loan()], credit("UPI-RAMESHWAR STORES", 50_000))).toBeNull();
    expect(matchLoanReturn([loan()], credit("UPI-RAMESH KUMAR", -80_000))).toBeNull();
  });

  it("keeps lent money and paybacks out of spending and income", () => {
    expect(isSpending(makeTxn({ amountPaise: -80_000, category: "lent" }))).toBe(false);
    expect(isIncome(makeTxn({ amountPaise: 80_000, category: "lent" }))).toBe(false);
  });
});
