import { describe, expect, it } from "vitest";
import { amountWithUnits, goalAsk, monthsInText } from "./coach-goals";

const R = (rupees: number) => rupees * 100;
const today = "2026-10-31";

describe("goals from a chat message", () => {
  it("reads amounts with k and lakh", () => {
    expect(amountWithUnits("a 40k trip")).toBe(R(40_000));
    expect(amountWithUnits("₹1,20,000 bike")).toBe(R(1_20_000));
    expect(amountWithUnits("1.5 lakh course")).toBe(R(1_50_000));
    expect(amountWithUnits("no money here")).toBeNull();
  });

  it("reads months, years and month names", () => {
    expect(monthsInText("in the next 3 months", today)).toBe(3);
    expect(monthsInText("in 2 years", today)).toBe(24);
    expect(monthsInText("a trip in March", today)).toBe(5);
  });

  it("turns 'refrigerator in the next 3 months' into a small goal", () => {
    const g = goalAsk("I wish to take a refrigerator worth 30k as well in the next 3 months", today)!;
    expect(g).toMatchObject({ name: "Refrigerator", amountPaise: R(30_000), months: 3, monthlyPaise: R(10_000), targetDate: "2027-01-31" });
  });

  it("sizes 'Can I afford a 40k trip in March?'", () => {
    const g = goalAsk("Can I afford a 40k trip in March?", today)!;
    expect(g.name).toBe("Trip");
    expect(g.amountPaise).toBe(R(40_000));
    expect(g.months).toBe(5);
    expect(g.monthlyPaise).toBe(R(8_000));
  });

  it("needs an amount", () => {
    expect(goalAsk("I want a fridge in 3 months", today)).toBeNull();
  });
});
