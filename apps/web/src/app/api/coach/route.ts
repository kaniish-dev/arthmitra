import {
  COACH_EXAMPLES,
  COACH_SYSTEM_INSTRUCTION,
  checkCoachAnswer,
  coachModelInput,
  detectIntent,
  redactNames,
  usesModel,
  type CoachLang,
  type CoachSnapshot,
} from "@arthmitra/engine";
import { CoachAnswer } from "@arthmitra/schema";

/**
 * Gemini coach on the free Gemini API tier (a key from Google AI Studio), run as a Next.js route
 * so no Cloud Functions or Blaze plan are needed. The key stays on the server. Any failure — no
 * key, rate limit, timeout, an answer that fails checkCoachAnswer — returns 503 and the screen
 * falls back to the template coach.
 */
// Above the 15-second Gemini timeout, so the host never cuts the route off before its fallback.
export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const fallback = (reason: string) => Response.json({ source: "template", reason }, { status: 503 });

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallback("no_key");

  const body = (await req.json().catch(() => null)) as { question?: unknown; lang?: unknown; snapshot?: CoachSnapshot } | null;
  const question = typeof body?.question === "string" ? body.question : "";
  const lang: CoachLang = body?.lang === "hi" ? "hi" : "en";
  if (!question.trim() || !body?.snapshot) return Response.json({ error: "bad_request" }, { status: 400 });
  // Safety questions never reach the model, whatever the browser sends.
  if (!usesModel(detectIntent(question))) return fallback("template_only");

  const original = body.snapshot;
  const { snapshot, redact, restore } = redactNames(original);
  const contents = [
    ...COACH_EXAMPLES.flatMap((ex) => [
      { role: "user", parts: [{ text: JSON.stringify(ex.input) }] },
      { role: "model", parts: [{ text: JSON.stringify({ ...ex.output, disclaimer: "" }) }] },
    ]),
    { role: "user", parts: [{ text: coachModelInput(redact(question), lang, snapshot) }] },
  ];

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: COACH_SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    // 429 is the free tier's rate limit.
    if (!res.ok) return fallback(res.status === 429 ? "rate_limited" : `gemini_${res.status}`);

    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = CoachAnswer.safeParse(JSON.parse(text));
    if (!parsed.success) return fallback("bad_shape");

    const answer = { ...parsed.data, answer: restore(parsed.data.answer) };
    if (!checkCoachAnswer(answer, original)) return fallback("failed_check");
    return Response.json({ source: "gemini", answer: answer.answer, actionIds: answer.actionIds });
  } catch {
    return fallback("error");
  }
}
