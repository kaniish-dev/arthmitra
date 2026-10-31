import { describe, expect, it } from "vitest";
import { readStatementTable } from "./csv";
import { pdfTable, type PdfText } from "./pdf-table";

/** Lays out text runs the way pdf.js reports them: y counts up from the bottom of the page. */
function line(page: number, y: number, cells: Array<[number, string]>): PdfText[] {
  return cells.map(([x, str]) => ({ page, x, y, width: str.length * 5, str }));
}

const HEADER: Array<[number, string]> = [
  [40, "Txn Date"],
  [110, "Description"],
  [300, "Ref No."],
  [380, "Debit"],
  [440, "Credit"],
  [500, "Balance"],
];

describe("pdfTable", () => {
  it("rebuilds rows under the header, joins wrapped narration and skips repeated headers", () => {
    const items = [
      ...line(1, 800, [[40, "State Bank of India — Account Statement"]]),
      ...line(1, 760, HEADER),
      ...line(1, 740, [[40, "01 Oct 2026"], [110, "NEFT SALARY"], [300, "N123"], [445, "50,000.00"], [500, "62,000.00"]]),
      ...line(1, 725, [[40, "03 Oct 2026"], [110, "UPI/SWIGGY/food"], [300, "U456"], [385, "450.00"], [500, "61,550.00"]]),
      ...line(1, 713, [[110, "order 8812"]]),
      ...line(1, 600, [[40, "This is a computer generated statement"]]),
      ...line(2, 800, HEADER),
      ...line(2, 780, [[40, "05/10/2026"], [110, "ATM CASH"], [385, "2,000.00"], [500, "59,550.00"]]),
    ];
    const table = pdfTable(items);
    expect(table[0]).toEqual(["Txn Date", "Description", "Ref No.", "Debit", "Credit", "Balance"]);
    expect(table).toHaveLength(4);
    expect(table[2]![1]).toBe("UPI/SWIGGY/food order 8812");

    const read = readStatementTable(table)!;
    expect(read.skipped).toBe(0);
    expect(read.rows.map((r) => [r.date, r.description, r.amountPaise, r.reference])).toEqual([
      ["2026-10-01", "NEFT SALARY", 5_000_000, "N123"],
      ["2026-10-03", "UPI/SWIGGY/food order 8812", -45_000, "U456"],
      ["2026-10-05", "ATM CASH", -200_000, ""],
    ]);
  });

  it("returns nothing when there is no statement table", () => {
    expect(pdfTable(line(1, 700, [[40, "Hello"], [200, "world"]]))).toEqual([]);
  });
});
