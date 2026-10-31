"use client";

import { useMemo } from "react";
import { addMonths, formatDate, formatINR, todayIso, yearOutlook } from "@arthmitra/engine";
import type { AllocationLine } from "@arthmitra/schema";
import { ALLOCATION_CONFIG } from "@/config/plan";
import { Disclaimer, cx } from "./ui";

/**
 * This year's outlook for a goal: the range of values the plan could reach in the next 12 months
 * (Monte Carlo, same model as the goal odds), the chance of still being on track and of a loss.
 * A projection from assumed returns and volatility — not a market prediction.
 */
export function YearOutlook(props: { allocation: AllocationLine[]; monthlyPaise: number; startPaise: number; targetPaise: number; monthsLeft: number; expectedReturnPct: number }) {
  const key = JSON.stringify(props);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures every input
  const o = useMemo(() => yearOutlook(props, ALLOCATION_CONFIG), [key]);
  const span = Math.max(1, o.p90Paise - o.p10Paise);
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - o.p10Paise) / span) * 100))}%`;
  const track = Math.round(o.onTrackProbability * 100);
  const loss = Math.round(o.lossProbability * 100);
  const by = formatDate(addMonths(todayIso(), o.months));
  return (
    <section aria-labelledby="outlook" className="surface-card rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="outlook" className="text-[15px] font-semibold tracking-tight">
          This year&apos;s outlook
        </h2>
        <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">Projection, not a prediction</span>
      </div>
      <p className="mt-1 text-sm text-on-surface-variant">
        Where this plan could be by <strong className="text-on-surface">{by}</strong>, after you put in {formatINR(o.paidInPaise)}.
      </p>

      <div className="mt-5">
        <div className="relative h-3 rounded-full bg-linear-to-r from-[#f9dedc] via-[#d3e3fd] to-[#c4eed0]" aria-hidden>
          <span className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-surface" style={{ left: at(o.p50Paise) }} />
          {o.onTrackPaise > o.p10Paise && o.onTrackPaise < o.p90Paise && (
            <span className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 border-l-2 border-dashed border-primary" style={{ left: at(o.onTrackPaise) }} />
          )}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-on-surface-variant">Bad year</dt>
            <dd className="font-semibold tabular-nums">{formatINR(o.p10Paise)}</dd>
          </div>
          <div className="text-center">
            <dt className="text-xs text-on-surface-variant">Most likely</dt>
            <dd className="font-semibold tabular-nums">{formatINR(o.p50Paise)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-on-surface-variant">Good year</dt>
            <dd className="font-semibold tabular-nums">{formatINR(o.p90Paise)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-container px-3 py-2.5">
          <p className="text-xs text-on-surface-variant">Chance you&apos;re still on track</p>
          <p className={cx("text-xl font-semibold tabular-nums", track >= 70 ? "text-success" : track >= 40 ? "text-warning" : "text-error")}>{track}%</p>
          <p className="text-[11px] text-on-surface-variant">Needs about {formatINR(o.onTrackPaise)} by then</p>
        </div>
        <div className="rounded-2xl bg-surface-container px-3 py-2.5">
          <p className="text-xs text-on-surface-variant">Chance of ending below what you put in</p>
          <p className={cx("text-xl font-semibold tabular-nums", loss <= 5 ? "text-success" : loss <= 25 ? "text-warning" : "text-error")}>{loss}%</p>
          <p className="text-[11px] text-on-surface-variant">{loss <= 5 ? "Your mix is steady over a year" : "Normal for shares; it evens out over years"}</p>
        </div>
      </div>
      <Disclaimer className="mt-4" />
    </section>
  );
}
