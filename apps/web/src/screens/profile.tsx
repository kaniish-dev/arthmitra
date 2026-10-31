"use client";

import Link from "next/link";
import { formatMonth, outstandingPaise } from "@arthmitra/engine";
import { useAppData } from "@/lib/store";
import { Avatar, Badge, Icon, ListRow, ListSection, PageHeader } from "@/components/ui";

/** Profile hub, reached from the avatar: who you are, then everything grouped by what it is for. */
export function ProfileScreen() {
  const data = useAppData()!;
  const p = data.profile!;
  const name = p.name.replace(" (demo)", "");
  const isDemo = p.name.endsWith("(demo)");
  const linked = data.accounts.filter((a) => a.status === "active").length;
  const goal = data.goals.find((g) => g.status === "active") ?? data.goals[0];
  const owed = data.splits.flatMap((s) => s.people).filter((x) => !x.settled).length + data.loans.filter((l) => outstandingPaise(l) > 0).length;

  const stats = [
    { icon: "stars", value: p.points, label: "Points" },
    { icon: "local_fire_department", value: p.streak, label: "Day streak" },
    { icon: "military_tech", value: p.badges.length, label: "Badges" },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader title="Profile" />
      <div className="flex flex-col gap-6">
        <section className="flex flex-col items-center gap-2 rounded-3xl bg-surface-container-lowest px-5 py-8 text-center ring-1 ring-outline-variant/40">
          <Avatar name={name} size="xl" />
          <h2 className="mt-2 text-2xl font-semibold">{name}</h2>
          <p className="text-sm text-on-surface-variant">
            {isDemo ? "Demo account" : "Your account"} · with ArthMitra since {formatMonth(p.createdAt.slice(0, 7))}
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Badge tone="good" icon="verified">
              18+ confirmed
            </Badge>
            <Badge tone="info" icon="lock">
              Stored only in this browser
            </Badge>
          </div>
          <ul className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2">
            {stats.map((s) => (
              <li key={s.label}>
                <Link href="/rewards" className="flex flex-col items-center gap-1 rounded-2xl bg-surface-container px-2 py-3 hover:bg-surface-container-high">
                  <Icon name={s.icon} filled className="text-on-warning-container" />
                  <span className="text-lg font-semibold tabular-nums">{s.value}</span>
                  <span className="text-xs text-on-surface-variant">{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ListSection title="Your money">
          <ListRow href="/accounts" icon="account_balance" label="Bank accounts" sub={`${linked} linked · consent and balances`} />
          <ListRow href="/goal" icon="flag" label="Your goal" sub={goal ? goal.name : "Set a goal"} />
          <ListRow href="/portfolio" icon="account_balance_wallet" label="Portfolio" sub="Investments and when they are free" />
          <ListRow href="/lent" icon="handshake" label="Lent and split" sub={owed ? `${owed} ${owed === 1 ? "person owes" : "people owe"} you` : "Nobody owes you right now"} />
        </ListSection>

        <ListSection title="Settings">
          <ListRow href="/onboarding" icon="edit" label="Edit my numbers" sub="Income, fixed costs, estimates and goal" />
          <ListRow href="/categories" icon="category" label="Categories and rules" sub="Limits, merges and merchant rules" />
          <ListRow href="/settings" icon="tune" label="Settings" sub="Consent, AI, alerts and your data" />
        </ListSection>

        <ListSection title="Help">
          <ListRow href="/help" icon="help" label="Help and safety" sub="How ArthMitra works and common questions" />
        </ListSection>

        <p className="pb-2 text-center text-xs text-on-surface-variant">ArthMitra prototype · Educational guidance, not financial advice.</p>
      </div>
    </div>
  );
}
