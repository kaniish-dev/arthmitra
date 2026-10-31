import { describe, expect, it } from "vitest";
import { defaultCategories } from "./categories";
import {
  budgetLevel,
  budgetRows,
  futureValue,
  goalStatus,
  isOnTrack,
  projectedCompletion,
  projectionRange,
  requiredMonthlySaving,
  savingsCapacity,
  savingsRate,
  splitEqually,
  summariseMonth,
  topCutCategories,
} from "./finance";
import { makeTxn } from "./testing";

const R = (rupees: number) => rupees * 100;

describe("summariseMonth (income and spending rules)", () => {
  const txns = [
    makeTxn({ amountPaise: R(50_000), category: "income", date: "2026-10-01" }),
    makeTxn({ amountPaise: R(-12_000), category: "rent", date: "2026-10-03" }),
    makeTxn({ amountPaise: R(-450), category: "food", date: "2026-10-05" }),
    makeTxn({ amountPaise: R(200), category: "refund", date: "2026-10-06" }),
    makeTxn({ amountPaise: R(-5_000), isTransfer: true, category: "transfer", date: "2026-10-07" }),
    makeTxn({ amountPaise: R(5_000), isTransfer: true, category: "transfer", date: "2026-10-07", accountId: "acc2" }),
    makeTxn({ amountPaise: R(-6_000), isInvestment: true, category: "investment", date: "2026-10-08" }),
    makeTxn({ amountPaise: R(-1_200), category: null, status: "uncategorised", date: "2026-10-09" }),
    makeTxn({ amountPaise: R(-999), category: "food", date: "2026-09-30" }),
  ];
  const s = summariseMonth(txns, "2026-10");

  it("counts income without refunds, transfers or investments", () => {
    expect(s.incomePaise).toBe(R(50_000));
  });
  it("counts spending minus refunds, without transfers or investments", () => {
    expect(s.spendingPaise).toBe(R(12_000 + 450 + 1_200 - 200));
    expect(s.investedPaise).toBe(R(6_000));
  });
  it("groups by category and keeps uncategorised separate", () => {
    expect(s.byCategory).toEqual({ rent: R(12_000), food: R(450), uncategorised: R(1_200) });
  });
});

describe("capacity and rate", () => {
  it("capacity = income − fixed − variable", () => {
    expect(savingsCapacity(R(50_000), R(14_000), R(19_000))).toBe(R(17_000));
  });
  it("savings rate is null when income is 0", () => {
    expect(savingsRate(0, R(100))).toBeNull();
    expect(savingsRate(R(50_000), R(40_000))).toBeCloseTo(0.2);
  });
});

describe("requiredMonthlySaving", () => {
  it("divides what is left by months left and rounds up to ₹100", () => {
    expect(requiredMonthlySaving(R(240_000), R(6_000), 12)).toBe(R(19_500));
    expect(requiredMonthlySaving(R(240_000), R(6_000), 14)).toBe(R(16_800));
  });
  it("treats a past or current target date as one month", () => {
    expect(requiredMonthlySaving(R(10_000), 0, 0)).toBe(R(10_000));
  });
  it("is zero once the goal is funded", () => {
    expect(requiredMonthlySaving(R(10_000), R(12_000), 6)).toBe(0);
  });
});

describe("projectedCompletion and on-track", () => {
  it("adds whole months of contributions to today", () => {
    expect(projectedCompletion("2026-10-30", R(234_000), R(17_000))).toBe("2027-12-30");
  });
  it("shows no date when contribution is 0", () => {
    expect(projectedCompletion("2026-10-30", R(1_000), 0)).toBeNull();
  });
  it("on track means contribution ≥ required", () => {
    expect(isOnTrack(R(17_000), R(16_800))).toBe(true);
    expect(isOnTrack(R(17_000), R(19_500))).toBe(false);
  });
});

describe("goalStatus (demo script numbers)", () => {
  const goal = { targetPaise: R(240_000), targetDate: "2027-10-30", monthlyContributionPaise: null };
  it("12 months: ₹19,500 needed vs ₹17,000 capacity → behind by ₹2,500", () => {
    const s = goalStatus({ goal, savedPaise: R(6_000), capacityPaise: R(17_000), today: "2026-10-30" });
    expect(s.requiredPaise).toBe(R(19_500));
    expect(s.onTrack).toBe(false);
    expect(s.gapPaise).toBe(R(2_500));
    expect(s.progress).toBeCloseTo(0.025);
  });
  it("dragging the date out 2 months puts it on track", () => {
    const s = goalStatus({
      goal: { ...goal, targetDate: "2027-12-30" },
      savedPaise: R(6_000),
      capacityPaise: R(17_000),
      today: "2026-10-30",
    });
    expect(s.requiredPaise).toBe(R(16_800));
    expect(s.onTrack).toBe(true);
  });
});

describe("projection range", () => {
  it("is plain addition at 0%", () => {
    expect(futureValue(R(1_000), 12, 0, R(500))).toBe(R(12_500));
  });
  it("orders low and high and grows with the rate", () => {
    const r = projectionRange({ monthlyPaise: R(10_000), months: 12, lowPct: 8, highPct: 6, startingPaise: 0 });
    expect(r.lowPaise).toBeLessThan(r.highPaise);
    expect(r.lowPaise).toBeGreaterThan(R(120_000));
  });
});

describe("topCutCategories", () => {
  it("finds the two discretionary categories furthest over estimate", () => {
    const cuts = topCutCategories({
      estimates: { food: R(6_000), entertainment: R(1_500), shopping: R(2_500), rent: R(12_000) },
      actualByCategory: { food: R(7_500), entertainment: R(2_500), shopping: R(2_600), rent: R(15_000) },
      discretionary: ["food", "entertainment", "shopping", "travel"],
    });
    expect(cuts).toEqual([
      { category: "food", roomPaise: R(1_500), reason: "over_estimate" },
      { category: "entertainment", roomPaise: R(1_000), reason: "over_estimate" },
    ]);
  });
  it("falls back to a share of spend when nothing ran over", () => {
    const cuts = topCutCategories({
      estimates: { food: R(9_000) },
      actualByCategory: { food: R(5_000) },
      discretionary: ["food"],
    });
    expect(cuts).toEqual([{ category: "food", roomPaise: R(1_000), reason: "share_of_spend" }]);
  });
});

describe("budgets", () => {
  const categories = defaultCategories().map((c) => (c.id === "travel" ? { ...c, monthlyLimitPaise: 300_000 } : c));

  it("uses a set limit first, then the onboarding estimate, and skips categories with neither", () => {
    const rows = budgetRows(categories, { food: 600_000, travel: 250_000, shopping: 0 }, { food: 620_000, travel: 240_000, groceries: 90_000 });
    expect(rows).toEqual([
      { category: "food", spentPaise: 620_000, budgetPaise: 600_000, share: 620_000 / 600_000, level: "over", fromEstimate: true },
      { category: "travel", spentPaise: 240_000, budgetPaise: 300_000, share: 0.8, level: "near", fromEstimate: false },
    ]);
  });

  it("is near from 80% and over from 100%", () => {
    expect(budgetLevel(79_999, 100_000)).toBe("ok");
    expect(budgetLevel(80_000, 100_000)).toBe("near");
    expect(budgetLevel(100_000, 100_000)).toBe("over");
  });
});

describe("splitEqually", () => {
  it("adds up exactly, giving leftover paise to your share", () => {
    expect(splitEqually(120_000, 3)).toEqual([40_000, 40_000, 40_000]);
    expect(splitEqually(100_001, 3)).toEqual([33_335, 33_333, 33_333]);
    expect(splitEqually(45_000, 1)).toEqual([45_000]);
  });

  it("rejects fewer than one person", () => {
    expect(() => splitEqually(1_000, 0)).toThrow();
  });
});
