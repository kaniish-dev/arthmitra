import {
  addDays,
  budgetRows,
  capacityFromProfile,
  categoryName,
  currentValuePaise,
  cushionMonths,
  daysBetween,
  emergencyPlan,
  findRecurring,
  flowChecks,
  flowLevel,
  flowScore,
  formatDate,
  formatMonth,
  goalStatus,
  loanState,
  monthKey,
  nextSteps,
  outstandingPaise,
  overdueLoans,
  perfectMonthStreak,
  planForMoney,
  previousMonthKey,
  savedForGoal,
  sumFixed,
  summariseMonth,
  topCutCategories,
  totalOutstanding,
  withdrawableDate,
  type BudgetRow,
  type CoachSnapshot,
  type CutSuggestion,
  type EmergencyPlan,
  type FlowCheck,
  type GoalStatus,
  type MoneyStructure,
  type MonthSummary,
  type NextStep,
} from "@arthmitra/engine";
import type { AppData, Goal, Loan, LoanReturn } from "@arthmitra/schema";
import { dueLabel, dueLabelHi, merchantLabel } from "./format";

export interface Overview {
  today: string;
  capacityPaise: number;
  thisMonth: MonthSummary;
  lastMonth: MonthSummary;
  balancePaise: number;
  uncategorisedCount: number;
  goal: Goal | null;
  savedPaise: number;
  status: GoalStatus | null;
  cuts: CutSuggestion[];
}

/** Everything the screens show, computed by the shared engine from one data tree. */
export function overview(d: AppData, today: string): Overview {
  const capacityPaise = d.profile ? capacityFromProfile(d.profile) : 0;
  const thisMonth = summariseMonth(d.transactions, monthKey(today));
  const lastMonth = summariseMonth(d.transactions, previousMonthKey(today));
  const activeAccounts = new Set(d.accounts.filter((a) => a.status === "active").map((a) => a.id));
  const balancePaise =
    d.accounts.filter((a) => activeAccounts.has(a.id)).reduce((s, a) => s + a.openingBalancePaise, 0) +
    d.transactions.filter((t) => t.accountId && activeAccounts.has(t.accountId)).reduce((s, t) => s + t.amountPaise, 0);
  const goal = d.goals.find((g) => g.status === "active") ?? d.goals[0] ?? null;
  const savedPaise = goal ? savedForGoal(d.investments, goal.id) : 0;
  const status = goal ? goalStatus({ goal, savedPaise, capacityPaise, today }) : null;
  const cuts = d.profile
    ? topCutCategories({
        estimates: d.profile.estimatedSpend,
        actualByCategory: lastMonth.byCategory,
        discretionary: d.categories.filter((c) => c.discretionary).map((c) => c.id),
      })
    : [];
  return {
    today,
    capacityPaise,
    thisMonth,
    lastMonth,
    balancePaise,
    uncategorisedCount: d.transactions.filter((t) => t.status === "uncategorised").length,
    goal,
    savedPaise,
    status,
    cuts,
  };
}

// ---------- Money structure ----------

/** Repeating payments due in the next 10 days (or just late), soonest first. */
function billsDueSoon(d: AppData, today: string) {
  return findRecurring(d.transactions, today).filter((b) => b.daysUntil <= 10 && b.daysUntil >= -10);
}

/** What friends still owe from split payments. */
export function splitOwedPaise(d: AppData): number {
  return d.splits.flatMap((s) => s.people).filter((p) => !p.settled).reduce((sum, p) => sum + p.sharePaise, 0);
}

/** Balance, essentials, extras, bills, goal and money owed — the structure the coach plans with. */
export function moneyStructure(d: AppData, o: Overview): MoneyStructure {
  const estimates = d.profile?.estimatedSpend ?? {};
  const discretionary = new Set(d.categories.filter((c) => c.discretionary).map((c) => c.id));
  let essentials = d.profile ? sumFixed(d.profile.fixedExpenses) : 0;
  let extras = 0;
  for (const [category, paise] of Object.entries(estimates)) {
    if (discretionary.has(category)) extras += paise;
    else essentials += paise;
  }
  const s = o.status;
  return {
    balancePaise: o.balancePaise,
    essentialsPaise: essentials,
    extrasPaise: extras,
    billsDuePaise: billsDueSoon(d, o.today).reduce((sum, b) => sum + b.amountPaise, 0),
    goalSavingPaise: o.goal && s && !s.achieved ? Math.max(0, s.contributionPaise) : 0,
    goalName: o.goal && s && !s.achieved ? o.goal.name : null,
    goalGapPaise: s && !s.onTrack && !s.achieved ? s.gapPaise : 0,
    owedToYouPaise: totalOutstanding(d.loans) + splitOwedPaise(d),
  };
}

/** Confirmed investments split into what can be taken out today and what is still locked. */
export function investmentsByAccess(d: AppData, today: string) {
  let freeNowPaise = 0;
  let lockedPaise = 0;
  for (const i of d.investments.filter((x) => x.status === "confirmed")) {
    if (withdrawableDate(i) <= today) freeNowPaise += currentValuePaise(i);
    else lockedPaise += currentValuePaise(i);
  }
  return { freeNowPaise, lockedPaise };
}

export function emergencyFor(d: AppData, o: Overview): EmergencyPlan {
  return emergencyPlan(moneyStructure(d, o), investmentsByAccess(d, o.today));
}

// ---------- Money lent ----------

/** Open loans, overdue first, then by due date. */
export function openLoans(d: AppData, today: string): Loan[] {
  const rank = (l: Loan) => (loanState(l, today) === "overdue" ? 0 : 1);
  return d.loans
    .filter((l) => outstandingPaise(l) > 0)
    .sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

/** The newest payback in the last 30 days, with the loan it belongs to. */
export function latestReturn(d: AppData, today: string): { loan: Loan; ret: LoanReturn } | null {
  let best: { loan: Loan; ret: LoanReturn } | null = null;
  for (const loan of d.loans) {
    for (const ret of loan.returns) {
      if (daysBetween(ret.date, today) > 30) continue;
      if (!best || ret.date > best.ret.date || (ret.date === best.ret.date && ret.id > best.ret.id)) best = { loan, ret };
    }
  }
  return best;
}

/**
 * Where a payback should go. A bank payback is already in the balance, so the plan is worked
 * out from the balance before it arrived.
 */
export function planForReturn(d: AppData, o: Overview, ret: LoanReturn) {
  const structure = moneyStructure(d, o);
  const txn = ret.txnId ? d.transactions.find((t) => t.id === ret.txnId) : undefined;
  const inBalance = txn?.accountId ? d.accounts.some((a) => a.id === txn.accountId && a.status === "active") : false;
  return planForMoney(ret.amountPaise, inBalance ? { ...structure, balancePaise: structure.balancePaise - ret.amountPaise } : structure);
}

// ---------- Monthly flow ----------

function flowForMonth(d: AppData, key: string, judgeOn: string): FlowCheck[] {
  const month = summariseMonth(d.transactions, key);
  return flowChecks({
    uncategorised: d.transactions.filter((t) => monthKey(t.date) === key && t.status === "uncategorised").length,
    overBudget: budgetRows(d.categories, d.profile?.estimatedSpend ?? {}, month.byCategory).filter((b) => b.level === "over").length,
    investedPaise: month.investedPaise,
    overdueLoans: overdueLoans(d.loans, judgeOn).length,
  });
}

/** This month's four habits, and the perfect-month streak over the months with payments. */
export function flowFor(d: AppData, today: string) {
  const checks = flowForMonth(d, monthKey(today), today);
  const months = new Set(d.transactions.map((t) => monthKey(t.date)));
  const completed: FlowCheck[][] = [];
  for (let first = addDays(`${monthKey(today)}-01`, -1); months.has(monthKey(first)); first = addDays(`${monthKey(first)}-01`, -1)) {
    completed.push(flowForMonth(d, monthKey(first), first));
  }
  const streak = perfectMonthStreak(completed);
  const level = flowLevel(streak);
  return { checks, score: flowScore(checks), streak, level: level.name, nextLevel: level.next, monthsToNext: level.monthsToNext };
}

// ---------- Next steps ----------

/** The engine's next steps from the whole picture; Home and the coach show the same list. */
export function stepsFor(d: AppData, o: Overview, limit = 3): NextStep[] {
  const bill = billsDueSoon(d, o.today).find((b) => b.daysUntil <= 5);
  const over = budgetsFor(d, o.thisMonth).filter((b) => b.level === "over")[0];
  const back = latestReturn(d, o.today);
  return nextSteps(
    {
      emergencyMode: d.settings.emergencyMode,
      recentReturn: back && !back.ret.handled && daysBetween(back.ret.date, o.today) <= 7 ? { person: back.loan.person, amountPaise: back.ret.amountPaise } : null,
      nextBill: bill ? { name: merchantLabel(bill.merchantKey), amountPaise: bill.amountPaise, dueEn: dueLabel(bill), dueHi: dueLabelHi(bill) } : null,
      overdue: openLoans(d, o.today)
        .filter((l) => loanState(l, o.today) === "overdue")
        .map((l) => ({ person: l.person, outstandingPaise: outstandingPaise(l) })),
      uncategorised: o.uncategorisedCount,
      worstOver: over ? { name: categoryName(d.categories, over.category), overPaise: over.spentPaise - over.budgetPaise } : null,
      cushionMonths: cushionMonths(moneyStructure(d, o)),
      goal: o.goal && o.status && !o.status.achieved ? { name: o.goal.name, gapPaise: o.status.gapPaise, onTrack: o.status.onTrack } : null,
      savedThisMonth: o.thisMonth.investedPaise > 0,
    },
    limit,
  );
}

// ---------- Coach ----------

/** Aggregates only — no account numbers or merchants — as the coach rules require. */
export function coachSnapshot(d: AppData, o: Overview): CoachSnapshot {
  const month = o.thisMonth.spendingPaise > 0 ? o.thisMonth : o.lastMonth;
  const topCategories = Object.entries(month.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, paise]) => ({ name: categoryName(d.categories, id === "uncategorised" ? null : id), paise }));
  const fun = budgetsFor(d, o.thisMonth).find((b) => b.category === "entertainment");
  const back = latestReturn(d, o.today);
  const loans = openLoans(d, o.today);
  return {
    monthLabel: formatMonth(month.monthKey),
    incomePaise: month.incomePaise,
    spendingPaise: month.spendingPaise,
    topCategories,
    capacityPaise: o.capacityPaise,
    goal:
      o.goal && o.status
        ? {
            name: o.goal.name,
            requiredPaise: o.status.requiredPaise,
            contributionPaise: o.status.contributionPaise,
            onTrack: o.status.onTrack,
            gapPaise: o.status.gapPaise,
            sparePaise: Math.max(0, o.status.contributionPaise - o.status.requiredPaise),
            targetDateLabel: formatDate(o.goal.targetDate),
            projectedDateLabel: o.status.projectedDate ? formatDate(o.status.projectedDate) : null,
          }
        : null,
    cuts: o.cuts.map((c) => ({ category: c.category, name: categoryName(d.categories, c.category), roomPaise: c.roomPaise })),
    cutsTotalPaise: o.cuts.reduce((sum, c) => sum + c.roomPaise, 0),
    fun: fun
      ? {
          budgetPaise: fun.budgetPaise,
          spentPaise: fun.spentPaise,
          leftPaise: Math.max(0, fun.budgetPaise - fun.spentPaise),
          overPaise: Math.max(0, fun.spentPaise - fun.budgetPaise),
        }
      : null,
    structure: moneyStructure(d, o),
    lent: {
      outstandingPaise: totalOutstanding(d.loans),
      people: loans.map((l) => ({
        person: l.person,
        outstandingPaise: outstandingPaise(l),
        dueLabel: l.dueDate ? formatDate(l.dueDate) : null,
        overdue: loanState(l, o.today) === "overdue",
      })),
      lastReturn: back
        ? { person: back.loan.person, amountPaise: back.ret.amountPaise, dateLabel: formatDate(back.ret.date), plan: planForReturn(d, o, back.ret) }
        : null,
    },
    steps: stepsFor(d, o),
    flow: flowFor(d, o.today),
    emergency: { ...emergencyFor(d, o), mode: d.settings.emergencyMode },
  };
}

/** Opening balance plus every transaction seen on that account. */
export function accountBalance(d: AppData, accountId: string): number {
  const account = d.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  return account.openingBalancePaise + d.transactions.filter((t) => t.accountId === accountId).reduce((sum, t) => sum + t.amountPaise, 0);
}

/** A month's budgets, fullest first. */
export function budgetsFor(d: AppData, month: MonthSummary): BudgetRow[] {
  return budgetRows(d.categories, d.profile?.estimatedSpend ?? {}, month.byCategory).sort((a, b) => b.share - a.share);
}
