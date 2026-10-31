import { describe, expect, it } from "vitest";
import { flowChecks, flowLevel, flowScore, perfectMonthStreak } from "./flow";
import { cushionMonths, emergencyPlan, nextSteps, planForMoney, type MoneyStructure, type StepInput } from "./plan";

const R = (rupees: number) => rupees * 100;

// Rohit-like: ₹20,500 of essentials a month, so the cushion target is ₹61,500.
const base: MoneyStructure = {
  balancePaise: R(45_000),
  essentialsPaise: R(20_500),
  extrasPaise: R(12_500),
  billsDuePaise: R(2_000),
  goalSavingPaise: R(17_000),
  goalName: "Car down payment",
  goalGapPaise: R(2_500),
  owedToYouPaise: R(800),
};

describe("money structure", () => {
  it("counts cushion months after bills due soon", () => {
    expect(cushionMonths(base)).toBe(2.0); // (45,000 − 2,000) ÷ 20,500 = 2.09 → 2.0
    expect(cushionMonths({ ...base, essentialsPaise: 0 })).toBeNull();
  });

  it("sends returned money to bills, then the cushion, then the goal, then you", () => {
    expect(planForMoney(R(800), base)).toEqual([{ kind: "cushion", paise: R(800) }]);
    const broke = { ...base, balancePaise: R(500) };
    expect(planForMoney(R(5_000), broke)).toEqual([
      { kind: "bills", paise: R(1_500) },
      { kind: "cushion", paise: R(3_500) },
    ]);
    const rich = { ...base, balancePaise: R(100_000) };
    expect(planForMoney(R(10_050), rich)).toEqual([
      { kind: "goal", paise: R(8_000) },
      { kind: "you", paise: R(2_050) },
    ]);
    expect(planForMoney(R(10_000), { ...rich, goalName: null })).toEqual([{ kind: "you", paise: R(10_000) }]);
  });

  it("adds up every allocation to the amount", () => {
    for (const amount of [R(1), R(800), R(25_000), R(250_000)]) {
      expect(planForMoney(amount, base).reduce((s, a) => s + a.paise, 0)).toBe(amount);
    }
  });

  it("works out how long money lasts in an emergency", () => {
    const e = emergencyPlan(base, { freeNowPaise: R(0), lockedPaise: R(6_000) });
    expect(e.availablePaise).toBe(R(43_000));
    expect(e.monthsCovered).toBe(2.0);
    expect(e.pauseGoalPaise).toBe(R(17_000));
    expect(e.monthsWithEverything).toBe(2.1); // (43,000 + 800) ÷ 20,500
  });
});

describe("next steps", () => {
  const calm: StepInput = {
    emergencyMode: false,
    recentReturn: null,
    nextBill: null,
    overdue: [],
    uncategorised: 0,
    worstOver: null,
    cushionMonths: 4,
    goal: { name: "Car", gapPaise: 0, onTrack: true },
    savedThisMonth: true,
  };

  it("puts the most urgent first and stops at three", () => {
    const steps = nextSteps({
      ...calm,
      recentReturn: { person: "Ramesh", amountPaise: R(800) },
      nextBill: { name: "Rent", amountPaise: R(12_000), dueEn: "Due in 4 days", dueHi: "4 दिन में" },
      overdue: [{ person: "Priya", outstandingPaise: R(1_500) }],
      uncategorised: 2,
    });
    expect(steps.map((s) => s.kind)).toEqual(["money_back", "bill", "lent"]);
    expect(steps[0]!.title.en).toBe("₹800 is back from Ramesh");
  });

  it("leads with the emergency and hides goal nudges while it is on", () => {
    const steps = nextSteps({ ...calm, emergencyMode: true, goal: { name: "Car", gapPaise: R(2_500), onTrack: false } });
    expect(steps.map((s) => s.kind)).toEqual(["emergency"]);
  });

  it("asks for the month's saving when nothing else is due", () => {
    expect(nextSteps({ ...calm, savedThisMonth: false }).map((s) => s.kind)).toEqual(["save"]);
    expect(nextSteps(calm)).toEqual([]);
  });
});

describe("monthly flow", () => {
  it("scores four habits at 25 points each", () => {
    const checks = flowChecks({ uncategorised: 0, overBudget: 1, investedPaise: R(6_000), overdueLoans: 0 });
    expect(checks.filter((c) => !c.met).map((c) => c.id)).toEqual(["budgets"]);
    expect(flowScore(checks)).toBe(75);
  });

  it("counts perfect months in a row and the level they reach", () => {
    const perfect = flowChecks({ uncategorised: 0, overBudget: 0, investedPaise: 1, overdueLoans: 0 });
    const miss = flowChecks({ uncategorised: 1, overBudget: 0, investedPaise: 1, overdueLoans: 0 });
    expect(perfectMonthStreak([perfect, perfect, miss, perfect])).toBe(2);
    expect(flowLevel(0)).toEqual({ name: "Starter", next: "Steady", monthsToNext: 1 });
    expect(flowLevel(2)).toEqual({ name: "Steady", next: "Strong", monthsToNext: 1 });
    expect(flowLevel(7)).toEqual({ name: "Champion", next: null, monthsToNext: 0 });
  });
});
