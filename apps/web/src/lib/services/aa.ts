import { AA_PURPOSE, consentRequest, todayIso } from "@arthmitra/engine";
import type { AaConsentDetail, Transaction } from "@arthmitra/schema";
import { DEMO_AA_NAME, mockHistory, type HistoryKind } from "@arthmitra/seed";

/**
 * RBI Account Aggregator: consent, then transaction history. MOCKED — the consent screen is
 * real, but approving returns sample transactions. Live, ArthMitra (or a regulated partner,
 * the FIU) integrates with a licensed AA through a technology provider; the AA sends the
 * same ReBIT-format data that readDepositData already reads.
 */
export interface AaConsentSummary {
  aaName: string;
  detail: AaConsentDetail;
  /** Plain-language lines for the consent screen. */
  what: string;
  howLong: string;
  purpose: string;
  historyMonths: number;
}

export interface AccountAggregatorService {
  readonly live: boolean;
  /** What will be asked for, shown before the user approves. */
  consentFor(historyMonths: number): AaConsentSummary;
  /** After approval: the history for one account. */
  fetchHistory(args: { accountId: string; months: number; kind: HistoryKind }): Promise<Transaction[]>;
}

export const mockAa: AccountAggregatorService = {
  live: false,
  consentFor(historyMonths) {
    const now = new Date().toISOString();
    const detail = consentRequest(todayIso(), now);
    return {
      aaName: DEMO_AA_NAME,
      detail,
      what: "Account summary and transactions of your savings account. Never your bank password, PIN or profile.",
      howLong: `${historyMonths} months of past transactions, then new ones once an hour, for 12 months. Revoke any time.`,
      purpose: `${AA_PURPOSE.text} (RBI purpose code ${AA_PURPOSE.code}).`,
      historyMonths,
    };
  },
  async fetchHistory({ accountId, months, kind }) {
    await new Promise((r) => setTimeout(r, 1200));
    return mockHistory({ kind, months, today: todayIso(), accountId, nowIso: new Date().toISOString(), seed: accountId.length * 7 });
  },
};

export const aa: AccountAggregatorService = mockAa;
