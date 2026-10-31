import { navMetrics, shortlistFunds, type NavMetrics, type ResearchFund } from "@arthmitra/engine";
import { InstrumentType, RiskComfort } from "@arthmitra/schema";
import { z } from "zod";
import { RESEARCH, RESEARCH_SOURCES } from "@/config/research";
import snapshot from "@/config/research-snapshot.json";
import type { CategoryResearch } from "@/lib/services/research";

/**
 * Server side of category research: rank the dated snapshot, refresh the leaders' NAVs live from
 * mfapi.in (AMFI data), and rank again. Any live failure keeps the snapshot figures, so the panel
 * always has an answer and always says how fresh it is.
 */
const SNAPSHOT = snapshot as unknown as { builtAt: string; navAsOf: string; terAsOf: string | null; categories: Record<string, ResearchFund[]> };
const LIVE_TTL_MS = 6 * 60 * 60 * 1000;
const live = new Map<number, { at: number; metrics: NavMetrics | null }>();

async function liveMetrics(code: number): Promise<NavMetrics | null> {
  const hit = live.get(code);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.metrics;
  let metrics: NavMetrics | null = null;
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${code}`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ date: string; nav: string }> };
      metrics = navMetrics(
        (body.data ?? []).map((p) => {
          const [d, m, y] = p.date.split("-");
          return { date: `${y}-${m}-${d}`, nav: Number(p.nav) };
        }),
      );
    }
  } catch {
    // Timeout or network: the snapshot figures stand.
  }
  live.set(code, { at: Date.now(), metrics });
  return metrics;
}

/** Query string of both research routes. */
export const ResearchParams = z.object({
  category: InstrumentType,
  months: z.coerce.number().int().min(1).max(600),
  risk: RiskComfort,
});

export async function researchCategory(type: InstrumentType, monthsLeft: number, risk: RiskComfort): Promise<CategoryResearch | null> {
  const cfg = RESEARCH[type];
  const peers = SNAPSHOT.categories[type];
  if (!cfg || !peers?.length) return null;
  const opts = { criteria: cfg, monthsLeft, risk };

  // Refresh the likely leaders, then rank the whole peer group again with their new figures.
  const leaders = shortlistFunds(peers, { ...opts, take: 6 }).funds;
  const fresh = await Promise.all(leaders.map((f) => liveMetrics(f.code)));
  const updated = new Map(leaders.map((f, i) => [f.code, fresh[i]]));
  const merged = peers.map((f) => {
    const m = updated.get(f.code);
    return m && m.navDate >= f.metrics.navDate ? { ...f, metrics: m } : f;
  });
  const result = shortlistFunds(merged, { ...opts, take: 3 });
  const liveCount = result.funds.filter((f) => updated.get(f.code) && f.metrics === updated.get(f.code)).length;

  return {
    type,
    peerGroup: cfg.peerGroup,
    window: result.window,
    peers: result.peers,
    funds: result.funds,
    note: cfg.note ?? null,
    navAsOf: result.funds.reduce((d, f) => (f.metrics.navDate > d ? f.metrics.navDate : d), SNAPSHOT.navAsOf),
    terAsOf: SNAPSHOT.terAsOf,
    source: liveCount === result.funds.length ? "live" : liveCount ? "mixed" : "snapshot",
    snapshotBuiltAt: SNAPSHOT.builtAt,
    sources: [RESEARCH_SOURCES.nav, RESEARCH_SOURCES.ter],
  };
}
