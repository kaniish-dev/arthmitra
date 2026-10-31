import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOCATION,
  allocate,
  blendedReturnPct,
  buildPlan,
  practicalSplit,
  equityPct,
  passiveIncomeMonthly,
  sipFutureValue,
  sipNeeded,
  timelineFor,
  wealthTarget,
} from "./allocation";

const R = (rupees: number) => rupees * 100;
const total = (lines: Array<{ pct: number }>) => lines.reduce((s, l) => s + l.pct, 0);

describe("timeline mapping", () => {
  it("under 3 years is short, 3 to 7 is medium, over 7 is long", () => {
    expect(timelineFor(6)).toBe("short");
    expect(timelineFor(35)).toBe("short");
    expect(timelineFor(36)).toBe("medium");
    expect(timelineFor(84)).toBe("medium");
    expect(timelineFor(85)).toBe("long");
    expect(timelineFor(240)).toBe("long");
  });

  it("follows an edited config", () => {
    const cfg = { shortBelowMonths: 24, longAboveMonths: 60, wealthYears: { short: 5, medium: 10, long: 15 } };
    expect(timelineFor(30, cfg)).toBe("medium");
    expect(timelineFor(61, cfg)).toBe("long");
  });
});

describe("allocation mapping", () => {
  it("low risk uses only safe instruments: FDs, RDs, gold, bonds, G-Secs, T-bills", () => {
    const lines = allocate("low", "long", DEFAULT_ALLOCATION, "lump");
    expect(total(lines)).toBe(100);
    expect(lines.map((l) => l.type).sort()).toEqual(["bonds", "fd", "gold", "gsec", "rd", "tbill"]);
    expect(equityPct(lines)).toBe(0);
  });

  it("a monthly plan never gets an FD: its share goes to a recurring deposit", () => {
    for (const risk of ["low", "medium", "high"] as const) {
      for (const tl of ["short", "medium", "long"] as const) {
        const lines = allocate(risk, tl);
        expect(lines.map((l) => l.type)).not.toContain("fd");
        expect(total(lines)).toBe(100);
      }
    }
    expect(allocate("low", "long").find((l) => l.type === "rd")?.pct).toBe(50);
  });

  it("medium risk mixes debt/hybrid funds, index funds, gold and some FD/RD", () => {
    const lines = allocate("medium", "long");
    expect(total(lines)).toBe(100);
    expect(lines.map((l) => l.type)).toEqual(expect.arrayContaining(["debt", "hybrid", "index", "gold", "rd"]));
    expect(allocate("medium", "long", DEFAULT_ALLOCATION, "lump").map((l) => l.type)).toContain("fd");
  });

  it("high risk on a long timeline is all equity: equity funds, index funds, direct stocks", () => {
    const lines = allocate("high", "long");
    expect(lines).toEqual([
      { type: "equity", pct: 50 },
      { type: "index", pct: 30 },
      { type: "stocks", pct: 20 },
    ]);
  });

  it("short timelines cap equity even when risk is high", () => {
    const lines = allocate("high", "short");
    expect(total(lines)).toBe(100);
    expect(equityPct(lines)).toBeLessThanOrEqual(DEFAULT_ALLOCATION.equityCapPct.short);
    // Monthly: the safe 80% all goes to RDs. With a lump sum it splits between RD and FD.
    expect(lines.find((l) => l.type === "rd")?.pct).toBe(80);
    const lump = allocate("high", "short", DEFAULT_ALLOCATION, "lump");
    expect(lump.find((l) => l.type === "fd")?.pct).toBe(40);
    expect(lump.find((l) => l.type === "rd")?.pct).toBe(40);
  });

  it("a medium timeline caps high risk at 60% equity, moving the rest to debt and G-Secs", () => {
    const lines = allocate("high", "medium");
    expect(total(lines)).toBe(100);
    expect(Math.round(equityPct(lines))).toBe(60);
    expect(lines.map((l) => l.type)).toEqual(expect.arrayContaining(["debt", "gsec"]));
  });

  it("blends the assumed returns by weight", () => {
    expect(blendedReturnPct([{ type: "fd", pct: 50 }, { type: "index", pct: 50 }])).toBe(9);
  });
});

describe("projection", () => {
  it("a SIP with no return is just the sum paid in", () => {
    expect(sipFutureValue(R(1_000), 12, 0)).toBe(R(12_000));
  });

  it("the SIP needed reaches the target", () => {
    const needed = sipNeeded(R(2_40_000), 0, 24, 7);
    expect(sipFutureValue(needed, 24, 7)).toBeGreaterThanOrEqual(R(2_40_000));
    expect(needed).toBeLessThan(R(10_000));
    expect(needed % R(100)).toBe(0);
  });

  it("money already saved lowers the SIP, and enough saved needs nothing", () => {
    expect(sipNeeded(R(1_00_000), R(50_000), 12, 7)).toBeLessThan(sipNeeded(R(1_00_000), 0, 12, 7));
    expect(sipNeeded(R(1_00_000), R(1_00_000), 12, 7)).toBe(0);
  });
});

describe("wealth generator", () => {
  it("targets 25× yearly expenses and pays 4% a year back as income", () => {
    expect(wealthTarget(R(30_000))).toBe(R(90_00_000));
    expect(passiveIncomeMonthly(R(90_00_000))).toBe(R(30_000));
  });
});

describe("buildPlan", () => {
  it("defaults the monthly amount to what is needed when affordable, and is on track", () => {
    const p = buildPlan({ targetPaise: R(3_00_000), savedPaise: 0, monthsLeft: 24, risk: "low", timeline: "short", affordablePaise: R(20_000) });
    expect(p.monthlyPaise).toBe(p.requiredPaise);
    expect(p.onTrack).toBe(true);
    expect(p.split.reduce((s, l) => s + l.paise, 0)).toBe(p.monthlyPaise);
  });

  it("caps the monthly amount at the realistic saving and reports the shortfall", () => {
    const p = buildPlan({ targetPaise: R(10_00_000), savedPaise: 0, monthsLeft: 24, risk: "medium", timeline: "short", affordablePaise: R(15_000) });
    expect(p.monthlyPaise).toBe(R(15_000));
    expect(p.onTrack).toBe(false);
    expect(p.shortfallPaise).toBe(p.requiredPaise - R(15_000));
  });
});

describe("practical monthly split", () => {
  const mix = [
    { type: "rd" as const, pct: 50 },
    { type: "gsec" as const, pct: 20 },
    { type: "tbill" as const, pct: 10 },
    { type: "bonds" as const, pct: 10 },
    { type: "gold" as const, pct: 10 },
  ];
  it("keeps every line when each gets at least ₹500", () => {
    const s = practicalSplit(mix, R(10_000));
    expect(s.map((l) => l.type)).toEqual(["rd", "gsec", "tbill", "bonds", "gold"]);
    expect(s.reduce((a, l) => a + l.paise, 0)).toBe(R(10_000));
  });

  it("folds ₹150 slices into the bigger lines for a small monthly amount", () => {
    const s = practicalSplit(mix, R(1_500));
    expect(s.every((l) => l.paise >= R(500))).toBe(true);
    expect(s.reduce((a, l) => a + l.paise, 0)).toBe(R(1_500));
    expect(s.reduce((a, l) => a + l.pct, 0)).toBe(100);
  });

  it("puts a tiny amount all in one line", () => {
    expect(practicalSplit(mix, R(400))).toEqual([{ type: "rd", pct: 100, paise: R(400) }]);
  });
});
