import type { z } from "zod";

/**
 * One Gemini call that must return JSON matching `schema`. Server only — imported by route
 * handlers, so the key never reaches the browser. Returns null on any failure (no key, rate
 * limit, timeout, bad shape) and each caller falls back to its rule-based path.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

export async function geminiJson<T>(instruction: string, input: unknown, schema: z.ZodType<T>, opts: { temperature?: number; timeoutMs?: number } = {}): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ role: "user", parts: [{ text: typeof input === "string" ? input : JSON.stringify(input) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: opts.temperature ?? 0.2 },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
