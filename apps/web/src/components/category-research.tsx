"use client";

import { useState } from "react";
import { formatDate } from "@arthmitra/engine";
import type { InstrumentType, RiskComfort } from "@arthmitra/schema";
import { RESEARCH, STOCK_RESEARCH } from "@/config/research";
import { fetchResearch, fetchResearchSummary, type CategoryResearch } from "@/lib/services/research";
import { Badge, Disclaimer, Icon, Skeleton, cx } from "./ui";

const RESEARCH_DISCLAIMER = "Research, not a recommendation. Past returns don't guarantee future returns — read the scheme documents before investing.";

const pct = (n: number | null, dp = 2) => (n === null ? "—" : `${n.toFixed(dp)}%`);

/**
 * "Research this category" under one plan line: funds in the category that meet published criteria,
 * with dated AMFI figures and a plain-words read. Loads when opened. Stocks get research criteria only.
 */
export function CategoryResearchPanel({ type, monthsLeft, risk }: { type: InstrumentType; monthsLeft: number; risk: RiskComfort }) {
  const [state, setState] = useState<{ status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; data: CategoryResearch }>({ status: "idle" });
  const [summary, setSummary] = useState<string | null | undefined>(undefined);
  const supported = type in RESEARCH;
  if (!supported && type !== "stocks") return null;

  const load = async () => {
    if (state.status !== "idle" || !supported) return;
    setState({ status: "loading" });
    const q = { type, monthsLeft, risk };
    const data = await fetchResearch(q).catch(() => null);
    setState(data ? { status: "ready", data } : { status: "error" });
    if (data) setSummary(await fetchResearchSummary(q));
  };

  return (
    <details className="group mt-3 rounded-xl border border-primary/25 bg-primary-container/20 px-3 py-2 text-sm" onToggle={(e) => e.currentTarget.open && load()}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
        <Icon name="query_stats" className="text-[18px] text-primary" />
        {supported ? "Research this category" : STOCK_RESEARCH.title}
        <Icon name="expand_more" className="ml-auto text-[20px] transition-transform group-open:rotate-180" />
      </summary>

      {!supported ? (
        <div className="mt-2 flex flex-col gap-2 text-on-surface-variant">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {STOCK_RESEARCH.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="text-xs">{STOCK_RESEARCH.note}</p>
        </div>
      ) : state.status === "loading" || state.status === "idle" ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : state.status === "error" ? (
        <p className="mt-2 text-on-surface-variant">Couldn&apos;t load the research right now. Try again in a minute.</p>
      ) : (
        <ResearchBody data={state.data} summary={summary} />
      )}
    </details>
  );
}

function ResearchBody({ data, summary }: { data: CategoryResearch; summary: string | null | undefined }) {
  const windowLabel = data.window === "1y" ? "1-year return" : "3-year CAGR";
  return (
    <div className="mt-2 flex flex-col gap-3">
      <p className="text-xs text-on-surface-variant">
        {data.peers.count} {data.peerGroup.toLowerCase()} compared on {data.window === "1y" ? "1-year return" : "3-year CAGR"} and expense ratio
        {RESEARCH[data.type]?.trackingOnly ? "" : ", plus ups and downs and worst fall"}. {data.window === "1y" ? "Your goal is under 3 years away, so the last year counts most." : "Your goal is 3 or more years away, so 3-year growth counts most."}
      </p>

      <ol className="flex flex-col gap-2">
        {data.funds.map((f, i) => (
          <li key={f.code} className="@container rounded-xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant/60">
            <div className="flex items-start gap-2.5">
              <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", i === 0 ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant")}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">{f.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
                  <Badge>{f.kind}</Badge>
                  {f.kind === "ETF" ? "Single plan" : "Direct plan · Growth"} · NAV ₹{f.metrics.nav.toLocaleString("en-IN", { maximumFractionDigits: 2 })} on {formatDate(f.metrics.navDate)}
                </p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-center @md:grid-cols-4">
              {[
                [windowLabel, pct(data.window === "1y" ? f.metrics.cagr1y : f.metrics.cagr3y)],
                ["5-year CAGR", pct(f.metrics.cagr5y)],
                ["Expense ratio", pct(f.terPct)],
                ["Worst fall (3y)", f.metrics.maxDrawdownPct === null ? "—" : `-${f.metrics.maxDrawdownPct.toFixed(1)}%`],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-lg bg-surface-container px-1.5 py-1.5">
                  <dt className="text-[11px] text-on-surface-variant">{label}</dt>
                  <dd className="font-semibold whitespace-nowrap tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-on-surface-variant">
              {f.reasons.map((r) => (
                <li key={r} className="flex items-start gap-1.5">
                  <Icon name="check" className="mt-px text-[14px] text-success" />
                  {r}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {summary === undefined ? (
        <Skeleton className="h-14" />
      ) : (
        summary && (
          <p className="flex items-start gap-2 rounded-xl bg-secondary-container/50 px-3 py-2.5 text-on-secondary-container">
            <Icon name="auto_awesome" className="mt-px text-[18px]" />
            <span>
              {summary}
              <span className="mt-1 block text-[11px] opacity-75">Written by Gemini from the figures above.</span>
            </span>
          </p>
        )
      )}

      {data.note && <p className="text-xs text-on-surface-variant">{data.note}</p>}

      <p className="text-[11px] text-on-surface-variant">
        NAVs to {formatDate(data.navAsOf)} (
        {data.source === "live"
          ? "refreshed just now"
          : `${data.source === "mixed" ? "partly refreshed just now, the rest from the " : ""}snapshot of ${formatDate(data.snapshotBuiltAt.slice(0, 10))}`}
        )
        {data.terAsOf ? ` · expense ratios as of ${formatDate(data.terAsOf)}` : ""} · {data.sources.join("; ")}. Fund size (AUM) and exchange trading data aren&apos;t included yet.
      </p>
      <Disclaimer text={RESEARCH_DISCLAIMER} />
    </div>
  );
}
