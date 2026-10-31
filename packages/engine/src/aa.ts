import { AaDepositData, type AaConsentDetail } from "@arthmitra/schema";
import type { StatementRow } from "./csv";
import { addMonths, isValidIso } from "./dates";
import { toPaise } from "./money";

/**
 * Account Aggregator: the consent ArthMitra requests and the reader for the FI data
 * that comes back. Every bank on the AA network sends the same ReBIT format, so this
 * one reader replaces per-bank CSV and PDF parsing.
 */

/** ReBIT purpose code 102. */
export const AA_PURPOSE = { code: "102", text: "Customer spending patterns, budget or other reportings" } as const;
/** History asked for on the first fetch. */
export const AA_HISTORY_MONTHS = 6;
export const AA_CONSENT_MONTHS = 12;

/**
 * Periodic consent for balance and transactions of savings and current accounts only.
 * PROFILE (holder name, PAN, address, email) is never requested.
 */
export function consentRequest(today: string, nowIso: string): AaConsentDetail {
  const expiry = `${addMonths(today, AA_CONSENT_MONTHS)}T23:59:59.000Z`;
  return {
    consentStart: nowIso,
    consentExpiry: expiry,
    consentMode: "STORE",
    fetchType: "PERIODIC",
    consentTypes: ["SUMMARY", "TRANSACTIONS"],
    fiTypes: ["DEPOSIT"],
    purpose: { ...AA_PURPOSE },
    fiDataRange: { from: `${addMonths(today, -AA_HISTORY_MONTHS)}T00:00:00.000Z`, to: expiry },
    dataLife: { unit: "MONTH", value: AA_CONSENT_MONTHS },
    frequency: { unit: "HOUR", value: 1 },
  };
}

export interface AaStatement {
  last4: string;
  type: "savings" | "current";
  /** Balance the bank reported with this fetch; null when the summary was not sent. */
  balancePaise: number | null;
  rows: StatementRow[];
  /** Transactions that could not be read (bad date or amount); counted, never guessed. */
  skipped: number;
}

const IST_OFFSET_MS = 330 * 60_000;

/** Calendar date in India for an ISO timestamp, whatever zone it was written in. */
function istDate(timestamp: string): string | null {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Reads one account's decrypted FI data. Throws when it is not ReBIT deposit data. */
export function readDepositData(input: unknown): AaStatement {
  const parsed = AaDepositData.safeParse(input);
  if (!parsed.success) throw new Error("Not ReBIT deposit data");
  const { account } = parsed.data;
  const last4 = /(\d{4})$/.exec(account.maskedAccNumber)?.[1];
  if (!last4) throw new Error("Masked account number has no last 4 digits");

  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const t of account.transactions.transaction) {
    const date = (t.transactionTimestamp && istDate(t.transactionTimestamp)) || (t.valueDate && isValidIso(t.valueDate) ? t.valueDate : null);
    let paise: number | null = null;
    try {
      paise = Math.abs(toPaise(String(t.amount)));
    } catch {
      paise = null;
    }
    if (!date || !paise) {
      skipped++;
      continue;
    }
    rows.push({
      date,
      description: t.narration?.trim() || `${t.mode ?? "Bank"} ${t.type === "DEBIT" ? "payment" : "credit"}`,
      amountPaise: t.type === "DEBIT" ? -paise : paise,
      reference: t.txnId,
    });
  }

  let balancePaise: number | null = null;
  if (account.summary) {
    try {
      balancePaise = toPaise(String(account.summary.currentBalance));
    } catch {
      balancePaise = null;
    }
  }
  return { last4, type: account.summary?.type?.toUpperCase() === "CURRENT" ? "current" : "savings", balancePaise, rows, skipped };
}
