/** Saves text as a file in the browser's downloads. Nothing is uploaded. */
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * CSV with quoting. Text that starts with = + - @ gets a leading apostrophe so a
 * spreadsheet shows it as text instead of running it as a formula.
 */
export function toCsv(rows: Array<Array<string | number>>): string {
  const cell = (v: string | number) => {
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
