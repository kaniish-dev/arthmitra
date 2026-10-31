import { describe, expect, it } from "vitest";
import { sipFutureValue, sipNeeded } from "./allocation";
import { simulateGoal, yearOutlook } from "./montecarlo";

const R = (rupees: number) => rupees * 100;

describe("goal success probability (Monte Carlo)", () => {
  it("an all-FD plan has no market risk: certain when the SIP is enough, impossible when it isn't", () => {
    const fd = [{ type: "fd" as const, pct: 100 }];
    const needed = sipNeeded(R(1_00_000), 0, 12, 7);
    expect(simulateGoal({ allocation: fd, monthlyPaise: needed, months: 12, startPaise: 0, targetPaise: R(1_00_000) }).probability).toBe(1);
    expect(simulateGoal({ allocation: fd, monthlyPaise: needed / 2, months: 12, startPaise: 0, targetPaise: R(1_00_000) }).probability).toBe(0);
  });

  it("equity on a short timeline is a coin toss even at the 'needed' amount; time makes it likelier", () => {
    const eq = [{ type: "equity" as const, pct: 100 }];
    const short = simulateGoal({ allocation: eq, monthlyPaise: sipNeeded(R(1_00_000), 0, 12, 12), months: 12, startPaise: 0, targetPaise: R(1_00_000) });
    expect(short.probability).toBeGreaterThan(0.3);
    expect(short.probability).toBeLessThan(0.7);
    expect(short.p10Paise).toBeLessThan(short.p90Paise);
  });

  it("the typical (median) outcome sits near the straight-line projection", () => {
    const mix = [
      { type: "index" as const, pct: 50 },
      { type: "debt" as const, pct: 50 },
    ];
    const r = simulateGoal({ allocation: mix, monthlyPaise: R(10_000), months: 120, startPaise: 0, targetPaise: R(10_00_000) });
    const straight = sipFutureValue(R(10_000), 120, 9.25);
    expect(Math.abs(r.p50Paise - straight) / straight).toBeLessThan(0.08);
  });

  it("repeats exactly for the same seed", () => {
    const input = { allocation: [{ type: "index" as const, pct: 100 }], monthlyPaise: R(5_000), months: 60, startPaise: 0, targetPaise: R(4_00_000) };
    expect(simulateGoal(input)).toEqual(simulateGoal(input));
  });
});

describe("this year's outlook", () => {
  it("an FD plan has no chance of loss and a narrow range", () => {
    const o = yearOutlook({ allocation: [{ type: "fd", pct: 100 }], monthlyPaise: R(5_000), startPaise: 0, targetPaise: R(1_00_000), monthsLeft: 24, expectedReturnPct: 7 });
    expect(o.months).toBe(12);
    expect(o.paidInPaise).toBe(R(60_000));
    expect(o.lossProbability).toBe(0);
    expect(o.p90Paise - o.p10Paise).toBeLessThan(R(100));
  });

  it("an equity plan can end the year below what was paid in, and its range is wide", () => {
    const o = yearOutlook({ allocation: [{ type: "equity", pct: 100 }], monthlyPaise: R(5_000), startPaise: R(50_000), targetPaise: R(10_00_000), monthsLeft: 120, expectedReturnPct: 12 });
    expect(o.lossProbability).toBeGreaterThan(0.1);
    expect(o.p90Paise).toBeGreaterThan(o.p10Paise * 1.2);
  });

  it("a goal ending in 6 months is judged on those 6 months", () => {
    const o = yearOutlook({ allocation: [{ type: "rd", pct: 100 }], monthlyPaise: R(10_000), startPaise: 0, targetPaise: R(50_000), monthsLeft: 6, expectedReturnPct: 6.5 });
    expect(o.months).toBe(6);
    expect(o.onTrackPaise).toBe(R(50_000));
    expect(o.onTrackProbability).toBe(1);
  });
});
