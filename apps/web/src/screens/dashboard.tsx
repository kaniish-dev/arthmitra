"use client";

import Link from "next/link";
import { useState } from "react";
import { COACH_ACTIONS, categoryName, formatDate, formatINR, formatMonth, normalizeMerchant, savingsRate, todayIso, totalOutstanding, type StepKind } from "@arthmitra/engine";
import type { AppData, Goal } from "@arthmitra/schema";
import { SCRIPTED_PAYMENTS } from "@arthmitra/seed";
import { simulatePayment } from "@/lib/actions";
import { overview, splitOwedPaise, stepsFor, type Overview } from "@/lib/derive";
import { amountText, merchantLabel } from "@/lib/format";
import { useAppData } from "@/lib/store";
import { useToast } from "@/components/providers";
import { TransactionList } from "@/components/transactions";
import { ActionTile, Avatar, Card, Icon, LinkButton, ListRow, ProgressBar, SectionTitle, cx } from "@/components/ui";

const GOAL_ICON: Record<Goal["kind"], string> = {
  car: "directions_car",
  wedding: "favorite",
  trip: "flight",
  emergency: "health_and_safety",
  home: "home",
  education: "school",
  custom: "flag",
};

const SHORTCUTS = [
  { href: "/add", icon: "payments", label: "Add cash" },
  { href: "/inbox", icon: "inbox", label: "Inbox" },
  { href: "/goal", icon: "flag", label: "Goal plan" },
  { href: "/coach", icon: "forum", label: "Ask coach" },
  { href: "/insights", icon: "insights", label: "Insights" },
  { href: "/bills", icon: "event_repeat", label: "Bills" },
  { href: "/lent", icon: "handshake", label: "Lent" },
  { href: "/emergency", icon: "emergency_home", label: "Emergency" },
];

/**
 * Home, kept short like a payment app: money card, round shortcuts, what needs a tap today,
 * the goal, money owed to you and recent activity. Everything else has its own page.
 */
export function DashboardScreen() {
  const data = useAppData()!;
  const o = overview(data, todayIso());
  const hasBank = data.accounts.some((a) => a.status === "active");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {data.settings.emergencyMode && (
        <Link href="/emergency" className="flex items-center gap-3 rounded-3xl bg-error-container px-4 py-3 text-on-error-container hover:bg-error-container/80">
          <Icon name="emergency_home" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Emergency mode is on.</span> Essentials only — open your plan.
          </span>
          <Icon name="chevron_right" />
        </Link>
      )}
      <Summary data={data} o={o} hasBank={hasBank} />

      {!hasBank && (
        <Card className="bg-primary-container/40">
          <SectionTitle>Link your bank to see your payments</SectionTitle>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/link-bank" icon="link">
              Link with Account Aggregator
            </LinkButton>
            <LinkButton href="/import" variant="text" icon="upload_file">
              Upload a CSV
            </LinkButton>
          </div>
        </Card>
      )}

      <nav aria-label="Shortcuts">
        <ul className="grid grid-cols-4 gap-y-2 sm:grid-cols-8">
          {SHORTCUTS.map((a) => (
            <li key={a.href}>
              <ActionTile {...a} count={a.href === "/inbox" ? o.uncategorisedCount : undefined} />
            </li>
          ))}
        </ul>
      </nav>

      {hasBank && <DemoFeed data={data} />}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ForYou data={data} o={o} />
          <GoalCard o={o} paused={data.settings.emergencyMode} />
        </div>
        <div className="flex flex-col gap-6">
          <OwedCard data={data} />
          <Card>
            <SectionTitle href={data.transactions.length ? "/history" : undefined}>Recent activity</SectionTitle>
            <TransactionList data={data} txns={data.transactions.slice(0, 5)} empty="Payments appear here as soon as your bank sends them." />
          </Card>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-on-surface-variant">
        <Icon name="lock" className="text-[16px]" />
        ArthMitra never moves money and never asks for your UPI PIN, OTP or bank password.
      </p>
    </div>
  );
}

function Summary({ data, o, hasBank }: { data: AppData; o: Overview; hasBank: boolean }) {
  const [showBalance, setShowBalance] = useState(false);
  const rate = savingsRate(o.thisMonth.incomePaise, o.thisMonth.spendingPaise);
  const spentShare = o.thisMonth.incomePaise > 0 ? Math.min(1, o.thisMonth.spendingPaise / o.thisMonth.incomePaise) : 0;
  const firstName = data.profile?.name.replace(" (demo)", "").split(" ")[0] ?? "";

  return (
    <section aria-label={`${formatMonth(o.today)} summary`} className="rounded-3xl bg-linear-to-br from-primary to-[#0842a0] p-5 text-on-primary sm:p-6">
      <p className="text-sm text-on-primary/85">
        Namaste{firstName ? `, ${firstName}` : ""} · {formatMonth(o.today)}
      </p>
      <p className="mt-4 text-sm text-on-primary/85">Spent this month</p>
      <p className="text-4xl font-semibold tabular-nums">{formatINR(o.thisMonth.spendingPaise)}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25" aria-hidden>
        <div className="h-full rounded-full bg-white" style={{ width: `${spentShare * 100}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-on-primary/80">Income</dt>
          <dd className="font-semibold tabular-nums">{formatINR(o.thisMonth.incomePaise)}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-primary/80">Savings rate</dt>
          <dd className="font-semibold tabular-nums">{rate === null ? "—" : `${Math.round(rate * 100)}%`}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-primary/80">Invested</dt>
          <dd className="font-semibold tabular-nums">{formatINR(o.thisMonth.investedPaise)}</dd>
        </div>
      </dl>
      {hasBank && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white/12 px-3 py-2.5 sm:px-4">
          <Link href="/accounts" className="flex min-w-0 items-center gap-1 text-sm hover:underline">
            <span className="truncate">Bank balance</span>
            <Icon name="chevron_right" className="text-[18px]" />
          </Link>
          <button
            type="button"
            aria-pressed={showBalance}
            onClick={() => setShowBalance(!showBalance)}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1 text-sm font-semibold whitespace-nowrap tabular-nums hover:bg-white/15 sm:px-2 sm:text-base"
          >
            {showBalance ? formatINR(o.balancePaise) : "Check balance"}
            <Icon name={showBalance ? "visibility_off" : "visibility"} className="text-[18px]" />
          </button>
        </div>
      )}
    </section>
  );
}

/** Demo only: scripted payments the simulated AA delivers on its next fetch. */
function DemoFeed({ data }: { data: AppData }) {
  const toast = useToast();
  return (
    <section aria-label="Demo payments" className="flex items-center gap-3 rounded-3xl border border-dashed border-outline-variant px-3 py-2.5 sm:px-4">
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-on-surface-variant">
        <Icon name="science" className="text-[18px]" />
        <span className="hidden sm:inline">Demo payment</span>
      </span>
      <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
        {SCRIPTED_PAYMENTS.map((p) => {
          const name = merchantLabel(normalizeMerchant(p.merchantRaw));
          return (
            <li key={p.id} className="shrink-0">
              <button
                type="button"
                aria-label={`Simulate ${p.label}`}
                onClick={() => {
                  const t = simulatePayment(p.id);
                  if (!t) {
                    toast({ message: "Your AA consent is paused or revoked, so nothing new is fetched. Resume it in Bank accounts." });
                  } else {
                    const label = merchantLabel(t.merchantKey);
                    toast({
                      message:
                        t.status === "categorised"
                          ? `${label} sorted into ${categoryName(data.categories, t.category)} automatically.`
                          : `${label} went to your inbox — the bell shows it.`,
                    });
                  }
                }}
                className="flex items-center gap-2 rounded-full bg-surface-container-lowest py-1 pr-3 pl-1 text-sm ring-1 ring-outline-variant/60 hover:bg-on-surface/5"
              >
                <Avatar name={name} size="sm" />
                <span className="font-medium whitespace-nowrap">{name}</span>
                <span className={cx("text-xs tabular-nums", p.amountPaise > 0 ? "text-success" : "text-on-surface-variant")}>{amountText(p.amountPaise)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STEP_ICON: Record<StepKind, string> = {
  emergency: "emergency_home",
  money_back: "savings",
  bill: "event_repeat",
  lent: "handshake",
  sort: "inbox",
  budget: "speed",
  cushion: "shield",
  goal: "flag",
  save: "savings",
};

/** The coach's next steps, most urgent first — the same list the Coach page opens with. */
function ForYou({ data, o }: { data: AppData; o: Overview }) {
  const steps = stepsFor(data, o);
  return (
    <Card className="p-3 sm:p-4">
      <h2 className="flex items-center justify-between px-2 pt-1 pb-1 text-base font-semibold">
        For you today
        <Link href="/coach" className="text-sm font-semibold text-primary hover:underline">
          Ask coach
        </Link>
      </h2>
      {steps.length === 0 ? (
        <p className="flex items-center gap-2 px-2 py-2 text-sm text-on-surface-variant">
          <Icon name="task_alt" className="text-success" />
          All caught up — nothing needs you right now.
        </p>
      ) : (
        steps.map((s) => <ListRow key={s.kind} href={COACH_ACTIONS[s.action].href} icon={STEP_ICON[s.kind]} label={s.title.en} sub={s.detail.en} />)
      )}
    </Card>
  );
}

/** Money lent and split shares still to come back. */
function OwedCard({ data }: { data: AppData }) {
  const lent = totalOutstanding(data.loans);
  const split = splitOwedPaise(data);
  if (lent + split === 0) return null;
  const people = new Set([...data.loans.filter((l) => !l.forgiven && l.returns.reduce((s, r) => s + r.amountPaise, 0) < l.amountPaise).map((l) => l.person)]).size;
  return (
    <Link href="/lent" className="flex items-center gap-4 rounded-3xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant/40 hover:bg-on-surface/5 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-container text-on-success-container">
        <Icon name="handshake" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-on-surface-variant">Owed to you</span>
        <span className="block text-xl font-semibold text-success tabular-nums">{formatINR(lent + split)}</span>
        <span className="block text-xs text-on-surface-variant">
          {people > 0 ? `${people} ${people === 1 ? "person" : "people"} you lent to` : "From split bills"}
          {lent > 0 && split > 0 ? " · plus split bills" : ""}
        </span>
      </span>
      <Icon name="chevron_right" className="text-on-surface-variant" />
    </Link>
  );
}

function GoalCard({ o, paused }: { o: Overview; paused: boolean }) {
  if (!o.goal || !o.status) {
    return (
      <Card>
        <SectionTitle>Your goal</SectionTitle>
        <p className="mb-3 text-sm text-on-surface-variant">Pick one thing to save for and ArthMitra works out the monthly amount.</p>
        <LinkButton href="/onboarding" icon="add">
          Add a goal
        </LinkButton>
      </Card>
    );
  }
  const s = o.status;
  return (
    <Card>
      <SectionTitle href="/goal" linkLabel="Open plan">
        Your goal
      </SectionTitle>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
          <Icon name={GOAL_ICON[o.goal.kind]} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{o.goal.name}</p>
          <p className="text-xs text-on-surface-variant">
            {formatINR(o.savedPaise)} of {formatINR(o.goal.targetPaise)} · by {formatDate(o.goal.targetDate)}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={s.progress} tone={s.onTrack || s.achieved ? "good" : "warn"} label={`${o.goal.name} progress`} />
      </div>
      <p className="mt-3 text-sm text-on-surface-variant">
        {paused ? (
          <span className="font-semibold">Saving paused for the emergency. Pick it up again when things settle.</span>
        ) : s.achieved ? (
          <span className="font-semibold text-success">Reached — well done.</span>
        ) : s.onTrack ? (
          <>
            <span className="font-semibold text-success">On track.</span> Needs {formatINR(s.requiredPaise)} a month; you can save {formatINR(s.contributionPaise)}.
          </>
        ) : (
          <>
            <span className="font-semibold text-error">Behind by {formatINR(s.gapPaise)} a month.</span> Needs {formatINR(s.requiredPaise)}; you can save{" "}
            {formatINR(s.contributionPaise)}.
          </>
        )}
      </p>
    </Card>
  );
}
