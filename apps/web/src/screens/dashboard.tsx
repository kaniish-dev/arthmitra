"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { INSTRUMENT_LABEL, FIXED_CATEGORY_IDS, averageByCategory, categoryName, formatDate, formatINR, formatMonth, todayIso, totalOutstanding, type MonthFlow } from "@arthmitra/engine";
import type { AppData } from "@arthmitra/schema";
import { AaStatus } from "@/components/aa-status";
import { CHART_COLORS, CategoryDonut, MonthBars } from "@/components/charts";
import { TransactionList } from "@/components/transactions";
import { BEFIKAR_SAMPLE } from "@/config/befikar";
import { ADD_ONS_LABEL, FEATURES } from "@/lib/constants";
import { goalProgress, planGoals, savingsInsight, wealthSummary, type SavingsInsight } from "@/lib/insights";
import { agoLabel, useNow } from "@/lib/aa-sync";
import { useAppData } from "@/lib/store";
import { Badge, Card, DemoBadge, Icon, LinkButton, ProgressBar, SectionTitle, Skeleton, cx } from "@/components/ui";

const GOAL_ICON: Record<string, string> = {
  car: "directions_car",
  wedding: "favorite",
  trip: "flight",
  emergency: "health_and_safety",
  home: "home",
  education: "school",
  custom: "flag",
};

const ADD_ONS = [FEATURES.coach, FEATURES.crisisCushion, FEATURES.lend, FEATURES.financeFirstClass];

/**
 * Home — Track (savings insights): month on month, paycheck to paycheck — income, total
 * spend, spend by category, money left, fixed vs variable — then a realistic monthly saving
 * with a Gemini explanation, the Befikar Mode teaser and "Plan something".
 */
export function DashboardScreen() {
  const data = useAppData()!;
  const today = todayIso();
  const insight = savingsInsight(data, today);
  const months = [...insight.months, insight.thisMonth];
  const [selected, setSelected] = useState(insight.months.at(-1)?.monthKey ?? insight.thisMonth.monthKey);
  const flow = months.find((m) => m.monthKey === selected) ?? insight.thisMonth;
  const firstName = data.profile?.name.split(" ")[0] ?? "";
  const hasFeed = data.accounts.some((a) => a.status === "active" && (a.source === "aa" || a.source === "simulated"));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section aria-label="Money left" className="hero relative overflow-hidden rounded-3xl bg-linear-to-br from-primary to-[#0842a0] p-5 text-on-primary sm:p-6">
        <p className="text-sm text-on-primary/85">
          Namaste{firstName ? `, ${firstName}` : ""} 👋 · {data.registration?.isMinor ? "pocket money to pocket money" : "paycheck to paycheck"}
        </p>
        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Month">
          {months.map((m) => (
            <button
              key={m.monthKey}
              type="button"
              role="tab"
              aria-selected={m.monthKey === selected}
              onClick={() => setSelected(m.monthKey)}
              className={cx("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", m.monthKey === selected ? "bg-white text-primary" : "bg-white/15 hover:bg-white/25")}
            >
              {formatMonth(m.monthKey)}
              {m.monthKey === insight.thisMonth.monthKey ? " · so far" : ""}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-on-primary/85">Money left in {formatMonth(flow.monthKey)}</p>
        <p className={cx("text-4xl font-semibold tabular-nums", flow.leftPaise < 0 && "text-[#ffdad6]")}>{formatINR(flow.leftPaise)}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-on-primary/80">Income</dt>
            <dd className="font-semibold tabular-nums">{formatINR(flow.incomePaise)}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-primary/80">Total spend</dt>
            <dd className="font-semibold tabular-nums">{formatINR(flow.spendingPaise)}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-primary/80">Saved</dt>
            <dd className="font-semibold tabular-nums">{flow.incomePaise > 0 ? `${Math.max(0, Math.round((flow.leftPaise / flow.incomePaise) * 100))}%` : "—"}</dd>
          </div>
        </dl>
      </section>

      {hasFeed && <AaStatus data={data} compact />}

      <RealisticSavingCard data={data} insight={insight} />

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <FixedVariable data={data} flow={flow} />
        <SpendByCategory data={data} flow={flow} />
      </div>

      {insight.months.length > 1 && (
        <Card>
          <SectionTitle>Month on month</SectionTitle>
          <MonthBars rows={months.map((m) => ({ label: formatMonth(m.monthKey).split(" ")[0]!, income: m.incomePaise, spend: m.spendingPaise }))} />
          {/* Tables ignore sr-only's 1px width, so the wrapper does the hiding (else phones scroll sideways). */}
          <div className="sr-only">
            <table>
              <caption>Income and spend by month</caption>
              <tbody>
                {months.map((m) => (
                  <tr key={m.monthKey}>
                    <th>{formatMonth(m.monthKey)}</th>
                    <td>Income {formatINR(m.incomePaise)}</td>
                    <td>Spent {formatINR(m.spendingPaise)}</td>
                    <td>Left {formatINR(m.leftPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <PortfolioCard data={data} />
        <GoalsCard data={data} today={today} />
      </div>

      <BefikarTeaser />

      <nav aria-label={ADD_ONS_LABEL}>
        <h2 className="mb-3 text-base font-semibold">{ADD_ONS_LABEL}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ADD_ONS.map((f) => (
            <li key={f.href}>
              <Link href={f.href} className="flex h-full flex-col gap-2 rounded-3xl surface-card p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary-container text-on-secondary-container">
                  <Icon name={f.icon} />
                </span>
                <span className="font-semibold">{f.name}</span>
                <span className="text-xs text-on-surface-variant">{f.href === FEATURES.lend.href && totalOutstanding(data.loans) > 0 ? `${formatINR(totalOutstanding(data.loans))} owed to you` : f.tagline}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card>
        <SectionTitle href={data.transactions.length ? "/history" : undefined}>Recent activity</SectionTitle>
        <TransactionList data={data} txns={data.transactions.slice(0, 5)} empty="Transactions appear here once your bank history comes in." />
      </Card>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-on-surface-variant">
        <Icon name="lock" className="text-[16px]" />
        ArthMitra never holds your money or places trades. It plans, redirects and tracks.
      </p>
    </div>
  );
}

/** Rule-based realistic saving, explained in 2–3 lines by Gemini (or a template), with 2 tips. */
function RealisticSavingCard({ data, insight }: { data: AppData; insight: SavingsInsight }) {
  const s = insight.saving;
  const flowsForTop = insight.months.slice(-6);
  const top = averageByCategory(flowsForTop)
    .filter((c) => !FIXED_CATEGORY_IDS.includes(c.category) && c.category !== "uncategorised")
    .slice(0, 3)
    .map((c) => ({ name: categoryName(data.categories, c.category), perMonth: formatINR(c.paise) }));
  const isMinor = data.registration?.isMinor ?? false;
  const template = templateInsight(s.monthsRead, insight, top, isMinor);
  const ai = useAiInsight(data.settings.aiEnabled && s.monthsRead > 0, {
    monthsRead: Math.max(1, s.monthsRead),
    averageIncome: formatINR(s.averageIncomePaise),
    averageSpend: formatINR(s.averageSpendPaise),
    averageFixed: formatINR(s.averageFixedPaise),
    averageVariable: formatINR(s.averageVariablePaise),
    averageLeft: formatINR(s.averageSurplusPaise),
    realisticSaving: formatINR(s.monthlyPaise),
    tightMonths: s.tightMonths,
    topVariable: top,
    isMinor,
  });
  const text = ai.result ?? template;

  return (
    <Card className="bg-tertiary-container/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-on-surface-variant">Realistic monthly saving</p>
          <p className="text-4xl font-semibold text-on-surface tabular-nums">{formatINR(s.monthlyPaise)}</p>
          <p className="text-xs text-on-surface-variant">
            {s.monthsRead > 0 ? `From your last ${s.monthsRead} months · you kept ${formatINR(s.averageSurplusPaise)} a month on average` : "Needs at least one full month of history."}
          </p>
        </div>
        <LinkButton href="/explore" icon="rocket_launch" className="h-12">
          Plan something
        </LinkButton>
      </div>
      {insight.committedPaise > 0 && (
        <p className="mt-3 text-sm">
          <strong className="tabular-nums">{formatINR(insight.committedPaise)}</strong> already goes to your plans ·{" "}
          <strong className="tabular-nums">{formatINR(insight.freePaise)}</strong> free for something new
        </p>
      )}
      <div className="mt-4 rounded-2xl bg-surface-container-lowest p-4">
        {ai.loading ? (
          <div className="flex flex-col gap-2" aria-busy>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <p className="text-sm">{text.explanation}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {text.tips.map((t) => (
                <li key={t} className="flex gap-2 text-sm">
                  <Icon name="tips_and_updates" className="text-[18px] text-tertiary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-on-surface-variant">{ai.result ? "Written by Gemini from your monthly totals" : "Rule-based summary"} · the number itself is 80% of your average money left.</p>
          </>
        )}
      </div>
    </Card>
  );
}

type InsightText = { explanation: string; tips: string[] };

function templateInsight(monthsRead: number, insight: SavingsInsight, top: Array<{ name: string; perMonth: string }>, isMinor: boolean): InsightText {
  const s = insight.saving;
  if (monthsRead === 0) return { explanation: "Once a full month of transactions is in, we'll work out a saving you can actually hit.", tips: ["Link your bank or upload a statement.", "Ask the Coach what to track first."] };
  const [a, b] = top;
  return {
    explanation: `${isMinor ? "Pocket money" : "Income"} averaged ${formatINR(s.averageIncomePaise)} and spending ${formatINR(s.averageSpendPaise)} a month, so about ${formatINR(s.averageSurplusPaise)} was left. Saving ${formatINR(s.monthlyPaise)} keeps a small buffer for surprises${s.tightMonths ? ` — ${s.tightMonths} month${s.tightMonths > 1 ? "s were" : " was"} tighter than that` : ""}.`,
    tips: [
      a ? `${a.name} is your biggest variable spend at ${a.perMonth} a month — trimming it by a tenth is an easy win.` : "Set a weekly limit for eating out.",
      b ? `Check ${b.name} (${b.perMonth} a month) — one less order or trip a week adds up.` : "Move your saving on payday, before spending starts.",
    ],
  };
}

/** Asks /api/insights once per summary; null result means use the template. */
function useAiInsight(enabled: boolean, summary: Record<string, unknown>) {
  const key = JSON.stringify(summary);
  const cacheKey = `arthmitra:insight:${key}`;
  // A cached answer for this summary (same tab) is shown straight away.
  const [state, setState] = useState<{ key: string; result: InsightText | null; loading: boolean }>(() => {
    const cached = readCache(cacheKey);
    return { key: cached ? key : "", result: cached, loading: enabled && !cached };
  });
  useEffect(() => {
    if (!enabled || state.key === key) return;
    let live = true;
    fetch("/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: key })
      .then(async (res) => (res.ok ? ((await res.json()) as InsightText) : null))
      .catch(() => null)
      .then((result) => {
        if (!live) return;
        setState({ key, result, loading: false });
        if (result) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ explanation: result.explanation, tips: result.tips }));
          } catch {
            // Fine without the cache.
          }
        }
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.key only guards a repeat fetch
  }, [enabled, key, cacheKey]);
  if (!enabled) return { key, result: null, loading: false };
  return state.key === key ? state : { key, result: null, loading: true };
}

function readCache(cacheKey: string): InsightText | null {
  try {
    const raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as InsightText) : null;
  } catch {
    return null;
  }
}

/** Category rows with a bar scaled to the month's biggest category. */
function CategoryBars({ data, rows, biggest, color }: { data: AppData; rows: Array<[string, number]>; biggest: number; color: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map(([c, paise]) => (
        <li key={c}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-on-surface-variant">{categoryName(data.categories, c)}</span>
            <span className="font-medium tabular-nums">{formatINR(paise)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container-high" aria-hidden>
            <div className={cx("h-full rounded-full", color)} style={{ width: `${(paise / biggest) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FixedVariable({ data, flow }: { data: AppData; flow: MonthFlow }) {
  const total = Math.max(1, flow.fixedPaise + flow.variablePaise);
  const fixedPct = Math.round((flow.fixedPaise / total) * 100);
  const cats = Object.entries(flow.byCategory)
    .filter(([c]) => c !== "uncategorised")
    .sort((a, b) => b[1] - a[1]);
  const fixed = cats.filter(([c]) => FIXED_CATEGORY_IDS.includes(c));
  const variable = cats.filter(([c]) => !FIXED_CATEGORY_IDS.includes(c)).slice(0, Math.max(3, 6 - fixed.length));
  const biggest = Math.max(1, ...cats.map(([, v]) => v));
  return (
    <Card className="flex h-full flex-col">
      <SectionTitle>Fixed vs variable · {formatMonth(flow.monthKey)}</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Fixed · {fixedPct}%
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{formatINR(flow.fixedPaise)}</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-sm text-on-surface-variant">
            <span className="h-2.5 w-2.5 rounded-full bg-tertiary" /> Variable · {100 - fixedPct}%
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{formatINR(flow.variablePaise)}</p>
        </div>
      </div>
      <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-container-highest" aria-hidden>
        <div className="rounded-l-full bg-primary" style={{ width: `${fixedPct}%` }} />
        <div className="flex-1 rounded-r-full bg-tertiary" />
      </div>
      <div className="mt-5 grid flex-1 grid-cols-1 gap-5 border-t border-outline-variant/50 pt-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Fixed · rent, EMIs, bills</p>
          {fixed.length ? <CategoryBars data={data} rows={fixed} biggest={biggest} color="bg-primary" /> : <p className="text-sm text-on-surface-variant">None this month.</p>}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Variable · easiest to trim</p>
          {variable.length ? <CategoryBars data={data} rows={variable} biggest={biggest} color="bg-tertiary" /> : <p className="text-sm text-on-surface-variant">None this month.</p>}
        </div>
      </div>
    </Card>
  );
}

/** Top 5 categories plus "Others", so every donut slice has a legend row in the same colour. */
function SpendByCategory({ data, flow }: { data: AppData; flow: MonthFlow }) {
  const sorted = Object.entries(flow.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([c, paise]) => ({ label: categoryName(data.categories, c === "uncategorised" ? null : c), paise }));
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((s, r) => s + r.paise, 0);
  const rows = rest > 0 ? [...top, { label: "Others", paise: rest }] : top;
  const total = Math.max(1, rows.reduce((s, r) => s + r.paise, 0));
  return (
    <Card className="flex h-full flex-col">
      <SectionTitle href="/insights" linkLabel="Insights">
        Spend by category · {formatMonth(flow.monthKey)}
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No spending recorded this month yet.</p>
      ) : (
        <div className="grid flex-1 grid-cols-1 items-center gap-4 sm:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[200px_minmax(0,1fr)]">
          <div className="relative mx-auto h-[200px] w-[200px]">
            <CategoryDonut rows={rows} height={200} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-on-surface-variant">Total spent</span>
              <span className="text-lg font-semibold tabular-nums">{formatINR(flow.spendingPaise)}</span>
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-outline-variant/40 text-sm">
            {rows.map((r, i) => (
              <li key={r.label} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                <span className="w-10 text-right text-xs text-on-surface-variant tabular-nums">{Math.round((r.paise / total) * 100)}%</span>
                <span className="w-20 text-right font-medium tabular-nums">{formatINR(r.paise)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Portfolio at a glance: value, returns and passive income, with the biggest holdings. */
function PortfolioCard({ data }: { data: AppData }) {
  const now = useNow();
  const w = wealthSummary(data);
  const account = data.investmentAccounts.find((a) => a.status === "connected");
  const byType = new Map<string, { value: number; invested: number }>();
  for (const h of data.holdings) {
    const x = byType.get(h.instrumentType) ?? { value: 0, invested: 0 };
    byType.set(h.instrumentType, { value: x.value + h.currentValuePaise, invested: x.invested + h.amountInvestedPaise });
  }
  const top = [...byType].sort((a, b) => b[1].value - a[1].value).slice(0, 4);
  const gainPct = w.investedPaise > 0 ? (w.gainPaise / w.investedPaise) * 100 : 0;
  return (
    <Card className="flex h-full flex-col">
      <SectionTitle href="/portfolio" linkLabel="Open portfolio">
        Your portfolio
      </SectionTitle>
      {!account || data.holdings.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3">
          <p className="text-sm text-on-surface-variant">
            {account ? "Connected — invest from a plan, then press Sync now to see your holdings here." : "After you invest on a third-party app, connect that account and your holdings show up here."}
          </p>
          <LinkButton href="/portfolio" icon={account ? "sync" : "add_link"} variant="outlined">
            {account ? "Sync holdings" : "Connect your investment account"}
          </LinkButton>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-on-surface-variant">Current value</p>
              <p className="text-3xl font-semibold tabular-nums">{formatINR(w.valuePaise)}</p>
            </div>
            <div className="text-right">
              <p className={cx("text-sm font-semibold tabular-nums", w.gainPaise >= 0 ? "text-success" : "text-error")}>
                {formatINR(w.gainPaise, { signed: true })} ({gainPct >= 0 ? "+" : ""}
                {gainPct.toFixed(1)}%)
              </p>
              <p className="text-xs text-on-surface-variant">on {formatINR(w.investedPaise)} invested</p>
            </div>
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-outline-variant/40 text-sm">
            {top.map(([type, v], i) => (
              <li key={type} className="flex items-center gap-3 py-2 first:pt-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{INSTRUMENT_LABEL[type as keyof typeof INSTRUMENT_LABEL]}</span>
                <span className="w-14 text-right text-xs text-on-surface-variant tabular-nums">{Math.round((v.value / Math.max(1, w.valuePaise)) * 100)}%</span>
                <span className="w-20 text-right font-medium tabular-nums">{formatINR(v.value)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/50 pt-3 text-xs text-on-surface-variant">
            <span>
              Passive income ≈ <strong className="text-on-surface tabular-nums">{formatINR(w.passiveIncomePaise)}/mo</strong>
            </span>
            <span>
              {account.provider}
              {account.owner === "guardian" ? " (guardian)" : ""} · synced {account.lastSyncedAt ? agoLabel(account.lastSyncedAt, now) : "never"}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function GoalsCard({ data, today }: { data: AppData; today: string }) {
  const goals = planGoals(data).filter((g) => g.status === "active");
  return (
    <Card className="h-full">
      <SectionTitle href={goals.length ? "/plan" : undefined} linkLabel="All plans">
        Your plans
      </SectionTitle>
      {goals.length === 0 ? (
        <>
          <p className="mb-3 text-sm text-on-surface-variant">Save for a Big Day — a car, a wedding, a dream trip — or start the Wealth Generator to escape the rat race.</p>
          <LinkButton href="/explore" icon="add">
            Plan something
          </LinkButton>
        </>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.slice(0, 3).map((g) => {
            const p = goalProgress(data, g, today);
            return (
              <li key={g.id}>
                <Link href={`/plan/view?id=${g.id}`} className="block rounded-2xl hover:bg-on-surface/4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                      <Icon name={g.path === "wealth" ? "trending_up" : (GOAL_ICON[g.kind] ?? "flag")} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{g.name}</span>
                      <span className="block text-xs text-on-surface-variant">
                        {formatINR(p.valuePaise)} of {formatINR(g.targetPaise)} · by {formatDate(g.targetDate)}
                      </span>
                    </span>
                    {g.plan ? (
                      <Badge tone={p.onTrack ? "good" : "warn"}>{p.onTrack ? "On track" : "Behind"}</Badge>
                    ) : (
                      <Badge tone="neutral">No plan yet</Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={p.progress} tone={p.onTrack ? "good" : "warn"} label={`${g.name} progress`} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function BefikarTeaser() {
  return (
    <Link href={FEATURES.befikarMode.href} className="relative block overflow-hidden rounded-3xl bg-linear-to-br from-[#00513a] to-[#146c2e] p-5 text-white sm:p-6">
      <div aria-hidden className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon name={FEATURES.befikarMode.icon} /> {FEATURES.befikarMode.name}
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">Coming soon</span>
      </p>
      <p className="mt-3 text-2xl font-semibold">Your Freedom Date</p>
      <p className="mt-1 text-sm text-white/85">The day passive income covers every monthly bill. Start early, save early.</p>
      <p className="mt-3 text-xs text-white/80">
        Sample: Freedom Date {formatDate(BEFIKAR_SAMPLE.freedomDate)} · <span className="underline">See the vision</span>
      </p>
      <span className="sr-only">
        <DemoBadge label="Sample" />
      </span>
    </Link>
  );
}
