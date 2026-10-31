import { addDays, addMonths, daysBetween, monthsBetween } from "./dates";
import { roundUpTo } from "./money";

/**
 * Goal-based savings recommendation: decides HOW to hold money for a goal — mode (lump sum,
 * monthly, periodic, mixed), product (savings account, liquid fund, FD, RD or a combination),
 * tenure and amount — from the user's real situation and the provider's actual product terms.
 *
 * 1. Classify the intent (recurring, lump sum, periodic, mixed, emergency; goal-based when there
 *    is a target and a date).
 * 2. Apply hard constraints per product: availability, minimum deposit, a tenure that matures on or
 *    before the goal date, deposit frequency, ability to commit, and early-access needs. A product
 *    that fails any of them is never ranked, whatever its score.
 * 3. Rank the eligible products for each part of the money (what is available today, and what is
 *    saved every period) with a suitability score, and explain the choice.
 * 4. Check achievability on principal only: interest never makes an insufficient plan "work".
 *    Show the shortfall and options, without changing any input.
 *
 * No bank-specific terms are hard-coded here: products come in as data (see the catalogue in
 * apps/web/src/config/products.ts). Without reliable rates, no maturity value is shown.
 */

export type ProductKind = "savings" | "liquid" | "fd" | "rd";
export type Frequency = "monthly" | "weekly" | "quarterly" | "irregular" | "none";
export type EarlyNeed = "yes" | "no" | "unsure";

/** One product's actual terms, from a provider (or an illustrative catalogue, clearly labelled). */
export interface ProductTerms {
  id: string;
  kind: ProductKind;
  label: string;
  available: boolean;
  /** FD: tenures offered, in days. */
  tenureDays?: number[];
  /** RD: tenures offered, in months. */
  tenureMonths?: number[];
  /** FD: minimum one-time deposit. RD: minimum per instalment. Savings/liquid: minimum to start. */
  minDepositPaise: number;
  /** Annual rate in percent, or null when there is no reliable rate. */
  ratePct: number | null;
  /** Taking money out before maturity. */
  premature: "free" | "penalty" | "not_allowed";
  /** Days to get money out normally (0 = same day). */
  accessDays: number;
  /** Rule text the user should read, e.g. an RD's missed-instalment rule. */
  rules: string[];
  source: "provider" | "illustrative";
}

export interface SavingsInput {
  today: string;
  goalDate: string;
  targetPaise: number;
  /** Savings already set aside for this goal. */
  existingPaise: number;
  /** Money available today to put towards the goal. */
  lumpSumPaise: number;
  /** Amount saved each period (see frequency). */
  recurringPaise: number;
  frequency: Frequency;
  needsEarlyAccess: EarlyNeed;
  /** Can keep to a fixed deposit every period. */
  canCommit: boolean;
  isEmergency: boolean;
  /** Part of the lump sum to keep instantly available (e.g. what the Crisis Cushion still lacks). */
  keepLiquidPaise?: number;
}

export type Intent = "recurring" | "lump_sum" | "periodic" | "mixed" | "emergency";

export interface PlanLine {
  role: "lump" | "recurring" | "buffer";
  product: ProductTerms;
  /** Lump/buffer: the amount. Recurring: the amount per period. */
  amountPaise: number;
  frequency: Frequency | "once";
  /** e.g. "6 months", "90 days", "No fixed term". */
  tenureLabel: string;
  maturityDate: string | null;
  /** Number of instalments, for recurring lines. */
  instalments: number;
  /** Principal that goes in over the line's life. */
  principalPaise: number;
  /** Only with a reliable provider rate; otherwise null. */
  estimatedMaturityPaise: number | null;
  liquidity: string;
  ifNeededEarly: string;
  why: string[];
}

export interface Rejection {
  productId: string;
  label: string;
  role: "lump" | "recurring";
  reason: string;
}

export interface Suggestion {
  kind: "increase_contribution" | "extend_date" | "reduce_goal" | "add_savings";
  text: string;
}

export interface SavingsRecommendation {
  intent: Intent;
  goalBased: boolean;
  /** Short label for the screen, e.g. "Lump sum + monthly". */
  modeLabel: string;
  horizonDays: number;
  horizonMonths: number;
  /** Contributions that fit before the goal date. */
  periods: number;
  /** Per-period amount needed, after existing savings and the lump sum. */
  requiredRecurringPaise: number;
  /** Principal by the goal date: existing + lump sum + all contributions. */
  projectedPaise: number;
  shortfallPaise: number;
  achievable: boolean;
  suggestions: Suggestion[];
  primary: PlanLine[];
  alternative: PlanLine[] | null;
  rejected: Rejection[];
  /** True when any line relies on illustrative (not provider) data. */
  illustrative: boolean;
  notes: string[];
}

const DAY_MS_LABEL = (days: number) => (days % 365 === 0 ? `${days / 365} year${days === 365 ? "" : "s"}` : days % 30 === 0 && days < 365 ? `${days / 30} month${days === 30 ? "" : "s"}` : `${days} days`);
const MONTH_LABEL = (m: number) => (m % 12 === 0 ? `${m / 12} year${m === 12 ? "" : "s"}` : `${m} months`);

export function classifyIntent(i: Pick<SavingsInput, "isEmergency" | "lumpSumPaise" | "recurringPaise" | "frequency">): Intent {
  if (i.isEmergency) return "emergency";
  const recurring = i.recurringPaise > 0 && i.frequency !== "none";
  if (i.lumpSumPaise > 0 && recurring) return "mixed";
  if (i.lumpSumPaise > 0) return "lump_sum";
  if (recurring && i.frequency === "monthly") return "recurring";
  return "periodic";
}

/** Contributions that happen on or before the goal date, starting today. */
export function contributionPeriods(frequency: Frequency, today: string, goalDate: string): number {
  const days = Math.max(0, daysBetween(today, goalDate));
  const months = Math.max(0, monthsBetween(today, goalDate));
  switch (frequency) {
    case "none":
      return 0;
    case "weekly":
      return Math.max(1, Math.floor(days / 7));
    case "quarterly":
      return Math.max(1, Math.floor(months / 3));
    case "monthly":
    case "irregular":
      return Math.max(1, months);
  }
}

/** Quarterly compounding, the usual Indian bank convention; only used with a reliable rate. */
function fdMaturity(principal: number, ratePct: number, days: number): number {
  return Math.round(principal * Math.pow(1 + ratePct / 400, (4 * days) / 365));
}
function rdMaturity(instalment: number, ratePct: number, months: number): number {
  let total = 0;
  for (let k = 0; k < months; k++) total += fdMaturity(instalment, ratePct, ((months - k) * 365) / 12);
  return Math.round(total);
}

const PREMATURE_TEXT: Record<ProductTerms["premature"], string> = {
  free: "You can take it out early without a penalty.",
  penalty: "You can break it early, but you get a lower rate and may pay a penalty — check the provider's rule.",
  not_allowed: "You can't take it out before maturity.",
};

interface Candidate {
  line: PlanLine;
  score: number;
}

function liquidLine(p: ProductTerms, role: PlanLine["role"], amountPaise: number, frequency: Frequency | "once", instalments: number, why: string[]): PlanLine {
  return {
    role,
    product: p,
    amountPaise,
    frequency,
    tenureLabel: "No fixed term",
    maturityDate: null,
    instalments,
    principalPaise: amountPaise * Math.max(1, instalments),
    estimatedMaturityPaise: null,
    liquidity: p.accessDays === 0 ? "Withdraw any time, same day." : `Usually reaches your bank in ${p.accessDays} working day${p.accessDays === 1 ? "" : "s"}.`,
    ifNeededEarly: "No problem — the money isn't locked.",
    why,
  };
}

/** Products for the money available today. Only products that pass every hard constraint are scored. */
function lumpCandidates(products: ProductTerms[], amount: number, i: SavingsInput, horizonDays: number, rejected: Rejection[]): Candidate[] {
  const out: Candidate[] = [];
  const reject = (p: ProductTerms, reason: string) => rejected.push({ productId: p.id, label: p.label, role: "lump", reason });
  for (const p of products) {
    if (!p.available) {
      reject(p, "Not available from the provider right now.");
      continue;
    }
    if (amount < p.minDepositPaise) {
      reject(p, `Needs at least ₹${(p.minDepositPaise / 100).toLocaleString("en-IN")} to start.`);
      continue;
    }
    if (p.kind === "rd") {
      reject(p, "An RD takes monthly instalments, not one amount.");
      continue;
    }
    if (p.kind === "savings" || p.kind === "liquid") {
      if (p.kind === "liquid" && p.accessDays > 1 && i.needsEarlyAccess === "yes") {
        reject(p, "Takes too long to withdraw for money you may need any day.");
        continue;
      }
      let score = p.kind === "savings" ? 50 : 45;
      const why: string[] = [];
      if (i.isEmergency) {
        score += 40;
        why.push("Emergency money must be reachable the same day");
      }
      if (horizonDays < 90) {
        score += 30;
        why.push("Over a few weeks, locking the money up earns very little extra");
      }
      if (i.needsEarlyAccess === "yes") {
        score += 30;
        why.push("You said you may need it before the goal date");
      } else if (i.needsEarlyAccess === "unsure") {
        score += 15;
        why.push("Stays flexible while your plans firm up");
      }
      if (p.kind === "liquid") why.push("Usually earns more than a savings account, with next-day access");
      if (!why.length) why.push("Simple and always available");
      out.push({ score, line: liquidLine(p, "lump", amount, "once", 1, why) });
      continue;
    }
    // Fixed deposit.
    if (i.isEmergency) {
      reject(p, "Emergency money shouldn't be locked in a fixed deposit.");
      continue;
    }
    if (i.needsEarlyAccess === "yes" && p.premature !== "free") {
      reject(p, "You said you'll need the money before the goal date, and breaking an FD early costs interest.");
      continue;
    }
    const fits = (p.tenureDays ?? []).filter((d) => d <= horizonDays).sort((a, b) => b - a);
    if (!fits.length) {
      const shortest = Math.min(...(p.tenureDays ?? [Infinity]));
      reject(p, Number.isFinite(shortest) ? `Its shortest tenure (${DAY_MS_LABEL(shortest)}) matures after your goal date.` : "No tenure data from the provider.");
      continue;
    }
    const tenure = fits[0]!;
    let score = 50;
    const why = [`A ${DAY_MS_LABEL(tenure)} tenure matures on or before your goal date`];
    if (horizonDays >= 90) {
      score += 25;
      why.push("Long enough for a fixed rate to be worth locking in");
    } else {
      score -= 25;
    }
    if (i.needsEarlyAccess === "no") {
      score += 15;
      why.push("You won't need the money before then");
    } else if (i.needsEarlyAccess === "unsure") {
      score -= 10;
    }
    score += Math.round((tenure / horizonDays) * 10);
    const maturityDate = addDays(i.today, tenure);
    out.push({
      score,
      line: {
        role: "lump",
        product: p,
        amountPaise: amount,
        frequency: "once",
        tenureLabel: DAY_MS_LABEL(tenure),
        maturityDate,
        instalments: 1,
        principalPaise: amount,
        estimatedMaturityPaise: p.source === "provider" && p.ratePct !== null ? fdMaturity(amount, p.ratePct, tenure) : null,
        liquidity: `Locked until ${maturityDate}.`,
        ifNeededEarly: PREMATURE_TEXT[p.premature],
        why,
      },
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Products for money saved every period. */
function recurringCandidates(products: ProductTerms[], i: SavingsInput, horizonMonths: number, periods: number, rejected: Rejection[]): Candidate[] {
  const out: Candidate[] = [];
  const reject = (p: ProductTerms, reason: string) => rejected.push({ productId: p.id, label: p.label, role: "recurring", reason });
  for (const p of products) {
    if (!p.available) {
      reject(p, "Not available from the provider right now.");
      continue;
    }
    if (p.kind === "fd") {
      reject(p, "An FD takes one lump sum; it can't take a deposit every month.");
      continue;
    }
    if (p.kind === "savings" || p.kind === "liquid") {
      if (i.recurringPaise < p.minDepositPaise && p.minDepositPaise > 0) {
        reject(p, `Needs at least ₹${(p.minDepositPaise / 100).toLocaleString("en-IN")} each time.`);
        continue;
      }
      let score = p.kind === "savings" ? 50 : 42;
      const why: string[] = [];
      if (i.isEmergency) {
        score += 40;
        why.push("Emergency money must be reachable the same day");
      }
      if (i.frequency === "irregular") {
        score += 25;
        why.push("Put money in whenever income arrives — no fixed instalment to miss");
      }
      if (!i.canCommit) {
        score += 15;
        why.push("No fixed schedule to keep");
      }
      if (horizonMonths < 6) {
        score += 25;
        why.push("For a few months, a fixed deposit scheme adds little and locks the money");
      }
      if (i.needsEarlyAccess === "yes") {
        score += 25;
        why.push("You may need the money before the goal date");
      }
      if (!why.length) why.push("Flexible: pause or change the amount any month");
      out.push({ score, line: liquidLine(p, "recurring", i.recurringPaise, i.frequency, periods, why) });
      continue;
    }
    // Recurring deposit.
    if (i.isEmergency) {
      reject(p, "Emergency money shouldn't be locked in a recurring deposit.");
      continue;
    }
    if (i.frequency !== "monthly") {
      reject(p, i.frequency === "irregular" ? "An RD needs the same amount every month; your income is irregular." : "An RD takes monthly instalments.");
      continue;
    }
    if (!i.canCommit) {
      reject(p, "An RD needs a fixed deposit every month, and missed instalments are penalised.");
      continue;
    }
    if (i.recurringPaise < p.minDepositPaise) {
      reject(p, `Needs at least ₹${(p.minDepositPaise / 100).toLocaleString("en-IN")} a month.`);
      continue;
    }
    if (i.needsEarlyAccess === "yes" && p.premature !== "free") {
      reject(p, "You said you'll need the money early, and closing an RD early costs interest.");
      continue;
    }
    const fits = (p.tenureMonths ?? []).filter((m) => m <= horizonMonths).sort((a, b) => b - a);
    if (!fits.length) {
      const shortest = Math.min(...(p.tenureMonths ?? [Infinity]));
      reject(p, Number.isFinite(shortest) ? `Its shortest tenure (${MONTH_LABEL(shortest)}) runs past your goal date.` : "No tenure data from the provider.");
      continue;
    }
    const months = fits[0]!;
    let score = 60;
    const why = [`Built for a fixed monthly deposit — ${MONTH_LABEL(months)} matures by your goal date`, "A fixed rate on every instalment, and the habit is automatic"];
    if (i.needsEarlyAccess === "no") {
      score += 15;
      why.push("You won't need the money before then");
    } else if (i.needsEarlyAccess === "unsure") {
      score -= 10;
    }
    if (months < horizonMonths) score -= 5;
    const maturityDate = addMonths(i.today, months);
    out.push({
      score,
      line: {
        role: "recurring",
        product: p,
        amountPaise: i.recurringPaise,
        frequency: "monthly",
        tenureLabel: MONTH_LABEL(months),
        maturityDate,
        instalments: months,
        principalPaise: i.recurringPaise * months,
        estimatedMaturityPaise: p.source === "provider" && p.ratePct !== null ? rdMaturity(i.recurringPaise, p.ratePct, months) : null,
        liquidity: `Locked until ${maturityDate}. ${p.rules[0] ?? ""}`.trim(),
        ifNeededEarly: PREMATURE_TEXT[p.premature],
        why,
      },
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Months of contributions left after an RD's tenure (e.g. an 8-month goal with a 6-month RD). */
function tailLine(primaryRecurring: PlanLine, products: ProductTerms[], i: SavingsInput, periods: number): PlanLine | null {
  if (primaryRecurring.product.kind !== "rd") return null;
  const left = periods - primaryRecurring.instalments;
  const savings = products.find((p) => p.available && p.kind === "savings");
  if (left <= 0 || !savings) return null;
  return liquidLine(savings, "recurring", i.recurringPaise, i.frequency, left, [`The last ${left} month${left === 1 ? "" : "s"} after the RD matures, until your goal date`]);
}

export function recommendSavings(i: SavingsInput, products: ProductTerms[]): SavingsRecommendation {
  const intent = classifyIntent(i);
  const horizonDays = Math.max(0, daysBetween(i.today, i.goalDate));
  const horizonMonths = Math.max(0, monthsBetween(i.today, i.goalDate));
  const periods = i.recurringPaise > 0 ? contributionPeriods(i.frequency, i.today, i.goalDate) : 0;
  const rejected: Rejection[] = [];
  const notes: string[] = [];

  // Achievability, on principal only.
  const remaining = Math.max(0, i.targetPaise - i.existingPaise - i.lumpSumPaise);
  const requiredRecurringPaise = periods > 0 ? roundUpTo(remaining / periods) : remaining;
  const projectedPaise = i.existingPaise + i.lumpSumPaise + i.recurringPaise * periods;
  const shortfallPaise = Math.max(0, i.targetPaise - projectedPaise);
  const suggestions: Suggestion[] = [];
  if (shortfallPaise > 0) {
    const r = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
    if (periods > 0) suggestions.push({ kind: "increase_contribution", text: `Save ${r(requiredRecurringPaise)} per ${i.frequency === "weekly" ? "week" : i.frequency === "quarterly" ? "quarter" : "month"} instead of ${r(i.recurringPaise)}.` });
    if (i.recurringPaise > 0 && i.frequency !== "none") {
      const per = i.frequency === "weekly" ? 7 / 30.4 : i.frequency === "quarterly" ? 3 : 1;
      const monthsNeeded = Math.ceil((remaining / i.recurringPaise) * per);
      suggestions.push({ kind: "extend_date", text: `Move the date out to about ${monthsNeeded} months from today.` });
    }
    suggestions.push({ kind: "reduce_goal", text: `Lower the goal to ${r(projectedPaise)}, what this plan reaches.` });
    suggestions.push({ kind: "add_savings", text: `Put ${r(shortfallPaise)} more of your existing savings towards it.` });
  }

  // The part of today's money that stays instantly available.
  const liquidProduct = products.find((p) => p.available && p.kind === "savings");
  const keep = Math.min(i.lumpSumPaise, Math.max(0, i.keepLiquidPaise ?? 0));
  const investable = i.lumpSumPaise - keep;

  const lump = investable > 0 ? lumpCandidates(products, investable, i, horizonDays, rejected) : [];
  const recurring = i.recurringPaise > 0 && i.frequency !== "none" ? recurringCandidates(products, i, horizonMonths, periods, rejected) : [];

  const build = (lumpPick: Candidate | undefined, recPick: Candidate | undefined): PlanLine[] => {
    const lines: PlanLine[] = [];
    if (keep > 0 && liquidProduct) lines.push(liquidLine(liquidProduct, "buffer", keep, "once", 1, ["Kept instantly available — your Crisis Cushion isn't full yet"]));
    if (lumpPick) lines.push(lumpPick.line);
    if (recPick) {
      lines.push(recPick.line);
      const tail = tailLine(recPick.line, products, i, periods);
      if (tail) lines.push(tail);
    }
    // Two "keep it liquid" lines for the same product merge into one, for a cleaner plan.
    return lines;
  };

  const primary = build(lump[0], recurring[0]);
  const altLump = lump[1];
  const altRec = recurring[1];
  const alternative = altLump || altRec ? build(altLump ?? lump[0], altRec ?? recurring[0]) : null;

  if (!primary.length) notes.push("No product passed the constraints. Check the provider's product list, or revise the goal.");
  const used = [...primary, ...(alternative ?? [])];
  const illustrative = used.some((l) => l.product.source === "illustrative");
  if (illustrative) notes.push("Product terms are illustrative. Rates and maturity values aren't shown until real provider data is connected.");
  if (used.some((l) => l.product.ratePct === null)) notes.push("Amounts below are what you put in. Interest comes on top, at the provider's actual rate.");

  const modeLabel =
    intent === "emergency"
      ? "Emergency reserve"
      : intent === "mixed"
        ? "Lump sum + monthly"
        : intent === "lump_sum"
          ? "Lump sum"
          : i.frequency === "irregular"
            ? "Whenever income arrives"
            : i.frequency === "weekly"
              ? "Weekly"
              : i.frequency === "quarterly"
                ? "Quarterly"
                : "Monthly";

  return {
    intent,
    goalBased: i.targetPaise > 0 && horizonDays > 0,
    modeLabel,
    horizonDays,
    horizonMonths,
    periods,
    requiredRecurringPaise,
    projectedPaise,
    shortfallPaise,
    achievable: shortfallPaise === 0,
    suggestions,
    primary,
    alternative: alternative && JSON.stringify(alternative.map((l) => l.product.id)) !== JSON.stringify(primary.map((l) => l.product.id)) ? alternative : null,
    rejected,
    illustrative,
    notes,
  };
}

/**
 * Illustrative catalogue used until a provider's product API is connected. Typical shapes of
 * Indian deposit products, deliberately without rates (ratePct null) so no maturity amount is
 * ever invented. Replace with provider data in apps/web/src/config/products.ts.
 */
export const ILLUSTRATIVE_PRODUCTS: ProductTerms[] = [
  { id: "savings", kind: "savings", label: "Savings account", available: true, minDepositPaise: 0, ratePct: null, premature: "free", accessDays: 0, rules: ["Check the minimum balance rule."], source: "illustrative" },
  {
    id: "liquid",
    kind: "liquid",
    label: "Liquid fund",
    available: true,
    minDepositPaise: 50_000,
    ratePct: null,
    premature: "free",
    accessDays: 1,
    rules: ["Market-linked (low risk); a small exit load applies in the first 7 days."],
    source: "illustrative",
  },
  {
    id: "fd",
    kind: "fd",
    label: "Fixed deposit (FD)",
    available: true,
    tenureDays: [7, 15, 30, 46, 60, 91, 180, 270, 365, 730, 1095, 1825],
    minDepositPaise: 100_000,
    ratePct: null,
    premature: "penalty",
    accessDays: 0,
    rules: ["Breaking it early usually means a lower rate and a penalty."],
    source: "illustrative",
  },
  {
    id: "rd",
    kind: "rd",
    label: "Recurring deposit (RD)",
    available: true,
    tenureMonths: [6, 9, 12, 15, 18, 21, 24, 36, 48, 60],
    minDepositPaise: 10_000,
    ratePct: null,
    premature: "penalty",
    accessDays: 0,
    rules: ["A missed instalment usually costs a small penalty; several missed can close the RD."],
    source: "illustrative",
  },
];
