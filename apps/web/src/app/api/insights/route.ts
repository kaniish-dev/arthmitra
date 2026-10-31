import { passesAdviceCheck } from "@arthmitra/engine";
import { z } from "zod";

/**
 * Gemini-written explanation of the "Realistic monthly saving" card: 2 to 3 personal lines and
 * 2 tips. The number itself is rule-based (engine savings.ts); Gemini only explains it, from
 * aggregates — never names, PAN, Aadhaar or account numbers. Any failure returns 503 and the
 * card shows the template text instead.
 */
// Above the Gemini timeout, so the host never cuts the route off before its fallback.
export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const Summary = z.object({
  monthsRead: z.number().int().min(1).max(12),
  averageIncome: z.string(),
  averageSpend: z.string(),
  averageFixed: z.string(),
  averageVariable: z.string(),
  averageLeft: z.string(),
  realisticSaving: z.string(),
  tightMonths: z.number().int().min(0),
  topVariable: z.array(z.object({ name: z.string().max(40), perMonth: z.string() })).max(4),
  isMinor: z.boolean(),
});

const Output = z.object({
  explanation: z.string().min(10).max(420),
  tips: z.array(z.string().min(5).max(200)).length(2),
});

const INSTRUCTION = `You are ArthMitra, a friendly money buddy for Gen Z and under-30 users in India.
You get a JSON summary of a user's past months (rupee figures already formatted) and a rule-based "realisticSaving".
Write:
- "explanation": 2 to 3 short lines on why that saving is realistic for them, using only figures from the input exactly as written.
- "tips": exactly 2 short, specific, doable tips to save a bit more, based on their biggest variable spends.
Tone: warm, plain words, light Hinglish allowed (e.g. "chhota sa change"). No judgement.
Never name a fund, stock, bank, app or brand, never promise returns, never ask for personal details.
If isMinor is true, speak to a teenager about pocket money; no investing tips.
Return only JSON: {"explanation": string, "tips": [string, string]}.`;

const fallback = (reason: string) => Response.json({ source: "template", reason }, { status: 503 });

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallback("no_key");
  const parsed = Summary.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(parsed.data) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallback(res.status === 429 ? "rate_limited" : `gemini_${res.status}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const out = Output.safeParse(JSON.parse(text));
    if (!out.success) return fallback("bad_shape");
    const all = [out.data.explanation, ...out.data.tips].join(" ");
    if (!passesAdviceCheck(all)) return fallback("failed_check");
    // Every rupee figure must come from the input.
    const allowed = new Set(JSON.stringify(parsed.data).match(/₹[\d,]+/g) ?? []);
    if ((all.match(/₹[\d,]+/g) ?? []).some((f) => !allowed.has(f))) return fallback("unknown_figure");
    return Response.json({ source: "gemini", ...out.data });
  } catch {
    return fallback("error");
  }
}
