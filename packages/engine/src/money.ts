const PAISE_PER_RUPEE = 100;

/** ₹100 in paise — required monthly saving is rounded up to this step. */
export const HUNDRED_RUPEES = 100 * PAISE_PER_RUPEE;

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const groupedNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/**
 * Parses rupees into integer paise. Accepts Indian grouping and a rupee sign:
 * "1,23,456.50", "₹ 2,40,000", "Rs. 450", 19500. Throws on anything else.
 */
export function toPaise(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Amount must be a finite number");
    return Math.round(input * PAISE_PER_RUPEE);
  }
  const cleaned = input.trim().replace(/^(rs\.?|inr)/i, "").replace(/[₹,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`Not an amount: "${input}"`);
  const negative = cleaned.startsWith("-");
  const [whole = "0", fraction = ""] = cleaned.replace("-", "").split(".");
  const paise = Number(whole) * PAISE_PER_RUPEE + Number(fraction.padEnd(2, "0"));
  return negative ? -paise : paise;
}

/** Like toPaise, but returns null instead of throwing (for form fields). */
export function tryToPaise(input: string | number): number | null {
  try {
    return toPaise(input);
  } catch {
    return null;
  }
}

/** Paise → rupees as a plain number, for inputs and charts. */
export function toRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * Formats paise for display: "₹1,23,456" or, with decimals, "₹1,23,456.00".
 * Negative amounts get a leading minus; `signed` adds "+" to positive ones.
 */
export function formatINR(
  paise: number,
  { decimals = false, signed = false }: { decimals?: boolean; signed?: boolean } = {},
): string {
  const body = (decimals ? inrPaise : inrWhole).format(Math.abs(paise) / PAISE_PER_RUPEE);
  if (paise < 0) return `-${body}`;
  return signed && paise > 0 ? `+${body}` : body;
}

/** Rupee figure with Indian grouping and no symbol, e.g. for input fields: "2,40,000". */
export function formatRupeesPlain(paise: number): string {
  return groupedNumber.format(paise / PAISE_PER_RUPEE);
}

/** Rounds a positive paise amount up to the next step (default ₹100). Zero or less → 0. */
export function roundUpTo(paise: number, step = HUNDRED_RUPEES): number {
  if (paise <= 0) return 0;
  return Math.ceil(paise / step) * step;
}
