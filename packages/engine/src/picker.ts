import type { InstrumentType, RiskComfort } from "@arthmitra/schema";
import { INSTRUMENTS, horizonBand } from "./instruments";

/**
 * Best-fit picker: scores every instrument category for one goal and explains why. A transparent
 * rule, not a black box — horizon, risk appetite, monthly saving, access to money and deposit
 * insurance. It ranks categories only; it never names a bank, fund or platform.
 */

const RISK_LEVEL: Record<(typeof INSTRUMENTS)[InstrumentType]["risk"], number> = { Low: 0, "Low to moderate": 1, Moderate: 2, High: 3 };
const USER_LEVEL: Record<RiskComfort, number> = { low: 0.5, medium: 1.5, high: 3 };

/** Categories you can add to every month (an RD, or a SIP into a fund). */
const MONTHLY = new Set<InstrumentType>(["rd", "liquid", "short_debt", "debt", "hybrid", "index", "equity", "gold", "savings"]);
/** Bank deposits, insured by DICGC up to ₹5 lakh per bank. */
const INSURED = new Set<InstrumentType>(["fd", "rd", "savings"]);
/** Money reachable within days without a big penalty. */
const QUICK_ACCESS = new Set<InstrumentType>(["savings", "liquid", "tbill"]);
/** Growth categories that need years to smooth out. */
const GROWTH = new Set<InstrumentType>(["index", "equity", "stocks", "hybrid"]);

export interface FitInput {
  monthsLeft: number;
  risk: RiskComfort;
  /** Saving monthly (most plans) rather than investing one lump sum. */
  monthly: boolean;
  /** Money available today for the goal; an FD needs a lump sum. */
  lumpSumPaise?: number;
  isMinor: boolean;
}

export interface Fit {
  type: InstrumentType;
  /** 0–100. */
  score: number;
  reasons: string[];
  /** Why it scored lower, when it did. */
  caution: string | null;
}

export function scoreFit(type: InstrumentType, i: FitInput): Fit {
  const info = INSTRUMENTS[type];
  const band = horizonBand(i.monthsLeft);
  const reasons: string[] = [];
  let caution: string | null = null;
  let score = 0;

  if (info.bands.includes(band)) {
    score += 35;
    reasons.push(i.monthsLeft < 12 ? "Suits money needed within a year" : i.monthsLeft <= 36 ? "Suits a 1–3 year goal" : "Suits a goal more than 3 years away");
  } else {
    caution = GROWTH.has(type) && i.monthsLeft <= 36 ? "Too volatile for a goal this close" : "Not ideal for this time frame";
  }

  const gap = Math.abs(RISK_LEVEL[info.risk] - USER_LEVEL[i.risk]);
  score += Math.max(0, 25 - gap * 10);
  if (gap <= 0.5) reasons.push(`Matches your ${i.risk} risk appetite`);
  else if (RISK_LEVEL[info.risk] > USER_LEVEL[i.risk] + 1) caution ??= "Riskier than you're comfortable with";

  if (i.monthly && MONTHLY.has(type)) {
    score += 15;
    reasons.push(type === "rd" ? "Built for a fixed monthly deposit" : "You can add to it every month (SIP)");
  } else if (i.monthly) {
    score += 5;
    caution ??= "Better for a lump sum than a monthly saving";
  }

  if (i.monthsLeft < 12 && QUICK_ACCESS.has(type)) {
    score += 15;
    reasons.push("Money is easy to reach at short notice");
  } else if (i.monthsLeft < 12 && (type === "rd" || (type === "fd" && (i.lumpSumPaise ?? 0) > 0))) {
    score += 15;
    reasons.push("A tenure can be set to mature right when you need it");
  } else if (i.monthsLeft > 84 && GROWTH.has(type)) {
    score += 15;
    reasons.push("Time to ride out market ups and downs");
  } else if (i.monthsLeft >= 12 && i.monthsLeft <= 84 && !QUICK_ACCESS.has(type)) {
    score += 8;
  }

  if (INSURED.has(type) && USER_LEVEL[i.risk] < 2) {
    score += 10;
    reasons.push("Bank deposit insured up to ₹5 lakh (DICGC)");
  }

  if (i.isMinor && type === "stocks") {
    score -= 20;
    caution = "Needs a demat account run by your guardian";
  }

  return { type, score: Math.max(0, Math.min(100, Math.round(score))), reasons: reasons.slice(0, 3), caution };
}

/**
 * Every investment category ranked for the goal, best first. A savings account is where money
 * waits, not a plan, so it isn't ranked; an FD takes one lump sum, so it's left out for a
 * monthly-only saver (hard constraint, whatever its score).
 */
export function rankFits(i: FitInput): Fit[] {
  return (Object.keys(INSTRUMENTS) as InstrumentType[])
    .filter((t) => t !== "savings" && !(t === "fd" && i.monthly && !(i.lumpSumPaise ?? 0)))
    .map((t) => scoreFit(t, i))
    .sort((a, b) => b.score - a.score);
}

/** What to check before choosing a product in each category (on any bank or app). */
export const CHECKLIST: Record<InstrumentType, string[]> = {
  savings: ["Interest rate on your balance", "Minimum balance and its penalty", "Free UPI and ATM transactions"],
  fd: ["Interest rate for your exact tenure", "Penalty for breaking it early", "DICGC insured (up to ₹5 lakh per bank)", "Tax: interest is taxable; TDS above the limit"],
  rd: ["Interest rate for your tenure", "Penalty for a missed instalment", "Auto-debit date (set it the day after salary)", "DICGC insured (up to ₹5 lakh per bank)"],
  liquid: ["Expense ratio (lower is better)", "Exit load in the first 7 days", "Direct plan, not regular, for lower costs"],
  short_debt: ["Expense ratio", "Credit quality of the bonds it holds (AAA is safest)", "Exit load period"],
  debt: ["Expense ratio", "Credit quality (AAA / sovereign)", "Average maturity matches your goal", "Exit load"],
  bonds: ["Credit rating AAA only", "Yield to maturity, not just the coupon", "Can you sell before maturity (listed and liquid)?"],
  gsec: ["Yield for your tenure", "Buy through RBI Retail Direct or a regulated app", "Hold to maturity to avoid price swings"],
  tbill: ["Discount (yield) at the latest auction", "91, 182 or 364 days — match your need", "Buy through RBI Retail Direct"],
  hybrid: ["Equity share in the fund (aggressive vs balanced)", "Expense ratio, direct plan", "5-year track record vs its benchmark"],
  index: ["Tracking error (how closely it follows the index)", "Expense ratio — the lowest wins for the same index", "Direct plan"],
  equity: ["Expense ratio, direct plan", "5–10 year record vs its benchmark, not last year's return", "Fund size and manager tenure"],
  stocks: ["Keep it a small slice of the plan", "Spread across sectors", "Avoid tips; check the company's profits and debt"],
  gold: ["SEBI-regulated gold ETF or fund, not unregulated digital gold", "Expense ratio", "Tracking against the gold price"],
};
