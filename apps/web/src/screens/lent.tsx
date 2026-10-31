"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addDays,
  formatDate,
  formatINR,
  loanState,
  outstandingPaise,
  returnedPaise,
  todayIso,
  totalOutstanding,
  type Allocation,
  type LoanState,
} from "@arthmitra/engine";
import type { Loan } from "@arthmitra/schema";
import { deleteLoan, markReturnHandled, recordReturn, setLoanForgiven, undoReturn } from "@/lib/actions";
import { latestReturn, overview, planForReturn, splitOwedPaise } from "@/lib/derive";
import { amountText, merchantLabel } from "@/lib/format";
import { useAppData } from "@/lib/store";
import { useToast } from "@/components/providers";
import { FEATURES } from "@/lib/constants";
import { copyText } from "@/lib/ids";
import { AmountInput, Avatar, Badge, Button, Card, EmptyState, Icon, Modal, PageHeader, ProgressBar, Select, Tabs, TextInput } from "@/components/ui";
import { LendForm } from "@/components/lend-form";
import { SplitPanel } from "@/screens/split";

const STATE: Record<LoanState, { label: string; tone: "good" | "warn" | "bad" | "neutral" | "info" }> = {
  open: { label: "Open", tone: "info" },
  due_soon: { label: "Due soon", tone: "warn" },
  overdue: { label: "Overdue", tone: "bad" },
  returned: { label: "Paid back", tone: "good" },
  forgiven: { label: "Let go", tone: "neutral" },
};

/** Money people owe you: loans you gave and shares of split payments. ArthMitra only keeps the record. */
export function LentScreen({ initialTab = "lent" }: { initialTab?: "lent" | "split" }) {
  const data = useAppData()!;
  const [tab, setTab] = useState(initialTab);
  const lent = totalOutstanding(data.loans);
  const split = splitOwedPaise(data);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={FEATURES.lend.name} subtitle="Money you lent to friends and family — who, how much, and when it is due back." back="/more" />
      <Card className="mb-6 flex items-center gap-4 bg-success-container/50">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-container text-on-success-container">
          <Icon name="handshake" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-on-surface-variant">Owed to you</p>
          <p className="text-3xl font-semibold text-success tabular-nums">{formatINR(lent + split)}</p>
          <p className="text-xs text-on-surface-variant">
            {formatINR(lent)} lent · {formatINR(split)} from split bills
          </p>
        </div>
      </Card>
      <Tabs
        label="Owed to you"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "lent", label: "Lent" },
          { value: "split", label: "Split bills" },
        ]}
      />
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "lent" ? <LentPanel /> : <SplitPanel />}
      </div>
      <p className="mt-6 flex items-start gap-1.5 text-xs text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        ArthMitra never asks anyone for money. People pay you back in whatever UPI app you both use, and the payback is spotted here.
      </p>
    </div>
  );
}

function LentPanel() {
  const data = useAppData()!;
  const today = todayIso();
  const [adding, setAdding] = useState(false);
  const open = data.loans.filter((l) => outstandingPaise(l) > 0);
  const closed = data.loans.filter((l) => outstandingPaise(l) === 0);
  const rank = (l: Loan) => ["overdue", "due_soon", "open"].indexOf(loanState(l, today));
  open.sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  return (
    <div className="flex flex-col gap-4">
      <MoneyBackCard />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant">Lend only what you could afford to lose, and agree a date.</p>
        <Button variant="tonal" icon="add" className="shrink-0" onClick={() => setAdding(true)}>
          Lent money
        </Button>
      </div>
      {data.loans.length === 0 ? (
        <Card>
          <EmptyState icon="handshake" title="No money lent">
            Lent money to a friend or family member? Add it here, or open the payment and tap Lent. When it comes back, the coach shows where it should go.
          </EmptyState>
        </Card>
      ) : (
        <>
          {open.map((l) => (
            <LoanCard key={l.id} loan={l} today={today} />
          ))}
          {closed.length > 0 && (
            <details className="group rounded-3xl surface-card p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Settled ({closed.length})
                <Icon name="expand_more" className="transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 divide-y divide-outline-variant/50">
                {closed.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Avatar name={l.person} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {l.person} · {formatINR(l.amountPaise)} on {formatDate(l.date)}
                    </span>
                    <Badge tone={STATE[loanState(l, today)].tone}>{STATE[loanState(l, today)].label}</Badge>
                    <button type="button" className="rounded-full p-1 hover:bg-on-surface/8" aria-label={`Delete the record for ${l.person}`} onClick={() => deleteLoan(l.id)}>
                      <Icon name="delete" className="text-[18px] text-on-surface-variant" />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Money you lent">
          <LendForm onDone={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}

const PLAN_ROW: Record<Allocation["kind"], { icon: string; label: (goal: string | null) => string }> = {
  bills: { icon: "event_repeat", label: () => "Keep for bills due in 10 days" },
  cushion: { icon: "shield", label: () => "Emergency cushion" },
  goal: { icon: "flag", label: (goal) => goal ?? "Your goal" },
  you: { icon: "redeem", label: () => "Yours to enjoy" },
};

/** The latest payback and where the engine says it should go. Stays until marked done. */
export function MoneyBackCard() {
  const data = useAppData()!;
  const today = todayIso();
  const back = latestReturn(data, today);
  if (!back || back.ret.handled) return null;
  const o = overview(data, today);
  const plan = planForReturn(data, o, back.ret);
  return (
    <Card className="bg-primary-container/40">
      <p className="text-sm text-on-surface-variant">Paid back {formatDate(back.ret.date)}</p>
      <p className="text-lg font-semibold">
        {formatINR(back.ret.amountPaise)} is back from {back.loan.person}
      </p>
      <p className="mt-3 mb-2 text-sm font-medium">Where it should go, from your balance, bills and goal:</p>
      <ul className="flex flex-col gap-2">
        {plan.map((a) => (
          <li key={a.kind} className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest px-3 py-2.5">
            <Icon name={PLAN_ROW[a.kind].icon} className="text-primary" />
            <span className="min-w-0 flex-1 text-sm">{PLAN_ROW[a.kind].label(o.goal?.name ?? null)}</span>
            <span className="font-semibold tabular-nums">{formatINR(a.paise)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-on-surface-variant">Move it yourself in your bank app — ArthMitra never moves money.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button icon="check" onClick={() => markReturnHandled(back.loan.id, back.ret.id)}>
          Done
        </Button>
        <Link href="/coach" className="rounded-full px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/8">
          Ask the coach
        </Link>
        <button type="button" className="ml-auto text-xs font-medium text-on-surface-variant hover:underline" onClick={() => undoReturn(back.loan.id, back.ret.id)}>
          Not this loan?
        </button>
      </div>
    </Card>
  );
}

function LoanCard({ loan, today }: { loan: Loan; today: string }) {
  const toast = useToast();
  const [returning, setReturning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const state = loanState(loan, today);
  const owed = outstandingPaise(loan);
  const back = returnedPaise(loan);

  const remind = async () => {
    const firstName = loan.person.split(" ")[0];
    const text = `Hi ${firstName}, a gentle reminder about the ${formatINR(owed)} from ${formatDate(loan.date)}. Could you send it back${loan.dueDate ? ` by ${formatDate(loan.dueDate)}` : " when you can"}? Thanks!`;
    try {
      if (navigator.share) await navigator.share({ text });
      else toast({ message: (await copyText(text)) ? "Reminder copied — paste it in your chat app." : `Copy this reminder: ${text}` });
    } catch {
      // Share sheet closed, or clipboard blocked.
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3">
        <Avatar name={loan.person} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{loan.person}</p>
          <p className="text-xs text-on-surface-variant">
            {formatINR(loan.amountPaise)} on {formatDate(loan.date)}
            {loan.dueDate ? ` · due ${formatDate(loan.dueDate)}` : ""}
            {loan.note ? ` · ${loan.note}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-semibold tabular-nums">{formatINR(owed)}</span>
          <Badge tone={STATE[state].tone}>{STATE[state].label}</Badge>
        </div>
      </div>
      {back > 0 && (
        <div className="mt-3">
          <ProgressBar value={back / loan.amountPaise} label={`${loan.person} paid back`} />
          <p className="mt-1 text-xs text-on-surface-variant">{formatINR(back)} paid back so far</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          icon="task_alt"
          className="px-4 py-2"
          onClick={() => {
            recordReturn(loan.id, owed, today, null);
            toast({ message: `Marked ${formatINR(owed)} from ${loan.person} as repaid.` });
          }}
        >
          Mark repaid
        </Button>
        <Button variant="tonal" icon="savings" className="px-4 py-2" onClick={() => setReturning(true)}>
          Part payment
        </Button>
        <Button variant="text" icon="content_copy" className="px-3 py-2" onClick={remind}>
          Copy reminder
        </Button>
        <span className="ml-auto flex gap-1">
          <button type="button" className="rounded-full px-3 py-2 text-xs font-medium text-on-surface-variant hover:bg-on-surface/8" onClick={() => setLoanForgiven(loan.id, true)}>
            Let it go
          </button>
          <button type="button" aria-label={`Delete the record for ${loan.person}`} className="rounded-full p-2 hover:bg-on-surface/8" onClick={() => setConfirmDelete(true)}>
            <Icon name="delete" className="text-[18px] text-on-surface-variant" />
          </button>
        </span>
      </div>
      {returning && (
        <Modal open onClose={() => setReturning(false)} title={`Money back from ${loan.person}`}>
          <ReturnForm loan={loan} onDone={() => setReturning(false)} />
        </Modal>
      )}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this record?">
        <p className="text-sm text-on-surface-variant">Any payments linked to it go back to your inbox to be sorted.</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="text" onClick={() => setConfirmDelete(false)}>
            Keep
          </Button>
          <Button variant="danger" icon="delete" onClick={() => deleteLoan(loan.id)}>
            Delete
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function ReturnForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const data = useAppData()!;
  const today = todayIso();
  const owed = outstandingPaise(loan);
  const [amount, setAmount] = useState<number | null>(owed);
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("cash");
  const since = addDays(today, -60);
  const credits = data.transactions.filter((t) => t.amountPaise > 0 && t.date >= since && !t.isTransfer && t.category !== "lent").slice(0, 25);
  const valid = amount && amount > 0 && amount <= owed && date <= today;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        recordReturn(loan.id, amount!, date, from === "cash" ? null : from);
        onDone();
      }}
    >
      <p className="text-sm text-on-surface-variant">{formatINR(owed)} is still owed.</p>
      <Select
        label="How did it come back?"
        value={from}
        onChange={(v) => {
          setFrom(v);
          const t = credits.find((c) => c.id === v);
          if (t) {
            setAmount(Math.min(t.amountPaise, owed));
            setDate(t.date);
          }
        }}
        options={[
          { value: "cash", label: "Cash, or not in ArthMitra" },
          ...credits.map((t) => ({ value: t.id, label: `${merchantLabel(t.merchantKey)} · ${amountText(t.amountPaise)} · ${formatDate(t.date)}` })),
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AmountInput label="Amount" valuePaise={amount} onChange={setAmount} />
        <TextInput label="Date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {amount !== null && amount > owed && <p className="text-xs text-error">That is more than the {formatINR(owed)} still owed.</p>}
      <div className="flex justify-end gap-3">
        <Button variant="text" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" icon="check" disabled={!valid}>
          Save
        </Button>
      </div>
    </form>
  );
}
