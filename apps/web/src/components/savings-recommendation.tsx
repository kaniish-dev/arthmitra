"use client";

import { useState } from "react";
import { formatDate, formatINR, type PlanLine, type SavingsRecommendation } from "@arthmitra/engine";
import { PARTNER, partnerLink } from "@/config/partner";
import { Badge, Button, DemoBadge, Disclaimer, Icon, cx } from "./ui";

const PER: Record<string, string> = { monthly: "/month", weekly: "/week", quarterly: "/quarter", irregular: " when income comes", once: "" };
const ROLE: Record<PlanLine["role"], string> = { lump: "Money available today", recurring: "Regular saving", buffer: "Kept instantly available" };
const ICON: Record<string, string> = { savings: "account_balance_wallet", liquid: "water_drop", fd: "lock_clock", rd: "event_repeat" };

/**
 * "How to save for this goal": the recommendation engine's answer — investment mode, products,
 * amounts, tenures, maturity dates, liquidity and early-withdrawal rules, why, an alternative, and
 * whether the goal is achievable on what goes in. `onRevise` opens the inputs again.
 */
export function SavingsRecommendationCard({ reco, goalName, onRevise }: { reco: SavingsRecommendation; goalName: string; onRevise?: () => void }) {
  const [showAlt, setShowAlt] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const lines = showAlt && reco.alternative ? reco.alternative : reco.primary;
  return (
    <section aria-labelledby="how-to-save" className="surface-card rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="how-to-save" className="text-[15px] font-semibold tracking-tight">
            How to save for this goal
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
            <Badge tone="info" icon="tune">
              {reco.modeLabel}
            </Badge>
            {reco.horizonMonths > 0 ? `${reco.horizonMonths} month${reco.horizonMonths === 1 ? "" : "s"} to go` : `${reco.horizonDays} days to go`}
            {reco.illustrative && <DemoBadge label="Illustrative product terms" />}
          </p>
        </div>
        {onRevise && (
          <Button variant="outlined" icon="edit" className="px-4 py-2" onClick={onRevise}>
            Change amount, saving or date
          </Button>
        )}
      </div>

      {/* Achievability, on what you put in — interest is never counted on to close a gap. */}
      <div className={cx("mt-4 rounded-2xl px-4 py-3", reco.achievable ? "bg-success-container/60" : "bg-warning-container/60")}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon name={reco.achievable ? "check_circle" : "warning"} className={cx("text-[20px]", reco.achievable ? "text-success" : "text-warning")} />
          {reco.achievable ? `On track: ${formatINR(reco.projectedPaise)} goes in by the goal date` : `Short by ${formatINR(reco.shortfallPaise)}: this plan puts in ${formatINR(reco.projectedPaise)}`}
        </p>
        {!reco.achievable && (
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-6 text-sm">
            {reco.suggestions.map((s) => (
              <li key={s.kind}>{s.text}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-on-surface-variant">Counts only what you put in. Interest comes on top; it isn&apos;t relied on to reach the goal.</p>
      </div>

      {reco.alternative && (
        <div className="mt-4 flex gap-1 rounded-full bg-surface-container-high p-1 text-sm font-medium" role="tablist" aria-label="Recommendation">
          {(["Recommended", "Alternative"] as const).map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={showAlt === (i === 1)}
              onClick={() => setShowAlt(i === 1)}
              className={cx("flex-1 rounded-full px-3 py-1.5", showAlt === (i === 1) ? "bg-surface-container-lowest shadow-sm" : "text-on-surface-variant")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <ol className="mt-4 flex flex-col gap-3">
        {lines.map((l, i) => (
          <li key={`${l.role}-${l.product.id}-${i}`} className="rounded-2xl border border-outline-variant/70 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                <Icon name={ICON[l.product.kind] ?? "savings"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">{ROLE[l.role]}</p>
                <p className="font-semibold">{l.product.label}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums">
                  {formatINR(l.amountPaise)}
                  <span className="text-sm font-normal text-on-surface-variant">{PER[l.frequency] ?? ""}</span>
                </p>
                {l.role === "recurring" && l.instalments > 1 && <p className="text-xs text-on-surface-variant">{l.instalments} instalments · {formatINR(l.principalPaise)} in all</p>}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-surface-container px-3 py-2">
                <dt className="text-xs text-on-surface-variant">Tenure</dt>
                <dd className="font-medium">{l.tenureLabel}</dd>
              </div>
              <div className="rounded-xl bg-surface-container px-3 py-2">
                <dt className="text-xs text-on-surface-variant">Matures</dt>
                <dd className="font-medium">{l.maturityDate ? formatDate(l.maturityDate) : "Any time"}</dd>
              </div>
              <div className="rounded-xl bg-surface-container px-3 py-2">
                <dt className="text-xs text-on-surface-variant">Maturity value</dt>
                <dd className="font-medium">{l.estimatedMaturityPaise !== null ? `≈ ${formatINR(l.estimatedMaturityPaise)}` : `${formatINR(l.principalPaise)} + interest`}</dd>
              </div>
            </dl>
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {l.why.map((w) => (
                <li key={w} className="flex gap-2">
                  <Icon name="check" className="mt-px text-[18px] text-success" />
                  {w}
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-on-surface-variant sm:grid-cols-2">
              <p className="flex gap-1.5">
                <Icon name="water_drop" className="text-[16px]" />
                <span>
                  <strong className="text-on-surface">Access:</strong> {l.liquidity}
                </span>
              </p>
              <p className="flex gap-1.5">
                <Icon name="schedule" className="text-[16px]" />
                <span>
                  <strong className="text-on-surface">If you need it earlier:</strong> {l.ifNeededEarly}
                </span>
              </p>
            </div>
            {l.product.kind !== "savings" && (
              <a
                href={partnerLink({ category: l.product.kind, amountRupees: l.amountPaise / 100, goal: goalName })}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm shadow-primary/25 hover:bg-[#0a4fbe]"
              >
                <Icon name="open_in_new" className="text-[18px]" />
                Open {l.product.label.toLowerCase()} on {PARTNER.name}
              </a>
            )}
          </li>
        ))}
        {lines.length === 0 && <li className="text-sm text-on-surface-variant">No product fits these answers. Change the amount, saving or date.</li>}
      </ol>

      {reco.rejected.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowRejected(!showRejected)} aria-expanded={showRejected} className="flex items-center gap-1 text-sm font-semibold text-primary">
            Why not other products?
            <Icon name="expand_more" className={cx("text-[20px] transition-transform", showRejected && "rotate-180")} />
          </button>
          {showRejected && (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {dedupe(reco.rejected).map((r) => (
                <li key={`${r.productId}-${r.role}`} className="flex gap-2 text-on-surface-variant">
                  <Icon name="block" className="mt-px text-[18px]" />
                  <span>
                    <strong className="text-on-surface">{r.label}</strong> {r.role === "recurring" ? "(regular saving)" : "(money today)"}: {r.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reco.notes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1 text-xs text-on-surface-variant">
          {reco.notes.map((n) => (
            <li key={n} className="flex gap-1.5">
              <Icon name="info" className="text-[14px]" />
              {n}
            </li>
          ))}
        </ul>
      )}
      <Disclaimer className="mt-3" />
    </section>
  );
}

function dedupe<T extends { productId: string; role: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = `${x.productId}-${x.role}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
