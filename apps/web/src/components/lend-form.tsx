"use client";

import { useState } from "react";
import { addDays, formatDate, todayIso } from "@arthmitra/engine";
import type { Transaction } from "@arthmitra/schema";
import { addLoan } from "@/lib/actions";
import { amountText, merchantLabel } from "@/lib/format";
import { useAppData } from "@/lib/store";
import { demoValues } from "@/lib/demo";
import { AmountInput, AutofillButton, Button, Select, TextInput } from "./ui";

/** Debits from the last 60 days that could be money lent. */
function lendablePayments(txns: Transaction[], today: string) {
  const since = addDays(today, -60);
  return txns.filter((t) => t.amountPaise < 0 && t.date >= since && !t.isInvestment && !t.isTransfer && t.category !== "lent").slice(0, 25);
}

/** Records money lent; with `txn`, that payment is the loan. */
export function LendForm({ txn, onDone }: { txn?: Transaction; onDone: () => void }) {
  const data = useAppData()!;
  const today = todayIso();
  const [person, setPerson] = useState(txn ? merchantLabel(txn.merchantKey) : "");
  const [amount, setAmount] = useState<number | null>(txn ? -txn.amountPaise : null);
  const [date, setDate] = useState(txn?.date ?? today);
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState(txn?.id ?? "cash");
  const payments = txn ? [] : lendablePayments(data.transactions, today);
  const valid = person.trim() && amount && amount > 0 && date <= today && (!due || due >= date);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        addLoan({ person, amountPaise: amount!, date, dueDate: due || null, note: note || null, txnId: from === "cash" ? null : from });
        onDone();
      }}
    >
      {!txn && (
        <AutofillButton
          onClick={() => {
            const v = demoValues().loan;
            setPerson(v.person);
            setAmount(v.amountPaise);
            setDate(addDays(today, -7));
            setDue(addDays(today, 7));
            setNote(v.note);
            setFrom("cash");
          }}
        />
      )}
      <TextInput label="Who did you lend to?" value={person} maxLength={40} onChange={(e) => setPerson(e.target.value)} placeholder="e.g. Ramesh Kumar" />
      {!txn && (
        <Select
          label="How did it go out?"
          value={from}
          onChange={(v) => {
            setFrom(v);
            const t = payments.find((p) => p.id === v);
            if (t) {
              setAmount(-t.amountPaise);
              setDate(t.date);
              if (!person) setPerson(merchantLabel(t.merchantKey));
            }
          }}
          options={[
            { value: "cash", label: "Cash, or not in ArthMitra" },
            ...payments.map((t) => ({ value: t.id, label: `${merchantLabel(t.merchantKey)} · ${amountText(t.amountPaise)} · ${formatDate(t.date)}` })),
          ]}
          hint="Picking a payment stops it counting as spending."
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AmountInput label="Amount" valuePaise={amount} onChange={setAmount} />
        <TextInput label="Date lent" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Pay back by (optional)" type="date" min={date} value={due} onChange={(e) => setDue(e.target.value)} />
        <TextInput label="Note (optional)" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rent help" />
      </div>
      <p className="text-xs text-on-surface-variant">When a payment from this person arrives, ArthMitra spots it and marks it paid back.</p>
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
