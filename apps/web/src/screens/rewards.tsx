"use client";

import Link from "next/link";
import { formatDate, formatINR, todayIso, type FlowCheckId } from "@arthmitra/engine";
import { flowFor, overview } from "@/lib/derive";
import { useAppData } from "@/lib/store";
import { Badge, Card, CardTitle, Icon, PageHeader, cx } from "@/components/ui";

/** Every badge the app can award (see withSortReward and confirmInvestmentWith in actions.ts). */
const BADGES = [
  { name: "Inbox zero", icon: "task_alt", how: "Sort every payment waiting in your inbox." },
  { name: "7-day streak", icon: "local_fire_department", how: "Sort at least one payment a day, 7 days in a row." },
  { name: "First ₹10,000 saved", icon: "savings", how: "Reach ₹10,000 of confirmed investments for your goal." },
];

export function RewardsScreen() {
  const data = useAppData()!;
  const p = data.profile!;
  const waiting = data.transactions.filter((t) => t.status === "uncategorised").length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Rewards" subtitle="For keeping your money sorted." back="/profile" />
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl bg-linear-to-br from-[#9a4d00] to-[#8c1d18] p-6 text-white">
          <p className="text-sm text-white/85">Your points</p>
          <p className="text-5xl font-semibold tabular-nums">{p.points}</p>
          <p className="mt-3 flex items-center gap-1.5 text-sm">
            <Icon name="local_fire_department" filled />
            {p.streak > 0 ? `${p.streak}-day sorting streak` : "Sort a payment today to start a streak"}
          </p>
          <Link
            href={waiting ? "/sort" : "/inbox"}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#8c1d18] hover:bg-white/90"
          >
            <Icon name="sports_esports" className="text-[20px]" />
            {waiting ? `Sort ${waiting} for +${waiting * 10} points` : "Inbox is clear"}
          </Link>
        </section>

        <FlowCard />

        <Card>
          <CardTitle icon="military_tech">Badges</CardTitle>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {BADGES.map((b) => {
              const earned = p.badges.includes(b.name);
              return (
                <li key={b.name} className={cx("flex flex-col items-center gap-2 rounded-2xl p-4 text-center", earned ? "bg-warning-container/60" : "bg-surface-container")}>
                  <span
                    className={cx(
                      "flex h-14 w-14 items-center justify-center rounded-full",
                      earned ? "bg-warning-container text-on-warning-container" : "bg-surface-container-highest text-on-surface-variant",
                    )}
                  >
                    <Icon name={earned ? b.icon : "lock"} filled={earned} className="text-[28px]" />
                  </span>
                  <p className="text-sm font-semibold">{b.name}</p>
                  {earned ? (
                    <Badge tone="good" icon="check">
                      Earned
                    </Badge>
                  ) : (
                    <p className="text-xs text-on-surface-variant">{b.how}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle icon="emoji_events">How to earn</CardTitle>
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-3">
              <Icon name="add_task" className="text-primary" />
              +10 points for every payment you sort, in the inbox, the sort game or a payment&apos;s details.
            </li>
            <li className="flex items-start gap-3">
              <Icon name="local_fire_department" className="text-primary" />
              Your streak grows each day you sort at least one payment.
            </li>
            <li className="flex items-start gap-3">
              <Icon name="savings" className="text-primary" />
              Badges mark milestones: a clear inbox, a week-long streak, your first ₹10,000 saved.
            </li>
          </ul>
        </Card>

        <p className="flex items-start gap-1.5 text-xs text-on-surface-variant">
          <Icon name="info" className="text-[16px]" />
          Points and badges are just for fun. They have no money value and can&apos;t be exchanged for anything.
        </p>
      </div>
    </div>
  );
}

const FLOW_TEXT: Record<FlowCheckId, { title: string; how: string; href: string }> = {
  sorted: { title: "Every payment sorted", how: "Nothing waiting in the inbox", href: "/inbox" },
  budgets: { title: "Every budget kept", how: "No category over its limit", href: "/insights" },
  saved: { title: "Saved for your goal", how: "An investment confirmed this month", href: "/goal" },
  lent: { title: "Lent money on time", how: "Nothing past the date you agreed", href: "/lent" },
};

/** This month's four habits; perfect months in a row raise the level. Points have no money value. */
function FlowCard() {
  const data = useAppData()!;
  const today = todayIso();
  const flow = flowFor(data, today);
  const o = overview(data, today);
  const s = o.status;
  return (
    <Card>
      <CardTitle icon="trending_up" action={<Badge tone="info">{flow.level}</Badge>}>
        Monthly flow
      </CardTitle>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tabular-nums">
            {flow.score}
            <span className="text-base font-normal text-on-surface-variant"> / 100</span>
          </p>
          <p className="text-xs text-on-surface-variant">this month · 25 points a habit</p>
        </div>
        <p className="text-right text-xs text-on-surface-variant">
          {flow.streak} perfect {flow.streak === 1 ? "month" : "months"} in a row
          {flow.nextLevel ? ` · ${flow.monthsToNext} more for ${flow.nextLevel}` : ""}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {flow.checks.map((c) => (
          <li key={c.id}>
            <Link href={FLOW_TEXT[c.id].href} className="flex items-center gap-3 rounded-2xl bg-surface-container px-3 py-2.5 hover:bg-surface-container-high">
              <Icon name={c.met ? "check_circle" : "radio_button_unchecked"} filled={c.met} className={c.met ? "text-success" : "text-on-surface-variant"} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{FLOW_TEXT[c.id].title}</span>
                <span className="block text-xs text-on-surface-variant">{FLOW_TEXT[c.id].how}</span>
              </span>
              <span className={cx("text-sm font-semibold tabular-nums", c.met ? "text-success" : "text-on-surface-variant")}>+25</span>
            </Link>
          </li>
        ))}
      </ul>
      {o.goal && s && !s.onTrack && s.projectedDate && (
        <p className="mt-4 rounded-2xl bg-primary-container/50 p-3 text-sm text-on-primary-container">
          The real reward: closing your {formatINR(s.gapPaise)} gap gets {o.goal.name} by {formatDate(o.goal.targetDate)} instead of {formatDate(s.projectedDate)}.
        </p>
      )}
      <p className="mt-3 text-xs text-on-surface-variant">Levels: Steady after 1 perfect month, Strong after 3, Champion after 6. Points and levels have no money value.</p>
    </Card>
  );
}
