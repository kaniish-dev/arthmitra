"use client";

import { formatDate, formatINR } from "@arthmitra/engine";
import type { Transaction } from "@arthmitra/schema";
import { useState } from "react";
import { answerTransfer } from "@/lib/actions";
import { useAppData } from "@/lib/store";
import { DemoPayments } from "@/components/demo-payments";
import { CategoryPicker, SuggestionChips, amountText, merchantLabel } from "@/components/transactions";
import { Avatar, Badge, Button, Card, CardTitle, EmptyState, LinkButton, PageHeader } from "@/components/ui";

/** Uncategorised inbox (F7): low-confidence items with their top 3 suggestions. */
export function InboxScreen() {
  const data = useAppData()!;
  const [picking, setPicking] = useState<Transaction | null>(null);
  const items = data.transactions.filter((t) => t.status === "uncategorised");
  const transfers = data.transactions.filter((t) => t.transferSuggested && t.amountPaise < 0);

  return (
    <>
      <PageHeader
        title="Uncategorised inbox"
        subtitle="Payments that need a category."
        action={
          items.length > 1 ? (
            <LinkButton href="/sort" icon="sports_esports">
              Sort them in the game
            </LinkButton>
          ) : undefined
        }
      />

      {data.accounts.some((a) => a.status === "active" && a.source === "simulated") && <DemoPayments />}

      {transfers.length > 0 && (
        <Card className="mb-6">
          <CardTitle icon="sync_alt">Transfers between your own accounts?</CardTitle>
          <ul className="divide-y divide-outline-variant/50">
            {transfers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{formatINR(-t.amountPaise)} moved on {formatDate(t.date)}</p>
                  <p className="text-xs text-on-surface-variant">Same amount left one linked account and reached another within 3 days.</p>
                </div>
                <Button variant="tonal" onClick={() => answerTransfer(t.id, true)}>
                  Yes, own transfer
                </Button>
                <Button variant="text" onClick={() => answerTransfer(t.id, false)}>
                  No
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        {items.length === 0 ? (
          <EmptyState icon="task_alt" title="Inbox zero">
            Every payment has a category. New unclear payments will show up here and on the bell.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-outline-variant/50">
            {items.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={merchantLabel(t.merchantKey)} badge={t.source === "cash" || t.source === "bill" ? "payments" : "help"} badgeTone="warn" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{merchantLabel(t.merchantKey)}</p>
                    <p className="text-xs text-on-surface-variant">
                      {formatDate(t.date)} · {t.source === "bank" ? "Bank" : t.source === "csv" ? "Statement" : "Cash"}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                  <span className="ml-auto text-sm font-semibold tabular-nums sm:hidden">{amountText(t.amountPaise)}</span>
                </div>
                <span className="hidden w-24 text-right text-sm font-semibold tabular-nums sm:block">{amountText(t.amountPaise)}</span>
                <div className="sm:w-[22rem]">
                  <p className="mb-1.5 text-xs text-on-surface-variant">
                    Suggested <Badge tone="neutral">{Math.round((t.confidence ?? 0) * 100)}% sure</Badge>
                  </p>
                  <SuggestionChips data={data} t={t} onOther={() => setPicking(t)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <CategoryPicker data={data} txn={picking} open={picking !== null} onClose={() => setPicking(null)} />
    </>
  );
}
