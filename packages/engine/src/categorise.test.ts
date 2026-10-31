import { describe, expect, it } from "vitest";
import { defaultCategories } from "./categories";
import { categoriseByRules, normalizeMerchant, type CategoriseContext } from "./categorise";

const ctx = (over: Partial<CategoriseContext> = {}): CategoriseContext => ({
  userRules: {},
  cache: {},
  threshold: 0.8,
  known: defaultCategories().map((c) => c.id),
  ...over,
});

describe("normalizeMerchant", () => {
  it("pulls the merchant out of UPI and bank narrations", () => {
    expect(normalizeMerchant("UPI/SWIGGY*ORDER7781/swiggy@icici")).toBe("swiggy");
    expect(normalizeMerchant("UPI-RK TRADERS-rktraders@okaxis")).toBe("rk traders");
    expect(normalizeMerchant("POS 4521 BIGBASKET BANGALORE")).toBe("bigbasket bangalore");
    expect(normalizeMerchant("NEFT-SALARY ACME TECH PVT LTD")).toBe("salary acme tech");
    expect(normalizeMerchant("Netflix.com")).toBe("netflix");
  });
});

describe("categoriseByRules", () => {
  it("sorts a known merchant silently (demo: Swiggy → Food)", () => {
    const r = categoriseByRules("swiggy", -45_000, ctx());
    expect(r).toMatchObject({ category: "food", status: "categorised", via: "keyword" });
  });

  it("prefers the longest keyword", () => {
    expect(categoriseByRules("swiggy instamart", -50_000, ctx()).category).toBe("groceries");
  });

  it("sends an unknown shop to the inbox with 3 suggestions (demo: RK Traders)", () => {
    const r = categoriseByRules("rk traders", -120_000, ctx());
    expect(r.status).toBe("uncategorised");
    expect(r.category).toBeNull();
    expect(r.suggestions).toEqual(["groceries", "shopping", "others"]);
    expect(r.via).toBe("none");
  });

  it("lets the user's own rule win over keywords", () => {
    const r = categoriseByRules("swiggy", -45_000, ctx({ userRules: { swiggy: "entertainment" } }));
    expect(r).toMatchObject({ category: "entertainment", confidence: 1, via: "user_rule" });
  });

  it("uses the merchant cache, applying the threshold", () => {
    const high = categoriseByRules("sharma dairy farm", -3_000, ctx({ cache: { "sharma dairy farm": { category: "groceries", confidence: 0.92 } } }));
    expect(high.status).toBe("categorised");
    const low = categoriseByRules("xyz corp", -3_000, ctx({ cache: { "xyz corp": { category: "shopping", confidence: 0.6 } } }));
    expect(low.status).toBe("uncategorised");
    expect(low.suggestions[0]).toBe("shopping");
  });

  it("recognises salary and refunds on credits; asks about other credits", () => {
    expect(categoriseByRules("salary acme tech", 5_000_000, ctx()).category).toBe("income");
    expect(categoriseByRules("amazon refund", 20_000, ctx()).category).toBe("refund");
    const unknown = categoriseByRules("ramesh kumar", 50_000, ctx());
    expect(unknown.status).toBe("uncategorised");
    expect(unknown.suggestions).toEqual(["income", "refund", "transfer"]);
  });
});
