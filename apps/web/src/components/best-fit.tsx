"use client";

import { CHECKLIST, INSTRUMENTS, INSTRUMENT_LABEL, assumedReturnPctFor, rankFits } from "@/lib/plan/best-fit";
import type { AllocationLine, RiskComfort } from "@arthmitra/schema";
import { PARTNER, partnerLink } from "@/config/partner";
import { Badge, Disclaimer, Icon, cx } from "./ui";

/**
 * Best fit for this goal: the investment categories that suit it best, with the reasons, a
 * "what to look for" checklist, and a link to the partner app for that category. Categories only —
 * never a named bank, fund or platform.
 */
export function BestFit({
  goalName,
  monthsLeft,
  risk,
  isMinor,
  monthlyPaise,
  allocation,
}: {
  goalName: string;
  monthsLeft: number;
  risk: RiskComfort;
  isMinor: boolean;
  monthlyPaise: number;
  allocation: AllocationLine[];
}) {
  const top = rankFits({ monthsLeft, risk, monthly: true, isMinor }).slice(0, 3);
  const share = (t: string) => allocation.find((l) => l.type === t)?.pct ?? 0;
  return (
    <section aria-labelledby="best-fit" className="surface-card rounded-3xl p-5 sm:p-6">
      <h2 id="best-fit" className="text-[15px] font-semibold tracking-tight">
        Best fit for this goal
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">Ranked on your time frame, risk appetite and monthly saving. Pick any product in the category on a {PARTNER.label}.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {top.map((f, i) => {
          const pct = share(f.type);
          const paise = pct ? Math.round((monthlyPaise * pct) / 100) : 0;
          return (
            <li key={f.type} className={cx("rounded-2xl border p-4", i === 0 ? "border-primary/40 bg-primary-container/25" : "border-outline-variant/70")}>
              <div className="flex flex-wrap items-start gap-3">
                <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", i === 0 ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant")}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {INSTRUMENT_LABEL[f.type]}
                    {i === 0 && <Badge tone="info">Best fit</Badge>}
                    {pct > 0 && <Badge tone="good">{pct}% of your plan</Badge>}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {INSTRUMENTS[f.type].risk} risk · ~{assumedReturnPctFor(f.type)}%/yr assumed · {INSTRUMENTS[f.type].regulator}
                  </p>
                </div>
                <div className="w-24 text-right">
                  <p className="text-xs text-on-surface-variant">Fit score</p>
                  <p className="text-lg font-semibold tabular-nums">{f.score}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container-high" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${f.score}%` }} />
                  </div>
                </div>
              </div>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {f.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <Icon name="check" className="mt-px text-[18px] text-success" />
                    {r}
                  </li>
                ))}
                {f.caution && (
                  <li className="flex gap-2 text-on-surface-variant">
                    <Icon name="info" className="mt-px text-[18px]" />
                    {f.caution}
                  </li>
                )}
              </ul>
              <details className="group mt-3 rounded-xl bg-surface-container px-3 py-2 text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
                  <Icon name="checklist" className="text-[18px] text-primary" />
                  What to look for before you pick one
                  <Icon name="expand_more" className="ml-auto text-[20px] transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-on-surface-variant">
                  {CHECKLIST[f.type].map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
              <a
                href={partnerLink({ category: f.type, amountRupees: paise / 100, goal: goalName })}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm shadow-primary/25 hover:bg-[#0a4fbe]"
              >
                <Icon name="open_in_new" className="text-[18px]" />
                Explore {INSTRUMENT_LABEL[f.type].toLowerCase()} options on {PARTNER.name}
              </a>
            </li>
          );
        })}
      </ol>
      <Disclaimer className="mt-4" />
    </section>
  );
}
