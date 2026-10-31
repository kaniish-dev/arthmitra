import { detectColumns, parseBankDate } from "./csv";

/** One run of text from a PDF page, with its left edge, baseline and width in PDF units. */
export interface PdfText {
  page: number;
  x: number;
  y: number;
  width: number;
  str: string;
}

interface Cell {
  x: number;
  end: number;
  text: string;
}

interface Line {
  page: number;
  y: number;
  cells: Cell[];
}

/** Text runs closer than this on a line belong to the same cell. */
const CELL_GAP = 6;
/** Baselines this close are the same line. */
const SAME_LINE = 3;
/** A wrapped narration line sits at most this far below the row it continues. */
const WRAP_GAP = 16;

function toLines(items: PdfText[]): Line[] {
  const sorted = items.filter((t) => t.str.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: Array<{ page: number; y: number; items: PdfText[] }> = [];
  for (const t of sorted) {
    const line = lines.at(-1);
    if (line && line.page === t.page && Math.abs(line.y - t.y) <= SAME_LINE) line.items.push(t);
    else lines.push({ page: t.page, y: t.y, items: [t] });
  }
  return lines.map((l) => {
    const cells: Cell[] = [];
    for (const t of l.items.sort((a, b) => a.x - b.x)) {
      const cell = cells.at(-1);
      if (cell && t.x - cell.end <= CELL_GAP) {
        cell.text += (t.x - cell.end > 1 ? " " : "") + t.str;
        cell.end = Math.max(cell.end, t.x + t.width);
      } else cells.push({ x: t.x, end: t.x + t.width, text: t.str });
    }
    return { page: l.page, y: l.y, cells: cells.map((c) => ({ ...c, text: c.text.trim() })) };
  });
}

/**
 * Rebuilds a bank statement table from a text PDF: finds the header line, places every cell
 * below it in the nearest header column, and joins wrapped narration lines onto their row.
 * Returns the header followed by one row per dated transaction, ready for readStatementTable.
 */
export function pdfTable(items: PdfText[]): string[][] {
  const lines = toLines(items);
  const headerAt = lines.findIndex((l) => detectColumns(l.cells.map((c) => c.text)) !== null);
  if (headerAt === -1) return [];
  const header = lines[headerAt]!.cells;
  const map = detectColumns(header.map((c) => c.text))!;
  const centres = header.map((c) => (c.x + c.end) / 2);
  const column = (c: Cell) => {
    const mid = (c.x + c.end) / 2;
    let best = 0;
    for (let i = 1; i < centres.length; i++) if (Math.abs(centres[i]! - mid) < Math.abs(centres[best]! - mid)) best = i;
    return best;
  };

  const rows: string[][] = [];
  let last: { row: string[]; page: number; y: number } | null = null;
  for (const line of lines.slice(headerAt + 1)) {
    const texts = line.cells.map((c) => c.text);
    // Later pages repeat the header.
    if (detectColumns(texts) !== null) continue;
    const row = header.map(() => "");
    for (const cell of line.cells) {
      const i = column(cell);
      row[i] = row[i] ? `${row[i]} ${cell.text}` : cell.text;
    }
    if (parseBankDate(row[map.date] ?? "")) {
      rows.push(row);
      last = { row, page: line.page, y: line.y };
      continue;
    }
    // A wrapped narration: only description text, right under the row it belongs to.
    const onlyDescription = row.every((v, i) => !v || i === map.description || i === map.reference);
    if (last && onlyDescription && line.page === last.page && last.y - line.y <= WRAP_GAP) {
      for (const i of [map.description, map.reference]) {
        if (i !== null && row[i]) last.row[i] = `${last.row[i]} ${row[i]}`.trim();
      }
      last.y = line.y;
    } else last = null;
  }
  return [header.map((c) => c.text), ...rows];
}
