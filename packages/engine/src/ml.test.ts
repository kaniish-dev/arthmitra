import { describe, expect, it } from "vitest";
import { categoriseByRules } from "./categorise";
import { defaultCategories } from "./categories";
import { merchantFeatures, predictSorter, sortExamples, trainSorter, unusualPayment, withSortPrediction } from "./ml";
import { makeTxn } from "./testing";

const R = (rupees: number) => rupees * 100;
const known = defaultCategories().map((c) => c.id);
const ctx = { userRules: {}, cache: {}, threshold: 0.8, known };

describe("smart sorting", () => {
  it("turns a name into words and 3-letter pieces", () => {
    expect(merchantFeatures("rk traders")).toEqual(["w:rk", "w:traders", "c:#rk", "c:rk#", "c:#tr", "c:tra", "c:rad", "c:ade", "c:der", "c:ers", "c:rs#"]);
  });

  it("learns from the user's sorting: a shop like one they sorted is sorted too", () => {
    const before = trainSorter([], known);
    expect(predictSorter(before, "shree rk traders").confidence).toBeLessThan(0.8);

    const sorted = [makeTxn({ merchantKey: "rk traders", category: "groceries" })];
    const after = trainSorter(sortExamples(sorted, known), known);
    const p = predictSorter(after, "shree rk traders");
    expect(p).toMatchObject({ category: "groceries", closest: { merchantKey: "rk traders" } });
    expect(p.confidence).toBeGreaterThanOrEqual(0.8);
    expect(after.userExamples).toBe(1);
  });

  it("works from day one on the built-in keywords", () => {
    expect(predictSorter(trainSorter([], known), "cafe mocha").category).toBe("food");
  });

  it("the latest category wins when the user corrected a shop", () => {
    const txns = [
      makeTxn({ merchantKey: "gift gallery", category: "shopping", date: "2026-09-01" }),
      makeTxn({ merchantKey: "gift gallery", category: "others", date: "2026-10-01" }),
    ];
    expect(sortExamples(txns, known)).toEqual([{ merchantKey: "gift gallery", category: "others" }]);
  });

  it("learns only from sorted spending", () => {
    const txns = [
      makeTxn({ merchantKey: "salary", category: "income", amountPaise: R(50_000) }),
      makeTxn({ merchantKey: "mystery", category: null, status: "uncategorised" }),
    ];
    expect(sortExamples(txns, known)).toEqual([]);
  });

  it("a sure guess sorts; an unsure one only leads the inbox suggestions; rules come first", () => {
    const rules = categoriseByRules("sharma general store", R(-300), ctx);
    expect(withSortPrediction(rules, { category: "groceries", confidence: 0.9, ranked: ["groceries"], closest: null }, 0.8)).toMatchObject({
      status: "categorised",
      category: "groceries",
      via: "ml",
    });
    const unsure = withSortPrediction(rules, { category: "health", confidence: 0.5, ranked: ["health"], closest: null }, 0.8);
    expect(unsure).toMatchObject({ status: "uncategorised", via: "none" });
    expect(unsure.suggestions[0]).toBe("health");
    const keyword = categoriseByRules("swiggy", R(-450), ctx);
    expect(withSortPrediction(keyword, { category: "shopping", confidence: 1, ranked: [], closest: null }, 0.8)).toBe(keyword);
  });
});

describe("unusual payments", () => {
  const food = [420, 560, 380, 650, 540, 720, 890, 480, 1_560].map((r, i) =>
    makeTxn({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, amountPaise: R(-r), category: "food" }),
  );

  it("flags a payment far above the usual one", () => {
    expect(unusualPayment(makeTxn({ date: "2026-10-20", amountPaise: R(-6_500), category: "food" }), food)).toEqual({ usualPaise: R(560), times: 12 });
  });

  it("a busy evening is not an alarm", () => {
    expect(unusualPayment(makeTxn({ date: "2026-10-20", amountPaise: R(-1_800), category: "food" }), food)).toBeNull();
  });

  it("a party the user confirmed (\"This was me\") is no longer unusual, and a similar one later isn't flagged", () => {
    const party = makeTxn({ id: "party", date: "2026-10-20", amountPaise: R(-6_500), category: "food", unusualCheck: "confirmed" });
    expect(unusualPayment(party, food)).toBeNull();
    const nextParty = makeTxn({ date: "2026-10-28", amountPaise: R(-7_000), category: "food" });
    expect(unusualPayment(nextParty, [...food, party])).toBeNull();
  });

  it("a payment reported as not mine stays flagged", () => {
    const t = makeTxn({ date: "2026-10-20", amountPaise: R(-6_500), category: "food", unusualCheck: "reported" });
    expect(unusualPayment(t, food)).not.toBeNull();
  });

  it("needs 5 earlier payments and at least ₹1,000", () => {
    expect(unusualPayment(makeTxn({ date: "2026-10-20", amountPaise: R(-6_500), category: "food" }), food.slice(0, 4))).toBeNull();
    const tiny = [10, 12, 11, 10, 12].map((r) => makeTxn({ amountPaise: R(-r), category: "travel" }));
    expect(unusualPayment(makeTxn({ amountPaise: R(-900), category: "travel" }), tiny)).toBeNull();
  });
});
