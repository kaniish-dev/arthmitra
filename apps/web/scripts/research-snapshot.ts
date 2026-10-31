/**
 * Builds src/config/research-snapshot.json: every scheme in each research peer group (config/research.ts)
 * with its direct-plan expense ratio and NAV metrics. The app ranks from this file and refreshes
 * NAVs live when it can, so the snapshot is the dated fallback.
 *
 *   npm run research:snapshot -w web
 *
 * Sources (all public): AMFI NAVAll.txt (scheme list and categories), AMFI's TER disclosure export,
 * and mfapi.in for each scheme's NAV history. Runs with plain Node 24 (type stripping).
 */
import { writeFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { navMetrics, type ResearchFund } from "../../../packages/engine/src/research.ts";
import { RESEARCH, type ResearchCategory } from "../src/config/research.ts";

const OUT = new URL("../src/config/research-snapshot.json", import.meta.url);
const NAV_ALL = "https://portal.amfiindia.com/spages/NAVAll.txt";
const TER_EXPORT = (month: string) => `https://www.amfiindia.com/api/populate-te-rdata-revised?MF_ID=All&Month=${month}&strCat=-1&strType=-1&excel=true`;
const HISTORY = (code: number) => `https://api.mfapi.in/mf/${code}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Scheme {
  code: number;
  base: string;
  name: string;
  amc: string;
  amfiCategory: string;
  navDate: string;
}

/** "30-Oct-2026" or "30-10-2026" → "2026-10-30". */
function isoDate(s: string): string {
  const [d, m, y] = s.trim().split("-");
  const month = /^\d+$/.test(m!) ? Number(m) : MONTHS.indexOf(m!) + 1;
  return `${y}-${String(month).padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function text(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** Scheme list from NAVAll.txt: category headers, then AMC names, then code;isin;isin;name;plan;option;nav;date. */
async function schemes(): Promise<Scheme[]> {
  const out: Scheme[] = [];
  let category = "";
  let amc = "";
  for (const raw of (await text(NAV_ALL)).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(/^Open Ended Schemes\((.*)\)$/);
    if (header) {
      category = header[1]!.trim();
      continue;
    }
    if (/^(Close|Interval) Ended Schemes/.test(line)) {
      category = "";
      continue;
    }
    const cols = line.split(";");
    if (cols.length < 8) {
      if (!line.startsWith("Scheme Code")) amc = line;
      continue;
    }
    const [code, , , name, plan, option, , date] = cols as [string, string, string, string, string, string, string, string];
    if (!category || !/^\d+$/.test(code)) continue;
    // Direct plan, growth option. ETFs have one plan, so a blank or "-" plan counts.
    const planOk = /direct/i.test(plan) || /^(-|na|)$/i.test(plan.trim());
    const optionOk = /growth/i.test(option) || /^(-|na|)$/i.test(option.trim());
    // Unclaimed-money and segregated plans aren't open to investors.
    if (!planOk || !optionOk || /idcw|dividend|bonus|unclaimed|i\.e\.f|investor education|segregated/i.test(`${name} ${option}`)) continue;
    out.push({ code: Number(code), base: name.trim(), name: name.trim(), amc: amc.replace(/ Mutual Fund$/, ""), amfiCategory: category, navDate: isoDate(date) });
  }
  return out;
}

/** Latest TER (direct plan, or the only plan for ETFs) per scheme name, from AMFI's export for this month and last (a new month starts nearly empty). */
async function expenseRatios(month: Date): Promise<{ ter: Map<string, { pct: number; date: string }>; months: string[] }> {
  const ter = new Map<string, { pct: number; date: string }>();
  const months: string[] = [];
  for (const back of [1, 0]) {
    const d = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - back, 1));
    const key = `${d.getUTCMonth() + 1}-${d.getUTCFullYear()}`;
    const res = await fetch(TER_EXPORT(key), { signal: AbortSignal.timeout(120_000) }).catch(() => null);
    if (!res?.ok) continue;
    const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1 });
    for (const r of rows.slice(1)) {
      const name = String(r[1] ?? "");
      const serial = Number(r[4]);
      // ETFs have a single plan, which AMFI reports in the regular-plan column.
      const direct = Number(r[14]);
      const pct = direct > 0 ? direct : Number(r[9]);
      if (!name || !Number.isFinite(serial) || !(pct > 0)) continue;
      const date = new Date((serial - 25569) * 86_400_000).toISOString().slice(0, 10);
      const k = norm(name);
      const prev = ter.get(k);
      if (!prev || date > prev.date) ter.set(k, { pct, date });
    }
    months.push(key);
  }
  if (!ter.size) throw new Error("AMFI TER export unavailable");
  return { ter, months };
}

async function history(code: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(HISTORY(code), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data?: Array<{ date: string; nav: string }> };
      return (body.data ?? []).map((p) => ({ date: isoDate(p.date), nav: Number(p.nav) }));
    } catch {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

/** Runs `fn` over `items`, `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

function members(all: Scheme[], cfg: ResearchCategory, latest: string): Scheme[] {
  const cutoff = new Date(Date.parse(latest) - 10 * 86_400_000).toISOString().slice(0, 10);
  const seen = new Set<number>();
  return all.filter((s) => {
    if (seen.has(s.code) || !cfg.amfiCategories.includes(s.amfiCategory) || s.navDate < cutoff) return false;
    if (cfg.include && !cfg.include.test(s.name)) return false;
    if (cfg.exclude?.test(s.name)) return false;
    seen.add(s.code);
    return true;
  });
}

const all = await schemes();
// The date most schemes report; a few publish a day ahead or lag behind.
const dateCounts = new Map<string, number>();
for (const s of all) dateCounts.set(s.navDate, (dateCounts.get(s.navDate) ?? 0) + 1);
const latest = [...dateCounts].sort((a, b) => b[1] - a[1])[0]![0];
console.log(`${all.length} direct-growth schemes, NAVs to ${latest}`);
const { ter, months } = await expenseRatios(new Date(`${latest}T00:00:00Z`));
console.log(`${ter.size} expense ratios (${months.join(", ")})`);

const categories: Record<string, ResearchFund[]> = {};
for (const [type, cfg] of Object.entries(RESEARCH) as Array<[string, ResearchCategory]>) {
  const group = members(all, cfg, latest);
  const funds = await pool(group, 8, async (s): Promise<ResearchFund | null> => {
    const navs = await history(s.code);
    const metrics = navs && navMetrics(navs);
    if (!metrics) return null;
    const t = ter.get(norm(s.base));
    return { code: s.code, name: s.name, amc: s.amc, kind: cfg.kind(s.name, s.amfiCategory), terPct: t?.pct ?? null, terDate: t?.date ?? null, metrics };
  });
  // Merged schemes can leave two codes under one name: keep the longer history.
  const byName = new Map<string, ResearchFund>();
  for (const f of funds) {
    if (!f) continue;
    const prev = byName.get(norm(f.name));
    if (!prev || f.metrics.historyYears > prev.metrics.historyYears) byName.set(norm(f.name), f);
  }
  categories[type] = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const withTer = categories[type]!.filter((f) => f.terPct !== null).length;
  console.log(`${type}: ${categories[type]!.length} of ${group.length} schemes (${withTer} with expense ratio)`);
}

const terDates = Object.values(categories).flat().map((f) => f.terDate).filter((d): d is string => !!d);
await writeFile(
  OUT,
  `${JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      navAsOf: latest,
      terAsOf: terDates.sort().at(-1) ?? null,
      categories,
    },
    null,
    1,
  )}\n`,
);
console.log(`Wrote ${OUT.pathname}`);
