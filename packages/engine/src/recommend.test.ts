import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "./dates";
import { ILLUSTRATIVE_PRODUCTS, recommendSavings, type ProductTerms, type SavingsInput } from "./recommend";

const R = (rupees: number) => rupees * 100;
const today = "2026-11-01";

function input(over: Partial<SavingsInput> & { months?: number; days?: number }): SavingsInput {
  const { months, days, ...rest } = over;
  return {
    today,
    goalDate: days !== undefined ? addDays(today, days) : addMonths(today, months ?? 6),
    targetPaise: R(1_00_000),
    existingPaise: 0,
    lumpSumPaise: 0,
    recurringPaise: 0,
    frequency: "none",
    needsEarlyAccess: "no",
    canCommit: true,
    isEmergency: false,
    ...rest,
  };
}

const kinds = (lines: Array<{ product: ProductTerms }> | null) => (lines ?? []).map((l) => l.product.kind);
const run = (i: SavingsInput, products = ILLUSTRATIVE_PRODUCTS) => recommendSavings(i, products);

describe("₹5,000 a month", () => {
  const monthly = (months: number) => run(input({ months, recurringPaise: R(5_000), frequency: "monthly", targetPaise: R(5_000) * months }));

  it.each([1, 2, 3])("for %i month(s): a savings account — an RD's shortest tenure is 6 months, and an FD can't take monthly deposits", (m) => {
    const r = monthly(m);
    expect(r.intent).toBe("recurring");
    expect(kinds(r.primary)).toEqual(["savings"]);
    expect(r.rejected.find((x) => x.productId === "rd")?.reason).toMatch(/shortest tenure/);
    expect(r.rejected.find((x) => x.productId === "fd" && x.role === "recurring")?.reason).toMatch(/lump sum/);
    expect(r.achievable).toBe(true);
  });

  it.each([
    [6, "6 months"],
    [12, "1 year"],
    [24, "2 years"],
  ])("for %i months: an RD of %s, maturing by the goal date", (m, label) => {
    const r = monthly(m);
    expect(kinds(r.primary)).toEqual(["rd"]);
    expect(r.primary[0]!.tenureLabel).toBe(label);
    expect(r.primary[0]!.maturityDate! <= r.primary[0]!.maturityDate!).toBe(true);
    expect(r.primary[0]!.maturityDate).toBe(addMonths(today, m));
    expect(kinds(r.alternative)).toEqual(["savings"]);
  });

  it("never recommends an FD — and never a 5-year one — for monthly saving", () => {
    for (const m of [1, 2, 3, 6, 12, 24, 60]) {
      const r = monthly(m);
      expect(kinds(r.primary)).not.toContain("fd");
      expect(r.primary.some((l) => l.tenureLabel === "5 years")).toBe(m === 60);
    }
  });
});

describe("₹50,000 available today", () => {
  const lump = (o: { months?: number; days?: number }) => run(input({ ...o, lumpSumPaise: R(50_000), targetPaise: R(50_000) }));

  it.each([1, 2])("for %i month(s): kept liquid — a 1- or 2-month FD isn't chosen just because it exists", (m) => {
    const r = lump({ months: m });
    expect(r.intent).toBe("lump_sum");
    expect(kinds(r.primary)).toEqual(["savings"]);
    expect(kinds(r.primary)).not.toContain("fd");
    // The short FD is eligible, just ranked below keeping the money liquid.
    expect(r.rejected.find((x) => x.productId === "fd")).toBeUndefined();
    expect(kinds(r.alternative)).toEqual(["liquid"]);
  });

  it.each([
    [3, "91 days"],
    [6, "6 months"],
    [12, "1 year"],
    [24, "2 years"],
  ])("for %i months: an FD of %s that matures on or before the goal date", (m, label) => {
    const r = lump({ months: m });
    expect(kinds(r.primary)).toEqual(["fd"]);
    expect(r.primary[0]!.tenureLabel).toBe(label);
    expect(r.primary[0]!.maturityDate! <= addMonths(today, m)).toBe(true);
    expect(r.primary[0]!.tenureLabel).not.toBe("5 years");
  });
});

describe("mixed, emergency and edge cases", () => {
  it("₹50,000 today + ₹5,000 a month for 6 months: FD for the lump, RD for the monthly, both maturing by the goal", () => {
    const r = run(input({ months: 6, lumpSumPaise: R(50_000), recurringPaise: R(5_000), frequency: "monthly", targetPaise: R(80_000) }));
    expect(r.intent).toBe("mixed");
    expect(kinds(r.primary)).toEqual(["fd", "rd"]);
    expect(r.primary.every((l) => !l.maturityDate || l.maturityDate <= addMonths(today, 6))).toBe(true);
    expect(r.projectedPaise).toBe(R(80_000));
    expect(r.achievable).toBe(true);
  });

  it("keeps part of the lump sum liquid when the Crisis Cushion isn't full", () => {
    const r = run(input({ months: 6, lumpSumPaise: R(50_000), keepLiquidPaise: R(20_000), targetPaise: R(50_000) }));
    expect(r.primary.map((l) => [l.role, l.product.kind, l.amountPaise])).toEqual([
      ["buffer", "savings", R(20_000)],
      ["lump", "fd", R(30_000)],
    ]);
  });

  it("an emergency fund needing immediate access stays in a savings account; FD and RD are ruled out", () => {
    const r = run(input({ months: 12, isEmergency: true, needsEarlyAccess: "yes", lumpSumPaise: R(30_000), recurringPaise: R(3_000), frequency: "monthly" }));
    expect(r.intent).toBe("emergency");
    expect(kinds(r.primary).every((k) => k === "savings")).toBe(true);
    expect(r.rejected.filter((x) => x.productId === "fd" || x.productId === "rd").length).toBeGreaterThan(0);
  });

  it("a goal date before the shortest FD matures rules the FD out", () => {
    const longOnly: ProductTerms[] = ILLUSTRATIVE_PRODUCTS.map((p) => (p.kind === "fd" ? { ...p, tenureDays: [365, 730] } : p));
    const r = run(input({ months: 6, lumpSumPaise: R(50_000), targetPaise: R(50_000) }), longOnly);
    expect(kinds(r.primary)).not.toContain("fd");
    expect(r.rejected.find((x) => x.productId === "fd")?.reason).toMatch(/matures after your goal date/);
  });

  it("not enough monthly saving: shows the shortfall and options, without changing inputs", () => {
    const i = input({ months: 6, recurringPaise: R(5_000), frequency: "monthly", targetPaise: R(1_00_000) });
    const r = run(i);
    expect(r.achievable).toBe(false);
    expect(r.shortfallPaise).toBe(R(70_000));
    expect(r.requiredRecurringPaise).toBe(R(16_700));
    expect(r.suggestions.map((s) => s.kind)).toEqual(["increase_contribution", "extend_date", "reduce_goal", "add_savings"]);
    expect(i.recurringPaise).toBe(R(5_000));
  });

  it("a lump sum below the FD minimum isn't put in an FD", () => {
    const r = run(input({ months: 6, lumpSumPaise: R(500), targetPaise: R(500) }));
    expect(kinds(r.primary)).toEqual(["savings"]);
    expect(r.rejected.find((x) => x.productId === "fd")?.reason).toMatch(/at least ₹1,000/);
  });

  it("needing the money early rules out FD and RD with a penalty", () => {
    const r = run(input({ months: 12, lumpSumPaise: R(50_000), recurringPaise: R(5_000), frequency: "monthly", needsEarlyAccess: "yes", targetPaise: R(1_10_000) }));
    expect(kinds(r.primary)).toEqual(["savings", "savings"]);
    expect(r.rejected.map((x) => x.productId)).toEqual(expect.arrayContaining(["fd", "rd"]));
  });

  it("irregular income: no RD (fixed instalments), save into a flexible account", () => {
    const r = run(input({ months: 12, recurringPaise: R(5_000), frequency: "irregular", targetPaise: R(60_000) }));
    expect(r.intent).toBe("periodic");
    expect(kinds(r.primary)).toEqual(["savings"]);
    expect(r.rejected.find((x) => x.productId === "rd")?.reason).toMatch(/irregular/);
  });

  it("no reliable rates: labelled illustrative, and no maturity value is invented", () => {
    const r = run(input({ months: 12, lumpSumPaise: R(50_000), targetPaise: R(50_000) }));
    expect(r.illustrative).toBe(true);
    expect(r.primary.every((l) => l.estimatedMaturityPaise === null)).toBe(true);
    expect(r.notes.join(" ")).toMatch(/illustrative/);
  });

  it("an unavailable product is never recommended", () => {
    const noRd = ILLUSTRATIVE_PRODUCTS.map((p) => (p.kind === "rd" ? { ...p, available: false } : p));
    const r = run(input({ months: 12, recurringPaise: R(5_000), frequency: "monthly", targetPaise: R(60_000) }), noRd);
    expect(kinds(r.primary)).toEqual(["savings"]);
    expect(r.rejected.find((x) => x.productId === "rd")?.reason).toMatch(/Not available/);
  });

  it("with real provider rates, a maturity value is estimated", () => {
    const real = ILLUSTRATIVE_PRODUCTS.map((p) => (p.kind === "fd" ? { ...p, ratePct: 7, source: "provider" as const } : p));
    const r = run(input({ months: 12, lumpSumPaise: R(50_000), targetPaise: R(50_000) }), real);
    expect(r.primary[0]!.estimatedMaturityPaise).toBeGreaterThan(R(53_000));
  });

  it("an 8-month goal: a 6-month RD, then the last 2 months in savings", () => {
    const r = run(input({ months: 8, recurringPaise: R(5_000), frequency: "monthly", targetPaise: R(40_000) }));
    expect(r.primary.map((l) => [l.product.kind, l.instalments])).toEqual([
      ["rd", 6],
      ["savings", 2],
    ]);
  });
});
