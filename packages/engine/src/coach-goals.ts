import { addMonths } from "./dates";
import { roundUpTo } from "./money";

/**
 * Reads a goal out of a chat message — "Can I afford a 40k trip in March?", "I want to buy a
 * refrigerator in the next 3 months" — so the Coach can size it against the realistic saving
 * and offer to turn it into a small savings goal.
 */
export interface GoalAsk {
  name: string;
  amountPaise: number;
  months: number;
  targetDate: string;
  monthlyPaise: number;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const AMOUNT = /(?:₹|rs\.?|inr)?\s?(\d+(?:,\d{2,3})*(?:\.\d+)?)\s*(k|thousand|lakhs?|lac|l|cr|crore)?\b/i;

/** "40k", "₹40,000", "1.5 lakh", "2L", "rs 12000" → paise; null when there is no amount of ₹100+. */
export function amountWithUnits(text: string): number | null {
  const m = AMOUNT.exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  const unit = (m[2] ?? "").toLowerCase();
  const mult = unit === "k" || unit === "thousand" ? 1_000 : unit.startsWith("l") ? 1_00_000 : unit.startsWith("cr") ? 1_00_00_000 : 1;
  const paise = Math.round(n * mult * 100);
  return paise >= 10_000 ? paise : null;
}

/** Months until the goal: "in 3 months", "next 6 months", "in 2 years", "in March"; null when none is said. */
export function monthsInText(text: string, today: string): number | null {
  const t = text.toLowerCase();
  const rel = /(\d+)\s*(month|months|mahine|महीने|year|years|saal|साल)/.exec(t);
  if (rel) return Number(rel[1]) * (/year|saal|साल/.test(rel[2]!) ? 12 : 1);
  if (/next year|agle saal/.test(t)) return 12;
  const named = MONTHS.findIndex((mo) => new RegExp(`\\b${mo}[a-z]*\\b`).test(t));
  if (named >= 0) {
    // Saving months up to and including the named month: October → March is 5.
    const m = Number(today.slice(5, 7));
    return (named + 1 - m + 12) % 12 || 12;
  }
  return null;
}

/** What the goal is for: the noun after "buy/take/afford a …", or a plain label. */
function goalName(raw: string): string {
  // Amounts and time phrases out first, so "a 40k trip in March" reads as "a trip".
  const text = raw.replace(new RegExp(AMOUNT.source, "gi"), " ").replace(/\s+/g, " ");
  const m = /(?:buy|take|get|afford|purchase|save for|plan)\s+(?:a|an|the|my)?\s*(?:new\s+)?([a-z][a-z ]{1,24}?)(?=\s+(?:in|by|next|within|worth|for|of|costing|this|before|as)\b|[?.!,]|$)/i.exec(text);
  const thing = m?.[1]?.trim();
  if (thing && !/^(it|that|this|one)$/i.test(thing)) return thing[0]!.toUpperCase() + thing.slice(1);
  return "New goal";
}

export function goalAsk(question: string, today: string, defaultMonths = 6): GoalAsk | null {
  const amountPaise = amountWithUnits(question.replace(/(\d+)\s*(month|months|mahine|year|years|saal)/gi, ""));
  if (!amountPaise) return null;
  const months = Math.max(1, Math.min(120, monthsInText(question, today) ?? defaultMonths));
  return { name: goalName(question), amountPaise, months, targetDate: addMonths(today, months), monthlyPaise: roundUpTo(amountPaise / months) };
}
