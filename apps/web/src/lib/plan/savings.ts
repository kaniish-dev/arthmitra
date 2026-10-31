import { recommendSavings, type SavingsRecommendation } from "@arthmitra/engine";
import type { AppData, Goal, GoalFunding } from "@arthmitra/schema";
import { PRODUCTS } from "@/config/products";
import { cushionGoal } from "@/lib/insights";

/** A goal saved before funding was asked about: monthly saving of the plan amount. */
export function fundingOf(goal: Pick<Goal, "funding" | "plan" | "monthlyContributionPaise" | "path">): GoalFunding {
  return (
    goal.funding ?? {
      lumpSumPaise: 0,
      recurringPaise: goal.plan?.monthlyPaise ?? goal.monthlyContributionPaise ?? 0,
      frequency: "monthly",
      needsEarlyAccess: goal.path === "crisisCushion" ? "yes" : "no",
      canCommit: true,
    }
  );
}

/** Average monthly amount for a frequency, used by the investment-mix projection. */
export function monthlyEquivalent(f: Pick<GoalFunding, "recurringPaise" | "frequency">): number {
  switch (f.frequency) {
    case "monthly":
    case "irregular":
      return f.recurringPaise;
    case "weekly":
      return Math.round((f.recurringPaise * 52) / 12);
    case "quarterly":
      return Math.round(f.recurringPaise / 3);
    case "none":
      return 0;
  }
}

/** What the Crisis Cushion still lacks — that much of a lump sum stays instantly available. */
export function cushionGap(d: AppData): number {
  const c = cushionGoal(d);
  if (!c) return 0;
  return Math.max(0, c.targetPaise - (c.cushionSavedPaise ?? 0));
}

/** The savings recommendation for a goal (or a draft), from the user's funding answers and the product catalogue. */
export function savingsFor(
  d: AppData,
  goal: { targetPaise: number; targetDate: string; existingPaise: number; isEmergency: boolean },
  funding: GoalFunding,
  today: string,
): SavingsRecommendation {
  return recommendSavings(
    {
      today,
      goalDate: goal.targetDate,
      targetPaise: goal.targetPaise,
      existingPaise: goal.existingPaise,
      lumpSumPaise: funding.lumpSumPaise,
      recurringPaise: funding.recurringPaise,
      frequency: funding.frequency,
      needsEarlyAccess: funding.needsEarlyAccess,
      canCommit: funding.canCommit,
      isEmergency: goal.isEmergency,
      // Emergency money is already the cushion; for other goals keep what the cushion still lacks.
      keepLiquidPaise: goal.isEmergency ? 0 : cushionGap(d),
    },
    PRODUCTS,
  );
}
