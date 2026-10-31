"use client";

import { categoryName, findRecurring, formatINR, todayIso, type RecurringPayment } from "@arthmitra/engine";
import type { AppData } from "@arthmitra/schema";
import { dueLabel, merchantLabel } from "@/lib/format";
import { useAppData } from "@/lib/store";
import { categoryIcon } from "@/components/transactions";
import { Avatar, Card, EmptyState, Icon, PageHeader, SectionTitle, cx } from "@/components/ui";

/** Repeating payments found in the history: when each is next due, and what subscriptions cost a year. */
export function BillsScreen() {
  const data = useAppData()!;
  const bills = findRecurring(data.transactions, todayIso());
  const late = bills.filter((b) => b.daysUntil < 0);
  const upcoming = bills.filter((b) => b.daysUntil >= 0);
  const monthly = bills.reduce((sum, b) => sum + b.amountPaise, 0);
  const subscriptions = bills.filter((b) => b.category === "entertainment");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Bills and subscriptions" subtitle="Payments that repeat each month." />
      {bills.length === 0 ? (
        <Card>
          <EmptyState icon="event_repeat" title="No repeating payments yet">
            Once rent, bills or subscriptions show up in two different months, they appear here with their next date.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <p className="text-xs text-on-surface-variant">Repeating each month</p>
              <p className="text-xl font-semibold tabular-nums sm:text-2xl">{formatINR(monthly)}</p>
              <p className="text-xs text-on-surface-variant">
                {bills.length} {bills.length === 1 ? "payment" : "payments"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-on-surface-variant">Subscriptions a year</p>
              <p className="text-xl font-semibold tabular-nums sm:text-2xl">{formatINR(subscriptions.reduce((sum, b) => sum + b.amountPaise * 12, 0))}</p>
              <p className="text-xs text-on-surface-variant">
                {subscriptions.length} {subscriptions.length === 1 ? "subscription" : "subscriptions"}
              </p>
            </Card>
          </div>

          {late.length > 0 && <BillList data={data} title="Not seen yet this month" bills={late} />}
          {upcoming.length > 0 && <BillList data={data} title="Coming up" bills={upcoming} />}
        </div>
      )}
      <p className="mt-6 flex items-start gap-1.5 text-xs text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        ArthMitra doesn&apos;t pay bills. Pay them in your bank or UPI app as usual and they&apos;ll show up here.
      </p>
    </div>
  );
}

function BillList({ data, title, bills }: { data: AppData; title: string; bills: RecurringPayment[] }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <ul className="-mx-2">
        {bills.map((b) => {
          const name = merchantLabel(b.merchantKey);
          return (
            <li key={b.merchantKey} className="flex items-center gap-3 px-2 py-2.5">
              <Avatar name={name} badge={categoryIcon(data, b.category)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="block text-xs text-on-surface-variant">
                  {categoryName(data.categories, b.category)}
                  {b.category === "entertainment" ? ` · ${formatINR(b.amountPaise * 12)} a year` : ""}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-semibold tabular-nums">{formatINR(b.amountPaise)}</span>
                <span className={cx("text-xs", b.daysUntil < 0 ? "text-error" : b.daysUntil <= 3 ? "text-warning" : "text-on-surface-variant")}>{dueLabel(b)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
