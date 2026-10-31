/** Rule-based categorisation: user rules → keyword rules → merchant cache. Smart sorting (ml.ts) and Gemini come after these. */

/** Words that wrap the merchant name in Indian bank narrations. */
const NARRATION_WORDS = new Set([
  "upi", "pos", "neft", "imps", "rtgs", "ach", "nach", "ecs", "mb", "ib", "ecom", "bil", "billpay",
  "to", "by", "from", "ref", "txn", "payment", "paid", "p2m", "p2a", "vpa", "debit", "credit", "card",
  "com", "www", "pvt", "ltd", "private", "limited", "llp",
]);

/** "UPI/SWIGGY*ORDER7781/swiggy@icici" → "swiggy"; "UPI-RK TRADERS-rk@okaxis" → "rk traders". */
export function normalizeMerchant(raw: string): string {
  // UPI handles (name@bank) are dropped; hyphens are separators, so they are not part of a handle here.
  const lower = raw.toLowerCase().replace(/[a-z0-9._]+@[a-z0-9.]+/g, " ");
  const segments = lower
    .split(/[/|*\\-]+|\s{2,}/)
    .map((seg) => seg.replace(/[^a-z&' ]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const seg of segments) {
    const words = seg.split(" ").filter((w) => !NARRATION_WORDS.has(w));
    if (words.join("").length >= 2) return words.join(" ");
  }
  return lower.replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim() || "unknown";
}

/** Spend keywords per category. The longest matching keyword wins ("swiggy instamart" → groceries). */
export const SPEND_KEYWORDS: Record<string, string[]> = {
  food: ["swiggy", "zomato", "eatsure", "dominos", "domino's", "mcdonalds", "kfc", "pizza", "restaurant", "cafe", "dhaba", "biryani", "chai", "bakery", "sweets"],
  groceries: ["bigbasket", "blinkit", "zepto", "instamart", "swiggy instamart", "dmart", "jiomart", "grocery", "kirana", "supermarket", "milk", "dairy"],
  travel: ["uber", "ola", "rapido", "irctc", "metro", "indigo", "air india", "makemytrip", "redbus", "fuel", "petrol", "hpcl", "iocl", "bpcl", "fastag", "parking"],
  shopping: ["amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "decathlon", "croma", "reliance digital"],
  bills: ["electricity", "bescom", "msedcl", "tneb", "airtel", "jio", "vodafone", "bsnl", "broadband", "dth", "tata play", "recharge", "water bill", "gas bill", "indane", "bharat gas"],
  subscriptions: ["netflix", "hotstar", "jiohotstar", "prime video", "spotify", "sonyliv", "zee5", "youtube premium", "subscription", "icloud", "google one"],
  entertainment: ["bookmyshow", "pvr", "inox", "zee", "gaming", "steam"],
  health: ["apollo", "pharmeasy", "netmeds", "medplus", "pharmacy", "chemist", "hospital", "clinic", "diagnostics", "lab"],
  education: ["school", "college", "tuition", "fees", "coaching", "coursera", "udemy", "unacademy"],
  rent: ["rent", "nobroker", "landlord"],
  emi: ["emi", "loan", "bajaj finance", "home credit"],
};

const INCOME_KEYWORDS = ["salary", "payroll", "sal credit", "stipend", "interest"];
const REFUND_KEYWORDS = ["refund", "reversal", "reversed", "cashback", "chargeback"];

/** Shop-type words that hint at likely categories when no keyword matches. */
const HINTS: Array<{ words: string[]; suggestions: string[] }> = [
  { words: ["traders", "trader", "stores", "store", "mart", "general", "enterprises", "provision"], suggestions: ["groceries", "shopping", "others"] },
  { words: ["medical", "medicals", "pharma", "chemist", "health"], suggestions: ["health", "groceries", "others"] },
  { words: ["hotel", "bhojnalaya", "foods", "kitchen", "canteen", "mess"], suggestions: ["food", "travel", "others"] },
  { words: ["travels", "tours", "cabs", "auto", "motors"], suggestions: ["travel", "others", "shopping"] },
  { words: ["school", "academy", "classes", "institute"], suggestions: ["education", "others", "bills"] },
];
const DEFAULT_SPEND_SUGGESTIONS = ["others", "shopping", "food"];

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

function longestKeywordMatch(text: string, table: Record<string, string[]>): string | null {
  let best: { category: string; length: number } | null = null;
  for (const [category, words] of Object.entries(table)) {
    for (const w of words) {
      if (containsPhrase(text, w) && (!best || w.length > best.length)) best = { category, length: w.length };
    }
  }
  return best?.category ?? null;
}

export type CategoriseVia = "user_rule" | "keyword" | "cache" | "ml" | "ai" | "none";

export interface CategoriseResult {
  category: string | null;
  confidence: number;
  suggestions: string[];
  status: "categorised" | "uncategorised";
  via: CategoriseVia;
}

export interface CategoriseContext {
  /** merchantKey → category, learned from the user's corrections. */
  userRules: Record<string, string>;
  /** merchantKey → earlier result (from keywords or Gemini). */
  cache: Record<string, { category: string; confidence: number }>;
  /** At or above this confidence a transaction is sorted silently (default 0.8). */
  threshold: number;
  /** Category ids that exist for this user; suggestions outside it are dropped. */
  known: string[];
}

/** Applies the confidence threshold: high → categorised, low → inbox with suggestions. */
export function decide(
  category: string | null,
  confidence: number,
  suggestions: string[],
  threshold: number,
  via: CategoriseVia,
): CategoriseResult {
  const unique = [...new Set([...(category ? [category] : []), ...suggestions])].slice(0, 3);
  if (category && confidence >= threshold) {
    return { category, confidence, suggestions: unique, status: "categorised", via };
  }
  return { category: null, confidence, suggestions: unique, status: "uncategorised", via };
}

/** Rule steps only. A "none" result is where the caller asks Gemini, if AI is on. */
export function categoriseByRules(merchantKey: string, amountPaise: number, ctx: CategoriseContext): CategoriseResult {
  const keep = (ids: string[]) => ids.filter((id) => ctx.known.includes(id));
  const rule = ctx.userRules[merchantKey];
  if (rule && ctx.known.includes(rule)) return decide(rule, 1, [], ctx.threshold, "user_rule");

  if (amountPaise > 0) {
    if (REFUND_KEYWORDS.some((k) => containsPhrase(merchantKey, k) || merchantKey.includes(k))) {
      return decide("refund", 0.9, ["refund", "income"], ctx.threshold, "keyword");
    }
    if (INCOME_KEYWORDS.some((k) => containsPhrase(merchantKey, k) || merchantKey.includes(k))) {
      return decide("income", 0.95, ["income"], ctx.threshold, "keyword");
    }
    return decide(null, 0.5, ["income", "refund", "transfer"], ctx.threshold, "none");
  }

  const keyword = longestKeywordMatch(merchantKey, SPEND_KEYWORDS);
  if (keyword && ctx.known.includes(keyword)) return decide(keyword, 0.9, [], ctx.threshold, "keyword");

  const cached = ctx.cache[merchantKey];
  if (cached && ctx.known.includes(cached.category)) {
    return decide(cached.category, cached.confidence, [], ctx.threshold, "cache");
  }

  const hint = HINTS.find((h) => h.words.some((w) => containsPhrase(merchantKey, w)));
  const suggestions = keep(hint?.suggestions ?? DEFAULT_SPEND_SUGGESTIONS);
  return decide(null, 0.3, suggestions.length ? suggestions : keep(DEFAULT_SPEND_SUGGESTIONS), ctx.threshold, "none");
}
