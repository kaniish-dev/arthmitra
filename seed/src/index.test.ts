import { describe, expect, it } from "vitest";
import {
  addMonths,
  capacityFromProfile,
  categoriseByRules,
  defaultCategories,
  findRecurring,
  goalStatus,
  loanState,
  matchLoanReturn,
  normalizeMerchant,
  previousMonthKey,
  readDepositData,
  savedForGoal,
  summariseMonth,
  topCutCategories,
} from "@arthmitra/engine";
import { DEMO_ACCOUNTS, DEMO_GOAL_ID, SCRIPTED_PAYMENTS, demoBankHistory, demoFiData, demoLoans, demoOnboarded } from "./index";

describe("demo loans", () => {
  it("Ramesh is overdue, and the friend's ₹800 demo payment pays him back", () => {
    const loans = demoLoans("2026-10-30", "2026-10-30T10:00:00.000Z");
    expect(loans.map((l) => loanState(l, "2026-10-30"))).toEqual(["overdue", "open"]);
    const friend = SCRIPTED_PAYMENTS.find((p) => p.id === "friend")!;
    const match = matchLoanReturn(loans, { amountPaise: friend.amountPaise, merchantRaw: friend.merchantRaw, merchantKey: normalizeMerchant(friend.merchantRaw) });
    expect(match?.id).toBe("loan-ramesh");
  });
});

const today = "2026-10-30";
const now = "2026-10-30T10:00:00.000Z";
const R = (rupees: number) => rupees * 100;

describe("demo seed matches the demo script", () => {
  const data = demoOnboarded(today, now);
  const history = demoBankHistory(today, now);
  const goal = data.goals[0]!;
  const capacity = capacityFromProfile(data.profile!);
  const saved = savedForGoal(history.investments, DEMO_GOAL_ID);

  it("capacity is ₹17,000 and ₹6,000 is already saved", () => {
    expect(capacity).toBe(R(17_000));
    expect(saved).toBe(R(6_000));
  });

  it("12-month goal needs ₹19,500 — ₹2,500 short", () => {
    const s = goalStatus({ goal, savedPaise: saved, capacityPaise: capacity, today });
    expect(s.requiredPaise).toBe(R(19_500));
    expect(s.gapPaise).toBe(R(2_500));
  });

  it("last month's overspend gives ₹2,500 of room in Food and Entertainment", () => {
    const last = summariseMonth(history.transactions, previousMonthKey(today));
    const cuts = topCutCategories({
      estimates: data.profile!.estimatedSpend,
      actualByCategory: last.byCategory,
      discretionary: defaultCategories().filter((c) => c.discretionary).map((c) => c.id),
    });
    expect(cuts.map((c) => c.category)).toEqual(["food", "entertainment"]);
    expect(cuts.reduce((s, c) => s + c.roomPaise, 0)).toBe(R(2_500));
    expect(last.incomePaise).toBe(R(50_000));
  });

  it("moving the date out 2 months turns the goal on track", () => {
    const moved = { ...goal, targetDate: addMonths(goal.targetDate, 2) };
    expect(goalStatus({ goal: moved, savedPaise: saved, capacityPaise: capacity, today }).onTrack).toBe(true);
  });

  it("this month holds nothing dated today or later", () => {
    expect(history.transactions.every((t) => t.date < today)).toBe(true);
  });

  it("scripted payments: Swiggy sorts itself, RK Traders goes to the inbox", () => {
    const ctx = { userRules: {}, cache: {}, threshold: 0.8, known: defaultCategories().map((c) => c.id) };
    const [swiggy, rk] = SCRIPTED_PAYMENTS;
    expect(categoriseByRules("swiggy", swiggy!.amountPaise, ctx).category).toBe("food");
    expect(categoriseByRules("rk traders", rk!.amountPaise, ctx).status).toBe("uncategorised");
  });
});

describe("demo repeating bills", () => {
  it("finds rent, utilities and subscriptions, with rent due 4 days after the demo date", () => {
    const bills = findRecurring(demoBankHistory(today, now).transactions, today);
    expect(bills.map((b) => b.category)).toEqual(["rent", "bills", "bills", "entertainment", "entertainment"]);
    expect(bills[0]).toMatchObject({ amountPaise: R(12_000), daysUntil: 4, paidThisMonth: true });
  });
});

describe("simulated Account Aggregator", () => {
  it("sends ReBIT data that the real reader turns back into the same payments", () => {
    const account = DEMO_ACCOUNTS[0]!;
    const txns = demoBankHistory(today, now).transactions.filter((t) => t.accountId === account.id);
    const fi = demoFiData(account, R(41_250), txns.map((t) => ({ txnId: t.id, date: t.date, amountPaise: t.amountPaise, narration: t.merchantRaw })));
    const read = readDepositData(JSON.parse(JSON.stringify(fi)));
    expect(read.last4).toBe(account.last4);
    expect(read.balancePaise).toBe(R(41_250));
    expect(read.skipped).toBe(0);
    expect(read.rows).toEqual(txns.map((t) => ({ date: t.date, description: t.merchantRaw, amountPaise: t.amountPaise, reference: t.id })));
  });
});
