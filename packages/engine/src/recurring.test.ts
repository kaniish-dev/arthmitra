import { describe, expect, it } from "vitest";
import { findRecurring } from "./recurring";
import { makeTxn } from "./testing";

const monthly = (merchantKey: string, category: string, dates: string[], rupees: number[]) =>
  dates.map((date, i) => makeTxn({ merchantKey, category, date, amountPaise: -rupees[i]! * 100 }));

describe("findRecurring", () => {
  const today = "2026-10-30";

  it("finds rent paid on the same day each month and dates the next one", () => {
    const [rent] = findRecurring(monthly("landlord sharma", "rent", ["2026-08-03", "2026-09-03", "2026-10-03"], [12_000, 12_000, 12_000]), today);
    expect(rent).toMatchObject({ merchantKey: "landlord sharma", amountPaise: 1_200_000, nextDate: "2026-11-03", daysUntil: 4, paidThisMonth: true, months: 3 });
  });

  it("ignores habits: categories outside bills, and merchants paid more than once a month", () => {
    const food = monthly("cafe", "food", ["2026-09-10", "2026-10-10"], [300, 300]);
    const twice = monthly("netflix com", "entertainment", ["2026-09-09", "2026-09-20", "2026-10-09"], [649, 649, 649]);
    expect(findRecurring([...food, ...twice], today)).toEqual([]);
  });

  it("needs similar amounts, similar days and at least two months", () => {
    const tickets = monthly("bookmyshow", "entertainment", ["2026-09-21", "2026-10-21"], [1_552, 552]);
    const drifting = monthly("gym", "bills", ["2026-09-02", "2026-10-20"], [999, 999]);
    const once = monthly("insurance", "bills", ["2026-10-05"], [2_000]);
    expect(findRecurring([...tickets, ...drifting, ...once], today)).toEqual([]);
  });

  it("flags a bill not seen yet this month as past its expected date", () => {
    const [broadband] = findRecurring(monthly("airtel broadband", "bills", ["2026-08-06", "2026-09-06"], [800, 800]), today);
    expect(broadband).toMatchObject({ nextDate: "2026-10-06", paidThisMonth: false, daysUntil: -24 });
  });

  it("skips transfers, credits, uncategorised items and future dates", () => {
    const txns = [
      ...monthly("self", "transfer", ["2026-09-01", "2026-10-01"], [5_000, 5_000]).map((t) => ({ ...t, isTransfer: true, category: "bills" })),
      ...monthly("refund co", "bills", ["2026-09-02", "2026-10-02"], [100, 100]).map((t) => ({ ...t, amountPaise: -t.amountPaise })),
      ...monthly("unknown", "bills", ["2026-09-04", "2026-10-04"], [100, 100]).map((t) => ({ ...t, status: "uncategorised" as const })),
    ];
    expect(findRecurring(txns, today)).toEqual([]);
  });

  it("lists the soonest first", () => {
    const list = findRecurring(
      [
        ...monthly("netflix com", "entertainment", ["2026-09-09", "2026-10-09"], [649, 649]),
        ...monthly("landlord sharma", "rent", ["2026-09-03", "2026-10-03"], [12_000, 12_000]),
      ],
      today,
    );
    expect(list.map((r) => r.merchantKey)).toEqual(["landlord sharma", "netflix com"]);
  });
});
