import { describe, expect, it } from "vitest";
import { navMetrics, researchWindow, shortlistFunds, type NavPoint, type ResearchFund } from "./research";

/** Daily NAVs (weekdays) growing at `annualPct` from `start` for `years`. */
function series(annualPct: number, years: number, wobble = 0, end = "2026-10-30"): NavPoint[] {
  const out: NavPoint[] = [];
  const endT = Date.parse(`${end}T00:00:00Z`);
  const days = Math.round(years * 365.25);
  for (let i = days; i >= 0; i--) {
    const d = new Date(endT - i * 86_400_000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const t = (days - i) / 365.25;
    const nav = 10 * Math.pow(1 + annualPct / 100, t) * (1 + wobble * Math.sin(i / 3));
    out.push({ date: d.toISOString().slice(0, 10), nav });
  }
  return out;
}

const fund = (code: number, metrics: Partial<ResearchFund["metrics"]>, terPct: number | null): ResearchFund => ({
  code,
  name: `Fund ${code}`,
  amc: "AMC",
  kind: "Fund",
  terPct,
  terDate: "2026-10-30",
  metrics: { cagr1y: 10, cagr3y: 12, cagr5y: 13, volatilityPct: 14, maxDrawdownPct: 15, historyYears: 6, nav: 100, navDate: "2026-10-30", ...metrics },
});

describe("NAV metrics", () => {
  it("recovers a steady growth rate as CAGR over 1, 3 and 5 years", () => {
    const m = navMetrics(series(12, 6))!;
    expect(m.cagr1y).toBeCloseTo(12, 0);
    expect(m.cagr3y).toBeCloseTo(12, 0);
    expect(m.cagr5y).toBeCloseTo(12, 0);
    expect(m.historyYears).toBeCloseTo(6, 0);
    expect(m.maxDrawdownPct).toBe(0);
  });

  it("leaves windows longer than the history empty instead of guessing", () => {
    const m = navMetrics(series(8, 2))!;
    expect(m.cagr1y).not.toBeNull();
    expect(m.cagr3y).toBeNull();
    expect(m.cagr5y).toBeNull();
  });

  it("measures a fall from the peak and more volatility for a bumpier fund", () => {
    const calm = navMetrics(series(10, 4, 0.001))!;
    const bumpy = navMetrics(series(10, 4, 0.03))!;
    expect(bumpy.volatilityPct!).toBeGreaterThan(calm.volatilityPct!);
    expect(bumpy.maxDrawdownPct!).toBeGreaterThan(calm.maxDrawdownPct!);
  });

  it("ignores bad points and needs at least two", () => {
    expect(navMetrics([{ date: "2026-10-30", nav: 10 }])).toBeNull();
    expect(navMetrics([...series(10, 2), { date: "bad", nav: 5 }, { date: "2026-10-31", nav: 0 }])!.navDate).toBe("2026-10-30");
  });
});

describe("category shortlist", () => {
  it("judges goals under 3 years on the last year", () => {
    expect(researchWindow(24)).toBe("1y");
    expect(researchWindow(36)).toBe("3y");
  });

  it("index funds rank on cost and return only: the cheapest, best-tracking fund leads", () => {
    const funds = [fund(1, { cagr3y: 12.1 }, 0.2), fund(2, { cagr3y: 12.4, volatilityPct: 30 }, 0.05), fund(3, { cagr3y: 11.8 }, 0.6)];
    const r = shortlistFunds(funds, { criteria: { trackingOnly: true, minYears: 3 }, monthsLeft: 60, risk: "medium" });
    expect(r.funds.map((f) => f.code)).toEqual([2, 1, 3]);
    expect(r.funds[0]!.reasons[0]).toBe("3-year CAGR 12.40% vs peer median 12.10%");
  });

  it("short goals weigh steadiness: a calmer fund beats a slightly higher return", () => {
    const funds = [fund(1, { cagr1y: 9, volatilityPct: 25, maxDrawdownPct: 20 }, 0.5), fund(2, { cagr1y: 8.5, volatilityPct: 8, maxDrawdownPct: 5 }, 0.5), fund(3, { cagr1y: 7 }, 0.5)];
    const r = shortlistFunds(funds, { criteria: { minYears: 3 }, monthsLeft: 18, risk: "low" });
    expect(r.window).toBe("1y");
    expect(r.funds[0]!.code).toBe(2);
  });

  it("drops funds without enough history, and every reason quotes the peer median", () => {
    const funds = [fund(1, { historyYears: 2 }, 0.1), fund(2, {}, 0.3), fund(3, {}, 0.4)];
    const r = shortlistFunds(funds, { criteria: { minYears: 3 }, monthsLeft: 60, risk: "high" });
    expect(r.peers.count).toBe(2);
    expect(r.funds.some((f) => f.code === 1)).toBe(false);
    expect(r.funds[0]!.reasons.slice(0, 3).every((x) => x.includes("peer median"))).toBe(true);
  });
});
