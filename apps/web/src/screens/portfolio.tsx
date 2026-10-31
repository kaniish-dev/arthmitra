"use client";

import Link from "next/link";
import { useState } from "react";
import { INSTRUMENT_LABEL, formatDate, formatINR, todayIso } from "@arthmitra/engine";
import type { AppData, InvestmentAccount } from "@arthmitra/schema";
import { INVESTMENT_APP_KINDS } from "@/config/partner";
import { addInvestmentAccount, disconnectInvestmentAccount, storeHoldings } from "@/lib/actions";
import { agoLabel, useNow } from "@/lib/aa-sync";
import { COMPLIANCE, FEATURES } from "@/lib/constants";
import { goalProgress, planGoals, wealthSummary } from "@/lib/insights";
import { portfolioApi } from "@/lib/services/portfolio";
import { getData, useAppData } from "@/lib/store";
import { useToast } from "@/components/providers";
import { AutofillButton, Badge, Button, Card, DemoBadge, Disclaimer, EmptyState, Icon, LinkButton, Modal, Note, PageHeader, ProgressBar, SectionTitle, Skeleton, cx } from "@/components/ui";

/**
 * Portfolio tracking: connect the user's (or, for a minor, the guardian's) account on a
 * third-party investment app; holdings sync through the PortfolioTrackingAPI (mocked) and are
 * tracked against each goal and the wealth target.
 */
export function PortfolioScreen() {
  const data = useAppData()!;
  const toast = useToast();
  const now = useNow();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const today = todayIso();
  const accounts = data.investmentAccounts.filter((a) => a.status === "connected");
  const w = wealthSummary(data);

  const sync = async (account: InvestmentAccount) => {
    setSyncing(account.id);
    try {
      const holdings = await portfolioApi.fetchHoldings(account, getData().goals);
      storeHoldings(account.id, holdings);
      toast({ message: holdings.length ? `Synced ${holdings.length} holdings.` : "Synced. No holdings yet — invest from a plan, then sync again." });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        title="Portfolio"
        subtitle="Where you stand today vs your goals. Holdings come from your investment account — ArthMitra never buys or sells."
        action={
          <Button icon="add_link" variant="outlined" onClick={() => setConnecting(true)}>
            Connect account
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <Card>
          <EmptyState icon="account_balance_wallet" title="Connect your investment account">
            After you invest on a third-party app, connect that account here and your holdings sync automatically.
            <div className="mt-4">
              <Button icon="add_link" onClick={() => setConnecting(true)}>
                Connect your investment account
              </Button>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <section aria-label="Where you stand today" className="hero relative overflow-hidden rounded-3xl bg-linear-to-br from-primary to-[#0842a0] p-5 text-on-primary sm:p-6">
            <p className="text-sm text-on-primary/85">Where you stand today</p>
            <p className="text-4xl font-semibold tabular-nums">{formatINR(w.valuePaise)}</p>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-on-primary/80">Invested</dt>
                <dd className="font-semibold tabular-nums">{formatINR(w.investedPaise)}</dd>
              </div>
              <div>
                <dt className="text-xs text-on-primary/80">Returns</dt>
                <dd className="font-semibold tabular-nums">
                  {formatINR(w.gainPaise, { signed: true })}
                  {w.investedPaise > 0 && ` (${((w.gainPaise / w.investedPaise) * 100).toFixed(1)}%)`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-on-primary/80">Passive income</dt>
                <dd className="font-semibold tabular-nums">{formatINR(w.passiveIncomePaise)}/mo</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-on-primary/75">Educational guidance, not investment advice. Returns are not guaranteed. Passive income is an estimate at 4% a year.</p>
          </section>

          {accounts.map((a) => (
            <Card key={a.id} className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-container text-on-secondary-container">
                <Icon name={INVESTMENT_APP_KINDS.find((k) => k.label === a.provider)?.icon ?? "account_balance_wallet"} />
              </span>
              {/* basis-48: on phones the buttons wrap to their own line instead of squeezing the text. */}
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-semibold">
                  {a.provider} {a.owner === "guardian" && <Badge icon="family_restroom">Guardian&apos;s account</Badge>}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Last synced {a.lastSyncedAt ? agoLabel(a.lastSyncedAt, now) : "never"} · via portfolio-tracking API <DemoBadge label="Mock API" />
                </p>
              </div>
              <Button icon="sync" onClick={() => sync(a)} disabled={syncing !== null}>
                {syncing === a.id ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                variant="text"
                className="px-3"
                onClick={() => {
                  if (window.confirm("Disconnect this account? Its holdings are removed from ArthMitra.")) disconnectInvestmentAccount(a.id);
                }}
              >
                Disconnect
              </Button>
            </Card>
          ))}

          {syncing && (
            <div className="flex flex-col gap-2" aria-busy>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          )}

          <GoalsTracking data={data} today={today} />
          <WealthView data={data} />
          <Holdings data={data} />
        </div>
      )}

      {connecting && <ConnectModal data={data} onClose={() => setConnecting(false)} onConnected={(a) => void sync(a)} />}
    </div>
  );
}

function GoalsTracking({ data, today }: { data: AppData; today: string }) {
  const goals = planGoals(data).filter((g) => g.plan && g.status === "active" && g.path !== "wealth");
  if (goals.length === 0) return null;
  return (
    <Card>
      <SectionTitle>Per goal</SectionTitle>
      <ul className="flex flex-col gap-5">
        {goals.map((g) => {
          const p = goalProgress(data, g, today);
          return (
            <li key={g.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/plan/view?id=${g.id}`} className="font-semibold hover:underline">
                  {g.name}
                </Link>
                <Badge tone={p.onTrack ? "good" : "warn"}>{p.onTrack ? "On track" : "Behind"}</Badge>
              </div>
              <div className="mt-2">
                <ProgressBar value={p.progress} tone={p.onTrack ? "good" : "warn"} label={`${g.name}: ${Math.round(p.progress * 100)}% reached`} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Mini label="Invested" value={formatINR(p.investedPaise)} />
                <Mini label="Current value" value={formatINR(p.valuePaise)} />
                <Mini label="Goal reached" value={`${Math.round(p.progress * 100)}% of ${formatINR(g.targetPaise)}`} />
                <Mini label="Monthly top-up needed" value={p.topUpPaise ? `+${formatINR(p.topUpPaise)}` : "None"} tone={p.topUpPaise ? "bad" : "good"} />
              </dl>
              <p className="mt-1 text-xs text-on-surface-variant">
                Target {formatDate(g.targetDate)} · plan {formatINR(g.plan!.monthlyPaise)}/mo · needed now {formatINR(p.neededPaise)}/mo
              </p>
            </li>
          );
        })}
      </ul>
      <Disclaimer className="mt-4" />
    </Card>
  );
}

function WealthView({ data }: { data: AppData }) {
  const w = wealthSummary(data);
  if (!w.wealth) return null;
  const target = w.wealth.targetPaise;
  return (
    <Card className="bg-tertiary-container/40">
      <SectionTitle href={`/plan/view?id=${w.wealth.id}`} linkLabel="Plan">
        {FEATURES.wealth.name}
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Mini label="Total value" value={formatINR(w.valuePaise)} big />
        <Mini label="Est. monthly passive income" value={formatINR(w.passiveIncomePaise)} big />
        <Mini label="Monthly expenses to cover" value={formatINR(w.wealth.monthlyExpensesPaise ?? 0)} big />
      </div>
      <div className="mt-4">
        <ProgressBar value={w.coverage ?? 0} label="Share of expenses covered by passive income" />
        <p className="mt-1 text-sm">
          Passive income covers <strong>{Math.round((w.coverage ?? 0) * 100)}%</strong> of your monthly expenses today · target corpus {formatINR(target)}
        </p>
      </div>
      <Link href={FEATURES.befikarMode.href} className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <Icon name={FEATURES.befikarMode.icon} className="text-[18px]" /> {FEATURES.befikarMode.name}: Freedom Date (coming soon)
      </Link>
      <Disclaimer className="mt-3" />
    </Card>
  );
}

function Holdings({ data }: { data: AppData }) {
  if (data.holdings.length === 0)
    return (
      <Card>
        <EmptyState icon="hourglass_empty" title="No holdings synced yet">
          Invest from a plan on a third-party app, then press Sync now.
          <div className="mt-3">
            <LinkButton href="/plan" variant="outlined">
              Open my plans
            </LinkButton>
          </div>
        </EmptyState>
      </Card>
    );
  const goalName = (id: string | null) => data.goals.find((g) => g.id === id)?.name ?? "Not linked to a goal";
  return (
    <Card>
      <SectionTitle>Holdings</SectionTitle>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-on-surface-variant">
              <th className="px-2 py-2 font-medium">Holding</th>
              <th className="px-2 py-2 font-medium">Goal</th>
              <th className="px-2 py-2 text-right font-medium">Invested</th>
              <th className="px-2 py-2 text-right font-medium">Value</th>
              <th className="px-2 py-2 text-right font-medium">Return</th>
            </tr>
          </thead>
          <tbody>
            {data.holdings.map((h) => {
              const gain = h.currentValuePaise - h.amountInvestedPaise;
              return (
                <tr key={h.id} className="border-t border-outline-variant/50">
                  <td className="px-2 py-2">
                    {INSTRUMENT_LABEL[h.instrumentType]}
                    <span className="block text-xs text-on-surface-variant">{h.units} units</span>
                  </td>
                  <td className="px-2 py-2 text-on-surface-variant">{goalName(h.goalId)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatINR(h.amountInvestedPaise)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatINR(h.currentValuePaise)}</td>
                  <td className={cx("px-2 py-2 text-right tabular-nums", gain >= 0 ? "text-success" : "text-error")}>{formatINR(gain, { signed: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Disclaimer className="mt-3" />
    </Card>
  );
}

function Mini({ label, value, tone, big }: { label: string; value: string; tone?: "good" | "bad"; big?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className={cx("font-semibold tabular-nums", big && "text-xl", tone === "good" && "text-success", tone === "bad" && "text-error")}>{value}</dd>
    </div>
  );
}

/** Pick the app, choose whose account (guardian for minors), approve a mock consent. */
function ConnectModal({ data, onClose, onConnected }: { data: AppData; onClose: () => void; onConnected: (a: InvestmentAccount) => void }) {
  const minor = data.registration?.isMinor ?? false;
  const [kind, setKind] = useState<string | null>(null);
  const [owner, setOwner] = useState<InvestmentAccount["owner"]>(minor ? "guardian" : "self");
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    if (!kind) return;
    setBusy(true);
    const account = await portfolioApi.connect({ provider: kind, owner });
    addInvestmentAccount(account);
    setBusy(false);
    onClose();
    onConnected(account);
  };
  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Connect your investment account">
      <div className="flex flex-col gap-4 text-sm">
        <fieldset>
          <legend className="mb-2 font-medium">Where did you invest?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {INVESTMENT_APP_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.label}
                onClick={() => setKind(k.label)}
                className={cx("flex items-center gap-2 rounded-2xl border p-3 text-left font-medium", kind === k.label ? "border-primary bg-primary-container/60" : "border-outline-variant hover:bg-on-surface/4")}
              >
                <Icon name={k.icon} className="text-primary" />
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>
        <AutofillButton
          onClick={() => {
            setKind(minor ? INVESTMENT_APP_KINDS[2].label : INVESTMENT_APP_KINDS[0].label);
            setOwner(minor ? "guardian" : "self");
          }}
        />
        {minor && (
          <fieldset>
            <legend className="mb-2 font-medium">Whose account?</legend>
            <div className="flex gap-2">
              {(["guardian", "self"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={owner === o}
                  onClick={() => setOwner(o)}
                  className={cx("flex-1 rounded-full border px-4 py-2 font-medium", owner === o ? "border-primary bg-primary-container text-on-primary-container" : "border-outline")}
                >
                  {o === "guardian" ? `Guardian (${data.registration?.guardian?.name ?? "parent"})` : "Mine (minor account)"}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="rounded-2xl bg-surface-container p-3">
          <p className="font-semibold">Consent</p>
          <p className="text-on-surface-variant">Read-only access to holdings and their values, refreshed when you press Sync now. ArthMitra can&apos;t buy, sell or move money. Revoke any time.</p>
        </div>
        {minor && <Note icon="family_restroom">{COMPLIANCE.minors}</Note>}
        <p className="flex items-center gap-2">
          <DemoBadge label="Mock portfolio-tracking API" />
        </p>
        <div className="flex gap-2">
          <Button variant="outlined" className="h-12 flex-1" onClick={onClose} disabled={busy}>
            Deny
          </Button>
          <Button className="h-12 flex-1" onClick={approve} disabled={!kind || busy}>
            {busy ? "Connecting…" : "Approve"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
