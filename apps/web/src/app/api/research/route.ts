import { ResearchParams, researchCategory } from "@/lib/research";

/**
 * Category research shortlist: GET /api/research?category=index&months=60&risk=medium.
 * Public market data only — nothing about the user is sent beyond time frame and risk level.
 */
export const maxDuration = 30;

export async function GET(req: Request) {
  const q = ResearchParams.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const research = await researchCategory(q.data.category, q.data.months, q.data.risk);
  if (!research) return Response.json({ error: "no_research" }, { status: 404 });
  return Response.json(research);
}
