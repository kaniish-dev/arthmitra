"use client";

import { formatDate, formatINR, isSpending } from "@arthmitra/engine";
import { useState } from "react";
import { deleteSplit, setSplitSettled } from "@/lib/actions";
import { amountText, merchantLabel } from "@/lib/format";
import { useAppData } from "@/lib/store";
import { SplitForm } from "@/components/split-form";
import { Avatar, Badge, Button, Card, EmptyState, Modal, cx } from "@/components/ui";

/** Shared payments and who still owes you, shown as a tab of Lent and split. Records only. */
export function SplitPanel() {
  const data = useAppData()!;
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const candidates = data.transactions.filter(isSpending).slice(0, 30);
  const chosenTxn = data.transactions.find((t) => t.id === chosen);
  const close = () => {
    setPicking(false);
    setChosen(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="tonal" icon="add" onClick={() => setPicking(true)}>
          New split
        </Button>
      </div>

      {data.splits.length === 0 ? (
        <Card>
          <EmptyState icon="group_add" title="No splits yet">
            Paid for dinner or a cab with friends? Open the payment and tap Split, or start one with New split.
          </EmptyState>
        </Card>
      ) : (
        data.splits.map((s) => {
          const txn = data.transactions.find((t) => t.id === s.txnId);
          const name = txn ? merchantLabel(txn.merchantKey) : "Payment";
          return (
            <Card key={s.id}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {txn ? formatDate(txn.date) : "No longer in your history"} · your share {formatINR(s.yourSharePaise)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatINR(s.totalPaise)}</span>
              </div>
              <ul className="divide-y divide-outline-variant/50 rounded-2xl bg-surface-container px-3">
                {s.people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={p.name} size="sm" />
                    <span className={cx("min-w-0 flex-1 truncate text-sm", p.settled && "text-on-surface-variant line-through")}>{p.name}</span>
                    <span className="text-sm tabular-nums">{formatINR(p.sharePaise)}</span>
                    {p.settled ? (
                      <button type="button" onClick={() => setSplitSettled(s.id, p.id, false)} aria-label={`Mark ${p.name} as not paid yet`}>
                        <Badge tone="good" icon="check">
                          Paid
                        </Badge>
                      </button>
                    ) : (
                      <Button variant="tonal" className="px-3 py-1.5 text-xs" onClick={() => setSplitSettled(s.id, p.id, true)}>
                        Mark paid
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <Button variant="text" icon="delete" className="mt-2 -ml-3 text-error" onClick={() => deleteSplit(s.id)}>
                Remove split
              </Button>
            </Card>
          );
        })
      )}

      {picking && !chosenTxn && (
        <Modal key="pick" open onClose={close} title="Choose a payment">
          <ul className="-mx-2">
            {candidates.map((t) => {
              const name = merchantLabel(t.merchantKey);
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setChosen(t.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-on-surface/5">
                    <Avatar name={name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      <span className="text-xs text-on-surface-variant">{formatDate(t.date)}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{amountText(t.amountPaise)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
      {chosenTxn && (
        <Modal key="form" open onClose={close} title="Split this payment">
          <SplitForm txn={chosenTxn} onDone={close} onCancel={() => setChosen(null)} />
        </Modal>
      )}
    </div>
  );
}
