import { passesAdviceCheck } from "@arthmitra/engine";
import { z } from "zod";
import { geminiJson } from "@/lib/gemini";
import { ResearchParams, researchCategory } from "@/lib/research";

/**
 * Gemini's 2-to-3-line read of a category shortlist, written only from the shortlist's own figures.
 * The ranking itself is rule-based (engine research.ts). Any failure returns 503 and the panel shows
 * the rule-based reasons alone.
 */
export const maxDuration = 30;

const Output = z.object({ summary: z.string().min(20).max(480) });

const INSTRUCTION = `You are ArthMitra, a friendly money buddy for Gen Z and under-30 users in India.
You get research on one investment category: a peer group, the return window used, peer medians, and 3 funds that scored best on fixed criteria (return, expense ratio, volatility, worst fall).
Write "summary": 2 to 3 short plain sentences on how these funds compare with their peers and what trade-off a reader should notice (for example cost vs return, or steadiness).
Rules:
- Use only figures from the input, written exactly as given. No other numbers.
- This is research, not advice: never say "recommend", "you should buy/invest", "best fund for you", or promise or predict returns.
- Past returns don't guarantee future returns: say so in simple words once.
- No jargon without a two-word explanation. Light Hinglish allowed.
Return only JSON: {"summary": string}.`;

/** Figures with a percent sign, normalised so "7.4%" and "7.40%" match. */
const percents = (s: string) => (s.match(/-?\d+(?:\.\d+)?%/g) ?? []).map((p) => String(Number(p.slice(0, -1))));
const ADVICE = /\brecommend|\byou should (buy|invest)|\bbest fund for you|\bguarantee|\bwill (give|return|grow)/i;

export async function POST(req: Request) {
  const q = ResearchParams.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const r = await researchCategory(q.data.category, q.data.months, q.data.risk);
  if (!r) return Response.json({ error: "no_research" }, { status: 404 });

  const fmt = (n: number | null, dp = 2) => (n === null ? "not available" : `${n.toFixed(dp)}%`);
  const input = {
    peerGroup: r.peerGroup,
    window: r.window === "1y" ? "last 1 year" : "3-year CAGR (yearly growth rate)",
    peersCompared: r.peers.count,
    peerMedian: { return: fmt(r.peers.medianReturnPct), expenseRatio: fmt(r.peers.medianTerPct), volatility: fmt(r.peers.medianVolatilityPct, 1) },
    funds: r.funds.map((f) => ({
      name: f.name,
      kind: f.kind,
      return: fmt(r.window === "1y" ? f.metrics.cagr1y : f.metrics.cagr3y),
      expenseRatio: fmt(f.terPct),
      volatility: fmt(f.metrics.volatilityPct, 1),
      worstFall3y: fmt(f.metrics.maxDrawdownPct, 1),
    })),
  };

  const out = await geminiJson(INSTRUCTION, input, Output, { temperature: 0.3, timeoutMs: 15_000 });
  if (!out) return Response.json({ source: "template" }, { status: 503 });
  const allowed = new Set(percents(JSON.stringify(input)));
  if (!passesAdviceCheck(out.summary) || ADVICE.test(out.summary) || percents(out.summary).some((p) => !allowed.has(p))) {
    return Response.json({ source: "template", reason: "failed_check" }, { status: 503 });
  }
  return Response.json({ source: "gemini", summary: out.summary });
}
