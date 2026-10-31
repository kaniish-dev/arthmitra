/** Dates are plain YYYY-MM-DD strings; all maths is done in UTC to avoid DST and zone drift. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

function parse(iso: string): Ymd {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: "${iso}"`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Today's date in the device's local time zone. */
export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function isValidIso(iso: string): boolean {
  try {
    const { y, m, d } = parse(iso);
    return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
  } catch {
    return false;
  }
}

/** Adds calendar months, clamping to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parse(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toIso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parse(iso);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Signed whole days from a to b. */
export function daysBetween(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
}

/** Whole calendar months from `from` to `to`; 0 when `to` is not later. */
export function monthsBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  const bIsMonthEnd = b.d === daysInMonth(b.y, b.m);
  if (b.d < a.d && !bIsMonthEnd) months -= 1;
  return Math.max(0, months);
}

/** "2026-10" from "2026-10-29". */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function previousMonthKey(iso: string): string {
  return monthKey(addMonths(`${monthKey(iso)}-01`, -1));
}

/** "29 Oct 2026" */
export function formatDate(iso: string): string {
  const { y, m, d } = parse(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Oct 2026" from "2026-10" or a full date. */
export function formatMonth(keyOrIso: string): string {
  const [y, m] = keyOrIso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** The Monday on or before the date; weeks run Monday to Sunday. */
export function startOfWeek(iso: string): string {
  const { y, m, d } = parse(iso);
  const mondayBased = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(iso, -mondayBased);
}

export function laterOf(a: string, b: string): string {
  return a >= b ? a : b;
}
