import { describe, expect, it } from "vitest";
import type { Investment } from "@arthmitra/schema";
import { dedupeKey } from "./dedupe";
import { findInvestmentDebit, findTransferCounterpart, savedForGoal, withdrawableDate } from "./matching";
import { makeTxn } from "./testing";

describe("own-account transfers", () => {
  const debit = makeTxn({ accountId: "a", amountPaise: -500_000, merchantRaw: "IMPS TO SELF", date: "2026-10-07" });
  it("pairs equal and opposite amounts across accounts within 3 days", () => {
    const credit = makeTxn({ accountId: "b", amountPaise: 500_000, merchantRaw: "IMPS CR", date: "2026-10-09" });
    expect(findTransferCounterpart(debit, [credit])?.id).toBe(credit.id);
  });
  it("ignores the same account, other amounts and gaps over 3 days", () => {
    const same = makeTxn({ accountId: "a", amountPaise: 500_000, date: "2026-10-07" });
    const late = makeTxn({ accountId: "b", amountPaise: 500_000, date: "2026-10-11" });
    const other = makeTxn({ accountId: "b", amountPaise: 400_000, date: "2026-10-07" });
    expect(findTransferCounterpart(debit, [same, late, other])).toBeNull();
  });
  it("needs transfer words on one side", () => {
    const plain = makeTxn({ accountId: "a", amountPaise: -500_000, merchantRaw: "SHOP", date: "2026-10-07" });
    const credit = makeTxn({ accountId: "b", amountPaise: 500_000, merchantRaw: "SALARY", date: "2026-10-07" });
    expect(findTransferCounterpart(plain, [credit])).toBeNull();
  });
});

const inv = (over: Partial<Investment> = {}): Investment => ({
  id: "i1",
  goalId: "g1",
  instrumentType: "rd",
  platform: "Bank",
  amountPaise: 1_950_000,
  date: "2026-10-30",
  status: "paid",
  matchedTxnId: null,
  maturityDate: null,
  lockInUntil: null,
  exitLoadUntil: null,
  schemeCode: null,
  units: null,
  currentValuePaise: null,
  createdAt: "2026-10-30T00:00:00.000Z",
  ...over,
});

describe("investment matching", () => {
  it("finds the closest debit of the same amount within ±3 days", () => {
    const far = makeTxn({ amountPaise: -1_950_000, date: "2026-11-02" });
    const near = makeTxn({ amountPaise: -1_950_000, date: "2026-10-31" });
    expect(findInvestmentDebit(inv(), [far, near])?.id).toBe(near.id);
  });
  it("skips cash, transfers and debits already used", () => {
    const cash = makeTxn({ amountPaise: -1_950_000, date: "2026-10-30", source: "cash" });
    const used = makeTxn({ amountPaise: -1_950_000, date: "2026-10-30", isInvestment: true });
    expect(findInvestmentDebit(inv(), [cash, used])).toBeNull();
  });
  it("counts only confirmed investments toward the goal", () => {
    expect(savedForGoal([inv({ status: "confirmed" }), inv({ id: "i2", status: "paid" })], "g1")).toBe(1_950_000);
  });
  it("uses the latest of maturity, lock-in and exit load", () => {
    expect(withdrawableDate(inv({ maturityDate: "2027-10-30", exitLoadUntil: "2026-11-06" }))).toBe("2027-10-30");
    expect(withdrawableDate(inv())).toBe("2026-10-30");
  });
});

describe("dedupeKey", () => {
  it("is stable and sensitive to every part", () => {
    const base = { accountId: "a", date: "2026-10-30", amountPaise: -45_000, reference: "UTR123" };
    expect(dedupeKey(base)).toBe(dedupeKey({ ...base, reference: " utr123 " }));
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, amountPaise: -45_001 }));
    expect(dedupeKey(base)).toMatch(/^[0-9a-f]{16}$/);
  });
});
