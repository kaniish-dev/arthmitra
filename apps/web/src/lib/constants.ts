import { DISCLAIMER as SHARED_DISCLAIMER } from "@arthmitra/schema";

/**
 * Every feature name and every compliance note in one place, so a rename (say "Lend" →
 * "Udhaar Khata") is a one-line change.
 */
export const FEATURES = {
  coach: { name: "Coach", tagline: "Your AI money buddy", href: "/coach", icon: "forum" },
  crisisCushion: { name: "Crisis Cushion", tagline: "Emergency fund for bad days", href: "/cushion", icon: "health_and_safety" },
  lend: { name: "Lend", tagline: "Who owes you, and when", href: "/lent", icon: "handshake" },
  financeFirstClass: { name: "Finance First Class", tagline: "Money lessons in 3 minutes", href: "/learn", icon: "school" },
  befikarMode: { name: "Befikar Mode", tagline: "Your Freedom Date", href: "/befikar", icon: "beach_access" },
  bigDay: { name: "Save for a Big Day", tagline: "Car, wedding, dream trip", icon: "celebration" },
  wealth: { name: "Wealth Generator", tagline: "Escape the rat race", icon: "trending_up" },
} as const;

export const APP_NAME = "ArthMitra";

/** The one disclaimer shown on plans, suggestions, projections, portfolio returns, Coach and articles. */
export const DISCLAIMER = SHARED_DISCLAIMER;

export const COMPLIANCE = {
  kyc: "In the live app, a licensed verification provider checks PAN and Aadhaar. We store only the last 4 digits of your Aadhaar.",
  bank: "Your transaction history comes through an RBI Account Aggregator consent, or a bank statement you upload. This demo uses sample data.",
  noTrades: "ArthMitra never holds your money or places trades. It plans, redirects and tracks.",
  minors: "Either you or your guardian can invest on a third-party app. ArthMitra only tracks the portfolio.",
} as const;

/** Shown wherever something is mocked in this prototype. */
export const DEMO_BADGE = "Demo mode";
