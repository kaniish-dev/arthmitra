"use client";

import { parseCsv, pdfTable, readStatementTable, type PdfText, type StatementRow } from "@arthmitra/engine";

export type StatementRead =
  | { ok: true; rows: StatementRow[]; skipped: number }
  | { ok: false; error: string; needsPassword?: boolean };

export const STATEMENT_ACCEPT = ".csv,.xls,.xlsx,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const NO_TABLE = "Couldn't find Date, Description and Amount (or Debit/Credit) columns in this file.";

/**
 * Reads a bank statement in the browser — the file never leaves the device. CSV, Excel
 * (.xls/.xlsx, including the HTML "Excel" files some banks send) and text PDFs.
 */
export async function readStatementFile(file: File, password?: string): Promise<StatementRead> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return fromTables([parseCsv(await file.text())]);
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return readExcel(file);
  if (name.endsWith(".pdf")) return readPdf(file, password);
  return { ok: false, error: "Choose a CSV, Excel (.xls, .xlsx) or PDF statement." };
}

function fromTables(tables: string[][][]): StatementRead {
  for (const table of tables) {
    const read = readStatementTable(table);
    if (read) return { ok: true, ...read };
  }
  return { ok: false, error: NO_TABLE };
}

async function readExcel(file: File): Promise<StatementRead> {
  const XLSX = await import("xlsx");
  try {
    const book = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    // Every sheet, in case the statement isn't on the first one.
    return fromTables(
      book.SheetNames.map((n) =>
        XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[n]!, { header: 1, raw: false, dateNF: "dd/mm/yyyy", defval: "" }).map((r) => r.map(String)),
      ),
    );
  } catch {
    return { ok: false, error: "Couldn't open this Excel file. If it has a password, remove it in Excel and save again." };
  }
}

async function readPdf(file: File, password?: string): Promise<StatementRead> {
  const pdfjs = await import("pdfjs-dist");
  // Runs pdf.js on the page itself; statements are a few pages, and no worker file needs serving.
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    if (e instanceof pdfjs.PasswordException) {
      const wrong = e.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD;
      return { ok: false, needsPassword: true, error: wrong ? "That password didn't work. Try again." : "This PDF has a password. Enter it to open the statement." };
    }
    return { ok: false, error: "Couldn't open this PDF." };
  }
  const items: PdfText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    for (const item of content.items) {
      if ("str" in item) items.push({ page: p, x: item.transform[4], y: item.transform[5], width: item.width, str: item.str });
    }
  }
  await task.destroy();
  if (items.length === 0) return { ok: false, error: "This PDF is a scanned image, so its text can't be read. Download the statement again as a PDF or Excel from net banking." };
  return fromTables([pdfTable(items)]);
}

