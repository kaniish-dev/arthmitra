"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BAND_LABEL,
  INSTRUMENTS,
  addMonths,
  categoryName,
  formatDate,
  formatINR,
  formatMonth,
  horizonBand,
  instrumentsForBand,
  monthsBetween,
  projectionRange,
  spendCategories,
  todayIso,
} from "@arthmitra/engine";
import { DISCLAIMER, type Goal, type InstrumentType, type Investment } from "@arthmitra/schema";
import {
  addGoal,
  cancelInvestment,
  markInvestmentPaid,
  planInvestment,
  savePlan,
  simulateInvestmentDebit,
  updateGoal,
} from "@/lib/actions";
import { overview } from "@/lib/derive";
import { useAppData } from "@/lib/store";
import { ActualVsEstimate } from "@/components/charts";
import {
  AmountInput,
  Badge,
  Button,
  Card,
  CardTitle,
  Disclaimer,
  Icon,
  LinkButton,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Stat,
  Tabs,
  TextInput,
  cx,
} from "@/components/ui";

export function GoalScreen() {
  const data = useAppData()!;
  const today = todayIso();
  const o = overview(data, today);
  if (!o.goal || !o.status) {
    return (
      <>
        <PageHeader title="Your goal" />
        <Card>
          <p className="mb-4 text-sm text-on-surface-variant">You have no goal yet.</p>
          <LinkButton href="/onboarding" icon="add">
            Set a goal
          </LinkButton>
        </Card>
      </>
    );
  }
  if (o.goal.status === "achieved") return <Achieved goal={o.goal} />;
  return <GoalPlan />;
}

function GoalPlan() {
  const data = useAppData()!;
  const today = todayIso();
  const o = overview(data, today);
  const goal = o.goal!;
  const s = o.status!;
  const [investOpen, setInvestOpen] = useState(false);
  const [tab, setTab] = useState<"plan" | "invest" | "spending">("plan");
  const pending = data.investments.filter((i) => i.goalId === goal.id && i.status !== "confirmed").length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={goal.name}
        subtitle={`${formatINR(goal.targetPaise)} by ${formatDate(goal.targetDate)} · ${s.monthsLeft} months left`}
        action={
          s.onTrack ? (
            <Badge tone="good" icon="check_circle">
              On track
            </Badge>
          ) : (
            <Badge tone="warn" icon="warning">
              Behind by {formatINR(s.gapPaise)} a month
            </Badge>
          )
        }
      />
      <Tabs
        label="Goal plan"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "plan", label: "Plan" },
          { value: "invest", label: "Invest", count: pending },
          { value: "spending", label: "Spending" },
        ]}
      />

      {tab === "plan" && (
        <div id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Card>
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <strong className="text-2xl tabular-nums">{formatINR(o.savedPaise)}</strong> saved
                </span>
                <span className="text-on-surface-variant">{Math.round(s.progress * 100)}%</span>
              </div>
              <ProgressBar value={s.progress} label="Goal progress" tone={s.onTrack ? "good" : "warn"} />
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Needed / month" value={formatINR(s.requiredPaise)} />
                <Stat label="You can save" value={formatINR(s.contributionPaise)} tone={s.onTrack ? "good" : "bad"} />
                <Stat label="At this pace" value={s.projectedDate ? formatMonth(s.projectedDate) : "—"} />
              </div>
            </Card>
            {!s.onTrack && o.cuts.length > 0 && <FindMoney gapPaise={s.gapPaise} />}
          </div>
          <TimelineEditor goal={goal} />
        </div>
      )}

      {tab === "invest" && (
        <div id="panel-invest" role="tabpanel" aria-labelledby="tab-invest" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Instruments
            goal={goal}
            monthsLeft={s.monthsLeft}
            contributionPaise={Math.min(s.requiredPaise, s.contributionPaise) || s.requiredPaise}
            savedPaise={o.savedPaise}
            onInvest={() => setInvestOpen(true)}
          >
            <PendingInvestments goalId={goal.id} />
          </Instruments>
        </div>
      )}

      {tab === "spending" && (
        <div id="panel-spending" role="tabpanel" aria-labelledby="tab-spending" className="mx-auto max-w-3xl">
          <Feedback />
        </div>
      )}
      {/* Mounted only while open so its defaults follow the latest timeline edits. */}
      {investOpen && <InvestDialog goal={goal} open onClose={() => setInvestOpen(false)} defaultAmount={s.requiredPaise} monthsLeft={s.monthsLeft} />}
    </div>
  );
}

/** Where the monthly gap could come from: the categories with the most room last month. */
function FindMoney({ gapPaise }: { gapPaise: number }) {
  const data = useAppData()!;
  const o = overview(data, todayIso());
  const total = o.cuts.reduce((sum, c) => sum + c.roomPaise, 0);
  return (
    <Card className="bg-warning-container/40">
      <CardTitle icon="content_cut">Find {formatINR(gapPaise)} a month</CardTitle>
      <ul className="flex flex-col gap-2">
        {o.cuts.map((c) => (
          <li key={c.category} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{categoryName(data.categories, c.category)}</p>
              <p className="text-xs text-on-surface-variant">
                {c.reason === "over_estimate"
                  ? `Spent ${formatINR(o.lastMonth.byCategory[c.category] ?? 0)} against your estimate of ${formatINR(data.profile!.estimatedSpend[c.category] ?? 0)}`
                  : "A fifth of last month's spend"}
              </p>
            </div>
            <span className="shrink-0 font-semibold text-primary tabular-nums">{formatINR(c.roomPaise)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        Cutting these frees {formatINR(total)} a month{total >= gapPaise ? " — enough to close the gap." : "."}
      </p>
    </Card>
  );
}

/** Editable timeline (F13): drag the date or change the amount; everything recomputes instantly. */
function TimelineEditor({ goal }: { goal: Goal }) {
  const today = todayIso();
  const months = Math.max(1, monthsBetween(today, goal.targetDate));
  return (
    <Card>
      <CardTitle icon="timeline">Edit the timeline</CardTitle>
      <label htmlFor="months" className="flex items-baseline justify-between text-sm font-medium">
        <span>Reach it in</span>
        <span className="text-lg font-semibold text-primary tabular-nums">
          {months} months · {formatMonth(goal.targetDate)}
        </span>
      </label>
      <input
        id="months"
        type="range"
        min={1}
        max={120}
        value={months}
        onChange={(e) => updateGoal(goal.id, { targetDate: addMonths(today, Number(e.target.value)) })}
        className="mt-3 w-full accent-primary"
        aria-valuetext={`${months} months, ${formatMonth(goal.targetDate)}`}
      />
      <div className="mt-1 flex justify-between text-xs text-on-surface-variant">
        <span>1 month</span>
        <span>10 years</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <AmountInput label="Target amount" valuePaise={goal.targetPaise} onChange={(p) => p && p > 0 && updateGoal(goal.id, { targetPaise: p })} />
        <TextInput
          label="Exact date"
          type="date"
          min={addMonths(today, 1)}
          value={goal.targetDate}
          onChange={(e) => e.target.value > today && updateGoal(goal.id, { targetDate: e.target.value })}
        />
      </div>
    </Card>
  );
}

/** Monthly feedback (F12): actual vs estimate per category. */
function Feedback() {
  const data = useAppData()!;
  const o = overview(data, todayIso());
  const [which, setWhich] = useState<"this" | "last">("last");
  const month = which === "this" ? o.thisMonth : o.lastMonth;
  const estimates = data.profile!.estimatedSpend;
  const rows = spendCategories(data.categories)
    .map((c) => ({ id: c.id, label: c.name, actual: month.byCategory[c.id] ?? 0, estimate: estimates[c.id] ?? 0 }))
    .filter((r) => r.actual > 0 || r.estimate > 0)
    .filter((r) => !data.profile!.fixedExpenses.some((f) => f.category === r.id) || r.actual > 0);
  const surplus = month.incomePaise - month.spendingPaise;
  return (
    <Card>
      <CardTitle
        icon="bar_chart"
        action={
          <Select
            label="Month"
            value={which}
            onChange={(v) => setWhich(v as "this" | "last")}
            options={[
              { value: "last", label: formatMonth(o.lastMonth.monthKey) },
              { value: "this", label: `${formatMonth(o.thisMonth.monthKey)} so far` },
            ]}
          />
        }
      >
        Spend vs your estimate
      </CardTitle>
      <p className="mb-2 text-sm">
        Surplus: <strong className={cx("tabular-nums", surplus < 0 ? "text-error" : "text-primary")}>{formatINR(surplus)}</strong> (
        {formatINR(month.incomePaise)} in, {formatINR(month.spendingPaise)} spent)
      </p>
      {rows.length > 0 && <ActualVsEstimate rows={rows} />}
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Spending against estimates</caption>
        <thead>
          <tr className="text-left text-xs text-on-surface-variant">
            <th className="py-1 font-medium">Category</th>
            <th className="py-1 text-right font-medium">Spent</th>
            <th className="py-1 text-right font-medium">Estimate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/50">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-1.5">{r.label}</td>
              <td className={cx("py-1.5 text-right tabular-nums", r.estimate > 0 && r.actual > r.estimate && "font-semibold text-error")}>{formatINR(r.actual)}</td>
              <td className="py-1.5 text-right text-on-surface-variant tabular-nums">{formatINR(r.estimate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Instrument types for the horizon (F14). Same table for everyone; the user enters return assumptions. */
function Instruments({
  goal,
  monthsLeft,
  contributionPaise,
  savedPaise,
  onInvest,
  children,
}: {
  goal: Goal;
  monthsLeft: number;
  contributionPaise: number;
  savedPaise: number;
  onInvest: () => void;
  /** Shown under the invest card (pending confirmations). */
  children?: ReactNode;
}) {
  const data = useAppData()!;
  const band = horizonBand(monthsLeft);
  const options = instrumentsForBand(band);
  const plan = data.plans.find((p) => p.goalId === goal.id);
  const chosen = plan?.chosenTypes.filter((t) => options.some((o) => o.type === t)) ?? [];
  const [low, setLow] = useState(plan?.userReturnLowPct?.toString() ?? "");
  const [high, setHigh] = useState(plan?.userReturnHighPct?.toString() ?? "");
  const lowPct = low.trim() === "" ? null : Number(low);
  const highPct = high.trim() === "" ? null : Number(high);
  const validRange = lowPct !== null && highPct !== null && lowPct >= 0 && highPct >= 0 && lowPct <= 30 && highPct <= 30;

  useEffect(() => {
    const nextLow = validRange ? lowPct : null;
    const nextHigh = validRange ? highPct : null;
    if ((plan?.userReturnLowPct ?? null) === nextLow && (plan?.userReturnHighPct ?? null) === nextHigh) return;
    const t = setTimeout(() => savePlan(goal.id, chosen, nextLow, nextHigh), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [low, high]);

  const toggle = (type: InstrumentType) => {
    const next = chosen.includes(type) ? chosen.filter((t) => t !== type) : [...chosen, type];
    savePlan(goal.id, next, validRange ? lowPct : null, validRange ? highPct : null);
  };

  const range = validRange
    ? projectionRange({ monthlyPaise: contributionPaise, months: monthsLeft, lowPct: lowPct!, highPct: highPct!, startingPaise: savedPaise })
    : null;

  return (
    <>
      <Card>
        <CardTitle icon="account_balance" action={<Badge tone="info">{BAND_LABEL[band]}</Badge>}>
          Kinds of instrument that fit
        </CardTitle>
        <p className="-mt-2 mb-4 text-sm text-on-surface-variant">Types only — never a specific fund, stock or policy. Pick the ones to consider.</p>
        <ul className="flex flex-col gap-2">
          {options.map((i) => {
            const on = chosen.includes(i.type);
            return (
              <li key={i.type}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(i.type)}
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                    on ? "border-primary bg-primary/8" : "border-outline-variant hover:bg-on-surface/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <Icon name={on ? "check_box" : "check_box_outline_blank"} className="text-primary" />
                      {i.name}
                    </span>
                    <Badge tone={i.risk === "High" ? "bad" : i.risk === "Moderate" ? "warn" : "good"}>{i.risk} risk</Badge>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">{i.why}</p>
                  {/* Details only for the ones picked, so the list stays short. */}
                  {on && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Liquidity: {i.liquidity} · Regulated by {i.regulator}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardTitle icon="calculate">Plan it</CardTitle>
          <fieldset>
            <legend className="mb-3 text-sm text-on-surface-variant">Optional: a low and high yearly return you want to plan with. ArthMitra doesn&apos;t suggest one.</legend>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Low (% a year)" inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} placeholder="—" />
              <TextInput label="High (% a year)" inputMode="decimal" value={high} onChange={(e) => setHigh(e.target.value)} placeholder="—" />
            </div>
          </fieldset>
          {range && (
            <p className="mt-3 text-sm">
              Saving {formatINR(contributionPaise)} a month for {monthsLeft} months on top of {formatINR(savedPaise)} could reach{" "}
              <strong>
                {formatINR(range.lowPaise)} – {formatINR(range.highPaise)}
              </strong>
              . <span className="font-semibold text-warning">Not guaranteed.</span>
            </p>
          )}
          <Button icon="open_in_new" className="mt-5 w-full" onClick={onInvest}>
            Invest now
          </Button>
          <div className="mt-3">
            <Disclaimer text={DISCLAIMER} />
          </div>
        </Card>
        {children}
      </div>
    </>
  );
}

function InvestDialog({
  goal,
  open,
  onClose,
  defaultAmount,
  monthsLeft,
}: {
  goal: Goal;
  open: boolean;
  onClose: () => void;
  defaultAmount: number;
  monthsLeft: number;
}) {
  const data = useAppData()!;
  const band = horizonBand(monthsLeft);
  const plan = data.plans.find((p) => p.goalId === goal.id);
  const types = plan?.chosenTypes.length ? plan.chosenTypes : instrumentsForBand(band).map((i) => i.type);
  const [type, setType] = useState<InstrumentType>(types[0]!);
  const [amount, setAmount] = useState<number | null>(defaultAmount);
  const [partnerId, setPartnerId] = useState(data.partners[0]?.id ?? "other");
  const [platformName, setPlatformName] = useState("");
  const [term, setTerm] = useState(String(monthsLeft));
  const activeType = types.includes(type) ? type : types[0]!;
  const partner = data.partners.find((p) => p.id === partnerId);
  const hasTerm = activeType === "fd" || activeType === "rd";

  const go = () => {
    if (!amount) return;
    planInvestment({
      goalId: goal.id,
      instrumentType: activeType,
      platform: partner?.name ?? (platformName.trim() || "My bank"),
      amountPaise: amount,
      termMonths: hasTerm ? Math.max(1, Number(term) || monthsLeft) : null,
    });
    if (partner) window.open(partner.url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Invest in a partner app">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-on-surface-variant">ArthMitra never handles your money. You buy in the app or website you choose, then come back to confirm.</p>
        <Select
          label="Instrument type"
          value={activeType}
          onChange={(v) => setType(v as InstrumentType)}
          options={types.map((t) => ({ value: t, label: INSTRUMENTS[t].name }))}
        />
        <AmountInput label="Amount" valuePaise={amount} onChange={setAmount} />
        {hasTerm && <TextInput label="Term (months)" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} hint="Sets the maturity date on your withdrawable timeline." />}
        <Select
          label="Where will you invest?"
          value={partnerId}
          onChange={setPartnerId}
          options={[...data.partners.map((p) => ({ value: p.id, label: p.name })), { value: "other", label: "My bank or another app (no link)" }]}
          hint="Add your own bank's link in Settings. Links carry no referral codes."
        />
        {partnerId === "other" && <TextInput label="Name it" value={platformName} onChange={(e) => setPlatformName(e.target.value)} placeholder="e.g. My bank's RD page" />}
        <Button icon="open_in_new" disabled={!amount} onClick={go}>
          {partner ? `Open ${partner.name}` : "Save and confirm later"}
        </Button>
        <Disclaimer />
      </div>
    </Modal>
  );
}

const STATUS_STEPS: Investment["status"][] = ["planned", "paid", "confirmed"];

/** Payment confirmation (F16): Planned → Paid → Confirmed (debit matched). */
function PendingInvestments({ goalId }: { goalId: string }) {
  const data = useAppData()!;
  const pending = data.investments.filter((i) => i.goalId === goalId && i.status !== "confirmed");
  const [editing, setEditing] = useState<Record<string, number | null>>({});
  if (pending.length === 0) return null;
  return (
    <Card>
      <CardTitle icon="pending_actions">Confirm your investments</CardTitle>
      <ul className="flex flex-col gap-4">
        {pending.map((inv) => (
          <li key={inv.id} className="rounded-2xl border border-outline-variant p-4">
            <ol className="mb-3 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Status">
              {STATUS_STEPS.map((st, i) => (
                <li key={st} className="flex items-center gap-1.5">
                  <span className={cx("rounded-full px-2 py-0.5 font-semibold capitalize", STATUS_STEPS.indexOf(inv.status) >= i ? "bg-primary text-on-primary" : "bg-surface-container-high")}>
                    {st}
                  </span>
                  {i < 2 && <Icon name="arrow_forward" className="text-[14px] text-on-surface-variant" />}
                </li>
              ))}
            </ol>
            {inv.status === "planned" ? (
              <>
                <p className="mb-3 text-sm">
                  Did you invest <strong>{formatINR(editing[inv.id] ?? inv.amountPaise)}</strong> in {INSTRUMENTS[inv.instrumentType].name} at {inv.platform}?
                </p>
                {editing[inv.id] !== undefined && (
                  <div className="mb-3">
                    <AmountInput label="Amount you actually paid" valuePaise={editing[inv.id] ?? null} onChange={(p) => setEditing({ ...editing, [inv.id]: p })} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button icon="check" onClick={() => markInvestmentPaid(inv.id, editing[inv.id] ?? inv.amountPaise)}>
                    Yes, I paid
                  </Button>
                  {editing[inv.id] === undefined && (
                    <Button variant="outlined" onClick={() => setEditing({ ...editing, [inv.id]: inv.amountPaise })}>
                      Edit amount
                    </Button>
                  )}
                  <Button variant="text" onClick={() => cancelInvestment(inv.id)}>
                    Not yet
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm">
                  Waiting for a {formatINR(inv.amountPaise)} debit in your bank feed. It is matched automatically and then counts toward your goal.
                </p>
                <Button variant="tonal" icon="science" onClick={() => simulateInvestmentDebit(inv.id)}>
                  Demo: bank sends the debit
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Achieved({ goal }: { goal: Goal }) {
  const today = todayIso();
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [date, setDate] = useState(addMonths(today, 12));
  return (
    <div className="mx-auto max-w-xl">
      <Card className="mb-6 bg-primary-container text-center text-on-primary-container">
        <Icon name="celebration" className="text-6xl" />
        <h1 className="mt-2 text-2xl font-bold">You reached {goal.name}!</h1>
        <p className="mt-1">{formatINR(goal.targetPaise)} saved. Check the withdrawable timeline in Portfolio before you spend it.</p>
        <LinkButton href="/portfolio" variant="filled" className="mt-4" icon="account_balance_wallet">
          See when money is free
        </LinkButton>
      </Card>
      <Card>
        <CardTitle icon="flag">Set your next goal</CardTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && target) addGoal({ name: name.trim(), kind: "custom", targetPaise: target, targetDate: date });
          }}
        >
          <TextInput label="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
          <AmountInput label="Target amount" valuePaise={target} onChange={setTarget} />
          <TextInput label="Target date" type="date" min={addMonths(today, 1)} value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="submit" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50" disabled={!name.trim() || !target}>
            Start this goal
          </button>
        </form>
      </Card>
    </div>
  );
}
