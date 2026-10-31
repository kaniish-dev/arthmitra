import type { Transaction } from "@arthmitra/schema";
import { SPEND_KEYWORDS, decide, type CategoriseResult } from "./categorise";
import { addDays, daysInMonth, monthKey, previousMonthKey } from "./dates";
import { isSpending } from "./finance";

/**
 * On-device machine learning. Two small models that train on the user's own payments in the
 * browser, so no bank data leaves the device:
 *
 * 1. Smart sorting — TF-IDF features of the merchant name + k-nearest neighbours. Sorts a shop it
 *    has not seen before when its name looks like shops the user already sorted.
 * 2. Unusual payments — a robust outlier test (median and MAD) per category; a payment far above
 *    the usual amount raises a safety alert.
 */

// ---------- 1. Smart sorting ----------

export interface SortExample {
  merchantKey: string;
  category: string;
}

type Vector = Map<string, number>;

export interface SortModel {
  idf: Map<string, number>;
  examples: Array<{ merchantKey: string; category: string; vector: Vector }>;
  /** Examples that came from the user's own sorted payments (the rest are built-in keywords). */
  userExamples: number;
}

/** Words and 3-letter pieces of the name: "spice route" → w:spice, w:route, c:#sp, c:spi, … */
export function merchantFeatures(merchantKey: string): string[] {
  const words = merchantKey.toLowerCase().split(/\s+/).filter(Boolean);
  const grams = words.flatMap((w) => {
    const padded = `#${w}#`;
    return Array.from({ length: Math.max(0, padded.length - 2) }, (_, i) => `c:${padded.slice(i, i + 3)}`);
  });
  return [...words.map((w) => `w:${w}`), ...grams];
}

function tfidf(features: string[], idf: Map<string, number>): Vector {
  const v: Vector = new Map();
  for (const f of features) {
    const weight = idf.get(f);
    if (weight) v.set(f, (v.get(f) ?? 0) + weight);
  }
  const norm = Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
  if (norm > 0) for (const [k, x] of v) v.set(k, x / norm);
  return v;
}

function cosine(a: Vector, b: Vector): number {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) dot += x * (large.get(k) ?? 0);
  return dot;
}

/** The categorised spending a model learns from: one example per shop, the latest category winning. */
export function sortExamples(txns: Transaction[], known: string[]): SortExample[] {
  const byShop = new Map<string, SortExample>();
  const oldestFirst = [...txns].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const t of oldestFirst) {
    if (t.status !== "categorised" || !t.category || !isSpending(t) || !known.includes(t.category)) continue;
    byShop.set(t.merchantKey, { merchantKey: t.merchantKey, category: t.category });
  }
  return [...byShop.values()];
}

/** Trains on the user's examples plus the built-in keyword list, so it works from day one. */
export function trainSorter(userExamples: SortExample[], known: string[]): SortModel {
  const seeds = Object.entries(SPEND_KEYWORDS)
    .filter(([category]) => known.includes(category))
    .flatMap(([category, words]) => words.map((merchantKey) => ({ merchantKey, category })));
  const all = [...seeds, ...userExamples];
  const docFreq = new Map<string, number>();
  for (const ex of all) for (const f of new Set(merchantFeatures(ex.merchantKey))) docFreq.set(f, (docFreq.get(f) ?? 0) + 1);
  // Rare pieces of a name say more about it than common ones.
  const idf = new Map([...docFreq].map(([f, n]) => [f, Math.log((1 + all.length) / (1 + n)) + 1]));
  return {
    idf,
    examples: all.map((ex) => ({ ...ex, vector: tfidf(merchantFeatures(ex.merchantKey), idf) })),
    userExamples: userExamples.length,
  };
}

export interface SortPrediction {
  category: string | null;
  /** 0–1: how sure the model is; compared with the user's sorting threshold. */
  confidence: number;
  /** Up to 3 categories, most likely first, for the inbox. */
  ranked: string[];
  /** The most similar shop the model has seen, to explain the choice. */
  closest: { merchantKey: string; similarity: number } | null;
}

const K = 5;

/** k-nearest neighbours: the 5 most similar known shops vote, closer shops counting for more. */
export function predictSorter(model: SortModel, merchantKey: string): SortPrediction {
  const v = tfidf(merchantFeatures(merchantKey), model.idf);
  const neighbours = model.examples
    .map((ex) => ({ ex, sim: cosine(v, ex.vector) }))
    .filter((n) => n.sim > 0)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, K);
  if (!neighbours.length) return { category: null, confidence: 0, ranked: [], closest: null };

  const votes = new Map<string, number>();
  // Squared so one near-identical shop outweighs several loose matches.
  for (const n of neighbours) votes.set(n.ex.category, (votes.get(n.ex.category) ?? 0) + n.sim * n.sim);
  const ranked = [...votes].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, w]) => s + w, 0);
  const [top, topVotes] = ranked[0]!;
  const best = neighbours.find((n) => n.ex.category === top)!;
  // Sure only when the neighbours agree AND the closest one really looks like this shop.
  const confidence = Math.round((topVotes / total) * best.sim * 100) / 100;
  return {
    category: top,
    confidence,
    ranked: ranked.slice(0, 3).map(([c]) => c),
    closest: { merchantKey: best.ex.merchantKey, similarity: Math.round(best.sim * 100) / 100 },
  };
}

/**
 * Runs after the rules found nothing. A sure prediction sorts the payment; an unsure one only
 * puts its guess first among the inbox suggestions.
 */
export function withSortPrediction(rules: CategoriseResult, p: SortPrediction, threshold: number): CategoriseResult {
  if (rules.via !== "none" || !p.category) return rules;
  if (p.confidence >= threshold) return decide(p.category, p.confidence, p.ranked, threshold, "ml");
  if (p.confidence < 0.3) return rules;
  return { ...rules, suggestions: [...new Set([p.category, ...rules.suggestions])].slice(0, 3) };
}

// ---------- 2. Unusual payments ----------

export interface UnusualPayment {
  /** The usual (median) payment in this category over the last 120 days. */
  usualPaise: number;
  /** How many times the usual amount this payment is, rounded. */
  times: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const MIN_HISTORY = 5;
const MIN_ALERT_PAISE = 100_000; // ₹1,000: small surprises are not worth an alert.

/**
 * Robust outlier test. Compares the payment with the user's other payments in the same category
 * over the last 120 days using the median and the median absolute deviation (MAD), which one
 * odd payment cannot pull around the way an average can. Needs 5 earlier payments, and the
 * payment must also be 3× the usual and 1.5× the biggest earlier one, so a busy month is not an alarm.
 */
export function unusualPayment(txn: Transaction, history: Transaction[]): UnusualPayment | null {
  if (!isSpending(txn) || txn.status !== "categorised" || !txn.category) return null;
  // The user said it was them (a party, a big day): no longer unusual. It stays in the history,
  // so a similar payment later sits within 1.5× the biggest one and doesn't alert either.
  if (txn.unusualCheck === "confirmed") return null;
  const amount = -txn.amountPaise;
  if (amount < MIN_ALERT_PAISE) return null;
  const from = addDays(txn.date, -120);
  const amounts = history
    .filter((t) => t.id !== txn.id && t.category === txn.category && isSpending(t) && t.date >= from && t.date <= txn.date)
    .map((t) => -t.amountPaise);
  if (amounts.length < MIN_HISTORY) return null;

  const usual = median(amounts);
  const mad = median(amounts.map((a) => Math.abs(a - usual)));
  // 1.4826 × MAD estimates the spread; a floor keeps identical bills (MAD 0) from flagging ₹1 more.
  const spread = Math.max(1.4826 * mad, 0.25 * usual, 10_000);
  const score = (amount - usual) / spread;
  // All three must hold: far outside the usual spread, 3× the usual, and well above the biggest earlier one.
  if (score < 4 || amount < 3 * usual || amount < 1.5 * Math.max(...amounts)) return null;
  return { usualPaise: Math.round(usual), times: Math.round(amount / usual) };
}
