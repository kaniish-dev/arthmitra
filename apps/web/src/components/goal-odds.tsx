"use client";

import { useMemo } from "react";
import { formatINR, simulateGoal } from "@arthmitra/engine";
import type { AllocationLine } from "@arthmitra/schema";
import { ALLOCATION_CONFIG } from "@/config/plan";
import { Disclaimer, cx } from "./ui";

/**
 * Goal success probability from a Monte Carlo simulation (engine montecarlo.ts): 2,000 possible
 * market paths using each instrument's assumed return and volatility.
 */
export function GoalOdds({ allocation, monthlyPaise, months, startPaise, targetPaise }: { allocation: AllocationLine[]; monthlyPaise: number; months: number; startPaise: number; targetPaise: number }) {
  const key = JSON.stringify([allocation, monthlyPaise, months, startPaise, targetPaise]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures every input
  const r = useMemo(() => simulateGoal({ allocation, monthlyPaise, months, startPaise, targetPaise }, ALLOCATION_CONFIG), [key]);
  const pct = Math.round(r.probability * 100);
  const tone = pct >= 75 ? "#146c2e" : pct >= 45 ? "#9a4d00" : "#b3261e";
  return (
    <section aria-labelledby="odds" className="@container rounded-3xl surface-card p-4 sm:p-5">
      <h2 id="odds" className="text-base font-semibold">
        Chance of reaching your goal on time
      </h2>
      {/* Sized by the card, not the screen: the card sits half-width beside the outlook on laptops. */}
      <div className="mt-3 grid grid-cols-1 items-center gap-4 @lg:grid-cols-[auto_minmax(0,1fr)]">
        <div
          role="img"
          aria-label={`${pct}% chance`}
          className="relative mx-auto h-28 w-28 rounded-full"
          style={{ background: `conic-gradient(${tone} ${pct * 3.6}deg, #dfe4dc 0deg)` }}
        >
          <div className="absolute inset-2.5 flex items-center justify-center rounded-full bg-surface-container-lowest">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: tone }}>
              {pct}%
            </span>
          </div>
        </div>
        <div>
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              ["Bad market", r.p10Paise],
              ["Typical", r.p50Paise],
              ["Good market", r.p90Paise],
            ].map(([label, v]) => (
              <div key={label as string} className="min-w-0 rounded-2xl bg-surface-container px-1.5 py-2">
                <dt className="text-xs text-on-surface-variant">{label}</dt>
                <dd className={cx("text-[13px] font-semibold whitespace-nowrap tabular-nums @xs:text-sm", (v as number) >= targetPaise ? "text-success" : "text-on-surface")}>{formatINR(v as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-on-surface-variant">
            We simulated {r.paths.toLocaleString("en-IN")} possible market paths with each investment&apos;s typical ups and downs. Target {formatINR(targetPaise)}.
            {pct < 75 && " Save a little more each month, push the date out, or lower the risk to raise the odds."}
          </p>
        </div>
      </div>
      <Disclaimer className="mt-3" />
    </section>
  );
}
