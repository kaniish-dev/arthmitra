import { describe, expect, it } from "vitest";
import type { Transaction } from "@arthmitra/schema";
import { averageByCategory, monthFlow, pastMonthFlows, realisticSaving } from "./savings";

const R = (rupees: number) => rupees * 100;
let n = 0;
function txn(date: string, rupees: number, category: string, extra: Partial<Transaction> = {}): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    accountId: "a",
    date,
    amountPaise: R(rupees),
    merchantRaw: category,
    merchantKey: category,
    category,
    confidence: 1,
    suggestions: [],
    status: "categorised",
    source: "bank",
    isTransfer: false,
    transferSuggested: false,
    isInvestment: false,
    goalId: null,
    billId: null,
    note: null,
    dedupeKey: `k${n}`,
    createdAt: "2026-10-01T00:00:00Z",
    ...extra,
  };
}

const month = (m: string, food: number) => [
  txn(`2026-${m}-01`, 50_000, "income"),
  txn(`2026-${m}-02`, -15_000, "rent"),
  txn(`2026-${m}-05`, -2_500, "emi"),
  txn(`2026-${m}-09`, -500, "subscriptions"),
  txn(`2026-${m}-10`, -food, "food"),
  txn(`2026-${m}-12`, -4_000, "shopping"),
];

describe("month flow", () => {
  it("splits fixed (rent, EMI, bills, subscriptions) from variable spending", () => {
    const f = monthFlow(month("08", 8_000), "2026-08");
    expect(f).toMatchObject({ incomePaise: R(50_000), spendingPaise: R(30_000), fixedPaise: R(18_000), variablePaise: R(12_000), leftPaise: R(20_000) });
  });

  it("ignores own-account transfers and investments", () => {
    const txns = [...month("08", 8_000), txn("2026-08-20", -5_000, "transfer", { isTransfer: true }), txn("2026-08-21", -3_000, "investment", { isInvestment: true })];
    expect(monthFlow(txns, "2026-08").spendingPaise).toBe(R(30_000));
  });
});

describe("realistic monthly saving", () => {
  const txns = [...month("07", 8_000), ...month("08", 12_000), ...month("09", 10_000), ...month("10", 2_000)];
  const flows = pastMonthFlows(txns, "2026-10-15");

  it("reads only complete months before this one", () => {
    expect(flows.map((f) => f.monthKey)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("is 80% of the average surplus, rounded down to ₹500", () => {
    // Surpluses 20,000 / 16,000 / 18,000 → average 18,000 → 80% = 14,400 → ₹14,000.
    const r = realisticSaving(flows);
    expect(r.averageSurplusPaise).toBe(R(18_000));
    expect(r.monthlyPaise).toBe(R(14_000));
    expect(r.monthsRead).toBe(3);
    expect(r.tightMonths).toBe(0);
  });

  it("is never negative when months run over", () => {
    const over = [...month("08", 40_000), ...month("09", 45_000)];
    expect(realisticSaving(pastMonthFlows(over, "2026-10-01")).monthlyPaise).toBe(0);
  });

  it("is zero with no history", () => {
    expect(realisticSaving([]).monthlyPaise).toBe(0);
  });

  it("averages spend per category, biggest first", () => {
    expect(averageByCategory(flows)[0]).toEqual({ category: "rent", paise: R(15_000) });
  });
});
