import { describe, expect, it } from "vitest";
import { detectColumns, parseBankDate, parseCsv, statementRows } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, commas inside quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseBankDate", () => {
  it("reads day-first Indian formats", () => {
    expect(parseBankDate("29/10/2026")).toBe("2026-10-29");
    expect(parseBankDate("29-10-26")).toBe("2026-10-29");
    expect(parseBankDate("29 Oct 2026")).toBe("2026-10-29");
    expect(parseBankDate("29-Oct-26")).toBe("2026-10-29");
    expect(parseBankDate("2026-10-29")).toBe("2026-10-29");
    expect(parseBankDate("31/02/2026")).toBeNull();
  });
});

describe("statement import", () => {
  it("maps debit/credit columns to signed paise and skips unreadable rows", () => {
    const rows = parseCsv(
      [
        "Date,Narration,Chq./Ref.No.,Withdrawal Amt.,Deposit Amt.,Closing Balance",
        '01/10/2026,NEFT-SALARY ACME,REF1,,"50,000.00","62,000.00"',
        "03/10/2026,UPI-SWIGGY,REF2,450.00,,61550.00",
        "bad,row,,,,",
      ].join("\n"),
    );
    const map = detectColumns(rows[0]!);
    expect(map).not.toBeNull();
    const { rows: out, skipped } = statementRows(rows.slice(1), map!);
    expect(out).toEqual([
      { date: "2026-10-01", description: "NEFT-SALARY ACME", amountPaise: 5_000_000, reference: "REF1" },
      { date: "2026-10-03", description: "UPI-SWIGGY", amountPaise: -45_000, reference: "REF2" },
    ]);
    expect(skipped).toBe(1);
  });

  it("reads a single amount column with Dr/Cr suffixes", () => {
    const rows = parseCsv("Txn Date,Description,Amount\n03/10/2026,UPI-SWIGGY,450.00 Dr\n04/10/2026,REFUND,120 Cr");
    const map = detectColumns(rows[0]!)!;
    expect(statementRows(rows.slice(1), map).rows.map((r) => r.amountPaise)).toEqual([-45_000, 12_000]);
  });
});
