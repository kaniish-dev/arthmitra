import {
  addDays,
  addMonths,
  budgetLevel,
  categoriseByRules,
  categoryIdFromName,
  categoryName,
  consentRequest,
  decide,
  dedupeKey,
  findInvestmentDebit,
  findTransferCounterpart,
  formatINR,
  isSpending,
  matchLoanReturn,
  monthKey,
  normalizeMerchant,
  outstandingPaise,
  predictSorter,
  readDepositData,
  savedForGoal,
  sortExamples,
  splitEqually,
  todayIso,
  trainSorter,
  unusualPayment,
  withSortPrediction,
  type StatementRow,
} from "@arthmitra/engine";
import type {
  AaConsent,
  Account,
  AppData,
  AppNotification,
  AppSettings,
  ConsentPurpose,
  FixedExpense,
  Goal,
  GoalFunding,
  GoalPath,
  GoalPlan,
  Guardian,
  Holding,
  InstrumentType,
  Investment,
  InvestmentAccount,
  Loan,
  LoanReturn,
  Profile,
  Registration,
  RiskComfort,
  Split,
  Timeline,
  Transaction,
  TxnSource,
} from "@arthmitra/schema";
import {
  DEMO_AA_NAME,
  DEMO_GOAL_ID,
  NOTICE_VERSION,
  SCRIPTED_PAYMENTS,
  demoBankHistory,
  demoFiData,
  demoOnboarded,
  emptyData,
  linkedAccount,
  personaData,
  profileFromHistory,
  type PersonaId,
} from "@arthmitra/seed";
import { ALLOCATION_CONFIG } from "@/config/plan";
import { shortId } from "./ids";
import { clearData, getData, setData, update } from "./store";

/**
 * Demo-mode actions. Each mirrors a Cloud Function or client write from the build
 * workflow, so the Firebase version can replace them one by one.
 */

export const newId = (prefix: string) => `${prefix}-${shortId()}`;
const now = () => new Date().toISOString();
const today = () => todayIso();

const POINTS_PER_SORT = 10;

function notify(d: AppData, type: AppNotification["type"], message: string, txnId?: string): AppData {
  const n: AppNotification = { id: newId("n"), type, message, read: false, createdAt: now(), ...(txnId ? { txnId } : {}) };
  return { ...d, notifications: [n, ...d.notifications].slice(0, 50) };
}

/**
 * Bell alert when a payment this month pushes its category past 80% or 100% of its budget
 * (the category's limit, else the user's onboarding estimate).
 */
function budgetAlert(d: AppData, txn: Transaction): AppData {
  if (!d.profile || !txn.category || txn.status !== "categorised" || !isSpending(txn) || monthKey(txn.date) !== monthKey(today())) return d;
  const category = d.categories.find((c) => c.id === txn.category);
  const budget = category?.monthlyLimitPaise ?? d.profile.estimatedSpend[txn.category] ?? 0;
  if (!category || budget <= 0) return d;
  const before = d.transactions
    .filter((t) => t.id !== txn.id && t.category === txn.category && isSpending(t) && monthKey(t.date) === monthKey(txn.date))
    .reduce((sum, t) => sum - t.amountPaise, 0);
  const after = before - txn.amountPaise;
  const level = budgetLevel(after, budget);
  if (level === "ok" || level === budgetLevel(before, budget)) return d;
  return notify(
    d,
    "budget",
    level === "over"
      ? `${category.name} is over its ${formatINR(budget)} budget this month (${formatINR(after)} spent).`
      : `${category.name} has used ${Math.round((after / budget) * 100)}% of its ${formatINR(budget)} budget this month.`,
  );
}

function byNewest(a: Transaction, b: Transaction) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

// ---------- Session ----------

export function startDemo() {
  setData(demoOnboarded(today(), now()));
}

export function startFresh() {
  setData(emptyData());
}

export function deleteEverything() {
  clearData();
}

export function exportJson(): string {
  return JSON.stringify({ exportedAt: now(), ...getData() }, null, 2);
}

// ---------- Onboarding ----------

export interface OnboardingInput {
  name: string;
  monthlyIncomePaise: number;
  otherIncomePaise: number;
  fixedExpenses: FixedExpense[];
  estimatedSpend: Record<string, number>;
  riskComfort: RiskComfort;
  goal: Pick<Goal, "name" | "kind" | "targetPaise" | "targetDate">;
  aiConsent: boolean;
}

export function completeOnboarding(input: OnboardingInput) {
  update((d) => {
    const profile: Profile = {
      name: input.name,
      // Under-18 accounts stay under-18 when they edit their plan.
      is18Plus: d.profile?.is18Plus ?? true,
      monthlyIncomePaise: input.monthlyIncomePaise,
      otherIncomePaise: input.otherIncomePaise,
      fixedExpenses: input.fixedExpenses.filter((f) => f.amountPaise > 0),
      estimatedSpend: input.estimatedSpend,
      riskComfort: input.riskComfort,
      points: d.profile?.points ?? 0,
      streak: d.profile?.streak ?? 0,
      lastSortDate: d.profile?.lastSortDate ?? null,
      badges: d.profile?.badges ?? [],
      createdAt: d.profile?.createdAt ?? now(),
    };
    const goal: Goal = {
      id: d.goals[0]?.id ?? newId("goal"),
      ...input.goal,
      monthlyContributionPaise: null,
      risk: input.riskComfort,
      status: "active",
      createdAt: now(),
    };
    return {
      ...d,
      profile,
      goals: [goal, ...d.goals.slice(1)],
      consents: [
        ...d.consents,
        { id: newId("consent"), purpose: "ai_processing", granted: input.aiConsent, noticeVersion: NOTICE_VERSION, createdAt: now() },
      ],
      settings: { ...d.settings, aiEnabled: input.aiConsent },
    };
  });
}

// ---------- Sign-up (basic details → KYC → bank link) ----------

export interface SignupInput {
  name: string;
  dob: string;
  email: string | null;
  /** 10 digits, without +91. */
  mobile: string;
  isMinor: boolean;
  /** Masked already: the raw PAN and Aadhaar never reach the store. */
  kyc: { panMasked: string; aadhaarLast4: string };
  guardian: { name: string; relation: Guardian["relation"] } | null;
  bank: { holderName: string; accountLast4: string; ifsc: string; bankName: string; branch: string };
  history: { source: "aa"; txns: Transaction[]; consent: AaConsent["detail"] } | { source: "statement"; rows: StatementRow[] };
}

/**
 * Ends sign-up: saves the registration (only masked IDs), the bank account, its history from
 * the AA or the uploaded statement, and a profile read from that history.
 */
export function completeSignup(input: SignupInput): ImportSummary {
  const summary: ImportSummary = { added: 0, duplicates: 0, toInbox: 0 };
  update((current) => {
    const at = now();
    const accountId = `acc-${input.bank.accountLast4}-${input.bank.ifsc.slice(0, 4).toLowerCase()}`;
    const aaConsentId = input.history.source === "aa" ? newId("aac") : null;
    const account: Account = {
      ...linkedAccount({ id: accountId, bankName: input.bank.bankName, last4: input.bank.accountLast4, holderName: input.bank.holderName, openingBalancePaise: 0 }),
      source: input.history.source === "aa" ? "simulated" : "csv",
      aaConsentId,
      consentExpiry: input.history.source === "aa" ? input.history.consent.consentExpiry.slice(0, 10) : null,
    };
    const registration: Registration = {
      name: input.name,
      dob: input.dob,
      email: input.email,
      mobile: `+91${input.mobile}`,
      isMinor: input.isMinor,
      kycStatus: "verified",
      panMasked: input.isMinor ? null : input.kyc.panMasked,
      aadhaarLast4: input.isMinor ? null : input.kyc.aadhaarLast4,
      guardian: input.guardian ? { ...input.guardian, panMasked: input.kyc.panMasked, aadhaarLast4: input.kyc.aadhaarLast4, consentedAt: at } : null,
      bank: { ...input.bank, historySource: input.history.source, accountId },
      kycProvider: "demo",
      completedAt: at,
    };
    let d: AppData = {
      ...current,
      registration,
      accounts: [...current.accounts.filter((a) => a.id !== accountId), account],
      consents: [...current.consents, { id: newId("consent"), purpose: "bank_data", granted: true, noticeVersion: NOTICE_VERSION, createdAt: at }],
      // No AI profiling of children's spending (DPDP Act, section 9).
      settings: input.isMinor ? { ...current.settings, aiEnabled: false } : current.settings,
    };
    if (input.history.source === "aa") {
      const existing = new Set(d.transactions.map((t) => t.dedupeKey));
      // The AA fetch ran before the account id existed; file its rows under it.
      const fresh = input.history.txns
        .map((t) => ({ ...t, id: `${accountId}-${t.id}`, accountId, dedupeKey: `${accountId}|${t.dedupeKey}` }))
        .filter((t) => !existing.has(t.dedupeKey));
      summary.added = fresh.length;
      d = {
        ...d,
        transactions: [...d.transactions, ...fresh].sort(byNewest),
        aaConsents: [
          ...d.aaConsents,
          { id: aaConsentId!, aaName: DEMO_AA_NAME, status: "active", detail: input.history.consent, accountIds: [accountId], lastFetchedAt: at, createdAt: at },
        ],
      };
    } else {
      d = ingestRows(d, accountId, input.history.rows, "csv", summary);
    }
    // A balance that makes sense: what the history leaves plus a little.
    const net = d.transactions.filter((t) => t.accountId === accountId).reduce((s, t) => s + t.amountPaise, 0);
    d = { ...d, accounts: d.accounts.map((a) => (a.id === accountId ? { ...a, openingBalancePaise: Math.max(0, 1_000_000 - net) } : a)) };
    const profile = profileFromHistory({ name: input.name, isMinor: input.isMinor, txns: d.transactions, today: today(), nowIso: at });
    return { ...d, profile: d.profile ? { ...profile, points: d.profile.points, badges: d.profile.badges, streak: d.profile.streak } : profile };
  });
  return summary;
}

/** One-tap demo login: a fully onboarded persona (salaried 24-year-old, or 16-year-old with a guardian). */
export function startPersona(id: PersonaId) {
  setData(personaData(id, today(), now(), ALLOCATION_CONFIG.returnsPct));
}

export function updateProfile(patch: Partial<Profile>) {
  update((d) => (d.profile ? { ...d, profile: { ...d.profile, ...patch } } : d));
}

// ---------- Bank linking (Account Aggregator) ----------

/** New payments are fetched only while the account's AA consent is active. */
export function canFetch(d: AppData, account: Account): boolean {
  if (account.status !== "active") return false;
  if (!account.aaConsentId) return true;
  return d.aaConsents.find((c) => c.id === account.aaConsentId)?.status === "active";
}

/**
 * Demo AA: the user approved the consent for these accounts on the simulated AA page,
 * and the first fetch brings the fictional history (already sorted, as for a returning user).
 * A new link replaces the earlier demo consent.
 */
export function linkDemoAa(accountIds: string[]): AaConsent | null {
  if (!accountIds.length) return null;
  const picked = new Set(accountIds);
  const consent: AaConsent = {
    id: newId("aac"),
    aaName: DEMO_AA_NAME,
    status: "active",
    detail: consentRequest(today(), now()),
    accountIds,
    lastFetchedAt: now(),
    createdAt: now(),
  };
  update((d) => {
    const history = demoBankHistory(today(), now());
    const goalId = d.goals[0]?.id ?? null;
    const isDemoGoal = goalId === DEMO_GOAL_ID;
    const existing = new Set(d.transactions.map((t) => t.dedupeKey));
    const fetched = history.transactions
      .filter((t) => t.accountId && picked.has(t.accountId) && !existing.has(t.dedupeKey))
      .map((t) => (t.isInvestment ? { ...t, goalId: isDemoGoal ? goalId : null } : t));
    const linked = history.accounts
      .filter((a) => picked.has(a.id))
      .map((a) => ({ ...a, status: "active" as const, aaConsentId: consent.id, consentExpiry: consent.detail.consentExpiry.slice(0, 10) }));
    const rdAccount = history.transactions.find((t) => t.id === history.investments[0]?.matchedTxnId)?.accountId;
    return {
      ...d,
      accounts: [
        ...d.accounts.filter((a) => !picked.has(a.id)).map((a) => (a.source === "simulated" ? { ...a, status: "revoked" as const } : a)),
        ...linked,
      ],
      transactions: [...d.transactions, ...fetched].sort(byNewest),
      investments:
        isDemoGoal && rdAccount && picked.has(rdAccount) ? [...d.investments.filter((i) => i.id !== "inv-rd-1"), ...history.investments] : d.investments,
      aaConsents: [...d.aaConsents.map((c) => (c.aaName === DEMO_AA_NAME && c.status !== "revoked" ? { ...c, status: "revoked" as const } : c)), consent],
      consents: [
        ...d.consents,
        { id: newId("consent"), purpose: "bank_data", granted: true, noticeVersion: NOTICE_VERSION, createdAt: now() },
      ],
    };
  });
  return consent;
}

/**
 * Removes a bank account and the payments that came from it. Splits of those payments go
 * too; loans and investments keep their record but lose the link to the payment. An AA
 * account also leaves its consent, and a consent with no accounts left is revoked.
 */
export function removeAccount(accountId: string) {
  update((d) => {
    const account = d.accounts.find((a) => a.id === accountId);
    if (!account) return d;
    const gone = new Set(d.transactions.filter((t) => t.accountId === accountId).map((t) => t.id));
    const unlink = (id: string | null) => (id && gone.has(id) ? null : id);
    const aaConsents = d.aaConsents.map((c) => {
      if (!c.accountIds.includes(accountId)) return c;
      const accountIds = c.accountIds.filter((id) => id !== accountId);
      return { ...c, accountIds, status: accountIds.length ? c.status : ("revoked" as const) };
    });
    const hadBankData = d.aaConsents.some((c) => c.status === "active" || c.status === "paused");
    const hasBankData = aaConsents.some((c) => c.status === "active" || c.status === "paused");
    return {
      ...d,
      accounts: d.accounts.filter((a) => a.id !== accountId),
      transactions: d.transactions.filter((t) => !gone.has(t.id)),
      splits: d.splits.filter((sp) => !gone.has(sp.txnId)),
      loans: d.loans.map((l) => ({ ...l, txnId: unlink(l.txnId), returns: l.returns.map((r) => ({ ...r, txnId: unlink(r.txnId) })) })),
      investments: d.investments.map((i) => ({ ...i, matchedTxnId: unlink(i.matchedTxnId) })),
      aaConsents,
      consents:
        hadBankData && !hasBankData
          ? [...d.consents, { id: newId("consent"), purpose: "bank_data", granted: false, noticeVersion: NOTICE_VERSION, createdAt: now() }]
          : d.consents,
    };
  });
}

/** Pausing stops fetches until resumed; revoking ends the consent and disconnects its accounts. */
export function setAaConsentStatus(consentId: string, status: "active" | "paused" | "revoked") {
  update((d) => {
    const consent = d.aaConsents.find((c) => c.id === consentId);
    if (!consent || consent.status === "revoked" || consent.status === "expired") return d;
    const aaConsents = d.aaConsents.map((c) => (c.id === consentId ? { ...c, status } : c));
    if (status !== "revoked") return { ...d, aaConsents };
    const anyLeft = aaConsents.some((c) => c.status === "active" || c.status === "paused");
    return {
      ...d,
      aaConsents,
      accounts: d.accounts.map((a) => (consent.accountIds.includes(a.id) ? { ...a, status: "revoked" as const } : a)),
      consents: anyLeft
        ? d.consents
        : [...d.consents, { id: newId("consent"), purpose: "bank_data", granted: false, noticeVersion: NOTICE_VERSION, createdAt: now() }],
    };
  });
}

/**
 * Periodic fetch (fetchAaData in the build workflow). The demo AA has nothing new until a
 * payment is simulated, so this only records the check.
 */
export function fetchAaNow(consentId: string): number {
  update((d) => ({
    ...d,
    aaConsents: d.aaConsents.map((c) => (c.id === consentId && c.status === "active" ? { ...c, lastFetchedAt: now() } : c)),
  }));
  return 0;
}

// ---------- Ingest pipeline (mirrors onTransactionCreated) ----------

export interface NewTxn {
  accountId: string | null;
  date: string;
  amountPaise: number;
  merchantRaw: string;
  source: TxnSource;
  reference: string;
  note?: string | null;
  /** A category the user picked themselves (cash / bill forms). */
  category?: string | null;
  billId?: string | null;
}

/** Pure step: dedupe → categorise → investment match → transfer check → notify. */
function ingest(d: AppData, input: NewTxn): { data: AppData; txn: Transaction | null } {
  const key = dedupeKey({ accountId: input.accountId, date: input.date, amountPaise: input.amountPaise, reference: input.reference });
  if (d.transactions.some((t) => t.dedupeKey === key)) return { data: d, txn: null };

  const merchantKey = normalizeMerchant(input.merchantRaw);
  const threshold = d.settings.confidenceThreshold;
  const known = d.categories.map((c) => c.id);
  const rules = input.category
    ? decide(input.category, 1, [], threshold, "user_rule")
    : categoriseByRules(merchantKey, input.amountPaise, {
        userRules: Object.fromEntries(d.merchantRules.map((r) => [r.merchantKey, r.category])),
        cache: d.merchantCache,
        threshold,
        known,
      });
  // Smart sorting retrains on the user's sorted payments each time; a few hundred shops take milliseconds.
  const result =
    rules.via === "none" && input.amountPaise < 0
      ? withSortPrediction(rules, predictSorter(trainSorter(sortExamples(d.transactions, known), known), merchantKey), threshold)
      : rules;

  let txn: Transaction = {
    id: newId("t"),
    accountId: input.accountId,
    date: input.date,
    amountPaise: input.amountPaise,
    merchantRaw: input.merchantRaw,
    merchantKey,
    category: result.category,
    confidence: result.confidence,
    suggestions: result.suggestions,
    status: result.status,
    source: input.source,
    isTransfer: result.category === "transfer",
    transferSuggested: false,
    isInvestment: result.category === "investment",
    goalId: null,
    billId: input.billId ?? null,
    note: input.note ?? null,
    dedupeKey: key,
    createdAt: now(),
  };
  let next: AppData = d;

  if (result.via === "keyword" && result.category) {
    next = { ...next, merchantCache: { ...next.merchantCache, [merchantKey]: { category: result.category, confidence: result.confidence } } };
  }

  // A paid investment waiting for its bank debit.
  if (txn.amountPaise < 0 && txn.source !== "cash") {
    const waiting = next.investments.find((i) => i.status === "paid" && findInvestmentDebit(i, [txn]));
    if (waiting) {
      txn = { ...txn, isInvestment: true, category: "investment", status: "categorised", confidence: 1, suggestions: [], goalId: waiting.goalId };
      next = confirmInvestmentWith(next, waiting.id, txn.id);
    }
  }

  // Money lent coming back: the person's name is in the narration and the amount fits.
  if (txn.amountPaise > 0 && !txn.isTransfer && txn.source !== "cash" && txn.category !== "income") {
    const loan = matchLoanReturn(next.loans, txn);
    if (loan) {
      txn = asLent(txn);
      next = withReturn(next, loan.id, txn.amountPaise, txn.date, txn.id);
      next = notify(next, "loan", `${formatINR(txn.amountPaise)} is back from ${loan.person}. Open Lent money to see where it should go.`);
    }
  }

  // Own-account transfer suggestion.
  if (!txn.isInvestment && !txn.isTransfer && txn.category !== "lent") {
    const counterpart = findTransferCounterpart(txn, next.transactions);
    if (counterpart) {
      txn = { ...txn, transferSuggested: true };
      next = {
        ...next,
        transactions: next.transactions.map((t) => (t.id === counterpart.id ? { ...t, transferSuggested: true } : t)),
      };
      next = notify(next, "transfer", `${formatINR(Math.abs(txn.amountPaise))} looks like a transfer between your own accounts.`);
    }
  }

  if (txn.status === "uncategorised") {
    next = notify(next, "uncategorised", `${formatINR(Math.abs(txn.amountPaise))} at "${input.merchantRaw}" needs a category.`);
  }
  const odd = unusualPayment(txn, next.transactions);
  if (odd) {
    next = notify(
      next,
      "unusual",
      `Was this you? ${formatINR(-txn.amountPaise)} at "${input.merchantRaw}" is about ${odd.times}× your usual ${categoryName(next.categories, txn.category)} payment of ${formatINR(odd.usualPaise)}. A party or a big day is fine — tap "This was me". If you didn't make it, call 1930 now.`,
      txn.id,
    );
  }
  next = budgetAlert(next, txn);

  return { data: { ...next, transactions: [txn, ...next.transactions].sort(byNewest) }, txn };
}

export function addTransaction(input: NewTxn): Transaction | null {
  let created: Transaction | null = null;
  update((d) => {
    const r = ingest(d, input);
    created = r.txn;
    return r.data;
  });
  return created;
}

export interface ImportSummary {
  added: number;
  duplicates: number;
  toInbox: number;
}

/** Statement rows through the ingest pipeline; the reference keeps a re-fetch from duplicating. */
function ingestRows(d: AppData, accountId: string, rows: StatementRow[], source: TxnSource, summary: ImportSummary): AppData {
  let next = d;
  for (const row of rows) {
    const r = ingest(next, {
      accountId,
      date: row.date,
      amountPaise: row.amountPaise,
      merchantRaw: row.description,
      source,
      reference: row.reference || `${row.date}|${row.description}|${row.amountPaise}`,
    });
    if (!r.txn) summary.duplicates++;
    else {
      summary.added++;
      if (r.txn.status === "uncategorised") summary.toInbox++;
    }
    next = r.data;
  }
  return next;
}

/**
 * One account's decrypted FI data from any AA (onAaDataReady in the build workflow).
 * Every bank sends the same ReBIT format, so there is one reader for all of them.
 */
export function ingestAaData(accountId: string, payload: unknown): ImportSummary & { skipped: number } {
  const statement = readDepositData(payload);
  const summary = { added: 0, duplicates: 0, toInbox: 0, skipped: statement.skipped };
  update((d) => {
    const account = d.accounts.find((a) => a.id === accountId);
    if (!account || !canFetch(d, account)) return d;
    const next = ingestRows(d, accountId, statement.rows, "bank", summary);
    return {
      ...next,
      aaConsents: next.aaConsents.map((c) => (c.id === account.aaConsentId && c.status === "active" ? { ...c, lastFetchedAt: now() } : c)),
    };
  });
  return summary;
}

/**
 * Demo panel: the simulated AA delivers one scripted UPI payment in ReBIT format, and it
 * goes through the same reader and pipeline a real fetch would. Null while consent is paused.
 */
export function simulatePayment(scriptId: string): Transaction | null {
  const script = SCRIPTED_PAYMENTS.find((s) => s.id === scriptId);
  const d = getData();
  const account = d.accounts.find((a) => canFetch(d, a));
  if (!script || !account) return null;
  const balance =
    account.openingBalancePaise + d.transactions.filter((t) => t.accountId === account.id).reduce((sum, t) => sum + t.amountPaise, 0) + script.amountPaise;
  const known = new Set(d.transactions.map((t) => t.id));
  ingestAaData(
    account.id,
    demoFiData(account, balance, [{ txnId: `${script.id}-${Date.now()}`, date: today(), amountPaise: script.amountPaise, narration: script.merchantRaw }]),
  );
  return getData().transactions.find((t) => !known.has(t.id)) ?? null;
}

/**
 * Adds an uploaded statement's rows to the account with the same last 4 digits (an account
 * added by hand before becomes a statement account), or to a new statement account.
 * AA-linked accounts are left alone: their payments come from the AA.
 */
export function importStatement(args: { bankName: string; last4: string; rows: StatementRow[] }): ImportSummary {
  const summary: ImportSummary = { added: 0, duplicates: 0, toInbox: 0 };
  update((d) => {
    const existing = d.accounts.find((a) => a.status === "active" && a.last4 === args.last4 && (a.source === "manual" || a.source === "csv"));
    const accountId = existing?.id ?? `acc-csv-${args.last4}`;
    const next: AppData = existing
      ? { ...d, accounts: d.accounts.map((a) => (a.id === existing.id ? { ...a, source: "csv" as const } : a)) }
      : d.accounts.some((a) => a.id === accountId)
        ? d
        : {
            ...d,
            accounts: [
              ...d.accounts,
              {
                id: accountId,
                bankName: args.bankName,
                type: "savings",
                last4: args.last4,
                source: "csv",
                aaConsentId: null,
                consentExpiry: null,
                openingBalancePaise: 0,
                status: "active",
              },
            ],
          };
    return ingestRows(next, accountId, args.rows, "csv", summary);
  });
  return summary;
}

// ---------- Sorting ----------

function withSortReward(d: AppData, sorted: number): AppData {
  if (!d.profile || sorted === 0) return d;
  const t = today();
  const p = d.profile;
  const streak = p.lastSortDate === t ? p.streak : p.lastSortDate === addDays(t, -1) ? p.streak + 1 : 1;
  const badges = new Set(p.badges);
  const left = d.transactions.filter((x) => x.status === "uncategorised").length;
  let next: AppData = { ...d, profile: { ...p, points: p.points + sorted * POINTS_PER_SORT, streak, lastSortDate: t } };
  const award = (badge: string) => {
    if (!badges.has(badge)) {
      badges.add(badge);
      next = notify(next, "badge", `Badge earned: ${badge}`);
    }
  };
  if (left === 0) award("Inbox zero");
  if (streak >= 7) award("7-day streak");
  return { ...next, profile: { ...next.profile!, badges: [...badges] } };
}

/** User picks a category (inbox, sort game or one-tap edit on any row). */
export function setCategory(txnId: string, category: string) {
  update((d) => {
    const txn = d.transactions.find((t) => t.id === txnId);
    if (!txn) return d;
    const sorted: Transaction = {
      ...txn,
      category,
      status: "categorised",
      confidence: 1,
      suggestions: [],
      isTransfer: category === "transfer",
      isInvestment: category === "investment" || (txn.isInvestment && category === txn.category),
    };
    let next: AppData = { ...d, transactions: d.transactions.map((t) => (t.id === txnId ? sorted : t)) };
    if (txn.status === "uncategorised" || txn.category !== category) next = budgetAlert(next, sorted);
    return withSortReward(next, txn.status === "uncategorised" ? 1 : 0);
  });
}

/** "Always use Food for this merchant": saves a rule and sorts the merchant's other inbox items. */
export function rememberMerchant(merchantKey: string, category: string) {
  update((d) => {
    const pending = d.transactions.filter((t) => t.merchantKey === merchantKey && t.status === "uncategorised").length;
    const next: AppData = {
      ...d,
      merchantRules: [...d.merchantRules.filter((r) => r.merchantKey !== merchantKey), { merchantKey, category, createdFrom: "correction" }],
      transactions: d.transactions.map((t) =>
        t.merchantKey === merchantKey && t.status === "uncategorised"
          ? { ...t, category, status: "categorised", confidence: 1, suggestions: [] }
          : t,
      ),
    };
    return withSortReward(next, pending);
  });
}

// ---------- Splits ----------

/** Splits a payment equally between you and friends. ArthMitra only records it; it never asks anyone for money. */
export function createSplit(txnId: string, friendNames: string[]): Split | null {
  let created: Split | null = null;
  update((d) => {
    const txn = d.transactions.find((t) => t.id === txnId);
    if (!txn || txn.amountPaise >= 0 || friendNames.length === 0) return d;
    const shares = splitEqually(-txn.amountPaise, friendNames.length + 1);
    const split: Split = {
      id: newId("split"),
      txnId,
      totalPaise: -txn.amountPaise,
      yourSharePaise: shares[0]!,
      people: friendNames.map((name, i) => ({ id: newId("p"), name: name.trim() || `Friend ${i + 1}`, sharePaise: shares[i + 1]!, settled: false })),
      createdAt: now(),
    };
    created = split;
    return { ...d, splits: [split, ...d.splits.filter((s) => s.txnId !== txnId)] };
  });
  return created;
}

export function setSplitSettled(splitId: string, personId: string, settled: boolean) {
  update((d) => ({
    ...d,
    splits: d.splits.map((s) => (s.id === splitId ? { ...s, people: s.people.map((p) => (p.id === personId ? { ...p, settled } : p)) } : s)),
  }));
}

export function deleteSplit(splitId: string) {
  update((d) => ({ ...d, splits: d.splits.filter((s) => s.id !== splitId) }));
}

/** Free-text note on a payment; like category and status, a field the client may edit. */
export function setNote(txnId: string, note: string) {
  update((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === txnId ? { ...t, note: note.trim() || null } : t)) }));
}

export function deleteMerchantRule(merchantKey: string) {
  update((d) => ({ ...d, merchantRules: d.merchantRules.filter((r) => r.merchantKey !== merchantKey) }));
}

export function answerTransfer(txnId: string, isTransfer: boolean) {
  update((d) => {
    const txn = d.transactions.find((t) => t.id === txnId);
    if (!txn) return d;
    const counterpart = findTransferCounterpart({ ...txn, transferSuggested: false }, d.transactions);
    const ids = new Set([txnId, ...(counterpart ? [counterpart.id] : [])]);
    return {
      ...d,
      transactions: d.transactions.map((t) =>
        ids.has(t.id)
          ? isTransfer
            ? { ...t, isTransfer: true, transferSuggested: false, category: "transfer", status: "categorised", confidence: 1, suggestions: [] }
            : { ...t, transferSuggested: false }
          : t,
      ),
    };
  });
}

export function markNotificationsRead() {
  update((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
}

// ---------- Categories ----------

export function addCategory(name: string): string {
  let id = "";
  update((d) => {
    id = categoryIdFromName(name, d.categories.map((c) => c.id));
    const order = Math.max(...d.categories.filter((c) => !c.system).map((c) => c.order)) + 0.5;
    return {
      ...d,
      categories: [...d.categories, { id, name: name.trim(), icon: "label", monthlyLimitPaise: null, discretionary: false, system: false, order }],
    };
  });
  return id;
}

export function renameCategory(id: string, name: string) {
  update((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id && !c.system ? { ...c, name: name.trim() } : c)) }));
}

export function setCategoryLimit(id: string, monthlyLimitPaise: number | null) {
  update((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, monthlyLimitPaise } : c)) }));
}

/** Moves every transaction, rule and estimate from one category into another, then removes it. */
export function mergeCategory(fromId: string, intoId: string) {
  if (fromId === intoId) return;
  update((d) => {
    const estimates = { ...(d.profile?.estimatedSpend ?? {}) };
    if (estimates[fromId]) {
      estimates[intoId] = (estimates[intoId] ?? 0) + estimates[fromId]!;
      delete estimates[fromId];
    }
    return {
      ...d,
      profile: d.profile ? { ...d.profile, estimatedSpend: estimates } : null,
      categories: d.categories.filter((c) => c.id !== fromId),
      transactions: d.transactions.map((t) => (t.category === fromId ? { ...t, category: intoId } : t)),
      merchantRules: d.merchantRules.map((r) => (r.category === fromId ? { ...r, category: intoId } : r)),
      merchantCache: Object.fromEntries(
        Object.entries(d.merchantCache).map(([k, v]) => [k, v.category === fromId ? { ...v, category: intoId } : v]),
      ),
    };
  });
}

// ---------- Goals and plans ----------

export function updateGoal(id: string, patch: Partial<Pick<Goal, "name" | "targetPaise" | "targetDate" | "monthlyContributionPaise">>) {
  update((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
}

export function addGoal(goal: Pick<Goal, "name" | "kind" | "targetPaise" | "targetDate">): string {
  const id = newId("goal");
  update((d) => ({
    ...d,
    goals: [
      { id, ...goal, monthlyContributionPaise: null, risk: d.profile?.riskComfort ?? "medium", status: "active", createdAt: now() },
      ...d.goals,
    ],
  }));
  return id;
}

export function savePlan(goalId: string, chosenTypes: InstrumentType[], lowPct: number | null, highPct: number | null) {
  update((d) => ({
    ...d,
    plans: [
      ...d.plans.filter((p) => p.goalId !== goalId),
      { id: newId("plan"), goalId, chosenTypes, userReturnLowPct: lowPct, userReturnHighPct: highPct, createdAt: now() },
    ],
  }));
}

// ---------- Investments ----------

export function planInvestment(input: {
  goalId: string;
  instrumentType: InstrumentType;
  platform: string;
  amountPaise: number;
  termMonths: number | null;
}): string {
  const id = newId("inv");
  const date = today();
  const hasTerm = input.instrumentType === "fd" || input.instrumentType === "rd";
  const inv: Investment = {
    id,
    goalId: input.goalId,
    instrumentType: input.instrumentType,
    platform: input.platform,
    amountPaise: input.amountPaise,
    date,
    status: "planned",
    matchedTxnId: null,
    maturityDate: hasTerm && input.termMonths ? addMonths(date, input.termMonths) : null,
    lockInUntil: null,
    exitLoadUntil: input.instrumentType === "liquid" ? addDays(date, 7) : null,
    schemeCode: null,
    units: null,
    currentValuePaise: null,
    createdAt: now(),
  };
  update((d) => ({ ...d, investments: [inv, ...d.investments] }));
  return id;
}

function confirmInvestmentWith(d: AppData, investmentId: string, txnId: string): AppData {
  const inv = d.investments.find((i) => i.id === investmentId);
  if (!inv) return d;
  let next: AppData = {
    ...d,
    investments: d.investments.map((i) => (i.id === investmentId ? { ...i, status: "confirmed", matchedTxnId: txnId } : i)),
  };
  next = notify(next, "investment", `${formatINR(inv.amountPaise)} investment confirmed against your bank debit.`);
  const saved = savedForGoal(next.investments, inv.goalId);
  const goal = next.goals.find((g) => g.id === inv.goalId);
  if (goal && goal.status === "active" && saved >= goal.targetPaise) {
    next = { ...next, goals: next.goals.map((g) => (g.id === goal.id ? { ...g, status: "achieved" } : g)) };
  }
  if (next.profile && saved >= 1_000_000 && !next.profile.badges.includes("First ₹10,000 saved")) {
    next = notify({ ...next, profile: { ...next.profile, badges: [...next.profile.badges, "First ₹10,000 saved"] } }, "badge", "Badge earned: First ₹10,000 saved");
  }
  return next;
}

/** "Did you invest ₹X?" → yes. Matches an existing debit if one is already in the feed. */
export function markInvestmentPaid(id: string, amountPaise: number) {
  update((d) => {
    let next: AppData = { ...d, investments: d.investments.map((i) => (i.id === id ? { ...i, status: "paid", amountPaise } : i)) };
    const inv = next.investments.find((i) => i.id === id)!;
    const debit = findInvestmentDebit(inv, next.transactions);
    if (debit) {
      next = {
        ...next,
        transactions: next.transactions.map((t) =>
          t.id === debit.id
            ? { ...t, isInvestment: true, category: "investment", status: "categorised", confidence: 1, suggestions: [], goalId: inv.goalId }
            : t,
        ),
      };
      next = confirmInvestmentWith(next, id, debit.id);
    }
    return next;
  });
}

/** Demo only: the bank feed delivers the debit for a paid investment. */
export function simulateInvestmentDebit(id: string) {
  const inv = getData().investments.find((i) => i.id === id);
  const account = getData().accounts.find((a) => a.status === "active");
  if (!inv || inv.status !== "paid") return;
  addTransaction({
    accountId: account?.id ?? null,
    date: today(),
    amountPaise: -inv.amountPaise,
    merchantRaw: `ACH/${inv.instrumentType.toUpperCase()} PURCHASE/${inv.platform}`,
    source: "bank",
    reference: `inv-${inv.id}`,
  });
}

export function cancelInvestment(id: string) {
  update((d) => ({ ...d, investments: d.investments.filter((i) => !(i.id === id && i.status === "planned")) }));
}

export function setInvestmentValue(id: string, currentValuePaise: number | null) {
  update((d) => ({ ...d, investments: d.investments.map((i) => (i.id === id ? { ...i, currentValuePaise } : i)) }));
}

// ---------- Settings, consent, partners ----------

export function setSettings(patch: Partial<AppSettings>) {
  update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
}

/** Consent log is append-only; withdrawing stops the related processing. */
export function setConsent(purpose: ConsentPurpose, granted: boolean) {
  update((d) => ({
    ...d,
    consents: [...d.consents, { id: newId("consent"), purpose, granted, noticeVersion: NOTICE_VERSION, createdAt: now() }],
    settings: purpose === "ai_processing" ? { ...d.settings, aiEnabled: granted } : d.settings,
    accounts:
      purpose === "bank_data" && !granted ? d.accounts.map((a) => ({ ...a, status: "revoked" as const })) : d.accounts,
    aaConsents:
      purpose === "bank_data" && !granted
        ? d.aaConsents.map((c) => (c.status === "active" || c.status === "paused" ? { ...c, status: "revoked" as const } : c))
        : d.aaConsents,
  }));
}

// ---------- Money lent ----------

/** A lent payment or a payback: neither spending nor income. */
function asLent(t: Transaction): Transaction {
  return { ...t, category: "lent", status: "categorised", confidence: 1, suggestions: [], transferSuggested: false };
}

/** Back to the inbox when its loan link is removed. */
function unlinked(t: Transaction): Transaction {
  return { ...t, category: null, status: "uncategorised", confidence: null };
}

/** Records money lent. When it went out as a payment, that payment stops counting as spending. */
export function addLoan(input: { person: string; amountPaise: number; date: string; dueDate: string | null; note: string | null; txnId: string | null }): string | null {
  const person = input.person.trim().slice(0, 40);
  if (!person || input.amountPaise <= 0) return null;
  const loan: Loan = {
    id: newId("loan"),
    person,
    amountPaise: input.amountPaise,
    date: input.date,
    dueDate: input.dueDate,
    note: input.note?.trim().slice(0, 80) || null,
    txnId: input.txnId,
    returns: [],
    forgiven: false,
    createdAt: now(),
  };
  update((d) => ({
    ...d,
    loans: [loan, ...d.loans],
    transactions: input.txnId ? d.transactions.map((t) => (t.id === input.txnId ? asLent(t) : t)) : d.transactions,
  }));
  return loan.id;
}

function withReturn(d: AppData, loanId: string, amountPaise: number, date: string, txnId: string | null): AppData {
  const loan = d.loans.find((l) => l.id === loanId);
  const paise = loan ? Math.min(amountPaise, outstandingPaise(loan)) : 0;
  if (!loan || paise <= 0) return d;
  const ret: LoanReturn = { id: newId("ret"), amountPaise: paise, date, txnId, handled: false };
  return {
    ...d,
    loans: d.loans.map((l) => (l.id === loanId ? { ...l, returns: [...l.returns, ret] } : l)),
    transactions: txnId ? d.transactions.map((t) => (t.id === txnId ? asLent(t) : t)) : d.transactions,
  };
}

/** A payback recorded by hand: cash, or a credit picked from the history. */
export function recordReturn(loanId: string, amountPaise: number, date: string, txnId: string | null) {
  update((d) => withReturn(d, loanId, amountPaise, date, txnId));
}

/** The user has acted on the coach plan for this payback. */
export function markReturnHandled(loanId: string, returnId: string) {
  update((d) => ({
    ...d,
    loans: d.loans.map((l) => (l.id === loanId ? { ...l, returns: l.returns.map((r) => (r.id === returnId ? { ...r, handled: true } : r)) } : l)),
  }));
}

/** Removes a payback that was matched wrongly; its credit goes back to the inbox. */
export function undoReturn(loanId: string, returnId: string) {
  update((d) => {
    const ret = d.loans.find((l) => l.id === loanId)?.returns.find((r) => r.id === returnId);
    return {
      ...d,
      loans: d.loans.map((l) => (l.id === loanId ? { ...l, returns: l.returns.filter((r) => r.id !== returnId) } : l)),
      transactions: ret?.txnId ? d.transactions.map((t) => (t.id === ret.txnId ? unlinked(t) : t)) : d.transactions,
    };
  });
}

export function setLoanForgiven(loanId: string, forgiven: boolean) {
  update((d) => ({ ...d, loans: d.loans.map((l) => (l.id === loanId ? { ...l, forgiven } : l)) }));
}

/** Deletes the record; payments linked to it go back to the inbox to be sorted. */
export function deleteLoan(loanId: string) {
  update((d) => {
    const loan = d.loans.find((l) => l.id === loanId);
    const linked = new Set([loan?.txnId, ...(loan?.returns.map((r) => r.txnId) ?? [])].filter(Boolean));
    return {
      ...d,
      loans: d.loans.filter((l) => l.id !== loanId),
      transactions: d.transactions.map((t) => (linked.has(t.id) ? unlinked(t) : t)),
    };
  });
}

export function addPartner(name: string, url: string) {
  update((d) => ({ ...d, partners: [...d.partners, { id: newId("partner"), name: name.trim(), url: url.trim() }] }));
}

export function removePartner(id: string) {
  update((d) => ({ ...d, partners: d.partners.filter((p) => p.id !== id) }));
}

// ---------- Explore → plan (Big Day, Wealth Generator, Crisis Cushion, coach goals) ----------

export interface PlannedGoalInput {
  id?: string;
  name: string;
  kind: Goal["kind"];
  path: GoalPath;
  targetPaise: number;
  targetDate: string;
  risk: RiskComfort;
  timeline: Timeline;
  monthlyExpensesPaise?: number;
  funding?: GoalFunding;
  plan: GoalPlan | null;
}

/** Saves (or updates) a goal with its timeline, risk appetite and investment plan. */
export function savePlannedGoal(input: PlannedGoalInput): string {
  const id = input.id ?? newId("goal");
  update((d) => {
    const before = d.goals.find((g) => g.id === id);
    const goal: Goal = {
      ...(before ?? { status: "active" as const, createdAt: now() }),
      id,
      name: input.name,
      kind: input.kind,
      path: input.path,
      targetPaise: input.targetPaise,
      targetDate: input.targetDate,
      risk: input.risk,
      timeline: input.timeline,
      monthlyExpensesPaise: input.monthlyExpensesPaise,
      funding: input.funding ?? before?.funding,
      plan: input.plan,
      monthlyContributionPaise: input.plan?.monthlyPaise ?? null,
    };
    // Wealth Generator is one goal only: a new one replaces the old.
    const others = d.goals.filter((g) => g.id !== id && !(input.path === "wealth" && g.path === "wealth"));
    return { ...d, goals: [goal, ...others] };
  });
  return id;
}

export function deleteGoal(id: string) {
  update((d) => ({
    ...d,
    goals: d.goals.filter((g) => g.id !== id),
    holdings: d.holdings.map((h) => (h.goalId === id ? { ...h, goalId: null } : h)),
  }));
}

/** A small savings goal from a Coach chat ("a fridge in 3 months"), without an investment plan yet. */
export function addCoachGoal(name: string, targetPaise: number, targetDate: string): string {
  return savePlannedGoal({ name, kind: "custom", path: "custom", targetPaise, targetDate, risk: "low", timeline: "short", plan: null });
}

/** Crisis Cushion: N months of expenses, what is set aside so far, and the monthly top-up. */
export function saveCushion(input: { months: number; savedPaise: number; targetPaise: number; monthlyPaise: number; targetDate: string }) {
  update((d) => {
    const before = d.goals.find((g) => g.path === "crisisCushion");
    const goal: Goal = {
      id: before?.id ?? newId("goal"),
      name: "Crisis Cushion",
      kind: "emergency",
      path: "crisisCushion",
      targetPaise: Math.max(1, input.targetPaise),
      targetDate: input.targetDate,
      monthlyContributionPaise: input.monthlyPaise,
      risk: "low",
      cushionMonths: input.months,
      cushionSavedPaise: input.savedPaise,
      status: input.savedPaise >= input.targetPaise ? "achieved" : "active",
      createdAt: before?.createdAt ?? now(),
    };
    return { ...d, goals: [...d.goals.filter((g) => g.id !== goal.id), goal] };
  });
}

// ---------- Portfolio tracking ----------

export function addInvestmentAccount(account: InvestmentAccount) {
  update((d) => ({ ...d, investmentAccounts: [...d.investmentAccounts.filter((a) => a.id !== account.id), account] }));
}

/** Replaces an account's holdings with what the portfolio-tracking API returned. */
export function storeHoldings(accountId: string, holdings: Holding[]) {
  update((d) => ({
    ...d,
    holdings: [...d.holdings.filter((h) => h.accountId !== accountId), ...holdings],
    investmentAccounts: d.investmentAccounts.map((a) => (a.id === accountId ? { ...a, lastSyncedAt: now() } : a)),
  }));
}

export function disconnectInvestmentAccount(accountId: string) {
  update((d) => ({
    ...d,
    investmentAccounts: d.investmentAccounts.filter((a) => a.id !== accountId),
    holdings: d.holdings.filter((h) => h.accountId !== accountId),
  }));
}


// ---------- Unusual payments: "Was this you?" ----------

/**
 * The user confirms an unusual payment was theirs (a party, a birthday, a big day). The alert
 * clears, and the payment counts as normal from now on, so a similar one won't alert again.
 */
export function confirmUnusual(txnId: string) {
  update((d) => ({
    ...d,
    transactions: d.transactions.map((t) => (t.id === txnId ? { ...t, unusualCheck: "confirmed" as const } : t)),
    notifications: d.notifications.filter((n) => !(n.type === "unusual" && n.txnId === txnId)),
  }));
}

/** The user didn't make it: kept on the list, with what to do next on the bell. */
export function reportUnusual(txnId: string) {
  update((d) => {
    const t = d.transactions.find((x) => x.id === txnId);
    if (!t) return d;
    const marked = { ...d, transactions: d.transactions.map((x) => (x.id === txnId ? { ...x, unusualCheck: "reported" as const } : x)) };
    return notify(
      { ...marked, notifications: marked.notifications.filter((n) => !(n.type === "unusual" && n.txnId === txnId)) },
      "unusual",
      `You reported ${formatINR(-t.amountPaise)} at "${t.merchantRaw}" as not yours. Call 1930 (cyber fraud helpline) now and tell your bank to block the card or UPI.`,
    );
  });
}
