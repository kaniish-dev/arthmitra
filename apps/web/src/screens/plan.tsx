"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { INSTRUMENTS, INSTRUMENT_LABEL, formatDate, formatINR, sipFutureValue, todayIso } from "@arthmitra/engine";
import type { AppData, Goal } from "@arthmitra/schema";
import { AllocationDonut, ProjectionLine } from "@/components/charts";
import { GoalOdds } from "@/components/goal-odds";
import { PARTNER, partnerLink } from "@/config/partner";
import { BestFit } from "@/components/best-fit";
import { CategoryResearchPanel } from "@/components/category-research";
import { YearOutlook } from "@/components/year-outlook";
import { SavingsRecommendationCard } from "@/components/savings-recommendation";
import { fundingOf, savingsFor } from "@/lib/plan/savings";
import { CHECKLIST } from "@/lib/plan/best-fit";
import { RISK_COPY, TIMELINE_COPY } from "@/config/plan";
import { deleteGoal } from "@/lib/actions";
import { COMPLIANCE, FEATURES } from "@/lib/constants";
import { goalProgress, planGoals } from "@/lib/insights";
import { assumedReturnPct } from "@/lib/plan/allocation";
import { useAppData } from "@/lib/store";
import { Badge, Button, Card, DemoBadge, Disclaimer, EmptyState, Icon, LinkButton, Note, PageHeader, ProgressBar, SectionTitle } from "@/components/ui";

const ICON: Record<string, string> = { car: "directions_car", wedding: "favorite", trip: "flight", education: "school", home: "home", emergency: "health_and_safety", custom: "flag" };
const goalIcon = (g: Goal) => (g.path === "wealth" ? "trending_up" : (ICON[g.kind] ?? "flag"));
const pathLabel = (g: Goal) => (g.path === "wealth" ? FEATURES.wealth.name : g.path === "custom" ? "From Coach" : FEATURES.bigDay.name);

/** Plan tab: every goal and its plan, plus "Plan something". */
export function PlansScreen() {
  const data = useAppData()!;
  const today = todayIso();
  const goals = planGoals(data);
  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader
        title="Plan"
        subtitle="Your goals and how much goes where each month."
        action={
          <LinkButton href="/explore" icon="add">
            Plan something
          </LinkButton>
        }
      />
      {goals.length === 0 ? (
        <Card>
          <EmptyState icon="flag" title="No plans yet">
            Save for a Big Day, or start the Wealth Generator.
            <div className="mt-4">
              <LinkButton href="/explore" icon="rocket_launch">
                Plan something
              </LinkButton>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((g) => {
            const p = goalProgress(data, g, today);
            return (
              <li key={g.id}>
                <Link href={`/plan/view?id=${g.id}`} className="block rounded-3xl surface-card p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                      <Icon name={goalIcon(g)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{g.name}</span>
                      <span className="block text-xs text-on-surface-variant">
                        {pathLabel(g)} · {formatINR(g.targetPaise)} by {formatDate(g.targetDate)}
                      </span>
                    </span>
                    {g.plan ? <Badge tone={p.onTrack ? "good" : "warn"}>{p.onTrack ? "On track" : "Behind"}</Badge> : <Badge>Needs a plan</Badge>}
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={p.progress} tone={p.onTrack ? "good" : "warn"} label={`${g.name} progress`} />
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {g.plan ? `${formatINR(g.plan.monthlyPaise)}/month · ${formatINR(p.valuePaise)} invested value today` : "Pick a timeline and risk to get a plan."}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link href={FEATURES.crisisCushion.href} className="mt-4 flex items-center gap-3 rounded-3xl border border-dashed border-outline-variant p-4 hover:bg-on-surface/4">
        <Icon name={FEATURES.crisisCushion.icon} className="text-primary" />
        <span className="flex-1 text-sm">
          <strong>{FEATURES.crisisCushion.name}</strong> — keep a few months of expenses safe before high-risk investing.
        </span>
        <Icon name="chevron_right" />
      </Link>
    </div>
  );
}

/** One plan: monthly amount, allocation donut, projection, on-track check, and "Invest" redirects. */
export function PlanViewScreen() {
  const data = useAppData()!;
  const router = useRouter();
  const id = useSearchParams().get("id");
  const goal = data.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Plan" back="/plan" />
        <Card>
          <EmptyState icon="search_off" title="This plan isn't here any more">
            <Link href="/plan" className="font-semibold text-primary">
              Back to plans
            </Link>
          </EmptyState>
        </Card>
      </div>
    );
  }
  const today = todayIso();
  const p = goalProgress(data, goal, today);
  const plan = goal.plan;
  // How to hold the money: from the goal's funding answers, with what's already invested counted as saved.
  const reco = savingsFor(data, { targetPaise: goal.targetPaise, targetDate: goal.targetDate, existingPaise: p.valuePaise, isEmergency: false }, fundingOf(goal), today);

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader
        title={goal.name}
        subtitle={`${pathLabel(goal)} · ${formatINR(goal.targetPaise)} by ${formatDate(goal.targetDate)}${goal.timeline ? ` · ${TIMELINE_COPY[goal.timeline].label} · ${RISK_COPY[goal.risk].label} risk` : ""}`}
        back="/plan"
        action={
          <div className="flex gap-2">
            <LinkButton href={`/explore?edit=${goal.id}`} variant="outlined" icon="edit">
              {plan ? "Edit" : "Make a plan"}
            </LinkButton>
          </div>
        }
      />
      {!plan ? (
        <Card>
          <EmptyState icon="flag" title="No investment plan yet">
            This goal came from a Coach chat. Pick a timeline and risk to see what to invest in each month.
            <div className="mt-4">
              <LinkButton href={`/explore?edit=${goal.id}`} icon="arrow_forward">
                Make a plan
              </LinkButton>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-on-surface-variant">Invest each month</p>
                <p className="text-4xl font-semibold tabular-nums">{formatINR(plan.monthlyPaise)}</p>
                <p className="text-sm text-on-surface-variant">
                  Projected {formatINR(p.projectedPaise)} by {formatDate(goal.targetDate)} at ~{plan.expectedReturnPct}% a year assumed
                </p>
              </div>
              <Badge tone={p.onTrack ? "good" : "warn"} icon={p.onTrack ? "check_circle" : "schedule"}>
                {p.onTrack ? "On track" : `Add ${formatINR(p.topUpPaise)}/mo`}
              </Badge>
            </div>
            <div className="mt-4">
              <ProgressBar value={p.progress} tone={p.onTrack ? "good" : "warn"} label="Progress" />
              <p className="mt-1 text-xs text-on-surface-variant">
                {formatINR(p.valuePaise)} of {formatINR(goal.targetPaise)} today ({Math.round(p.progress * 100)}%) · {p.monthsLeft} months left
              </p>
            </div>
            <Disclaimer className="mt-3" />
          </Card>

          <SavingsRecommendationCard reco={reco} goalName={goal.name} onRevise={() => router.push(`/explore?edit=${goal.id}`)} />

          <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
            <GoalOdds allocation={plan.allocation} monthlyPaise={plan.monthlyPaise} months={Math.max(1, p.monthsLeft)} startPaise={p.valuePaise} targetPaise={goal.targetPaise} />
            <YearOutlook
              allocation={plan.allocation}
              monthlyPaise={plan.monthlyPaise}
              startPaise={p.valuePaise}
              targetPaise={goal.targetPaise}
              monthsLeft={Math.max(1, p.monthsLeft)}
              expectedReturnPct={plan.expectedReturnPct}
            />
          </div>

          <Card>
            <SectionTitle>Where to invest</SectionTitle>
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[200px_1fr]">
              <AllocationDonut rows={plan.allocation.map((l) => ({ label: INSTRUMENT_LABEL[l.type], pct: l.pct }))} />
              <p className="text-sm text-on-surface-variant">
                Your money is split by category. Under each one, open the research to see funds that meet published criteria, with dated figures — research, not a recommendation. Invest on a {PARTNER.label}; ArthMitra doesn&apos;t buy anything for you.
              </p>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {plan.allocation.map((l) => {
                const info = INSTRUMENTS[l.type];
                const paise = Math.round((plan.monthlyPaise * l.pct) / 100);
                return (
                  <li key={l.type} className="rounded-2xl border border-outline-variant/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{INSTRUMENT_LABEL[l.type]}</p>
                        <p className="text-xs text-on-surface-variant">
                          {l.pct}% · {info.risk} risk · ~{assumedReturnPct(l.type)}%/yr assumed · {info.regulator}
                        </p>
                      </div>
                      <p className="text-lg font-semibold tabular-nums">{formatINR(paise)}/mo</p>
                    </div>
                    <p className="mt-2 text-sm text-on-surface-variant">{info.why}</p>
                    <details className="group mt-3 rounded-xl bg-surface-container px-3 py-2 text-sm">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
                        <Icon name="checklist" className="text-[18px] text-primary" />
                        What to look for before you pick one
                        <Icon name="expand_more" className="ml-auto text-[20px] transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-on-surface-variant">
                        {CHECKLIST[l.type].map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </details>
                    <CategoryResearchPanel type={l.type} monthsLeft={Math.max(1, p.monthsLeft)} risk={goal.risk} />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={partnerLink({ category: l.type, amountRupees: paise / 100, goal: goal.name })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm shadow-primary/25 hover:bg-[#0a4fbe]"
                      >
                        <Icon name="open_in_new" className="text-[18px]" />
                        Invest on a third-party app
                      </a>
                      <Disclaimer />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <Note icon="open_in_new">
                Opens {PARTNER.name} in a new tab. {COMPLIANCE.noTrades} <DemoBadge label="Partner link from config" />
              </Note>
              {data.registration?.isMinor && <Note icon="family_restroom">{COMPLIANCE.minors}</Note>}
            </div>
          </Card>

          <BestFit
            goalName={goal.name}
            monthsLeft={Math.max(1, p.monthsLeft)}
            risk={goal.risk}
            isMinor={data.registration?.isMinor ?? false}
            monthlyPaise={plan.monthlyPaise}
            allocation={plan.allocation}
          />

          <Card>
            <SectionTitle>Projection</SectionTitle>
            <ProjectionLine rows={projectionRows(goal, p.valuePaise, p.monthsLeft)} targetRupees={goal.targetPaise / 100} />
            <Disclaimer className="mt-2" />
          </Card>

          {goal.path === "wealth" && <WealthTeaser data={data} />}

          <div className="flex flex-wrap gap-2">
            <LinkButton href="/portfolio" icon="account_balance_wallet" variant="tonal">
              Track in Portfolio
            </LinkButton>
            <Button
              variant="text"
              icon="delete"
              onClick={() => {
                if (window.confirm(`Delete "${goal.name}" and its plan?`)) {
                  deleteGoal(goal.id);
                  router.push("/plan");
                }
              }}
            >
              Delete plan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Year-end points from today to the target date. */
function projectionRows(goal: Goal, startPaise: number, monthsLeft: number) {
  const plan = goal.plan!;
  const rows: Array<{ label: string; value: number; invested: number }> = [];
  const step = monthsLeft > 48 ? 12 : monthsLeft > 18 ? 6 : 3;
  for (let m = 0; m <= monthsLeft; m += step) rows.push(point(m));
  if (rows.at(-1)?.label !== label(monthsLeft)) rows.push(point(monthsLeft));
  return rows;

  function label(m: number) {
    return m === 0 ? "Now" : m % 12 === 0 ? `${m / 12}y` : `${m}m`;
  }
  function point(m: number) {
    return { label: label(m), value: sipFutureValue(plan.monthlyPaise, m, plan.expectedReturnPct, startPaise), invested: startPaise + plan.monthlyPaise * m };
  }
}

function WealthTeaser({ data }: { data: AppData }) {
  const held = data.holdings.reduce((s, h) => s + h.currentValuePaise, 0);
  return (
    <Link href={FEATURES.befikarMode.href} className="flex items-center gap-4 rounded-3xl bg-linear-to-br from-[#00513a] to-[#146c2e] p-5 text-white">
      <Icon name={FEATURES.befikarMode.icon} className="text-3xl" />
      <span className="flex-1">
        <span className="block font-semibold">
          {FEATURES.befikarMode.name} · coming soon
        </span>
        <span className="block text-sm text-white/85">
          Your Freedom Date — when passive income from {held ? formatINR(held) : "your portfolio"} grows to cover every bill.
        </span>
      </span>
      <Icon name="chevron_right" />
    </Link>
  );
}
