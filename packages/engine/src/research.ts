import type { RiskComfort } from "@arthmitra/schema";

/**
 * Market research for one investment category: performance metrics from a fund's NAV history,
 * and a peer-relative shortlist with plain-language reasons. Research, not advice — the same
 * criteria and the same list for everyone in a category; the rupee split stays per category.
 *
 * Self-contained (type imports only) so the snapshot build script can run it with plain Node.
 */

export interface NavPoint {
  /** YYYY-MM-DD */
  date: string;
  nav: number;
}

export interface NavMetrics {
  /** Compound annual growth in percent, null when the history is shorter than the window. */
  cagr1y: number | null;
  cagr3y: number | null;
  cagr5y: number | null;
  /** Annualised volatility of daily returns over the last 3 years (or all history), percent. */
  volatilityPct: number | null;
  /** Worst fall from a peak over the last 3 years (or all history), percent, as a positive number. */
  maxDrawdownPct: number | null;
  historyYears: number;
  nav: number;
  navDate: string;
}

export interface ResearchFund {
  /** AMFI scheme code. */
  code: number;
  name: string;
  amc: string;
  kind: "Index fund" | "ETF" | "Fund" | "Fund of funds";
  /** Total expense ratio disclosed to AMFI (direct plan; ETFs have one plan), percent a year. */
  terPct: number | null;
  terDate: string | null;
  metrics: NavMetrics;
}

export interface Shortlisted extends ResearchFund {
  score: number;
  reasons: string[];
}

export interface PeerStats {
  count: number;
  medianReturnPct: number | null;
  medianTerPct: number | null;
  medianVolatilityPct: number | null;
}

export interface ResearchCriteria {
  /** Like-for-like categories (index funds) rank on cost and return only: they hold the same shares. */
  trackingOnly?: boolean;
  /** Funds with less history than this are left out. */
  minYears: number;
}

const DAY = 86_400_000;
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Last NAV on or before `iso`, from points sorted oldest first. */
function navOnOrBefore(points: NavPoint[], iso: string): NavPoint | null {
  const t = toTime(iso);
  let lo = 0;
  let hi = points.length - 1;
  let found: NavPoint | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (toTime(points[mid]!.date) <= t) {
      found = points[mid]!;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

function yearsBefore(iso: string, years: number): string {
  const d = new Date(toTime(iso));
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** Returns, risk and history length from a NAV series (any order; bad points dropped). */
export function navMetrics(series: NavPoint[]): NavMetrics | null {
  const points = series.filter((p) => Number.isFinite(p.nav) && p.nav > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date)).sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) return null;
  const last = points.at(-1)!;
  const first = points[0]!;
  const historyYears = (toTime(last.date) - toTime(first.date)) / (365.25 * DAY);

  const cagr = (years: number): number | null => {
    if (historyYears < years - 0.02) return null;
    const start = navOnOrBefore(points, yearsBefore(last.date, years)) ?? first;
    const span = (toTime(last.date) - toTime(start.date)) / (365.25 * DAY);
    if (span < years - 0.05) return null;
    return round((Math.pow(last.nav / start.nav, 1 / span) - 1) * 100);
  };

  // Risk over the last 3 years, or the whole history when shorter.
  const from = yearsBefore(last.date, 3);
  const recent = points.filter((p) => p.date >= from);
  let volatilityPct: number | null = null;
  let maxDrawdownPct: number | null = null;
  if (recent.length >= 30) {
    const rets: number[] = [];
    for (let i = 1; i < recent.length; i++) rets.push(Math.log(recent[i]!.nav / recent[i - 1]!.nav));
    const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
    const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
    volatilityPct = round(Math.sqrt(variance) * Math.sqrt(252) * 100, 1);
    let peak = recent[0]!.nav;
    let worst = 0;
    for (const p of recent) {
      peak = Math.max(peak, p.nav);
      worst = Math.min(worst, p.nav / peak - 1);
    }
    maxDrawdownPct = worst < 0 ? round(-worst * 100, 1) : 0;
  }

  return {
    cagr1y: cagr(1),
    cagr3y: cagr(3),
    cagr5y: cagr(5),
    volatilityPct,
    maxDrawdownPct,
    historyYears: round(historyYears, 1),
    nav: last.nav,
    navDate: last.date,
  };
}

/** Which return window a goal should be judged on: short goals look at the last year. */
export function researchWindow(monthsLeft: number): "1y" | "3y" {
  return monthsLeft < 36 ? "1y" : "3y";
}

const returnFor = (f: ResearchFund, w: "1y" | "3y") => (w === "1y" ? f.metrics.cagr1y : (f.metrics.cagr3y ?? null));

function median(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return round(v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2);
}

export function peerStats(funds: ResearchFund[], window: "1y" | "3y"): PeerStats {
  return {
    count: funds.length,
    medianReturnPct: median(funds.map((f) => returnFor(f, window))),
    medianTerPct: median(funds.map((f) => f.terPct)),
    medianVolatilityPct: median(funds.map((f) => f.metrics.volatilityPct)),
  };
}

/** 0..1 position among peers; `higherBetter` false flips it. Missing values score as the middle. */
function percentile(value: number | null, all: Array<number | null>, higherBetter: boolean): number {
  const v = all.filter((x): x is number => x !== null);
  if (value === null || v.length < 2) return 0.5;
  const below = v.filter((x) => x < value).length;
  const equal = v.filter((x) => x === value).length;
  const p = (below + (equal - 1) / 2) / (v.length - 1);
  return higherBetter ? p : 1 - p;
}

const pct = (n: number) => `${n.toFixed(2)}%`;

/**
 * Top funds in a category on fixed, published criteria. Weights shift with the goal: short goals
 * care more about steadiness, long goals more about return and cost. Every reason quotes a figure
 * next to the peer median, so the list can be checked by hand.
 */
export function shortlistFunds(
  funds: ResearchFund[],
  opts: { criteria: ResearchCriteria; monthsLeft: number; risk: RiskComfort; take?: number },
): { window: "1y" | "3y"; peers: PeerStats; funds: Shortlisted[] } {
  const window = researchWindow(opts.monthsLeft);
  const eligible = funds.filter((f) => f.metrics.historyYears >= opts.criteria.minYears && returnFor(f, window) !== null);
  const peers = peerStats(eligible, window);
  const rets = eligible.map((f) => returnFor(f, window));
  const ters = eligible.map((f) => f.terPct);
  const vols = eligible.map((f) => f.metrics.volatilityPct);
  const dds = eligible.map((f) => f.metrics.maxDrawdownPct);
  const steady = window === "1y" || opts.risk === "low";
  const w = opts.criteria.trackingOnly
    ? { ret: 0.5, ter: 0.5, vol: 0, dd: 0 }
    : steady
      ? { ret: 0.25, ter: 0.25, vol: 0.25, dd: 0.25 }
      : { ret: 0.4, ter: 0.3, vol: 0.15, dd: 0.15 };

  const scored = eligible.map((f) => {
    const ret = returnFor(f, window);
    const score =
      w.ret * percentile(ret, rets, true) +
      w.ter * percentile(f.terPct, ters, false) +
      w.vol * percentile(f.metrics.volatilityPct, vols, false) +
      w.dd * percentile(f.metrics.maxDrawdownPct, dds, false);
    const reasons: string[] = [];
    if (ret !== null && peers.medianReturnPct !== null)
      reasons.push(`${window === "1y" ? "1-year return" : "3-year CAGR"} ${pct(ret)} vs peer median ${pct(peers.medianReturnPct)}`);
    if (f.terPct !== null && peers.medianTerPct !== null)
      reasons.push(`Costs ${pct(f.terPct)} a year vs peer median ${pct(peers.medianTerPct)}`);
    if (!opts.criteria.trackingOnly && f.metrics.volatilityPct !== null && peers.medianVolatilityPct !== null && f.metrics.maxDrawdownPct !== null)
      reasons.push(`Ups and downs ${f.metrics.volatilityPct.toFixed(1)}% a year vs peer median ${peers.medianVolatilityPct.toFixed(1)}%; worst fall in 3 years ${f.metrics.maxDrawdownPct.toFixed(1)}%`);
    reasons.push(`${Math.floor(f.metrics.historyYears)}+ years of NAV history`);
    return { ...f, score: round(score, 3), reasons };
  });

  scored.sort((a, b) => b.score - a.score || (a.terPct ?? 9) - (b.terPct ?? 9));
  return { window, peers, funds: scored.slice(0, opts.take ?? 3) };
}
