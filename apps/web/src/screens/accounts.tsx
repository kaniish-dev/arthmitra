"use client";

import { formatDate, formatINR } from "@arthmitra/engine";
import type { Account, AaConsent, AppData } from "@arthmitra/schema";
import { useState } from "react";
import { fetchAaNow, removeAccount, setAaConsentStatus } from "@/lib/actions";
import { accountBalance } from "@/lib/derive";
import { useAppData } from "@/lib/store";
import { useToast } from "@/components/providers";
import { AaStatus } from "@/components/aa-status";
import { Badge, Button, Card, CardTitle, EmptyState, Icon, IconButton, LinkButton, Modal, PageHeader, cx } from "@/components/ui";

const SOURCE: Record<Account["source"], string> = { aa: "Account Aggregator", simulated: "Demo AA", csv: "Statement upload", manual: "No payments yet" };

/** Linked accounts with a per-account "Check balance", like a payment app's bank account page. */
export function AccountsScreen() {
  const data = useAppData()!;
  const [shown, setShown] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Account | null>(null);
  const active = data.accounts.filter((a) => a.status === "active");
  const total = active.reduce((sum, a) => sum + accountBalance(data, a.id), 0);
  const toggle = (id: string) => setShown(shown.includes(id) ? shown.filter((x) => x !== id) : [...shown, id]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Bank accounts" subtitle="Worked out from the payments ArthMitra has seen." back="/profile" />
      <div className="flex flex-col gap-4">
        <AaStatus data={data} />
        {data.accounts.length === 0 ? (
          <Card>
            <EmptyState icon="account_balance" title="No bank linked yet">
              Link your bank through an Account Aggregator, or upload a statement (CSV, Excel or PDF).
            </EmptyState>
          </Card>
        ) : (
          <>
            <Card className="flex items-center justify-between gap-4 bg-primary-container/40">
              <div>
                <p className="text-sm text-on-surface-variant">
                  Total across {active.length} active {active.length === 1 ? "account" : "accounts"}
                </p>
                <p className="text-3xl font-semibold tabular-nums">{shown.includes("all") ? formatINR(total) : "₹ ••••••"}</p>
              </div>
              <button
                type="button"
                aria-pressed={shown.includes("all")}
                onClick={() => toggle("all")}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap text-primary hover:bg-primary/8"
              >
                <Icon name={shown.includes("all") ? "visibility_off" : "visibility"} className="text-[20px]" />
                {shown.includes("all") ? "Hide" : "Show"}
              </button>
            </Card>

            {data.accounts.map((a) => {
              const on = shown.includes(a.id);
              return (
                <Card key={a.id} className={cx(a.status !== "active" && "opacity-70")}>
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container text-primary">
                      <Icon name="account_balance" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.bankName}</p>
                      <p className="text-sm text-on-surface-variant">
                        {a.type === "savings" ? "Savings" : "Current"} account ••{a.last4}
                        {a.holderName ? ` · ${a.holderName}` : ""}
                      </p>
                      {/* Phones: the badge sits under the name so the name keeps the row's width. */}
                      <span className="mt-1 inline-block sm:hidden">
                        <Badge tone={a.status === "active" ? "info" : "neutral"}>{a.status === "active" ? SOURCE[a.source] : "Disconnected"}</Badge>
                      </span>
                    </div>
                    <span className="hidden sm:inline-flex">
                      <Badge tone={a.status === "active" ? "info" : "neutral"}>{a.status === "active" ? SOURCE[a.source] : "Disconnected"}</Badge>
                    </span>
                    <IconButton icon="delete" label={`Remove ${a.bankName} ••${a.last4}`} onClick={() => setRemoving(a)} />
                  </div>
                  {a.status === "active" ? (
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-container px-4 py-3">
                      <span className="text-sm text-on-surface-variant">Balance</span>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={on ? `Hide balance of ${a.bankName} ••${a.last4}` : `Check balance of ${a.bankName} ••${a.last4}`}
                        onClick={() => toggle(a.id)}
                        className="flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold text-primary tabular-nums hover:bg-primary/8"
                      >
                        {on ? formatINR(accountBalance(data, a.id)) : "Check balance"}
                        <Icon name={on ? "visibility_off" : "visibility"} className="text-[18px]" />
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-on-surface-variant">Consent withdrawn. No new payments are fetched from this account.</p>
                  )}
                  {(a.source === "manual" || a.source === "csv") && a.status === "active" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <LinkButton href="/link-bank" variant="text" icon="sync" className="px-3 py-1.5">
                        Link with Account Aggregator
                      </LinkButton>
                      <LinkButton href="/import" variant="text" icon="upload_file" className="px-3 py-1.5">
                        {a.source === "csv" ? "Upload a newer statement" : "Upload a statement"}
                      </LinkButton>
                    </div>
                  )}
                  {a.status === "active" && data.aaConsents.find((c) => c.id === a.aaConsentId)?.status === "paused" ? (
                    <p className="mt-3 flex items-center gap-1 text-xs text-on-warning-container">
                      <Icon name="pause_circle" className="text-[16px]" />
                      Consent paused — no new payments are fetched until you resume it.
                    </p>
                  ) : (
                    a.consentExpiry &&
                    a.status === "active" && <p className="mt-3 text-xs text-on-surface-variant">Consent valid until {formatDate(a.consentExpiry)}</p>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {data.aaConsents.length > 0 && <AaConsents data={data} />}
        {removing && <RemoveAccount data={data} account={removing} onClose={() => setRemoving(null)} />}

        <div className="flex flex-wrap gap-3">
          <LinkButton href="/link-bank" icon="add">
            Link a bank account
          </LinkButton>
          <LinkButton href="/import" variant="outlined" icon="upload_file">
            Upload a statement
          </LinkButton>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-on-surface-variant">
          <Icon name="lock" className="text-[16px]" />
          ArthMitra never asks for your bank password, UPI PIN or OTP, and keeps only the last 4 digits of an account number.
        </p>
      </div>
    </div>
  );
}

const CONSENT_TONE: Record<AaConsent["status"], "good" | "warn" | "neutral" | "bad"> = { active: "good", paused: "warn", revoked: "neutral", expired: "neutral" };
const CONSENT_LABEL: Record<AaConsent["status"], string> = { active: "Active", paused: "Paused", revoked: "Revoked", expired: "Expired" };

/** Consents approved on an AA. Revoking here ends fetching; in production it also tells the AA. */
function AaConsents({ data }: { data: AppData }) {
  const toast = useToast();
  const [revoking, setRevoking] = useState<AaConsent | null>(null);
  const consents = [...data.aaConsents].sort((a, b) => Number(a.status === "revoked") - Number(b.status === "revoked") || (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <Card>
      <CardTitle icon="verified_user">Account Aggregator consents</CardTitle>
      <ul className="flex flex-col gap-3">
        {consents.map((c) => {
          const accounts = data.accounts.filter((a) => c.accountIds.includes(a.id));
          const live = c.status === "active" || c.status === "paused";
          return (
            <li key={c.id} className={cx("rounded-2xl border border-outline-variant p-4", !live && "opacity-70")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{c.aaName}</p>
                <Badge tone={CONSENT_TONE[c.status]}>{CONSENT_LABEL[c.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-on-surface-variant">
                {accounts.map((a) => `${a.bankName} ••${a.last4}`).join(", ") || "No accounts"} · balance and transactions · purpose {c.detail.purpose.code}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Approved {formatDate(c.createdAt.slice(0, 10))} · ends {formatDate(c.detail.consentExpiry.slice(0, 10))}
                {c.lastFetchedAt ? ` · last fetched ${new Date(c.lastFetchedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}
              </p>
              {live && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status === "active" && (
                    <Button
                      variant="tonal"
                      icon="sync"
                      onClick={() => {
                        const added = fetchAaNow(c.id);
                        toast({ message: added ? `${added} new transactions.` : `Up to date — no new transactions from ${c.aaName}.` });
                      }}
                    >
                      Fetch now
                    </Button>
                  )}
                  <Button variant="outlined" icon={c.status === "active" ? "pause" : "play_arrow"} onClick={() => setAaConsentStatus(c.id, c.status === "active" ? "paused" : "active")}>
                    {c.status === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="text" icon="link_off" onClick={() => setRevoking(c)}>
                    Revoke
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-on-surface-variant">You can also pause or revoke a consent in your AA&apos;s own app; ArthMitra stops fetching either way.</p>

      <Modal open={revoking !== null} onClose={() => setRevoking(null)} title="Revoke this consent?">
        <p className="text-sm text-on-surface-variant">
          ArthMitra stops fetching from these accounts and they show as disconnected. Payments already fetched stay until you delete them in Settings.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="text" onClick={() => setRevoking(null)}>
            Keep
          </Button>
          <Button
            variant="danger"
            icon="link_off"
            onClick={() => {
              if (revoking) setAaConsentStatus(revoking.id, "revoked");
              setRevoking(null);
            }}
          >
            Revoke
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

/** Confirms removing an account; says what happens to its payments and its AA consent. */
function RemoveAccount({ data, account, onClose }: { data: AppData; account: Account; onClose: () => void }) {
  const toast = useToast();
  const payments = data.transactions.filter((t) => t.accountId === account.id).length;
  const consent = data.aaConsents.find((c) => c.id === account.aaConsentId && c.status !== "revoked" && c.status !== "expired");
  const lastInConsent = consent?.accountIds.length === 1;
  const name = `${account.bankName} ••${account.last4}`;
  return (
    <Modal open onClose={onClose} title={`Remove ${name}?`}>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-on-surface-variant">
        <li>{payments ? `Its ${payments} ${payments === 1 ? "payment is" : "payments are"} deleted from ArthMitra.` : "It has no payments in ArthMitra."}</li>
        {consent && <li>{lastInConsent ? `The ${consent.aaName} consent is revoked, so nothing more is fetched.` : `ArthMitra stops fetching it from ${consent.aaName}.`}</li>}
        <li>Your bank account itself isn&apos;t touched. You can link it or upload a statement again later.</li>
      </ul>
      <div className="mt-4 flex justify-end gap-3">
        <Button variant="text" onClick={onClose}>
          Keep
        </Button>
        <Button
          variant="danger"
          icon="delete"
          onClick={() => {
            removeAccount(account.id);
            toast({ message: `${name} removed.` });
            onClose();
          }}
        >
          Remove
        </Button>
      </div>
    </Modal>
  );
}
