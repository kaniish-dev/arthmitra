"use client";

import { CYBER_HELPLINE } from "@arthmitra/engine";
import type { Transaction } from "@arthmitra/schema";
import { confirmUnusual, reportUnusual } from "@/lib/actions";
import { Badge, Icon } from "./ui";

/**
 * "Was this you?" answer for an unusual payment. A party or a big day is normal: "This was me"
 * clears the alert and teaches the check. "Not me" keeps it flagged and points to 1930.
 */
export function UnusualAnswer({ txn, onDone }: { txn: Pick<Transaction, "id" | "unusualCheck">; onDone?: () => void }) {
  if (txn.unusualCheck === "reported")
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone="bad" icon="report">
          Reported as not yours
        </Badge>
        <a href={`tel:${CYBER_HELPLINE}`} className="font-semibold text-error underline">
          Call {CYBER_HELPLINE}
        </a>
      </span>
    );
  return (
    <span className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => {
          confirmUnusual(txn.id);
          onDone?.();
        }}
        className="inline-flex items-center gap-1 rounded-full bg-success-container px-3 py-1 text-xs font-semibold text-on-success-container hover:brightness-95"
      >
        <Icon name="check" className="text-[16px]" />
        This was me
      </button>
      <button
        type="button"
        onClick={() => {
          reportUnusual(txn.id);
          onDone?.();
        }}
        className="inline-flex items-center gap-1 rounded-full border border-error/40 px-3 py-1 text-xs font-semibold text-error hover:bg-error/5"
      >
        <Icon name="gpp_bad" className="text-[16px]" />
        Not me
      </button>
    </span>
  );
}
