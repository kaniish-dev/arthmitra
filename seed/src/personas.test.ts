import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOCATION, monthKey, pastMonthFlows, realisticSaving } from "@arthmitra/engine";
import { mockHistory, mockHoldings, personaData } from "./personas";

const today = "2026-10-31";
const now = "2026-10-31T10:00:00.000Z";

describe("mock bank history", () => {
  it("returns the requested months plus this month so far, with salary, rent, EMI, subscriptions and UPI transfers", () => {
    const txns = mockHistory({ kind: "salaried", months: 6, today, accountId: "a", nowIso: now });
    expect(new Set(txns.map((t) => monthKey(t.date))).size).toBe(7);
    const cats = new Set(txns.map((t) => t.category));
    for (const c of ["income", "rent", "emi", "subscriptions", "food", "shopping", "travel", "others"]) expect(cats.has(c)).toBe(true);
    expect(txns.every((t) => t.date < today)).toBe(true);
  });

  it("is the same every time for the same month", () => {
    const a = mockHistory({ kind: "student", months: 3, today, accountId: "a", nowIso: now });
    const b = mockHistory({ kind: "student", months: 3, today, accountId: "a", nowIso: now });
    expect(a.map((t) => t.amountPaise)).toEqual(b.map((t) => t.amountPaise));
  });
});

describe("demo personas", () => {
  it("the salaried 24-year-old has own KYC and a positive realistic saving", () => {
    const d = personaData("adult", today, now, DEFAULT_ALLOCATION.returnsPct);
    expect(d.registration?.isMinor).toBe(false);
    expect(d.registration?.aadhaarLast4).toMatch(/^\d{4}$/);
    expect(d.registration?.guardian).toBeNull();
    expect(realisticSaving(pastMonthFlows(d.transactions, today)).monthlyPaise).toBeGreaterThan(0);
    expect(d.holdings.length).toBeGreaterThan(0);
  });

  it("the 16-year-old is linked to a guardian who did KYC, and tracks the guardian's account", () => {
    const d = personaData("minor", today, now, DEFAULT_ALLOCATION.returnsPct);
    expect(d.registration?.isMinor).toBe(true);
    expect(d.registration?.panMasked).toBeNull();
    expect(d.registration?.guardian?.aadhaarLast4).toBe("5678");
    expect(d.investmentAccounts[0]?.owner).toBe("guardian");
  });

  it("mock holdings follow each plan's mix", () => {
    const d = personaData("adult", today, now, DEFAULT_ALLOCATION.returnsPct);
    const h = mockHoldings({ account: { id: "x" }, goals: d.goals, returnsPct: DEFAULT_ALLOCATION.returnsPct, today, nowIso: now });
    expect(new Set(h.map((x) => x.goalId))).toEqual(new Set(["goal-car", "goal-wealth"]));
    expect(h.every((x) => x.amountInvestedPaise > 0)).toBe(true);
  });
});
