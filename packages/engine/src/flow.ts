/**
 * Monthly flow: four habits that keep money on track. Each is worth 25 points; all four make a
 * perfect month, and perfect months in a row raise the level. Points and levels have no money value.
 */

export type FlowCheckId = "sorted" | "budgets" | "saved" | "lent";
export interface FlowCheck {
  id: FlowCheckId;
  met: boolean;
}

export const FLOW_POINTS_PER_CHECK = 25;

export function flowChecks(month: { uncategorised: number; overBudget: number; investedPaise: number; overdueLoans: number }): FlowCheck[] {
  return [
    { id: "sorted", met: month.uncategorised === 0 },
    { id: "budgets", met: month.overBudget === 0 },
    { id: "saved", met: month.investedPaise > 0 },
    { id: "lent", met: month.overdueLoans === 0 },
  ];
}

export function flowScore(checks: FlowCheck[]): number {
  return checks.filter((c) => c.met).length * FLOW_POINTS_PER_CHECK;
}

export const isPerfectMonth = (checks: FlowCheck[]) => checks.every((c) => c.met);

/** Perfect months in a row, counting back from the newest completed month (newest first in the list). */
export function perfectMonthStreak(completedMonthsNewestFirst: FlowCheck[][]): number {
  let streak = 0;
  for (const checks of completedMonthsNewestFirst) {
    if (!isPerfectMonth(checks)) break;
    streak++;
  }
  return streak;
}

export const FLOW_LEVELS = [
  { name: "Starter", months: 0 },
  { name: "Steady", months: 1 },
  { name: "Strong", months: 3 },
  { name: "Champion", months: 6 },
] as const;

export function flowLevel(streak: number): { name: string; next: string | null; monthsToNext: number } {
  let index = 0;
  while (index + 1 < FLOW_LEVELS.length && streak >= FLOW_LEVELS[index + 1]!.months) index++;
  const next = FLOW_LEVELS[index + 1];
  return { name: FLOW_LEVELS[index]!.name, next: next?.name ?? null, monthsToNext: next ? next.months - streak : 0 };
}
