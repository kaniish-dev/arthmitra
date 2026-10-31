import { describe, expect, it } from "vitest";
import { CARE_NOTE, DISCLAIMER } from "@arthmitra/schema";
import {
  COACH_ACTIONS,
  DISCLAIMER_HI,
  SUGGESTED_QUESTIONS,
  amountInQuestion,
  checkCoachAnswer,
  detectIntent,
  passesAdviceCheck,
  snapshotFigures,
  templateAnswer,
  unknownFigures,
  type CoachIntent,
  type CoachSnapshot,
} from "./coach";
import { COACH_EVALS, COACH_EXAMPLES, COACH_SYSTEM_INSTRUCTION, coachModelInput, redactNames, usesModel } from "./coach-prompt";
import { flowChecks } from "./flow";
import { INSTRUMENTS } from "./instruments";
import { emergencyPlan, nextSteps, planForMoney, type MoneyStructure } from "./plan";

const R = (rupees: number) => rupees * 100;

const structure: MoneyStructure = {
  balancePaise: R(45_000),
  essentialsPaise: R(20_500),
  extrasPaise: R(12_500),
  billsDuePaise: R(2_000),
  goalSavingPaise: R(17_000),
  goalName: "Car down payment",
  goalGapPaise: R(2_500),
  owedToYouPaise: R(2_300),
};

const snapshot: CoachSnapshot = {
  monthLabel: "Oct 2026",
  incomePaise: R(50_000),
  spendingPaise: R(31_000),
  topCategories: [
    { name: "Rent", paise: R(12_000) },
    { name: "Food", paise: R(7_500) },
  ],
  capacityPaise: R(17_000),
  goal: {
    name: "Car down payment",
    requiredPaise: R(19_500),
    contributionPaise: R(17_000),
    onTrack: false,
    gapPaise: R(2_500),
    sparePaise: 0,
    targetDateLabel: "30 Oct 2027",
    projectedDateLabel: "30 Dec 2027",
  },
  cuts: [
    { category: "food", name: "Food", roomPaise: R(1_500) },
    { category: "entertainment", name: "Entertainment", roomPaise: R(1_000) },
  ],
  cutsTotalPaise: R(2_500),
  fun: { budgetPaise: R(1_500), spentPaise: R(1_151), leftPaise: R(349), overPaise: 0 },
  structure,
  lent: {
    outstandingPaise: R(1_500),
    people: [{ person: "Priya", outstandingPaise: R(1_500), dueLabel: "25 Oct 2026", overdue: true }],
    lastReturn: { person: "Ramesh Kumar", amountPaise: R(800), dateLabel: "30 Oct 2026", plan: planForMoney(R(800), structure) },
  },
  steps: nextSteps({
    emergencyMode: false,
    recentReturn: { person: "Ramesh Kumar", amountPaise: R(800) },
    nextBill: { name: "Rent", amountPaise: R(12_000), dueEn: "Due in 4 days", dueHi: "4 दिन में" },
    overdue: [{ person: "Priya", outstandingPaise: R(1_500) }],
    uncategorised: 1,
    worstOver: null,
    cushionMonths: 2,
    goal: { name: "Car down payment", gapPaise: R(2_500), onTrack: false },
    savedThisMonth: true,
  }),
  flow: { checks: flowChecks({ uncategorised: 1, overBudget: 0, investedPaise: R(6_000), overdueLoans: 1 }), score: 50, streak: 0, level: "Starter", nextLevel: "Steady", monthsToNext: 1 },
  emergency: { ...emergencyPlan(structure, { freeNowPaise: 0, lockedPaise: R(6_000) }), mode: false },
};

const ALL_INTENTS: CoachIntent[] = [
  "crisis",
  "medical",
  "product",
  "emergency",
  "money_back",
  "lent",
  "rewards",
  "safety",
  "next_steps",
  "stress",
  "fun_budget",
  "what_cut",
  "reach_goal",
  "how_much_save",
  "where_money",
  "unknown",
];

describe("coach templates", () => {
  it("maps every suggested question, in both languages, to its intent", () => {
    for (const lang of ["en", "hi"] as const) {
      for (const q of SUGGESTED_QUESTIONS[lang]) expect(detectIntent(q.text), q.text).toBe(q.intent);
    }
  });

  it("answers only with the snapshot's own figures and known buttons", () => {
    const a = templateAnswer("reach_goal", snapshot, "en");
    expect(a.answer).toContain("₹19,500");
    expect(a.answer).toContain("₹2,500 short");
    expect(a.disclaimer).toBe(DISCLAIMER);
    expect(templateAnswer("where_money", snapshot, "hi").disclaimer).toBe(DISCLAIMER_HI);
    const allowed = snapshotFigures(snapshot);
    for (const lang of ["en", "hi"] as const) {
      for (const intent of ALL_INTENTS) {
        const reply = templateAnswer(intent, snapshot, lang);
        expect(unknownFigures(reply.answer, allowed), `${intent} ${lang}`).toEqual([]);
        expect(checkCoachAnswer(reply, snapshot), `${intent} ${lang}`).toBe(true);
        expect(passesAdviceCheck(reply.answer)).toBe(true);
      }
    }
  });

  it("instrument table never mentions digital gold as an option", () => {
    expect(INSTRUMENTS.gold.name).toBe("Gold ETF or gold mutual fund");
  });
});

describe("money coach", () => {
  it("sends money that came back where the plan says, in order", () => {
    const a = templateAnswer("money_back", snapshot, "en");
    expect(a.answer).toContain("₹800 from Ramesh Kumar");
    expect(a.answer).toContain("put ₹800 in your emergency cushion (2 months of essentials now, aim for 3)");
    expect(a.actionIds).toEqual(["emergency"]);
  });

  it("plans an amount typed in the question", () => {
    expect(amountInQuestion("I got 20,000 back")).toBe(R(20_000));
    expect(amountInQuestion("got ₹1200 from Priya")).toBe(R(1_200));
    expect(amountInQuestion("2 friends paid")).toBeNull();
    const a = templateAnswer("money_back", snapshot, "en", "I got 20000 back from my brother");
    expect(a.answer).toContain("₹20,000 — based on");
    expect(a.answer).toContain("put ₹18,500 in your emergency cushion");
    expect(a.answer).toContain("put ₹1,200 toward Car down payment");
    expect(a.answer).toContain("keep ₹300 for yourself");
  });

  it("lists the next steps with their buttons", () => {
    const a = templateAnswer("next_steps", snapshot, "en");
    expect(a.answer).toContain("1) ₹800 is back from Ramesh Kumar");
    expect(a.answer).toContain("2) Keep ₹12,000 for Rent");
    expect(a.actionIds).toEqual(["lent", "bills"]);
  });

  it("lays out the emergency plan with helplines", () => {
    const a = templateAnswer("emergency", snapshot, "en");
    expect(a.answer).toContain("1) you have ₹43,000 free after bills, about 2 months of essentials");
    expect(a.answer).toContain("pause goal saving: frees ₹17,000 a month");
    expect(a.answer).toContain("1930");
    expect(a.answer).toContain("112");
  });

  it("explains rewards with the real reward from the goal", () => {
    const a = templateAnswer("rewards", snapshot, "en");
    expect(a.answer).toContain("2 of 4");
    expect(a.answer).toContain("still to do: sort every payment, no lent money overdue");
    expect(a.answer).toContain("by 30 Oct 2027 instead of 30 Dec 2027");
  });

  it("answers crisis and medical questions with care, not finance", () => {
    const crisis = templateAnswer("crisis", snapshot, "en");
    expect(crisis.answer).toContain("14416");
    expect(crisis.disclaimer).toBe(CARE_NOTE);
    expect(crisis.actionIds).toEqual([]);
    expect(templateAnswer("medical", snapshot, "en").disclaimer).toBe(CARE_NOTE);
  });

  it("rejects an AI answer with an invented figure or an unknown button", () => {
    const base = { answer: "Put ₹800 in your cushion.", figuresUsed: ["₹800"], actionIds: ["emergency"], disclaimer: "" };
    expect(checkCoachAnswer(base, snapshot)).toBe(true);
    expect(checkCoachAnswer({ ...base, answer: "Put ₹900 in your cushion." }, snapshot)).toBe(false);
    expect(checkCoachAnswer({ ...base, actionIds: ["pay_now"] }, snapshot)).toBe(false);
  });
});

describe("coach training pack", () => {
  it("passes every eval case with the template coach", () => {
    for (const c of COACH_EVALS) {
      const intent = detectIntent(c.question);
      expect(intent, c.id).toBe(c.intent);
      const a = templateAnswer(intent, snapshot, c.lang, c.question);
      for (const text of c.mustInclude ?? []) expect(a.answer, c.id).toContain(text);
      for (const re of c.mustNot ?? []) expect(a.answer, c.id).not.toMatch(re);
      for (const id of c.actions ?? []) expect(a.actionIds, c.id).toContain(id);
    }
  });

  it("worked examples follow the same rules the checker enforces", () => {
    for (const ex of COACH_EXAMPLES) {
      expect(passesAdviceCheck(ex.output.answer)).toBe(true);
      expect(ex.output.actionIds.length).toBeLessThanOrEqual(3);
      for (const id of ex.output.actionIds) expect(id in COACH_ACTIONS).toBe(true);
      const used = (ex.output.answer.match(/₹[\d,]+/g) ?? []).sort();
      expect([...new Set(used)].sort()).toEqual([...new Set(ex.output.figuresUsed)].sort());
    }
    expect(COACH_SYSTEM_INSTRUCTION).toContain("1930");
  });
});

describe("coach model input", () => {
  it("keeps crisis, medical and product questions away from the model", () => {
    expect(ALL_INTENTS.filter((i) => !usesModel(i))).toEqual(["crisis", "medical", "product"]);
  });

  it("sends no names and puts them back in the answer", () => {
    const { snapshot: redacted, redact, restore } = redactNames(snapshot);
    const sent = coachModelInput(redact("Did Ramesh pay me back?"), "en", redacted);
    expect(sent).not.toMatch(/Priya|Ramesh|Kumar/);
    expect(sent).toContain("Person 1");
    expect(restore("Person 2 paid back; Person 1 still owes ₹1,500.")).toBe("Ramesh Kumar paid back; Priya still owes ₹1,500.");
    expect(snapshotFigures(redacted)).toEqual(snapshotFigures(snapshot));
  });
});
