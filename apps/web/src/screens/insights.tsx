"use client";

import { categoryName, formatINR, formatMonth, isSpending, monthKey, previousMonthKey, savingsRate, summariseMonth, todayIso } from "@arthmitra/engine";
import { useState } from "react";
import { budgetsFor } from "@/lib/derive";
import { amountText, merchantLabel } from "@/lib/format";
import { useAppData } from "@/lib/store";
import { CategoryDonut } from "@/components/charts";
import { categoryIcon } from "@/components/transactions";
import { Avatar, Badge, Card, CardTitle, Icon, IconButton, PageHeader, ProgressBar, Stat, cx } from "@/components/ui";

/** Month in review: totals, change from the month before, categories against budgets, top shops. */
export function InsightsScreen() {
  const data = useAppData()!;
  const today = todayIso();
  const months = [...new Set([monthKey(today), ...data.transactions.map((t) => monthKey(t.date))])].sort().reverse();
  const [index, setIndex] = useState(0);
  const key = months[Math.min(index, months.length - 1)]!;
  const prevKey = previousMonthKey(`${key}-01`);
  const m = summariseMonth(data.transactions, key);
  const prev = summariseMonth(data.transactions, prevKey);
  const rate = savingsRate(m.incomePaise, m.spendingPaise);
  const change = prev.spendingPaise > 0 ? (m.spendingPaise - prev.spendingPaise) / prev.spendingPaise : null;

  const budgets = new Map(budgetsFor(data, m).map((b) => [b.category, b]));
  const byCategory = Object.entries(m.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([id, paise]) => ({ id, label: id === "uncategorised" ? "Uncategorised" : categoryName(data.categories, id), paise }));

  const spends = data.transactions.filter((t) => monthKey(t.date) === key && isSpending(t));
  const shops = new Map<string, { paise: number; count: number }>();
  for (const t of spends) {
    const s = shops.get(t.merchantKey) ?? { paise: 0, count: 0 };
    shops.set(t.merchantKey, { paise: s.paise - t.amountPaise, count: s.count + 1 });
  }
  const topShops = [...shops].sort((a, b) => b[1].paise - a[1].paise).slice(0, 5);
  const biggest = [...spends].sort((a, b) => a.amountPaise - b.amountPaise)[0];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Insights" subtitle="Your month in review." />

      <div className="mb-6 flex items-center justify-between rounded-full bg-surface-container-high p-1">
        <IconButton icon="chevron_left" label="Earlier month" disabled={index >= months.length - 1} onClick={() => setIndex(index + 1)} />
        <p className="font-semibold" aria-live="polite">
          {formatMonth(key)}
          {key === monthKey(today) && <span className="font-normal text-on-surface-variant"> · so far</span>}
        </p>
        <IconButton icon="chevron_right" label="Later month" disabled={index === 0} onClick={() => setIndex(index - 1)} />
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div>
              <Stat label="Spent" value={formatINR(m.spendingPaise)} />
              {change !== null && (
                <p className={cx("mt-1 flex items-center gap-0.5 text-xs font-medium", change > 0 ? "text-error" : "text-success")}>
                  <Icon name={change > 0 ? "arrow_upward" : "arrow_downward"} className="text-[14px]" />
                  {Math.abs(Math.round(change * 100))}% vs {formatMonth(prevKey).split(" ")[0]}
                </p>
              )}
            </div>
            <Stat label="Income" value={formatINR(m.incomePaise)} />
            <Stat label="Left over" value={formatINR(m.incomePaise - m.spendingPaise)} tone={m.incomePaise - m.spendingPaise >= 0 ? "good" : "bad"} />
            <Stat label="Savings rate" value={rate === null ? "—" : `${Math.round(rate * 100)}%`} sub={m.investedPaise ? `${formatINR(m.investedPaise)} invested` : undefined} />
          </div>
        </Card>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle icon="donut_large">Where it went</CardTitle>
            {byCategory.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No spending in {formatMonth(key)}.</p>
            ) : (
              <>
                <CategoryDonut rows={byCategory} />
                <ul className="mt-4 flex flex-col gap-4">
                  {byCategory.map((c) => {
                    const b = budgets.get(c.id);
                    return (
                      <li key={c.id}>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
                            <Icon name={c.id === "uncategorised" ? "help" : categoryIcon(data, c.id)} className="text-[20px]" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{c.label}</span>
                          {b?.level === "over" && (
                            <span className="hidden sm:inline">
                              <Badge tone="bad">over budget</Badge>
                            </span>
                          )}
                          <span className="shrink-0 font-semibold tabular-nums">{formatINR(c.paise)}</span>
                        </div>
                        {b && (
                          <div className="mt-1.5 pl-12">
                            <ProgressBar value={b.share} tone={b.level === "over" ? "bad" : b.level === "near" ? "warn" : "good"} label={`${c.label} budget used`} />
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {Math.round(b.share * 100)}% of {formatINR(b.budgetPaise)} {b.fromEstimate ? "estimate" : "limit"}
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardTitle icon="storefront">Top shops</CardTitle>
              {topShops.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No shop payments this month.</p>
              ) : (
                <ol className="flex flex-col gap-1">
                  {topShops.map(([merchant, s]) => {
                    const name = merchantLabel(merchant);
                    return (
                      <li key={merchant} className="flex items-center gap-3 py-1.5">
                        <Avatar name={name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{name}</span>
                          <span className="text-xs text-on-surface-variant">
                            {s.count} {s.count === 1 ? "payment" : "payments"}
                          </span>
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{formatINR(s.paise)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>

            {biggest && (
              <Card>
                <CardTitle icon="trending_up">Biggest payment</CardTitle>
                <div className="flex items-center gap-3">
                  <Avatar name={merchantLabel(biggest.merchantKey)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{merchantLabel(biggest.merchantKey)}</span>
                    <span className="text-xs text-on-surface-variant">{categoryName(data.categories, biggest.category)}</span>
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{amountText(biggest.amountPaise)}</span>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
