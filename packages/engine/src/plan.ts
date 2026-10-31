import { formatINR, HUNDRED_RUPEES } from "./money";

/**
 * The user's money structure and what to do with it: where money that comes back should go,
 * how long savings last in an emergency, and the next few steps. Pure maths on aggregates.
 */

/** Months of essential spending to keep aside before anything else. */
export const CUSHION_MONTHS = 3;

export interface MoneyStructure {
  /** Bank balance across active accounts. */
  balancePaise: number;
  /** Per month: fixed costs plus estimates for non-discretionary categories. */
  essentialsPaise: number;
  /** Per month: estimates for discretionary categories (food out, travel, shopping, fun). */
  extrasPaise: number;
  /** Repeating payments due in the next 10 days. */
  billsDuePaise: number;
  /** What the goal plan sets aside each month. */
  goalSavingPaise: number;
  goalName: string | null;
  /** Monthly shortfall against the goal; 0 when on track or no goal. */
  goalGapPaise: number;
  /** Money lent and split shares still owed to the user. */
  owedToYouPaise: number;
}

/** Balance left once bills due soon are paid. */
export const freeBalance = (s: Pick<MoneyStructure, "balancePaise" | "billsDuePaise">) => Math.max(0, s.balancePaise - s.billsDuePaise);

export const cushionTarget = (s: Pick<MoneyStructure, "essentialsPaise">) => s.essentialsPaise * CUSHION_MONTHS;

/** Months of essentials the free balance covers, to one decimal (rounded down); null without essentials. */
export function cushionMonths(s: Pick<MoneyStructure, "balancePaise" | "billsDuePaise" | "essentialsPaise">): number | null {
  if (s.essentialsPaise <= 0) return null;
  return Math.floor((freeBalance(s) / s.essentialsPaise) * 10) / 10;
}

export type AllocationKind = "bills" | "cushion" | "goal" | "you";
export interface Allocation {
  kind: AllocationKind;
  paise: number;
}

const downTo100 = (paise: number) => Math.floor(paise / HUNDRED_RUPEES) * HUNDRED_RUPEES;

/**
 * Where money that arrives (a loan paid back, a bonus) should go, in order:
 * 1. bills due in the next 10 days that the balance does not already cover;
 * 2. the emergency cushion, up to 3 months of essentials;
 * 3. the goal, 80% of what is left (rounded down to ₹100), when there is one;
 * 4. the rest is the user's to enjoy.
 */
export function planForMoney(amountPaise: number, s: MoneyStructure): Allocation[] {
  let left = Math.max(0, amountPaise);
  const out: Allocation[] = [];
  const take = (kind: AllocationKind, want: number) => {
    const paise = Math.min(left, Math.max(0, want));
    if (paise > 0) {
      out.push({ kind, paise });
      left -= paise;
    }
  };
  take("bills", s.billsDuePaise - Math.max(0, s.balancePaise));
  take("cushion", cushionTarget(s) - freeBalance(s));
  if (s.goalName) take("goal", downTo100(left * 0.8));
  take("you", left);
  return out;
}

// ---------- Emergency ----------

export interface EmergencyPlan {
  /** Free balance after bills due soon. */
  availablePaise: number;
  essentialsPaise: number;
  monthsCovered: number | null;
  /** Monthly goal saving that can pause. */
  pauseGoalPaise: number;
  /** Monthly extras that can stop. */
  extrasPaise: number;
  owedToYouPaise: number;
  /** Investments that can be taken out today without a lock-in or penalty. */
  freeNowPaise: number;
  /** Investments still locked; leaving early can cost a penalty. */
  lockedPaise: number;
  /** Months covered if everything above is used and only essentials are paid. */
  monthsWithEverything: number | null;
}

export function emergencyPlan(s: MoneyStructure, investments: { freeNowPaise: number; lockedPaise: number }): EmergencyPlan {
  const available = freeBalance(s);
  const months = (paise: number) => (s.essentialsPaise > 0 ? Math.floor((paise / s.essentialsPaise) * 10) / 10 : null);
  return {
    availablePaise: available,
    essentialsPaise: s.essentialsPaise,
    monthsCovered: months(available),
    pauseGoalPaise: s.goalSavingPaise,
    extrasPaise: s.extrasPaise,
    owedToYouPaise: s.owedToYouPaise,
    freeNowPaise: investments.freeNowPaise,
    lockedPaise: investments.lockedPaise,
    monthsWithEverything: months(available + s.owedToYouPaise + investments.freeNowPaise),
  };
}

// ---------- Next steps ----------

export type StepKind = "emergency" | "money_back" | "bill" | "lent" | "sort" | "budget" | "cushion" | "goal" | "save";

export interface NextStep {
  kind: StepKind;
  /** Page that acts on it; also its coach action id. */
  action: "emergency" | "lent" | "bills" | "inbox" | "insights" | "goal";
  title: { en: string; hi: string };
  detail: { en: string; hi: string };
  /** Rupee figures the texts use. */
  figures: string[];
}

export interface StepInput {
  emergencyMode: boolean;
  recentReturn: { person: string; amountPaise: number } | null;
  nextBill: { name: string; amountPaise: number; dueEn: string; dueHi: string } | null;
  overdue: Array<{ person: string; outstandingPaise: number }>;
  uncategorised: number;
  worstOver: { name: string; overPaise: number } | null;
  cushionMonths: number | null;
  goal: { name: string; gapPaise: number; onTrack: boolean } | null;
  savedThisMonth: boolean;
}

/** Up to `limit` steps, most urgent first. Same list on Home and in the coach. */
export function nextSteps(i: StepInput, limit = 3): NextStep[] {
  const inr = formatINR;
  const steps: NextStep[] = [];
  if (i.emergencyMode) {
    steps.push({
      kind: "emergency",
      action: "emergency",
      title: { en: "Emergency mode is on", hi: "इमरजेंसी मोड चालू है" },
      detail: { en: "Essentials only — follow your emergency plan", hi: "सिर्फ़ ज़रूरी खर्च — इमरजेंसी प्लान देखें" },
      figures: [],
    });
  }
  if (i.recentReturn) {
    const a = inr(i.recentReturn.amountPaise);
    steps.push({
      kind: "money_back",
      action: "lent",
      title: { en: `${a} is back from ${i.recentReturn.person}`, hi: `${i.recentReturn.person} से ${a} वापस आए` },
      detail: { en: "See where it should go", hi: "देखें इसे कहाँ लगाएँ" },
      figures: [a],
    });
  }
  if (i.nextBill) {
    const a = inr(i.nextBill.amountPaise);
    steps.push({
      kind: "bill",
      action: "bills",
      title: { en: `Keep ${a} for ${i.nextBill.name}`, hi: `${i.nextBill.name} के लिए ${a} रखें` },
      detail: { en: i.nextBill.dueEn, hi: i.nextBill.dueHi },
      figures: [a],
    });
  }
  if (i.overdue.length) {
    const first = i.overdue[0]!;
    const a = inr(first.outstandingPaise);
    const more = i.overdue.length - 1;
    steps.push({
      kind: "lent",
      action: "lent",
      title: { en: `Ask ${first.person} for ${a} back`, hi: `${first.person} से ${a} वापस माँगें` },
      detail: {
        en: more ? `Overdue · and ${more} more ${more === 1 ? "person" : "people"}` : "It's past the date you agreed",
        hi: more ? `तारीख निकल गई · और ${more} लोग` : "तय तारीख निकल गई है",
      },
      figures: [a],
    });
  }
  if (i.uncategorised > 0) {
    const n = i.uncategorised;
    steps.push({
      kind: "sort",
      action: "inbox",
      title: { en: `Sort ${n} ${n === 1 ? "payment" : "payments"}`, hi: `${n} खर्च छाँटें` },
      detail: { en: "So your budgets stay right", hi: "ताकि बजट सही रहे" },
      figures: [],
    });
  }
  if (i.worstOver) {
    const a = inr(i.worstOver.overPaise);
    steps.push({
      kind: "budget",
      action: "insights",
      title: { en: `${i.worstOver.name} is ${a} over budget`, hi: `${i.worstOver.name} बजट से ${a} ज़्यादा` },
      detail: { en: "Slow down there this week", hi: "इस हफ़्ते वहाँ खर्च धीमा करें" },
      figures: [a],
    });
  }
  if (i.cushionMonths !== null && i.cushionMonths < CUSHION_MONTHS) {
    steps.push({
      kind: "cushion",
      action: "emergency",
      title: { en: "Build your emergency cushion", hi: "इमरजेंसी कुशन बनाएँ" },
      detail: {
        en: `${i.cushionMonths} months of essentials now, aim for ${CUSHION_MONTHS}`,
        hi: `अभी ${i.cushionMonths} महीने का ज़रूरी खर्च, लक्ष्य ${CUSHION_MONTHS} महीने`,
      },
      figures: [],
    });
  }
  if (i.goal && !i.goal.onTrack && i.goal.gapPaise > 0 && !i.emergencyMode) {
    const a = inr(i.goal.gapPaise);
    steps.push({
      kind: "goal",
      action: "goal",
      title: { en: `Find ${a} a month for ${i.goal.name}`, hi: `${i.goal.name} के लिए हर महीने ${a} खोजें` },
      detail: { en: "The goal plan shows where", hi: "लक्ष्य योजना बताती है कहाँ से" },
      figures: [a],
    });
  } else if (i.goal && !i.savedThisMonth && !i.emergencyMode) {
    steps.push({
      kind: "save",
      action: "goal",
      title: { en: `Make this month's saving for ${i.goal.name}`, hi: `${i.goal.name} के लिए इस महीने की बचत करें` },
      detail: { en: "Invest in your own bank or app, then confirm", hi: "अपने बैंक या ऐप में निवेश करें, फिर पुष्टि करें" },
      figures: [],
    });
  }
  return steps.slice(0, limit);
}
