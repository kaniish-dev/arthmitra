import { DEFAULT_ALLOCATION, DEFAULT_TIMELINE, type AllocationConfig, type TimelineConfig } from "@arthmitra/engine";
import type { RiskComfort, Timeline } from "@arthmitra/schema";

/**
 * Plan settings. Edit here to change the timeline bands, the mix for each risk appetite,
 * the equity cap per timeline or the assumed annual returns shown to users.
 */
export const TIMELINE_CONFIG: TimelineConfig = DEFAULT_TIMELINE;

export const ALLOCATION_CONFIG: AllocationConfig = DEFAULT_ALLOCATION;

export const TIMELINE_COPY: Record<Timeline, { label: string; range: string; explainer: string }> = {
  short: { label: "Short term", range: "Under 3 years", explainer: "Need the money soon, so we keep it safe — no big market swings." },
  medium: { label: "Medium term", range: "3 to 7 years", explainer: "Some time to ride out ups and downs, so a balanced mix." },
  long: { label: "Long term", range: "Over 7 years", explainer: "Time is on your side — growth assets get room to compound." },
};

export const RISK_COPY: Record<RiskComfort, { label: string; meaning: string; examples: string; icon: string }> = {
  low: { label: "Low", meaning: "Stable, safe growth", examples: "FDs, RDs, gold, bonds, G-Secs, treasury bills", icon: "shield" },
  medium: { label: "Medium", meaning: "Balanced growth, some ups and downs", examples: "Debt or hybrid funds, index funds, gold", icon: "balance" },
  high: { label: "High", meaning: "Highest growth potential, most volatile", examples: "Equity mutual funds, index funds, direct stocks", icon: "rocket_launch" },
};

/** One-line explainers for finance terms used on plan screens. */
export const TERMS: Record<string, string> = {
  SIP: "Systematic Investment Plan — a fixed amount invested every month, automatically.",
  FD: "Fixed deposit — park money with a bank for a fixed time at a fixed rate.",
  RD: "Recurring deposit — a bank deposit you add to every month.",
  "G-Sec": "Government security — a loan you give to the Government of India.",
  "Index fund": "A fund that simply copies a market index like the Nifty 50, at low cost.",
  Equity: "Shares of companies — higher growth, bigger ups and downs.",
  "Passive income": "Money that comes in without you working for it, like interest or withdrawals from investments.",
};
