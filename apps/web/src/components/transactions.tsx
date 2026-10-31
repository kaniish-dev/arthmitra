"use client";

import Link from "next/link";
import { categoryName, formatDate, formatINR, isSpending, outstandingPaise, spendCategories } from "@arthmitra/engine";
import type { AppData, Transaction } from "@arthmitra/schema";
import { useState } from "react";
import { rememberMerchant, setCategory, setNote } from "@/lib/actions";
import { amountText, merchantLabel } from "@/lib/format";
import { useToast } from "./providers";
import { LendForm } from "./lend-form";
import { SplitForm } from "./split-form";
import { Avatar, Badge, Button, Chip, Icon, Modal, TextInput, cx } from "./ui";

const SOURCE_LABEL: Record<Transaction["source"], string> = {
  bank: "Bank",
  cash: "Cash",
  bill: "Bill",
  csv: "Statement",
};

export function categoryIcon(data: AppData, id: string | null): string {
  return data.categories.find((c) => c.id === id)?.icon ?? "help";
}

export { amountText, merchantLabel };

function directionLabel(t: Transaction): string {
  if (t.amountPaise > 0) return "Received from";
  if (t.source === "cash") return "Cash spent on";
  if (t.source === "bill") return "Cash paid at";
  return "Paid to";
}

/** Categories a transaction can move to: spend categories for debits, system ones for credits. */
export function choicesFor(data: AppData, t: Transaction) {
  if (t.amountPaise > 0) return data.categories.filter((c) => ["income", "refund", "transfer"].includes(c.id));
  return [...spendCategories(data.categories), ...data.categories.filter((c) => ["transfer", "investment"].includes(c.id))];
}

/** After a correction, offer "Always use X for this merchant" (PRD F6). */
export function useCategorise(data: AppData) {
  const toast = useToast();
  return (t: Transaction, category: string) => {
    setCategory(t.id, category);
    const name = categoryName(data.categories, category);
    toast({
      message: `Sorted into ${name}.`,
      action: { label: `Always use ${name} for ${merchantLabel(t.merchantKey)}`, onClick: () => rememberMerchant(t.merchantKey, category) },
    });
  };
}

export function CategoryPicker({ data, txn, open, onClose }: { data: AppData; txn: Transaction | null; open: boolean; onClose: () => void }) {
  const categorise = useCategorise(data);
  if (!txn) return null;
  return (
    <Modal open={open} onClose={onClose} title="Choose a category">
      <p className="mb-4 text-sm text-on-surface-variant">
        {merchantLabel(txn.merchantKey)} · {amountText(txn.amountPaise)} · {formatDate(txn.date)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {choicesFor(data, txn).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              categorise(txn, c.id);
              onClose();
            }}
            className={cx(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium hover:bg-primary/8",
              txn.category === c.id ? "border-primary bg-primary/8" : "border-outline-variant",
            )}
          >
            <Icon name={c.icon} className="text-primary" />
            {c.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function StatusLine({ data, t }: { data: AppData; t: Transaction }) {
  if (t.status === "uncategorised") {
    return (
      <Badge tone="warn" icon="edit">
        Sort
      </Badge>
    );
  }
  if (t.isTransfer) return <span className="text-xs text-on-surface-variant">Own transfer</span>;
  if (t.isInvestment) return <span className="text-xs font-medium text-success">Investment</span>;
  return <span className="text-xs text-on-surface-variant">{categoryName(data.categories, t.category)}</span>;
}

export function TransactionRow({ data, t, onOpen }: { data: AppData; t: Transaction; onOpen: (t: Transaction) => void }) {
  const account = data.accounts.find((a) => a.id === t.accountId);
  const uncategorised = t.status === "uncategorised";
  const name = merchantLabel(t.merchantKey);
  return (
    <li>
      <button type="button" onClick={() => onOpen(t)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-on-surface/5">
        <Avatar name={name} badge={uncategorised ? "help" : categoryIcon(data, t.category)} badgeTone={uncategorised ? "warn" : "neutral"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-on-surface">{name}</span>
          <span className="block truncate text-xs text-on-surface-variant">
            {formatDate(t.date)} · {SOURCE_LABEL[t.source]}
            {account ? ` ••${account.last4}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={cx("text-sm font-semibold tabular-nums", t.amountPaise > 0 ? "text-success" : "text-on-surface")}>
            <span className="sr-only">{t.amountPaise > 0 ? "Received " : "Paid "}</span>
            {amountText(t.amountPaise)}
          </span>
          <StatusLine data={data} t={t} />
        </span>
      </button>
    </li>
  );
}

function NoteField({ t }: { t: Transaction }) {
  const [text, setText] = useState(t.note ?? "");
  return (
    <TextInput
      label="Note"
      placeholder="e.g. Diwali gifts, office lunch"
      maxLength={80}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== (t.note ?? "") && setNote(t.id, text)}
      hint="Saved when you leave the field."
    />
  );
}

/** Receipt-style detail for one payment: change its category, save a merchant rule, add a note. */
export function TransactionSheet({ data, txnId, onClose }: { data: AppData; txnId: string | null; onClose: () => void }) {
  const t = data.transactions.find((x) => x.id === txnId);
  if (!t) return null;
  return <SheetContent key={t.id} data={data} t={t} onClose={onClose} />;
}

function RoundAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-1.5 text-xs font-medium text-on-surface">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/70 text-primary group-hover:bg-primary-container">
        <Icon name={icon} />
      </span>
      {label}
    </button>
  );
}

function SheetContent({ data, t, onClose }: { data: AppData; t: Transaction; onClose: () => void }) {
  const categorise = useCategorise(data);
  const toast = useToast();
  const [splitting, setSplitting] = useState(false);
  const [lending, setLending] = useState(false);
  const name = merchantLabel(t.merchantKey);
  const split = data.splits.find((s) => s.txnId === t.id);
  const lentAs = data.loans.find((l) => l.txnId === t.id);
  const paidBack = data.loans.find((l) => l.returns.some((r) => r.txnId === t.id));
  const isLent = t.category === "lent";
  const account = data.accounts.find((a) => a.id === t.accountId);
  const rule = data.merchantRules.find((r) => r.merchantKey === t.merchantKey);
  const category = t.category ? categoryName(data.categories, t.category) : null;
  const status =
    t.status === "uncategorised"
      ? { icon: "schedule", text: "Waiting for a category", tone: "text-warning" }
      : t.isTransfer
        ? { icon: "sync_alt", text: "Transfer between your own accounts", tone: "text-on-surface-variant" }
        : t.isInvestment
          ? { icon: "savings", text: "Counted towards your goal", tone: "text-success" }
          : isLent
            ? { icon: "handshake", text: lentAs ? `Lent to ${lentAs.person}` : paidBack ? `Paid back by ${paidBack.person}` : "Lent money", tone: "text-success" }
            : { icon: "check_circle", text: `Sorted into ${category}`, tone: "text-success" };

  if (splitting) {
    return (
      <Modal key="split" open onClose={onClose} title="Split this payment">
        <SplitForm txn={t} onDone={() => setSplitting(false)} onCancel={() => setSplitting(false)} />
      </Modal>
    );
  }
  if (lending) {
    return (
      <Modal key="lend" open onClose={onClose} title="Money you lent">
        <LendForm txn={t} onDone={() => setLending(false)} />
      </Modal>
    );
  }

  // Shares only what the receipt shows: never account numbers.
  const share = async () => {
    const text = `${t.amountPaise > 0 ? "Received" : "Paid"} ${formatINR(Math.abs(t.amountPaise))} ${t.amountPaise > 0 ? "from" : "to"} ${name} on ${formatDate(t.date)}${category ? ` · ${category}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: "Payment", text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ message: "Payment details copied." });
      }
    } catch {
      // Share sheet closed, or clipboard blocked: nothing to do.
    }
  };
  const owed = split ? split.people.filter((p) => !p.settled).reduce((sum, p) => sum + p.sharePaise, 0) : 0;

  return (
    <Modal key="details" open onClose={onClose} title="Payment details">
      <div className="flex flex-col items-center gap-1 pb-5 text-center">
        <Avatar name={name} size="xl" />
        <p className="mt-3 text-sm text-on-surface-variant">
          {directionLabel(t)} <span className="font-semibold text-on-surface">{name}</span>
        </p>
        <p className={cx("text-4xl font-semibold tabular-nums", t.amountPaise > 0 && "text-success")}>{amountText(t.amountPaise)}</p>
        <p className={cx("mt-1 flex items-center gap-1 text-sm font-medium", status.tone)}>
          <Icon name={status.icon} filled className="text-[18px]" />
          {status.text}
        </p>
        <p className="text-xs text-on-surface-variant">{formatDate(t.date)}</p>
      </div>

      <div className="mb-5 flex justify-center gap-8">
        <RoundAction icon="share" label="Share" onClick={share} />
        {isSpending(t) && <RoundAction icon="group_add" label={split ? "Split again" : "Split"} onClick={() => setSplitting(true)} />}
        {t.amountPaise < 0 && !t.isInvestment && !t.isTransfer && !isLent && <RoundAction icon="handshake" label="Lent" onClick={() => setLending(true)} />}
      </div>
      {(lentAs || paidBack) && (
        <Link href="/lent" className="mb-5 flex items-center gap-3 rounded-2xl bg-success-container/50 px-4 py-3 text-sm hover:bg-success-container">
          <Icon name="handshake" className="text-success" />
          <span className="flex-1">
            {lentAs
              ? `Lent to ${lentAs.person} · ${outstandingPaise(lentAs) > 0 ? `${formatINR(outstandingPaise(lentAs))} still to come back` : "paid back"}`
              : `${paidBack!.person} paid this back · not counted as income`}
          </span>
          <Icon name="chevron_right" />
        </Link>
      )}
      {split && (
        <Link href="/split" className="mb-5 flex items-center gap-3 rounded-2xl bg-secondary-container/50 px-4 py-3 text-sm hover:bg-secondary-container">
          <Icon name="group" className="text-primary" />
          <span className="flex-1">
            Split with {split.people.map((p) => p.name).join(", ")} · {owed > 0 ? `${formatINR(owed)} still to come back` : "all settled"}
          </span>
          <Icon name="chevron_right" />
        </Link>
      )}

      {!isLent && (
        <>
          <h3 className="mb-2 text-sm font-semibold">Category</h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {choicesFor(data, t).map((c) => (
              <Chip key={c.id} icon={c.icon} selected={t.category === c.id && t.status !== "uncategorised"} onClick={() => categorise(t, c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </>
      )}
      {isLent ? (
        <div className="mb-5" />
      ) : rule ? (
        <p className="mb-5 flex items-center gap-1.5 text-xs text-on-surface-variant">
          <Icon name="rule" className="text-[16px]" />
          {name} always goes to {categoryName(data.categories, rule.category)}.
          <Link href="/categories" className="font-semibold text-primary hover:underline">
            Manage rules
          </Link>
        </p>
      ) : t.status === "categorised" && t.category && !t.isTransfer && !t.isInvestment ? (
        <Button
          variant="text"
          icon="rule"
          className="mb-4 -ml-3"
          onClick={() => {
            rememberMerchant(t.merchantKey, t.category!);
            toast({ message: `${name} will always go to ${category}.` });
          }}
        >
          Always use {category} for {name}
        </Button>
      ) : (
        <div className="mb-5" />
      )}

      <NoteField key={t.id} t={t} />

      <dl className="mt-5 divide-y divide-outline-variant/50 rounded-2xl bg-surface-container px-4 text-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-on-surface-variant">{t.amountPaise > 0 ? "To" : "From"}</dt>
          <dd className="text-right font-medium">{account ? `${account.bankName} ••${account.last4}` : "Cash in hand"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-on-surface-variant">Came from</dt>
          <dd className="text-right font-medium">{t.source === "bank" ? "Bank feed" : SOURCE_LABEL[t.source]}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="shrink-0 text-on-surface-variant">{account ? "Bank narration" : "You wrote"}</dt>
          <dd className="font-mono text-xs break-all">{t.merchantRaw}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-on-surface-variant">ArthMitra ID</dt>
          <dd className="font-mono text-xs">{t.id}</dd>
        </div>
      </dl>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-on-surface-variant">
        <Icon name="verified_user" className="text-[16px]" />
        ArthMitra only records this payment. It never sends or receives money.
      </p>
    </Modal>
  );
}

export function TransactionList({ data, txns, empty }: { data: AppData; txns: Transaction[]; empty?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      {txns.length === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">{empty ?? "No transactions yet."}</p>
      ) : (
        <ul className="-mx-2">
          {txns.map((t) => (
            <TransactionRow key={t.id} data={data} t={t} onOpen={(x) => setOpenId(x.id)} />
          ))}
        </ul>
      )}
      <TransactionSheet data={data} txnId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

/** Suggestion chips used by the inbox: top 3 plus "Other…". */
export function SuggestionChips({ data, t, onOther }: { data: AppData; t: Transaction; onOther: () => void }) {
  const categorise = useCategorise(data);
  return (
    <div className="flex flex-wrap gap-2">
      {t.suggestions.map((id) => (
        <Chip key={id} icon={categoryIcon(data, id)} onClick={() => categorise(t, id)}>
          {categoryName(data.categories, id)}
        </Chip>
      ))}
      <Button variant="text" className="px-3 py-1.5" onClick={onOther}>
        Other…
      </Button>
    </div>
  );
}
