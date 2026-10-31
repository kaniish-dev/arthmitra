"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@arthmitra/engine";
import type { ConsentPurpose } from "@arthmitra/schema";
import { addPartner, deleteEverything, exportJson, removePartner, setConsent, setSettings, startDemo } from "@/lib/actions";
import { downloadFile } from "@/lib/files";
import { useAppData } from "@/lib/store";
import { Badge, Button, Card, CardTitle, Icon, ListRow, Modal, PageHeader, TextInput, Toggle } from "@/components/ui";

const CONSENT_LABEL: Record<ConsentPurpose, { title: string; text: string }> = {
  bank_data: { title: "Bank data", text: "Balance and transactions through your Account Aggregator. Withdrawing revokes every AA consent." },
  ai_processing: { title: "AI processing", text: "Shop names, amounts, bill photos and totals go to Gemini to sort and coach — never account numbers. When off, rules and set answers are used." },
};

export function SettingsScreen() {
  const data = useAppData()!;
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerUrl, setPartnerUrl] = useState("");

  const latest = (purpose: ConsentPurpose) => [...data.consents].reverse().find((c) => c.purpose === purpose);

  const download = () => downloadFile(`arthmitra-export-${new Date().toISOString().slice(0, 10)}.json`, exportJson(), "application/json");

  const validUrl = /^https:\/\/[^\s]+\.[^\s]+$/.test(partnerUrl.trim());

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Consent, alerts and your data." back="/profile" />
      <div className="flex flex-col gap-6">
        <Card className="p-3 sm:p-4">
          <ListRow
            href="/accounts"
            icon="account_balance"
            label="Bank accounts and AA consents"
            sub={`${data.accounts.filter((a) => a.status === "active").length} linked · pause, revoke or fetch`}
          />
        </Card>

        <Card>
          <CardTitle icon="verified_user">Consent</CardTitle>
          <ul className="divide-y divide-outline-variant/50">
            {(Object.keys(CONSENT_LABEL) as ConsentPurpose[]).map((purpose) => {
              const c = latest(purpose);
              const granted = c?.granted ?? false;
              return (
                <li key={purpose} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {CONSENT_LABEL[purpose].title}
                      <Badge tone={granted ? "good" : "neutral"}>{granted ? `Given ${formatDate(c!.createdAt.slice(0, 10))}` : "Not given"}</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{CONSENT_LABEL[purpose].text}</p>
                  </div>
                  <Button variant={granted ? "outlined" : "tonal"} className="shrink-0 px-4 py-2" onClick={() => setConsent(purpose, !granted)}>
                    {granted ? "Withdraw" : "Give consent"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-on-surface-variant">Every change is kept in an append-only log ({data.consents.length} entries).</p>
        </Card>

        <Card>
          <CardTitle icon="tune">Alerts and sorting</CardTitle>
          <Toggle label="Daily cash reminder" checked={data.settings.cashReminder} onChange={(v) => setSettings({ cashReminder: v })} />
          <Toggle label="Streak nudges" checked={data.settings.streakNudges} onChange={(v) => setSettings({ streakNudges: v })} />
          <div className="py-2">
            <label htmlFor="threshold" className="flex justify-between text-sm font-medium">
              <span>Auto-sort confidence</span>
              <span className="tabular-nums">{Math.round(data.settings.confidenceThreshold * 100)}%</span>
            </label>
            <input
              id="threshold"
              type="range"
              min={60}
              max={95}
              step={5}
              value={Math.round(data.settings.confidenceThreshold * 100)}
              onChange={(e) => setSettings({ confidenceThreshold: Number(e.target.value) / 100 })}
              className="mt-2 w-full accent-primary"
            />
            <p className="text-xs text-on-surface-variant">Below this, a payment waits in your inbox. Served by Remote Config once Firebase is connected.</p>
          </div>
        </Card>

        <Card>
          <CardTitle icon="open_in_new">“Invest now” links</CardTitle>
          <ul className="mb-4 divide-y divide-outline-variant/50">
            {data.partners.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  {p.name} <span className="break-all text-on-surface-variant">· {p.url}</span>
                </span>
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => removePartner(p.id)} className="rounded-full p-1 hover:bg-on-surface/8">
                  <Icon name="close" className="text-[18px]" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (partnerName.trim() && validUrl) {
                addPartner(partnerName, partnerUrl);
                setPartnerName("");
                setPartnerUrl("");
              }
            }}
          >
            <TextInput label="Name" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="My bank's FD page" />
            <TextInput label="Link (https)" value={partnerUrl} onChange={(e) => setPartnerUrl(e.target.value)} placeholder="https://" />
            <Button type="submit" variant="tonal" icon="add" disabled={!partnerName.trim() || !validUrl}>
              Add
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle icon="database">Your data</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Button variant="outlined" icon="download" onClick={download}>
              Export everything (JSON)
            </Button>
            <Button
              variant="outlined"
              icon="restart_alt"
              onClick={() => {
                startDemo();
                router.push("/link-bank");
              }}
            >
              Reset demo
            </Button>
            <Button variant="danger" icon="delete_forever" onClick={() => setConfirmOpen(true)}>
              Delete everything
            </Button>
          </div>
        </Card>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete everything?">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed !== "DELETE") return;
            deleteEverything();
            router.push("/");
          }}
        >
          <p className="text-sm">This removes your profile, transactions, goals, investments and consent log from this device. It cannot be undone.</p>
          <TextInput label='Type DELETE to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          <button type="submit" disabled={typed !== "DELETE"} className="rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            Delete everything
          </button>
        </form>
      </Modal>
    </div>
  );
}
