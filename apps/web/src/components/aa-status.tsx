"use client";

import type { AppData } from "@arthmitra/schema";
import { agoLabel, inLabel, lastAaUpdate, nextFetchAt, useNow } from "@/lib/aa-sync";
import { Card, Icon, LinkButton } from "@/components/ui";

/**
 * RBI Account Aggregator notice with the last update right below it, or a link button when
 * nothing is linked yet. Fetching runs on its own (useAaAutoSync in the app shell).
 */
export function AaStatus({ data, compact }: { data: AppData; compact?: boolean }) {
  const now = useNow();
  const live = data.aaConsents.filter((c) => c.status === "active" || c.status === "paused");
  if (live.length === 0 && compact) return null;
  const last = lastAaUpdate(data);
  const next = live
    .map(nextFetchAt)
    .filter((t): t is number => t !== null)
    .reduce<number | null>((soonest, t) => (soonest === null || t < soonest ? t : soonest), null);
  const allPaused = live.every((c) => c.status === "paused");

  const updated = !live.length ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="flex items-center gap-1.5 text-xs text-on-surface-variant">
        <Icon name="sync_disabled" className="text-[16px]" />
        Not connected yet — payments are only the ones you add or upload.
      </p>
      <LinkButton href="/link-bank" variant="tonal" icon="link">
        Link with Account Aggregator
      </LinkButton>
    </div>
  ) : (
    <p role="status" className="flex flex-wrap items-center gap-x-1.5 text-xs text-on-surface-variant">
      <Icon name={allPaused ? "pause_circle" : "sync"} className="text-[16px]" />
      <span>
        Last updated <span className="font-semibold text-on-surface">{last ? agoLabel(last, now) : "not yet"}</span>
      </span>
      <span aria-hidden>·</span>
      <span>{allPaused ? "Paused — resume a consent to get new payments" : `Updates on its own, next check ${next === null ? "soon" : inLabel(next, now)}`}</span>
    </p>
  );

  if (compact) return updated;

  return (
    <Card className="bg-surface-container">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
          <Icon name="verified_user" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{live.length ? "Connected through RBI’s Account Aggregator network" : "Get payments automatically through RBI’s Account Aggregator network"}</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-on-surface-variant">
            <li>Account Aggregators are licensed and regulated by the Reserve Bank of India (NBFC-AA).</li>
            <li>Your bank shares data only with your consent, encrypted end to end. The AA itself can&apos;t read it.</li>
            <li>ArthMitra gets only balance and transactions, for the purpose and period you approved.</li>
            <li>You can pause or revoke the consent at any time, here or in your AA&apos;s app.</li>
          </ul>
          <div className="mt-3 border-t border-outline-variant/60 pt-3">{updated}</div>
        </div>
      </div>
    </Card>
  );
}
