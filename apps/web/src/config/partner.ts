/**
 * The third-party investment app users are sent to. No broker or platform is named in the
 * prototype: set NEXT_PUBLIC_PARTNER_NAME and NEXT_PUBLIC_PARTNER_URL to plug a partner in.
 */
export const PARTNER = {
  /** Generic label used in buttons and copy. */
  label: "third-party investment app",
  name: process.env.NEXT_PUBLIC_PARTNER_NAME || "Partner investment app",
  url: process.env.NEXT_PUBLIC_PARTNER_URL || "https://example.com/invest",
};

/** Kinds of investment account a user can connect for tracking (generic, never brands). */
export const INVESTMENT_APP_KINDS = [
  { id: "mf", label: "Mutual fund investment app", icon: "pie_chart" },
  { id: "broker", label: "Stock broking app", icon: "candlestick_chart" },
  { id: "bank", label: "Bank's investment section", icon: "account_balance" },
  { id: "govt", label: "Government bonds app", icon: "gavel" },
] as const;

/**
 * Deep link into the partner app for one plan line. NEXT_PUBLIC_PARTNER_URL can carry
 * {category}, {amount} and {goal} placeholders (for example
 * https://partner.example/invest?type={category}&amt={amount}); without them the three values are
 * added as query parameters, so the partner can open the right product page with the amount filled.
 */
export function partnerLink(args: { category: string; amountRupees: number; goal: string }): string {
  const values: Record<string, string> = {
    category: encodeURIComponent(args.category),
    amount: String(Math.max(0, Math.round(args.amountRupees))),
    goal: encodeURIComponent(args.goal),
  };
  if (/\{(category|amount|goal)\}/.test(PARTNER.url)) return PARTNER.url.replace(/\{(category|amount|goal)\}/g, (_, k: string) => values[k]!);
  const url = new URL(PARTNER.url);
  for (const [k, v] of Object.entries(values)) url.searchParams.set(k, decodeURIComponent(v));
  url.searchParams.set("source", "arthmitra");
  return url.toString();
}
