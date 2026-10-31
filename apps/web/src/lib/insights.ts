import {
  addMonths,
  monthFlow,
  monthKey,
  monthsBetween,
  passiveIncomeMonthly,
  pastMonthFlows,
  realisticSaving,
  sipFutureValue,
  sipNeeded,
  type MonthFlow,
  type RealisticSaving,
} from "@arthmitra/engine";
import type { AppData, Goal } from "@arthmitra/schema";

/** Savings insights for the dashboard: past months, this month, and the realistic saving. */
export interface SavingsInsight {
  /** Up to 12 complete past months, oldest first. */
  months: MonthFlow[];
  thisMonth: MonthFlow;
  saving: RealisticSaving;
  /** Monthly amounts already promised to goal plans and the Crisis Cushion. */
  committedPaise: number;
  /** Realistic saving left for a new goal. */
  freePaise: number;
}

export function savingsInsight(d: AppData, today: string): SavingsInsight {
  const months = pastMonthFlows(d.transactions, today, 12);
  // The saving target reads the last 6 months: recent habits matter most.
  const saving = realisticSaving(months.slice(-6));
  const committedPaise = activeGoals(d).reduce((s, g) => s + (g.monthlyContributionPaise ?? g.plan?.monthlyPaise ?? 0), 0);
  return {
    months,
    thisMonth: monthFlow(d.transactions, monthKey(today)),
    saving,
    committedPaise,
    freePaise: Math.max(0, saving.monthlyPaise - committedPaise),
  };
}

export const activeGoals = (d: AppData) => d.goals.filter((g) => g.status === "active");

/** Goals with a plan path (everything except the Crisis Cushion), newest first. */
export const planGoals = (d: AppData) => d.goals.filter((g) => (g.path ?? "bigDay") !== "crisisCushion");

export const cushionGoal = (d: AppData) => d.goals.find((g) => g.path === "crisisCushion") ?? null;

export interface GoalProgress {
  investedPaise: number;
  valuePaise: number;
  /** 0–1 of the target reached by today's value. */
  progress: number;
  monthsLeft: number;
  /** Projected value on the target date if the plan's monthly amount keeps going in. */
  projectedPaise: number;
  onTrack: boolean;
  /** Monthly amount needed from today to reach the target at the plan's assumed return. */
  neededPaise: number;
  /** Extra each month above the plan's amount; 0 when on track. */
  topUpPaise: number;
}

export function goalProgress(d: AppData, goal: Goal, today: string): GoalProgress {
  const held = d.holdings.filter((h) => h.goalId === goal.id);
  const investedPaise = held.reduce((s, h) => s + h.amountInvestedPaise, 0);
  const valuePaise = held.reduce((s, h) => s + h.currentValuePaise, 0) + (goal.path === "crisisCushion" ? (goal.cushionSavedPaise ?? 0) : 0);
  const monthsLeft = Math.max(0, monthsBetween(today, goal.targetDate));
  const rate = goal.plan?.expectedReturnPct ?? 6;
  const monthly = goal.plan?.monthlyPaise ?? goal.monthlyContributionPaise ?? 0;
  const projectedPaise = sipFutureValue(monthly, monthsLeft, rate, valuePaise);
  const neededPaise = sipNeeded(goal.targetPaise, valuePaise, Math.max(1, monthsLeft), rate);
  const onTrack = projectedPaise >= goal.targetPaise;
  return {
    investedPaise,
    valuePaise,
    progress: Math.min(1, valuePaise / goal.targetPaise),
    monthsLeft,
    projectedPaise,
    onTrack,
    neededPaise,
    topUpPaise: onTrack ? 0 : Math.max(0, neededPaise - monthly),
  };
}

/** Wealth view: everything held, and the passive income it could pay each month. */
export function wealthSummary(d: AppData) {
  const valuePaise = d.holdings.reduce((s, h) => s + h.currentValuePaise, 0);
  const investedPaise = d.holdings.reduce((s, h) => s + h.amountInvestedPaise, 0);
  const wealth = d.goals.find((g) => g.path === "wealth" && g.status === "active") ?? null;
  return {
    valuePaise,
    investedPaise,
    gainPaise: valuePaise - investedPaise,
    passiveIncomePaise: passiveIncomeMonthly(valuePaise),
    wealth,
    /** Share of monthly expenses today's portfolio could already cover. */
    coverage: wealth?.monthlyExpensesPaise ? Math.min(1, passiveIncomeMonthly(valuePaise) / wealth.monthlyExpensesPaise) : null,
  };
}

/** Months from today to a YYYY-MM-DD date, at least 1. */
export const monthsUntil = (today: string, date: string) => Math.max(1, monthsBetween(today, date));

/** A target date `months` from today. */
export const dateIn = (today: string, months: number) => addMonths(today, months);
