import { isValidIso, toIso } from "./dates";
import { tryToPaise } from "./money";

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export interface ColumnMap {
  date: number;
  description: number;
  debit: number | null;
  credit: number | null;
  /** Single signed amount column, used when there are no debit/credit columns. */
  amount: number | null;
  reference: number | null;
}

const find = (header: string[], pattern: RegExp) => {
  const i = header.findIndex((h) => pattern.test(h.trim().toLowerCase()));
  return i === -1 ? null : i;
};

/** Recognises common Indian bank statement headers. Null when date/description/amount can't be found. */
export function detectColumns(header: string[]): ColumnMap | null {
  const date = find(header, /(^|\s)(txn |transaction |value )?date/);
  const description = find(header, /narration|description|particulars|details|remarks/);
  const debit = find(header, /debit|withdrawal|\bdr\b/);
  const credit = find(header, /credit|deposit|\bcr\b/);
  const amount = debit === null && credit === null ? find(header, /amount/) : null;
  const reference = find(header, /ref|chq|cheque|utr/);
  if (date === null || description === null) return null;
  if (amount === null && (debit === null || credit === null)) return null;
  return { date, description, debit, credit, amount, reference };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Accepts 2026-10-29, 29/10/2026, 29-10-2026, 29/10/26, 29 Oct 2026, 29-Oct-26. Day-first, as Indian banks print. */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return checked(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) return checked(fullYear(m[3]!), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS[m[2]!.toLowerCase()];
    return month ? checked(fullYear(m[3]!), month, Number(m[1])) : null;
  }
  return null;
}

function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}

function checked(y: number, m: number, d: number): string | null {
  const iso = toIso(y, m, d);
  return isValidIso(iso) ? iso : null;
}

export interface StatementRow {
  date: string;
  description: string;
  amountPaise: number;
  reference: string;
}

/** Turns parsed rows into signed paise amounts (debit → negative). Rows that can't be read are counted, not guessed. */
export function statementRows(rows: string[][], map: ColumnMap): { rows: StatementRow[]; skipped: number } {
  const out: StatementRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = parseBankDate(r[map.date] ?? "");
    const description = (r[map.description] ?? "").trim();
    let amountPaise: number | null = null;
    if (map.amount !== null) {
      const raw = (r[map.amount] ?? "").trim();
      const isDebit = /dr$/i.test(raw);
      const value = tryToPaise(raw.replace(/\s*(dr|cr)$/i, ""));
      amountPaise = value === null ? null : isDebit ? -Math.abs(value) : value;
    } else {
      const debit = tryToPaise((r[map.debit!] ?? "").trim() || "0");
      const credit = tryToPaise((r[map.credit!] ?? "").trim() || "0");
      if (debit !== null && credit !== null) amountPaise = credit - Math.abs(debit);
    }
    if (!date || !description || amountPaise === null || amountPaise === 0) {
      skipped++;
      continue;
    }
    out.push({ date, description, amountPaise, reference: map.reference !== null ? (r[map.reference] ?? "").trim() : "" });
  }
  return { rows: out, skipped };
}
