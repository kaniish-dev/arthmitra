"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { INSTRUMENT_LABEL, addMonths, formatDate, formatINR, monthsBetween, todayIso, wealthTarget } from "@arthmitra/engine";
import type { Goal, GoalFunding, RiskComfort, Timeline } from "@arthmitra/schema";
import { SavingsRecommendationCard } from "@/components/savings-recommendation";
import { fundingOf, monthlyEquivalent, savingsFor } from "@/lib/plan/savings";
import { AllocationDonut } from "@/components/charts";
import { GoalOdds } from "@/components/goal-odds";
import { RISK_COPY, TIMELINE_COPY, TERMS } from "@/config/plan";
import { savePlannedGoal } from "@/lib/actions";
import { FEATURES } from "@/lib/constants";
import { cushionGoal, savingsInsight } from "@/lib/insights";
import { assumedReturnPct, buildPlan, timelineFor, wealthYears } from "@/lib/plan/allocation";
import { useAppData } from "@/lib/store";
import { AmountInput, AutofillButton, Badge, Button, Card, Chip, Disclaimer, Icon, Note, PageHeader, TextInput, cx } from "@/components/ui";

type Path = "bigDay" | "wealth";
type Step = "path" | "details" | "money" | "risk" | "review";

const BIG_DAYS: Array<{ kind: Goal["kind"]; label: string; icon: string; name: string; amount: number; months: number }> = [
  { kind: "car", label: "Car", icon: "directions_car", name: "Car down payment", amount: 3_00_000, months: 30 },
  { kind: "wedding", label: "Wedding", icon: "favorite", name: "Wedding", amount: 8_00_000, months: 48 },
  { kind: "trip", label: "Dream Vacation", icon: "flight", name: "Dream vacation", amount: 1_50_000, months: 18 },
  { kind: "custom", label: "Custom", icon: "edit", name: "", amount: 50_000, months: 12 },
];

const R = (rupees: number) => rupees * 100;

/**
 * Explore → Timeline and risk appetite → Investment plan. Two paths: Save for a Big Day (a goal
 * with an amount and a date) or Wealth Generator (one goal: passive income covering all monthly
 * expenses). Timeline and risk decide the mix; the plan shows what to invest in each month.
 */
export function ExploreScreen() {
  const data = useAppData()!;
  const router = useRouter();
  const params = useSearchParams();
  const today = todayIso();
  const insight = savingsInsight(data, today);
  const editing = data.goals.find((g) => g.id === params.get("edit")) ?? null;
  const startPath = (editing?.path === "wealth" ? "wealth" : editing ? "bigDay" : params.get("path")) as Path | null;
  const avgExpenses = insight.saving.averageSpendPaise || R(25_000);

  const [step, setStep] = useState<Step>(startPath ? "details" : "path");
  const [path, setPath] = useState<Path>(startPath ?? "bigDay");
  const [kind, setKind] = useState<Goal["kind"]>(editing?.kind ?? "car");
  const [name, setName] = useState(editing?.name ?? BIG_DAYS[0]!.name);
  const [amount, setAmount] = useState<number | null>(editing && editing.path !== "wealth" ? editing.targetPaise : R(BIG_DAYS[0]!.amount));
  const [date, setDate] = useState(editing?.targetDate ?? addMonths(today, BIG_DAYS[0]!.months));
  const [expenses, setExpenses] = useState<number | null>(editing?.monthlyExpensesPaise ?? avgExpenses);
  const [timeline, setTimeline] = useState<Timeline | null>(editing?.timeline ?? null);
  const [risk, setRisk] = useState<RiskComfort>(editing?.risk ?? (data.registration?.isMinor ? "low" : "medium"));
  const [monthly, setMonthly] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // How the goal is funded: asked before any product is suggested.
  const startFunding = editing ? fundingOf(editing) : null;
  const affordable = insight.freePaise + (editing?.plan?.monthlyPaise ?? 0);
  const [lumpSum, setLumpSum] = useState<number | null>(startFunding?.lumpSumPaise ?? 0);
  const [recurring, setRecurring] = useState<number | null>(startFunding?.recurringPaise ?? affordable);
  const [frequency, setFrequency] = useState<GoalFunding["frequency"]>(startFunding?.frequency ?? "monthly");
  const [early, setEarly] = useState<GoalFunding["needsEarlyAccess"]>(startFunding?.needsEarlyAccess ?? "no");
  const [commit, setCommit] = useState<boolean>(startFunding?.canCommit ?? true);

  // Big Day: the timeline follows the date unless the user overrides it. Wealth: the timeline sets the date.
  const derived = timelineFor(monthsBetween(today, date));
  const tl: Timeline = timeline ?? (path === "wealth" ? "long" : derived);
  const targetDate = path === "wealth" ? addMonths(today, wealthYears(tl) * 12) : date;
  const targetPaise = path === "wealth" ? wealthTarget(expenses ?? 0) : (amount ?? 0);
  const monthsLeft = Math.max(1, monthsBetween(today, targetDate));
  const funding: GoalFunding = { lumpSumPaise: lumpSum ?? 0, recurringPaise: frequency === "none" ? 0 : (recurring ?? 0), frequency, needsEarlyAccess: early, canCommit: commit };
  const reco = savingsFor(data, { targetPaise, targetDate, existingPaise: 0, isEmergency: false }, funding, today);
  // The investment mix runs on the regular saving; money available today counts as already invested.
  const plan = buildPlan({ targetPaise, savedPaise: funding.lumpSumPaise, monthsLeft, risk, timeline: tl, affordablePaise: monthlyEquivalent(funding), monthlyPaise: monthly });
  const cushion = cushionGoal(data);
  const cushionReady = cushion ? (cushion.cushionSavedPaise ?? 0) >= cushion.targetPaise : false;

  const nextFromDetails = () => {
    setError(null);
    if (path === "bigDay") {
      if (!name.trim()) return setError("Give your goal a name.");
      if (!amount || amount < R(1_000)) return setError("Enter a target amount of at least ₹1,000.");
      if (monthsBetween(today, date) < 1) return setError("Pick a date at least a month away.");
    } else if (!expenses || expenses < R(1_000)) return setError("Enter your monthly expenses.");
    setStep("money");
  };

  const nextFromMoney = () => {
    setError(null);
    if (!(lumpSum ?? 0) && (frequency === "none" || !(recurring ?? 0))) return setError("Enter money available today, a regular saving, or both.");
    setStep("risk");
  };

  const save = () => {
    const id = savePlannedGoal({
      id: editing?.id,
      name: path === "wealth" ? "Escape the rat race" : name.trim(),
      kind: path === "wealth" ? "custom" : kind,
      path,
      targetPaise,
      targetDate,
      risk,
      timeline: tl,
      monthlyExpensesPaise: path === "wealth" ? (expenses ?? 0) : undefined,
      funding,
      plan: {
        allocation: plan.allocation,
        monthlyPaise: plan.monthlyPaise,
        requiredPaise: plan.requiredPaise,
        projectedPaise: plan.projectedPaise,
        expectedReturnPct: plan.expectedReturnPct,
        createdAt: editing?.plan?.createdAt ?? new Date().toISOString(),
      },
    });
    router.push(`/plan/view?id=${id}`);
  };

  const back = step === "path" ? "/plan" : undefined;
  const STEPS: Step[] = ["path", "details", "money", "risk", "review"];

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader
        title={
          step === "path"
            ? "Plan something"
            : step === "details"
              ? path === "wealth"
                ? FEATURES.wealth.name
                : FEATURES.bigDay.name
              : step === "money"
                ? "Your money"
                : step === "risk"
                  ? "Timeline and risk"
                  : "Your plan"
        }
        subtitle={
          step === "path"
            ? `You can realistically save ${formatINR(insight.saving.monthlyPaise)} a month${insight.committedPaise ? ` (${formatINR(insight.freePaise)} free after your current plans)` : ""}. Pick a path.`
            : undefined
        }
        back={back ?? "/plan"}
      />
      <ol className="mb-5 flex gap-1.5" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined} className={cx("h-1.5 flex-1 rounded-full", STEPS.indexOf(step) >= i ? "bg-primary" : "bg-surface-container-highest")} />
        ))}
      </ol>

      {step === "path" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PathCard
            icon={FEATURES.bigDay.icon}
            title={FEATURES.bigDay.name}
            text="A goal with an amount and a date — a car, a wedding, a dream vacation."
            tone="bg-primary-container text-on-primary-container"
            onClick={() => {
              setPath("bigDay");
              setStep("details");
            }}
          />
          <PathCard
            icon={FEATURES.wealth.icon}
            title={`${FEATURES.wealth.name}`}
            text="Escape the rat race: build passive income that covers all your fixed and variable expenses. One goal only."
            tone="bg-tertiary-container text-on-tertiary-container"
            onClick={() => {
              setPath("wealth");
              setStep("details");
            }}
          />
        </div>
      )}

      {step === "details" && path === "bigDay" && (
        <Card className="flex flex-col gap-4">
          <AutofillButton
            label="Autofill: Dream Vacation, ₹1,50,000 in 18 months"
            onClick={() => {
              setKind("trip");
              setName("Dream vacation to Ladakh");
              setAmount(R(1_50_000));
              setDate(addMonths(today, 18));
              setTimeline(null);
            }}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">What&apos;s the Big Day?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BIG_DAYS.map((b) => (
                <button
                  key={b.kind}
                  type="button"
                  aria-pressed={kind === b.kind}
                  onClick={() => {
                    setKind(b.kind);
                    setName(b.name);
                    setAmount(R(b.amount));
                    setDate(addMonths(today, b.months));
                    setTimeline(null);
                  }}
                  className={cx("flex flex-col items-center gap-1 rounded-2xl border p-3 text-sm font-medium", kind === b.kind ? "border-primary bg-primary-container text-on-primary-container" : "border-outline-variant hover:bg-on-surface/4")}
                >
                  <Icon name={b.icon} className="text-2xl" />
                  {b.label}
                </button>
              ))}
            </div>
          </fieldset>
          <TextInput label="Goal name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. New bike" />
          <AmountInput label="Target amount" valuePaise={amount} onChange={setAmount} />
          <TextInput
            label="Target date"
            type="date"
            value={date}
            min={addMonths(today, 1)}
            onChange={(e) => {
              setDate(e.target.value);
              setTimeline(null);
            }}
            hint={`${formatDate(date)} · ${monthsBetween(today, date)} months away · ${TIMELINE_COPY[derived].label.toLowerCase()}`}
          />
          {error && <p role="alert" className="text-sm font-medium text-error">{error}</p>}
          <Button icon="arrow_forward" className="h-12" onClick={nextFromDetails}>
            Next: your money
          </Button>
        </Card>
      )}

      {step === "details" && path === "wealth" && (
        <Card className="flex flex-col gap-4">
          <p className="text-sm">
            Passive income is money that comes in without you working for it. Your goal: a portfolio big enough that taking out <strong>4% a year</strong> covers all your monthly expenses.
          </p>
          <AmountInput
            label="Monthly expenses to cover (fixed + variable)"
            valuePaise={expenses}
            onChange={setExpenses}
            hint={`Prefilled from your transactions: ${formatINR(avgExpenses)} a month on average. Edit if your lifestyle will change.`}
          />
          <div className="rounded-2xl bg-tertiary-container/50 p-4">
            <p className="text-sm text-on-surface-variant">Wealth target (25 × yearly expenses)</p>
            <p className="text-3xl font-semibold tabular-nums">{formatINR(wealthTarget(expenses ?? 0))}</p>
          </div>
          <Link href={FEATURES.befikarMode.href} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <Icon name={FEATURES.befikarMode.icon} className="text-[18px]" /> {FEATURES.befikarMode.name}: see your Freedom Date (coming soon)
          </Link>
          {error && <p role="alert" className="text-sm font-medium text-error">{error}</p>}
          <Button icon="arrow_forward" className="h-12" onClick={nextFromDetails}>
            Next: your money
          </Button>
        </Card>
      )}

      {step === "money" && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">How will you fund it?</h2>
                <p className="text-sm text-on-surface-variant">We pick the product only after this — not before.</p>
              </div>
              <AutofillButton
                label="Autofill: ₹20,000 today + monthly saving"
                onClick={() => {
                  setLumpSum(R(20_000));
                  setRecurring(affordable || R(5_000));
                  setFrequency("monthly");
                  setEarly("no");
                  setCommit(true);
                }}
              />
            </div>
            <AmountInput label="Money available today for this goal" valuePaise={lumpSum} onChange={setLumpSum} hint="Only money you can set aside now. Leave 0 if you'll save from scratch." />
            <fieldset>
              <legend className="mb-2 text-sm font-medium">How will you keep saving?</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["monthly", "Every month"],
                    ["weekly", "Every week"],
                    ["quarterly", "Every 3 months"],
                    ["irregular", "When income comes (irregular)"],
                    ["none", "Just the amount today"],
                  ] as const
                ).map(([f, label]) => (
                  <Chip key={f} selected={frequency === f} onClick={() => setFrequency(f)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            {frequency !== "none" && (
              <AmountInput
                label={frequency === "weekly" ? "Amount each week" : frequency === "quarterly" ? "Amount every 3 months" : frequency === "irregular" ? "Roughly how much a month" : "Amount each month"}
                valuePaise={recurring}
                onChange={setRecurring}
                hint={`Your realistic saving leaves ${formatINR(insight.freePaise)} a month free after current plans.`}
              />
            )}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Might you need this money before {formatDate(targetDate)}?</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["no", "No"],
                    ["unsure", "Not sure"],
                    ["yes", "Yes, I may"],
                  ] as const
                ).map(([v, label]) => (
                  <Chip key={v} selected={early === v} onClick={() => setEarly(v)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            {frequency === "monthly" && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Can you commit to the same amount every month?</legend>
                <div className="flex flex-wrap gap-2">
                  <Chip selected={commit} onClick={() => setCommit(true)}>
                    Yes, every month
                  </Chip>
                  <Chip selected={!commit} onClick={() => setCommit(false)}>
                    No, it may vary
                  </Chip>
                </div>
              </fieldset>
            )}
            {error && <p role="alert" className="text-sm font-medium text-error">{error}</p>}
          </Card>
          <SavingsRecommendationCard reco={reco} goalName={path === "wealth" ? "Escape the rat race" : name} />
          <div className="flex gap-2">
            <Button variant="text" icon="arrow_back" onClick={() => setStep("details")} className="h-12">
              Back
            </Button>
            <Button icon="arrow_forward" className="h-12 flex-1" onClick={nextFromMoney}>
              Next: timeline and risk
            </Button>
          </div>
        </div>
      )}

      {step === "risk" && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-base font-semibold">Timeline</h2>
            <p className="mb-3 text-sm text-on-surface-variant">
              {path === "wealth" ? "How aggressive are you? A shorter timeline means saving more each month." : `From your date this is ${TIMELINE_COPY[derived].label.toLowerCase()}. You can override it.`}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(TIMELINE_COPY) as Timeline[]).map((t) => (
                <OptionCard
                  key={t}
                  selected={tl === t}
                  onClick={() => setTimeline(t)}
                  title={TIMELINE_COPY[t].label}
                  sub={path === "wealth" ? `${wealthYears(t)} years · by ${formatDate(addMonths(today, wealthYears(t) * 12))}` : TIMELINE_COPY[t].range}
                  text={TIMELINE_COPY[t].explainer}
                  badge={path === "bigDay" && t === derived ? "From your date" : undefined}
                />
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-base font-semibold">Risk appetite</h2>
            <p className="mb-3 text-sm text-on-surface-variant">How much up-and-down can you sleep through?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(RISK_COPY) as RiskComfort[]).map((r) => (
                <OptionCard key={r} selected={risk === r} onClick={() => setRisk(r)} icon={RISK_COPY[r].icon} title={RISK_COPY[r].label} sub={RISK_COPY[r].meaning} text={`e.g. ${RISK_COPY[r].examples}`} />
              ))}
            </div>
            {tl === "short" && risk === "high" && (
              <p className="mt-3 text-sm text-on-surface-variant">
                <Icon name="info" className="mr-1 align-[-4px] text-[18px]" />
                Short timeline: equity is capped at 20% even on High, so a bad market year can&apos;t wreck the goal.
              </p>
            )}
            {risk === "high" && !cushionReady && (
              <Note icon={FEATURES.crisisCushion.icon}>
                Build your {FEATURES.crisisCushion.name} first: a few months of expenses kept safe before high-risk investing.{" "}
                <Link href={FEATURES.crisisCushion.href} className="font-semibold text-primary underline">
                  Set it up
                </Link>
              </Note>
            )}
            <Disclaimer className="mt-3" />
          </Card>
          <div className="flex gap-2">
            <Button variant="text" icon="arrow_back" onClick={() => setStep("money")} className="h-12">
              Back
            </Button>
            <Button icon="arrow_forward" className="h-12 flex-1" onClick={() => setStep("review")}>
              See my plan
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          <SavingsRecommendationCard reco={reco} goalName={path === "wealth" ? "Escape the rat race" : name} onRevise={() => setStep("money")} />
          <Card>
            <p className="mb-3 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Investment mix for your regular saving</p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-on-surface-variant">
                  {path === "wealth" ? "Escape the rat race" : name} · {formatINR(targetPaise)} by {formatDate(targetDate)}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{formatINR(plan.monthlyPaise)}/month</p>
                <p className="text-sm text-on-surface-variant">
                  Needed to hit it on time: <strong className="tabular-nums">{formatINR(plan.requiredPaise)}</strong> · you said {formatINR(monthlyEquivalent(funding))} a month{funding.lumpSumPaise ? ` + ${formatINR(funding.lumpSumPaise)} today` : ""}
                </p>
              </div>
              <Badge tone={plan.onTrack ? "good" : "warn"} icon={plan.onTrack ? "check_circle" : "schedule"}>
                {plan.onTrack ? "On track" : `Short by ${formatINR(plan.shortfallPaise)}/mo`}
              </Badge>
            </div>
            <div className="mt-4">
              <AmountInput
                label="Monthly SIP / deposit"
                valuePaise={plan.monthlyPaise}
                onChange={setMonthly}
                hint={
                  plan.monthlyPaise > Math.max(monthlyEquivalent(funding), affordable) ? (
                    <span className="font-medium text-error">
                      More than you can realistically save ({formatINR(Math.max(monthlyEquivalent(funding), affordable))}/month). Lower it, or move the date out.
                    </span>
                  ) : (
                    TERMS.SIP
                  )
                }
              />
            </div>
            <p className="mt-3 text-sm">
              Projected value by {formatDate(targetDate)}: <strong className="tabular-nums">{formatINR(plan.projectedPaise)}</strong> at an assumed {plan.expectedReturnPct}% a year.
            </p>
            <Disclaimer className="mt-3" />
          </Card>
          <Card>
            <h2 className="mb-2 text-base font-semibold">
              Mix: {TIMELINE_COPY[tl].label} · {RISK_COPY[risk].label} risk
            </h2>
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[200px_1fr]">
              <AllocationDonut rows={plan.allocation.map((l) => ({ label: INSTRUMENT_LABEL[l.type], pct: l.pct }))} />
              <ul className="flex flex-col gap-2 text-sm">
                {plan.split.map((l) => (
                  <li key={l.type} className="flex justify-between gap-3">
                    <span>
                      {INSTRUMENT_LABEL[l.type]} <span className="text-on-surface-variant">· {l.pct}% · ~{assumedReturnPct(l.type)}%/yr assumed</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatINR(l.paise)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <GoalOdds allocation={plan.allocation} monthlyPaise={plan.monthlyPaise} months={monthsLeft} startPaise={funding.lumpSumPaise} targetPaise={targetPaise} />
          <div className="flex gap-2">
            <Button variant="text" icon="arrow_back" onClick={() => setStep("risk")} className="h-12">
              Back
            </Button>
            <Button icon="check" className="h-12 flex-1" onClick={save}>
              {editing ? "Update plan" : "Save plan"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PathCard({ icon, title, text, tone, onClick }: { icon: string; title: string; text: string; tone: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex min-h-52 flex-col gap-3 rounded-3xl p-6 text-left transition-transform hover:scale-[1.01]", tone)}>
      <Icon name={icon} className="text-4xl" />
      <span className="text-2xl font-semibold">{title}</span>
      <span className="text-sm opacity-90">{text}</span>
      <span className="mt-auto flex items-center gap-1 text-sm font-semibold">
        Start <Icon name="arrow_forward" className="text-[18px]" />
      </span>
    </button>
  );
}

function OptionCard({ selected, onClick, title, sub, text, icon, badge }: { selected: boolean; onClick: () => void; title: string; sub: string; text: string; icon?: string; badge?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx("flex flex-col gap-1 rounded-2xl border p-3 text-left", selected ? "border-primary bg-primary-container/60" : "border-outline-variant hover:bg-on-surface/4")}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        {icon && <Icon name={icon} className="text-[20px] text-primary" />}
        {title}
        {selected && <Icon name="check_circle" filled className="ml-auto text-[20px] text-primary" />}
      </span>
      <span className="text-xs font-medium">{sub}</span>
      <span className="text-xs text-on-surface-variant">{text}</span>
      {badge && <span className="mt-1 w-fit rounded-full bg-surface-container-high px-2 py-0.5 text-[11px]">{badge}</span>}
    </button>
  );
}
