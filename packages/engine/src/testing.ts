import type { Transaction } from "@arthmitra/schema";

let n = 0;

/** Test factory: a categorised bank debit unless overridden. */
export function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    accountId: "acc1",
    date: "2026-10-10",
    amountPaise: -10_000,
    merchantRaw: "TEST",
    merchantKey: "test",
    category: "food",
    confidence: 1,
    suggestions: [],
    status: "categorised",
    source: "bank",
    isTransfer: false,
    transferSuggested: false,
    isInvestment: false,
    goalId: null,
    billId: null,
    note: null,
    dedupeKey: `k${n}`,
    createdAt: "2026-10-10T00:00:00.000Z",
    ...overrides,
  };
}
