"use client";

import Link from "next/link";
import { useState } from "react";
import { addMonths, formatDate, formatINR, roundUpTo, todayIso } from "@arthmitra/engine";
import { saveCushion } from "@/lib/actions";
import { FEATURES } from "@/lib/constants";
import { cushionGoal, savingsInsight } from "@/lib/insights";
import { useAppData } from "@/lib/store";
import { useToast } from "@/components/providers";
import { SavingsRecommendationCard } from "@/components/savings-recommendation";
import { savingsFor } from "@/lib/plan/savings";
import { AmountInput, AutofillButton, Badge, Button, Card, Icon, Note, PageHeader, ProgressBar } from "@/components/ui";

const BUILD_MONTHS = 12;

/**
 * Crisis Cushion: a separate emergency fund worth N months of expenses (default 6), with a
 * progress bar, a suggested monthly contribution, and a nudge to build it before high-risk investing.
 */
export function CushionScreen() {
  const data = useAppData()!;
  const toast = useToast();
  const today = todayIso();
  const insight = savingsInsight(data, today);
  const existing = cushionGoal(data);
  const [months, setMonths] = useState(existing?.cushionMonths ?? 6);
  const [expenses, setExpenses] = useState<number | null>(
    existing?.cushionMonths ? Math.round(existing.targetPaise / existing.cushionMonths) : insight.saving.averageSpendPaise || 2_000_000,
  );
  const [saved, setSaved] = useState<number | null>(existing?.cushionSavedPaise ?? 0);

  const target = (expenses ?? 0) * months;
  const have = saved ?? 0;
  const remaining = Math.max(0, target - have);
  const suggested = remaining === 0 ? 0 : Math.min(roundUpTo(remaining / BUILD_MONTHS), Math.max(roundUpTo(remaining / 36), insight.saving.monthlyPaise));
  const progress = target > 0 ? Math.min(1, have / target) : 0;
  const readyBy = suggested > 0 ? addMonths(today, Math.ceil(remaining / suggested)) : today;
  const highRisk = data.goals.some((g) => g.status === "active" && g.risk === "high" && g.path !== "crisisCushion");

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader title={FEATURES.crisisCushion.name} subtitle="Money kept aside for bad days — a job loss, a hospital bill, a sudden trip home. Separate from your goals." back="/more" />
      <div className="flex flex-col gap-5">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-on-surface-variant">Your cushion</p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatINR(have)} <span className="text-base font-normal text-on-surface-variant">of {formatINR(target)}</span>
              </p>
            </div>
            <Badge tone={progress >= 1 ? "good" : progress >= 0.5 ? "info" : "warn"} icon={progress >= 1 ? "verified" : "shield"}>
              {progress >= 1 ? "Fully built" : `${Math.round(progress * 100)}%`}
            </Badge>
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} tone={progress >= 1 ? "good" : "warn"} label="Crisis Cushion progress" />
          </div>
          {remaining > 0 ? (
            <p className="mt-3 text-sm">
              Put aside <strong className="tabular-nums">{formatINR(suggested)}</strong> a month and it&apos;s ready by <strong>{formatDate(readyBy)}</strong>.
            </p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-success">Your cushion covers {months} months. Befikar! 🎉</p>
          )}
        </Card>

        <SavingsRecommendationCard
          goalName="Crisis Cushion"
          reco={savingsFor(
            data,
            { targetPaise: Math.max(1, target), targetDate: readyBy > today ? readyBy : addMonths(today, 1), existingPaise: 0, isEmergency: true },
            { lumpSumPaise: have, recurringPaise: suggested, frequency: suggested > 0 ? "monthly" : "none", needsEarlyAccess: "yes", canCommit: true },
            today,
          )}
        />

        {highRisk && remaining > 0 && (
          <Note icon="warning">
            You have a High-risk plan. Build the cushion first, so a bad month never forces you to sell investments when markets are down.
          </Note>
        )}

        <Card className="flex flex-col gap-4">
          <AutofillButton
            onClick={() => {
              setMonths(6);
              setExpenses(insight.saving.averageSpendPaise || 2_500_000);
              setSaved(2_500_000);
            }}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Months of expenses to keep</legend>
            <div className="flex flex-wrap gap-2">
              {[3, 6, 9, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={months === m}
                  onClick={() => setMonths(m)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium ${months === m ? "border-primary bg-primary-container text-on-primary-container" : "border-outline"}`}
                >
                  {m} months{m === 6 ? " · suggested" : ""}
                </button>
              ))}
            </div>
          </fieldset>
          <AmountInput label="Monthly expenses" valuePaise={expenses} onChange={setExpenses} hint={`From your transactions: about ${formatINR(insight.saving.averageSpendPaise)} a month.`} />
          <AmountInput label="Already set aside" valuePaise={saved} onChange={setSaved} hint="Money you keep only for emergencies." />
          <p className="text-sm text-on-surface-variant">
            <Icon name="lightbulb" className="mr-1 align-[-4px] text-[18px] text-tertiary" />
            Keep it where you can reach it in a day: a separate savings account, a sweep-in FD or a liquid fund. Not in shares.
          </p>
          <Button
            icon="save"
            className="h-12"
            onClick={() => {
              saveCushion({ months, savedPaise: have, targetPaise: target, monthlyPaise: suggested, targetDate: readyBy });
              toast({ message: "Crisis Cushion saved." });
            }}
          >
            Save cushion
          </Button>
        </Card>

        <Link href="/emergency" className="flex items-center gap-3 rounded-3xl border border-dashed border-outline-variant p-4 text-sm hover:bg-on-surface/4">
          <Icon name="emergency_home" className="text-error" />
          <span className="flex-1">In an emergency right now? Open the emergency plan.</span>
          <Icon name="chevron_right" />
        </Link>
      </div>
    </div>
  );
}
