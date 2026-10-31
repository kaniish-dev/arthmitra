import { describe, expect, it } from "vitest";
import { CHECKLIST, rankFits, scoreFit } from "./picker";
import { INSTRUMENTS } from "./instruments";

describe("best-fit picker", () => {
  it("a short goal with a monthly saving and low risk ranks the RD first", () => {
    const top = rankFits({ monthsLeft: 9, risk: "low", monthly: true, isMinor: false });
    expect(top[0]!.type).toBe("rd");
    expect(top[0]!.reasons).toContain("Built for a fixed monthly deposit");
  });

  it("a long goal at high risk ranks equity categories first", () => {
    const top = rankFits({ monthsLeft: 180, risk: "high", monthly: true, isMinor: false }).slice(0, 2);
    expect(top.map((f) => f.type).every((t) => ["equity", "index"].includes(t))).toBe(true);
  });

  it("flags equity as too volatile for a goal this close", () => {
    const f = scoreFit("equity", { monthsLeft: 10, risk: "high", monthly: true, isMinor: false });
    expect(f.caution).toBe("Too volatile for a goal this close");
  });

  it("pushes direct stocks down for a minor", () => {
    const adult = scoreFit("stocks", { monthsLeft: 120, risk: "high", monthly: true, isMinor: false });
    const minor = scoreFit("stocks", { monthsLeft: 120, risk: "high", monthly: true, isMinor: true });
    expect(minor.score).toBeLessThan(adult.score);
    expect(minor.caution).toMatch(/guardian/);
  });

  it("has a checklist for every category and never names a provider", () => {
    for (const t of Object.keys(INSTRUMENTS)) {
      const items = CHECKLIST[t as keyof typeof CHECKLIST];
      expect(items.length).toBeGreaterThan(1);
      expect(items.join(" ")).not.toMatch(/\b(sbi|hdfc|icici|zerodha|groww|axis|kotak)\b/i);
    }
  });
});

describe("best-fit picker: hard constraints", () => {
  it("never ranks an FD for a monthly saver with no lump sum", () => {
    for (const monthsLeft of [3, 9, 18, 36, 60]) {
      expect(rankFits({ monthsLeft, risk: "low", monthly: true, isMinor: false }).map((f) => f.type)).not.toContain("fd");
    }
  });

  it("ranks an FD when there is money available today", () => {
    expect(rankFits({ monthsLeft: 9, risk: "low", monthly: true, isMinor: false, lumpSumPaise: 5_000_000 }).map((f) => f.type)).toContain("fd");
  });
});
