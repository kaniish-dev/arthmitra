import { describe, expect, it } from "vitest";
import { AA_PURPOSE, consentRequest, readDepositData } from "./aa";

const fi = (transaction: unknown[], extra: Record<string, unknown> = {}) => ({
  account: {
    type: "deposit",
    maskedAccNumber: "XXXXXXXX4321",
    linkedAccRef: "ref-1",
    profile: { holders: { holder: [{ name: "Someone", pan: "ABCDE1234F" }] } },
    summary: { currentBalance: "41,250.50", type: "SAVINGS" },
    transactions: { startDate: "2026-04-30", endDate: "2026-10-30", transaction },
    ...extra,
  },
});

describe("AA consent request", () => {
  it("asks only for balance and transactions of deposit accounts, for budgeting, for 12 months", () => {
    const c = consentRequest("2026-10-30", "2026-10-30T10:00:00.000Z");
    expect(c.purpose).toEqual(AA_PURPOSE);
    expect(c.purpose.code).toBe("102");
    expect(c.consentTypes).toEqual(["SUMMARY", "TRANSACTIONS"]);
    expect(c.consentTypes).not.toContain("PROFILE");
    expect(c.fiTypes).toEqual(["DEPOSIT"]);
    expect(c.fetchType).toBe("PERIODIC");
    expect(c.fiDataRange.from).toBe("2026-04-30T00:00:00.000Z");
    expect(c.consentExpiry).toBe("2027-10-30T23:59:59.000Z");
    expect(c.dataLife).toEqual({ unit: "MONTH", value: 12 });
  });
});

describe("readDepositData", () => {
  it("turns ReBIT transactions into signed paise rows keyed by txnId", () => {
    const s = readDepositData(
      fi([
        { txnId: "T1", type: "DEBIT", mode: "UPI", amount: "450.00", transactionTimestamp: "2026-10-12T09:41:12+05:30", narration: "UPI/SWIGGY*ORDER7781/swiggy@icici" },
        { txnId: "T2", type: "CREDIT", mode: "FT", amount: 50000, valueDate: "2026-10-01", narration: "NEFT-SALARY ACME TECH PVT LTD" },
      ]),
    );
    expect(s.last4).toBe("4321");
    expect(s.type).toBe("savings");
    expect(s.balancePaise).toBe(4_125_050);
    expect(s.rows).toEqual([
      { date: "2026-10-12", description: "UPI/SWIGGY*ORDER7781/swiggy@icici", amountPaise: -45_000, reference: "T1" },
      { date: "2026-10-01", description: "NEFT-SALARY ACME TECH PVT LTD", amountPaise: 5_000_000, reference: "T2" },
    ]);
  });

  it("dates by Indian time, so a UTC timestamp late at night lands on the next day", () => {
    const s = readDepositData(fi([{ txnId: "T3", type: "DEBIT", amount: "99", transactionTimestamp: "2026-10-12T20:00:00Z", valueDate: "2026-10-12", narration: "POS DMART" }]));
    expect(s.rows[0]!.date).toBe("2026-10-13");
  });

  it("counts unreadable transactions instead of guessing", () => {
    const s = readDepositData(
      fi([
        { txnId: "T4", type: "DEBIT", amount: "abc", valueDate: "2026-10-12", narration: "X" },
        { txnId: "T5", type: "DEBIT", amount: "10", narration: "No date" },
        { txnId: "T6", type: "DEBIT", amount: "0", valueDate: "2026-10-12", narration: "Zero" },
        { txnId: "T7", type: "DEBIT", mode: "ATM", amount: "500", valueDate: "2026-10-12" },
      ]),
    );
    expect(s.skipped).toBe(3);
    expect(s.rows).toEqual([{ date: "2026-10-12", description: "ATM payment", amountPaise: -50_000, reference: "T7" }]);
  });

  it("rejects data that is not a ReBIT deposit account", () => {
    expect(() => readDepositData({ hello: "world" })).toThrow("Not ReBIT deposit data");
    expect(() => readDepositData(fi([], { maskedAccNumber: "XXXX" }))).toThrow("last 4 digits");
  });
});
