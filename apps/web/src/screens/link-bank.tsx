"use client";

import { useState } from "react";
import { AA_PURPOSE, consentRequest, formatDate, todayIso } from "@arthmitra/engine";
import { DEMO_AA_NAME, DEMO_ACCOUNTS } from "@arthmitra/seed";
import { linkDemoAa } from "@/lib/actions";
import { getData, useAppData } from "@/lib/store";
import { Button, Card, CardTitle, Icon, LinkButton, Modal, PageHeader } from "@/components/ui";

type Step = { kind: "consent" } | { kind: "rejected" } | { kind: "done"; accounts: number; payments: number };

/**
 * Bank linking through RBI's Account Aggregator network (F4). The consent shown here is
 * the one requested from the AA; the user approves it on the AA's own page.
 */
export function LinkBankScreen() {
  const data = useAppData()!;
  const [step, setStep] = useState<Step>({ kind: "consent" });
  const [aaOpen, setAaOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(DEMO_ACCOUNTS.map((a) => a.id));
  const today = todayIso();
  const request = consentRequest(today, `${today}T00:00:00.000Z`);
  const expiry = formatDate(request.consentExpiry.slice(0, 10));

  const rows = [
    { icon: "target", label: "Purpose", value: `Spending and budgets (purpose code ${AA_PURPOSE.code})` },
    { icon: "receipt_long", label: "Data", value: "Balance and transactions only — never your name, PAN or address" },
    { icon: "date_range", label: "History", value: `From ${formatDate(request.fiDataRange.from.slice(0, 10))}, then new payments hourly` },
    { icon: "event_busy", label: "Ends", value: `${expiry}, or whenever you revoke it · data kept ${request.dataLife.value} months at most` },
  ];

  const approve = () => {
    linkDemoAa(picked);
    const payments = getData().transactions.filter((t) => t.accountId && picked.includes(t.accountId)).length;
    setAaOpen(false);
    setStep({ kind: "done", accounts: picked.length, payments });
  };

  if (step.kind === "done") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Bank linked" />
        <Card className="bg-success-container/50">
          <CardTitle icon="task_alt">Consent approved on {DEMO_AA_NAME}</CardTitle>
          <p className="text-sm">
            {step.accounts} {step.accounts === 1 ? "account" : "accounts"} linked · {step.payments} transactions fetched and sorted. New payments arrive with each
            fetch while the consent is active.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <LinkButton href="/dashboard" icon="home">
              Go to Home
            </LinkButton>
            <LinkButton href="/accounts" variant="outlined" icon="manage_accounts">
              Manage consent
            </LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Link a bank account"
        subtitle="Through RBI's Account Aggregator network, only with your consent."
      />

      {step.kind === "rejected" && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-surface-container p-3 text-sm">
          <Icon name="info" className="text-primary" />
          You rejected the request on the AA. Nothing was shared.
        </p>
      )}

      <Card className="mb-4">
        <CardTitle icon="verified_user">What ArthMitra asks your AA for</CardTitle>
        <dl className="divide-y divide-outline-variant/50">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-0.5 py-3 sm:grid-cols-[1.5rem_8rem_1fr]">
              <Icon name={r.icon} className="row-span-2 text-primary sm:row-span-1" />
              <dt className="text-sm font-medium">{r.label}</dt>
              <dd className="text-sm text-on-surface-variant">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-primary-container/60 p-3 text-sm text-on-primary-container">
          <Icon name="lock" />
          You approve on your AA&apos;s own page with an OTP the AA sends. ArthMitra never sees it, and keeps only the last 4 digits of an account number.
        </p>
        <Button icon="arrow_forward" className="mt-5 w-full" onClick={() => setAaOpen(true)}>
          Continue to {DEMO_AA_NAME}
        </Button>
        <p className="mt-2 text-center text-xs text-on-surface-variant">Demo AA with two fictional accounts · live AAs switch on after launch</p>
      </Card>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Bank not on the AA network yet?{" "}
        <LinkButton href="/import" variant="text" className="px-2 py-1">
          Upload a CSV statement
        </LinkButton>
      </p>
      {data.accounts.some((a) => a.status === "active") && (
        <p className="mt-2 text-center text-xs text-on-surface-variant">Linking again replaces the earlier {DEMO_AA_NAME} consent.</p>
      )}

      <Modal open={aaOpen} onClose={() => setAaOpen(false)} title={DEMO_AA_NAME}>
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 rounded-2xl bg-warning-container p-3 text-xs text-on-warning-container">
            <Icon name="science" className="text-[18px]" />
            Simulation of your AA&apos;s page. A real AA asks for your mobile number and an OTP first; ArthMitra is not part of that step.
          </p>
          <div>
            <p className="text-sm font-medium">ArthMitra is asking for</p>
            <p className="text-sm text-on-surface-variant">
              Balance and transactions · purpose {AA_PURPOSE.code} · fetched up to once an hour · until {expiry}
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Accounts found for your mobile number</legend>
            <ul className="flex flex-col gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-outline-variant p-3 hover:bg-on-surface/5">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-primary"
                      checked={picked.includes(a.id)}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, a.id] : picked.filter((id) => id !== a.id))}
                    />
                    <Icon name="account_balance" className="text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.bankName}</span>
                      <span className="block text-xs text-on-surface-variant">Savings ••{a.last4}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="text"
              onClick={() => {
                setAaOpen(false);
                setStep({ kind: "rejected" });
              }}
            >
              Reject
            </Button>
            <Button icon="check" disabled={picked.length === 0} onClick={approve}>
              Approve
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
