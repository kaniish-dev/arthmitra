"use client";

import { INSTRUMENTS, currentValuePaise, formatDate, formatINR, savedForGoal, withdrawableDate } from "@arthmitra/engine";
import { useState } from "react";
import { setInvestmentValue } from "@/lib/actions";
import { useAppData } from "@/lib/store";
import { WithdrawTimeline } from "@/components/charts";
import { AmountInput, Badge, Button, Card, CardTitle, EmptyState, LinkButton, Modal, PageHeader, ProgressBar, Stat } from "@/components/ui";

/** Goal achievement view (F17) and withdrawable timeline (F18). */
export function PortfolioScreen() {
  const data = useAppData()!;
  const [valuing, setValuing] = useState<string | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const holdings = data.investments.filter((i) => i.status === "confirmed");

  if (data.investments.length === 0) {
    return (
      <>
        <PageHeader title="Portfolio" />
        <Card>
          <EmptyState icon="account_balance_wallet" title="No investments yet">
            When you invest through a partner app and confirm it, it shows up here with the date the money is free.
            <div className="mt-4">
              <LinkButton href="/goal" icon="flag">
                Open your goal plan
              </LinkButton>
            </div>
          </EmptyState>
        </Card>
      </>
    );
  }

  const valuingInv = data.investments.find((i) => i.id === valuing) ?? null;
  const openValue = (id: string, paise: number) => {
    setValuing(id);
    setValue(paise);
  };

  return (
    <>
      <PageHeader title="Portfolio" subtitle="What you've invested, what it's worth and when it's free." />
      <div className="flex flex-col gap-6">
        {data.goals.map((g) => {
          const invested = savedForGoal(data.investments, g.id);
          const current = holdings.filter((i) => i.goalId === g.id).reduce((s, i) => s + currentValuePaise(i), 0);
          if (!data.investments.some((i) => i.goalId === g.id)) return null;
          return (
            <Card key={g.id}>
              <CardTitle icon="flag" action={g.status === "achieved" ? <Badge tone="good">Reached</Badge> : undefined}>
                {g.name}
              </CardTitle>
              <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Invested" value={formatINR(invested)} />
                <Stat label="Current value" value={formatINR(current)} sub="manual or NAV-based" />
                <Stat label="Of goal" value={`${Math.round((current / g.targetPaise) * 100)}%`} />
              </div>
              <ProgressBar value={current / g.targetPaise} label={`${g.name} funded`} />
            </Card>
          );
        })}

        <Card>
          <CardTitle icon="list">Holdings</CardTitle>
          {/* Phones: one card per holding. Tablets and up: the table. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {data.investments.map((i) => (
              <li key={i.id} className="rounded-2xl bg-surface-container p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{INSTRUMENTS[i.instrumentType].name}</p>
                    <p className="truncate text-xs text-on-surface-variant">{i.platform}</p>
                  </div>
                  <Badge tone={i.status === "confirmed" ? "good" : i.status === "paid" ? "info" : "neutral"}>{i.status}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-on-surface-variant">Invested</dt>
                    <dd className="font-medium tabular-nums">{formatINR(i.amountPaise)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-on-surface-variant">Value</dt>
                    <dd className="font-medium tabular-nums">{formatINR(currentValuePaise(i))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-on-surface-variant">Free from</dt>
                    <dd className="font-medium">{formatDate(withdrawableDate(i))}</dd>
                  </div>
                </dl>
                {i.status === "confirmed" && (
                  <Button variant="text" icon="edit" className="mt-2 -ml-3 px-3 py-1.5" onClick={() => openValue(i.id, i.currentValuePaise ?? i.amountPaise)}>
                    Update value
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-on-surface-variant">
                  <th className="py-2 font-medium">Instrument</th>
                  <th className="py-2 font-medium">Where</th>
                  <th className="py-2 text-right font-medium">Invested</th>
                  <th className="py-2 pr-4 text-right font-medium">Value</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Free from</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {data.investments.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2.5 font-medium">{INSTRUMENTS[i.instrumentType].name}</td>
                    <td className="py-2.5 text-on-surface-variant">{i.platform}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatINR(i.amountPaise)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{formatINR(currentValuePaise(i))}</td>
                    <td className="py-2.5">
                      <Badge tone={i.status === "confirmed" ? "good" : i.status === "paid" ? "info" : "neutral"}>{i.status}</Badge>
                    </td>
                    <td className="py-2.5">{formatDate(withdrawableDate(i))}</td>
                    <td className="py-2.5 text-right">
                      {i.status === "confirmed" && (
                        <Button variant="text" className="px-2 py-1" onClick={() => openValue(i.id, i.currentValuePaise ?? i.amountPaise)}>
                          Update value
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {holdings.length > 0 && (
          <Card>
            <CardTitle icon="event_available">Withdrawable timeline</CardTitle>
            <p className="mb-3 text-sm text-on-surface-variant">Each bar runs from the day you invested to the day the money is free of maturity, lock-in or exit load.</p>
            <WithdrawTimeline
              rows={holdings.map((i) => ({
                label: INSTRUMENTS[i.instrumentType].name,
                detail: `${formatINR(i.amountPaise)} · free ${formatDate(withdrawableDate(i))}`,
                start: i.date,
                end: withdrawableDate(i),
              }))}
            />
            <ul className="mt-3 text-sm">
              {holdings.map((i) => (
                <li key={i.id}>
                  {INSTRUMENTS[i.instrumentType].name}, {formatINR(i.amountPaise)}: free from {formatDate(withdrawableDate(i))}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Modal open={valuingInv !== null} onClose={() => setValuing(null)} title="Update current value">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-variant">
            Enter today&apos;s value from your bank or fund statement. With Firebase connected, mutual fund values update daily from AMFI&apos;s published NAVs.
          </p>
          <AmountInput label="Current value" valuePaise={value} onChange={setValue} autoFocus />
          <Button
            icon="save"
            onClick={() => {
              if (valuing) setInvestmentValue(valuing, value);
              setValuing(null);
            }}
          >
            Save
          </Button>
        </div>
      </Modal>
    </>
  );
}
