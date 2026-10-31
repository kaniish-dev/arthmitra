/**
 * Stable key so the same bank entry never lands twice (AA, CSV and the simulator can overlap).
 * Two 32-bit FNV-1a passes with different offsets → 16 hex chars; synchronous in browser and Node.
 */
export function dedupeKey(parts: {
  accountId: string | null;
  date: string;
  amountPaise: number;
  reference: string;
}): string {
  const source = [parts.accountId ?? "cash", parts.date, parts.amountPaise, parts.reference.trim().toLowerCase()].join("|");
  return fnv1a(source, 0x811c9dc5) + fnv1a(source, 0x01000193);
}

function fnv1a(text: string, offset: number): string {
  let hash = offset >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
