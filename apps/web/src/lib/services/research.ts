import type { PeerStats, Shortlisted } from "@arthmitra/engine";
import type { InstrumentType, RiskComfort } from "@arthmitra/schema";

/**
 * Market research for one plan category: funds that meet published criteria, with dated figures.
 * Research, not a recommendation — the same list for everyone with the same time frame and risk.
 * Served by /api/research (live NAVs over a dated AMFI snapshot); the write-up by /api/research/explain.
 */
export interface CategoryResearch {
  type: InstrumentType;
  peerGroup: string;
  window: "1y" | "3y";
  peers: PeerStats;
  funds: Shortlisted[];
  note: string | null;
  /** Date of the newest NAV used. */
  navAsOf: string;
  terAsOf: string | null;
  /** Whether the shown funds' NAVs were refreshed just now or come from the snapshot. */
  source: "live" | "mixed" | "snapshot";
  snapshotBuiltAt: string;
  sources: string[];
}

export interface ResearchQuery {
  type: InstrumentType;
  monthsLeft: number;
  risk: RiskComfort;
}

const params = (q: ResearchQuery) => new URLSearchParams({ category: q.type, months: String(q.monthsLeft), risk: q.risk });

export async function fetchResearch(q: ResearchQuery): Promise<CategoryResearch | null> {
  const res = await fetch(`/api/research?${params(q)}`);
  return res.ok ? ((await res.json()) as CategoryResearch) : null;
}

/** Gemini's plain-words summary of the shortlist, or null (the panel then shows the rule-based reasons only). */
export async function fetchResearchSummary(q: ResearchQuery): Promise<string | null> {
  try {
    const res = await fetch(`/api/research/explain?${params(q)}`, { method: "POST" });
    if (!res.ok) return null;
    const body = (await res.json()) as { summary?: string };
    return body.summary ?? null;
  } catch {
    return null;
  }
}
