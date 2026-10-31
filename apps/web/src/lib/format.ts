import { formatDate, formatINR, type RecurringPayment } from "@arthmitra/engine";

/** "rk traders" → "RK Traders": one- and two-letter words are usually initials. */
export function merchantLabel(key: string): string {
  const words = key.split(" ").filter(Boolean);
  if (words.length === 0) return "Unknown";
  return words.map((w) => (w.length <= 2 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1))).join(" ");
}

/** Payment-app amounts: money in gets a plus sign (and green), money out shows plain. */
export function amountText(paise: number): string {
  return paise > 0 ? `+${formatINR(paise)}` : formatINR(-paise);
}

/** "Due today", "Due in 4 days", "Due 9 Nov 2026", or "Not seen since 6 Sep 2026" for a late bill. */
export function dueLabel(bill: Pick<RecurringPayment, "daysUntil" | "nextDate" | "lastDate">): string {
  if (bill.daysUntil < 0) return `Not seen since ${formatDate(bill.lastDate)}`;
  if (bill.daysUntil === 0) return "Due today";
  if (bill.daysUntil === 1) return "Due tomorrow";
  if (bill.daysUntil <= 7) return `Due in ${bill.daysUntil} days`;
  return `Due ${formatDate(bill.nextDate)}`;
}

/** Hindi due label for the coach: "आज", "कल", "4 दिन में", or a late bill. */
export function dueLabelHi(bill: Pick<RecurringPayment, "daysUntil" | "nextDate">): string {
  if (bill.daysUntil < 0) return "इस महीने अभी नहीं दिखा";
  if (bill.daysUntil === 0) return "आज देना है";
  if (bill.daysUntil === 1) return "कल देना है";
  if (bill.daysUntil <= 7) return `${bill.daysUntil} दिन में देना है`;
  return `${formatDate(bill.nextDate)} को देना है`;
}
