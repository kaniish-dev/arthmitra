import {
  FIXED_CATEGORY_IDS,
  INSTRUMENT_LABEL,
  addDays,
  addMonths,
  averageByCategory,
  consentRequest,
  daysInMonth,
  dedupeKey,
  monthsBetween,
  normalizeMerchant,
  pastMonthFlows,
  realisticSaving,
  toIso,
} from "@arthmitra/engine";
import type { Account, AppData, Goal, Holding, InvestmentAccount, Loan, Profile, Registration, Transaction } from "@arthmitra/schema";
import { DEMO_AA_NAME, emptyData } from "./index";

/**
 * Mock bank history and the two one-tap demo personas. Every person, number and narration
 * here is fictional. Merchant narrations look like real UPI/POS lines so the categoriser and
 * the dashboard have something realistic to read.
 */

const R = (rupees: number) => Math.round(rupees * 100);

/** Small deterministic random numbers, so the same month always looks the same. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export type HistoryKind = "salaried" | "student";

type Line = [day: number, raw: string, rupees: number, category: string];

function salariedMonth(rand: () => number, monthIndex: number): Line[] {
  const vary = (base: number, spread = 0.35) => Math.round(base * (1 - spread / 2 + rand() * spread));
  const lines: Line[] = [
    [1, "NEFT-SALARY-BRIGHTLEAF SOFTWARE PVT LTD", 58_000, "income"],
    [3, "UPI-RENT-MR ANIL KAPOOR-landlord@okicici", -15_000, "rent"],
    [5, "ACH-PHONE EMI-CONSUMER FINANCE", -2_499, "emi"],
    [6, "BILLPAY-ELECTRICITY BESCOM", -vary(1_100), "bills"],
    [7, "UPI/AIRTEL BROADBAND/airtel@ybl", -699, "bills"],
    [9, "NETFLIX.COM", -649, "subscriptions"],
    [11, "UPI/SPOTIFY/spotify@icici", -119, "subscriptions"],
    [12, "UPI/CULT GYM MEMBERSHIP SUBSCRIPTION", -1_499, "subscriptions"],
  ];
  const food = ["UPI/SWIGGY*ORDER/swiggy@icici", "UPI/ZOMATO/zomato@hdfc", "UPI/CAFE COFFEE HOUSE", "UPI/DOMINOS PIZZA", "UPI/BIRYANI BLUES"];
  for (let i = 0; i < 9; i++) lines.push([2 + Math.floor(rand() * 26), food[i % food.length]!, -vary(450, 0.8), "food"]);
  const groceries = ["UPI/BLINKIT/blinkit@hdfc", "POS 4521 DMART", "UPI/ZEPTO/zepto@ybl"];
  for (let i = 0; i < 3; i++) lines.push([4 + i * 8, groceries[i]!, -vary(1_300), "groceries"]);
  const rides = ["UPI/UBER INDIA/uber@axis", "UPI/OLA/ola@axis", "UPI/NAMMA METRO RECHARGE", "UPI/RAPIDO/rapido@ybl"];
  for (let i = 0; i < 6; i++) lines.push([3 + Math.floor(rand() * 25), rides[i % rides.length]!, -vary(260, 0.8), "travel"]);
  const shops = ["UPI/AMAZON PAY/amazon@apl", "UPI/MYNTRA/myntra@icici", "UPI/FLIPKART/fk@axis"];
  for (let i = 0; i < 2; i++) lines.push([10 + Math.floor(rand() * 15), shops[(monthIndex + i) % shops.length]!, -vary(1_600, 0.9), "shopping"]);
  lines.push([20, "UPI/BOOKMYSHOW/bms@icici", -vary(700), "entertainment"]);
  // UPI transfers to friends (splitting dinners, trips).
  lines.push([16, "UPI-RAHUL VERMA-rahul.v@okhdfc", -vary(800), "others"]);
  if (monthIndex % 3 === 1) lines.push([22, "UPI/INDIGO AIRLINES/indigo@hdfc", -vary(6_500, 0.3), "travel"]);
  if (monthIndex % 4 === 2) lines.push([18, "UPI/APOLLO PHARMACY", -vary(900), "health"]);
  if (monthIndex % 5 === 3) lines.push([25, "IMPS-CR-FREELANCE DESIGN PROJECT", vary(6_000, 0.4), "income"]);
  return lines;
}

function studentMonth(rand: () => number, monthIndex: number): Line[] {
  const vary = (base: number, spread = 0.4) => Math.round(base * (1 - spread / 2 + rand() * spread));
  const lines: Line[] = [
    [1, "UPI-SUNITA RAO-POCKET MONEY-sunita@oksbi", 4_000, "income"],
    [4, "UPI/SPOTIFY STUDENT/spotify@icici", -59, "subscriptions"],
    [8, "UPI/JIO RECHARGE/jio@ybl", -299, "bills"],
  ];
  const food = ["UPI/CANTEEN SCHOOL CAFE", "UPI/SWIGGY*ORDER/swiggy@icici", "UPI/CHAI POINT", "UPI/BAKERY BITES"];
  for (let i = 0; i < 7; i++) lines.push([2 + Math.floor(rand() * 26), food[i % food.length]!, -vary(140, 0.9), "food"]);
  for (let i = 0; i < 4; i++) lines.push([3 + Math.floor(rand() * 25), "UPI/DELHI METRO RECHARGE", -vary(150), "travel"]);
  lines.push([14, "UPI/STATIONERY WORLD", -vary(250), "education"]);
  lines.push([19, "UPI/AMAZON PAY/amazon@apl", -vary(500, 0.9), "shopping"]);
  lines.push([23, "UPI-KAVYA SINGH-kavya@okaxis", -vary(200), "others"]);
  if (monthIndex % 3 === 0) lines.push([26, "UPI/PVR CINEMAS", -vary(350), "entertainment"]);
  if (monthIndex % 4 === 1) lines.push([12, "UPI-RAVI RAO-BIRTHDAY GIFT-ravi@okhdfc", 1_500, "income"]);
  return lines;
}

/**
 * `months` complete months of history plus this month up to yesterday, newest first, already
 * categorised (what the mock Account Aggregator returns).
 */
export function mockHistory(args: { kind: HistoryKind; months: number; today: string; accountId: string; nowIso: string; seed?: number }): Transaction[] {
  const { kind, months, today, accountId, nowIso } = args;
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const txns: Transaction[] = [];
  for (let offset = -months; offset <= 0; offset++) {
    const first = addMonths(toIso(ty, tm, 1), offset);
    const [y, m] = first.split("-").map(Number) as [number, number];
    const lastDay = offset === 0 ? td - 1 : daysInMonth(y, m);
    const rand = rng((args.seed ?? 7) * 1000 + y * 12 + m);
    const lines = kind === "salaried" ? salariedMonth(rand, y * 12 + m) : studentMonth(rand, y * 12 + m);
    lines.forEach(([day, raw, rupees, category], i) => {
      if (day > lastDay) return;
      const date = toIso(y, m, Math.min(day, daysInMonth(y, m)));
      const id = `mock-${accountId}-${y}${m}-${i}`;
      const amountPaise = R(rupees);
      txns.push({
        id,
        accountId,
        date,
        amountPaise,
        merchantRaw: raw,
        merchantKey: normalizeMerchant(raw),
        category,
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
        dedupeKey: dedupeKey({ accountId, date, amountPaise, reference: id }),
        createdAt: nowIso,
      });
    });
  }
  return txns.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** A profile read from the history: average income, fixed costs and spend per category. */
export function profileFromHistory(args: { name: string; isMinor: boolean; txns: Transaction[]; today: string; nowIso: string }): Profile {
  const flows = pastMonthFlows(args.txns, args.today, 12);
  const saving = realisticSaving(flows);
  const perCategory = averageByCategory(flows);
  const fixed = perCategory.filter((c) => FIXED_CATEGORY_IDS.includes(c.category));
  const variable = perCategory.filter((c) => !FIXED_CATEGORY_IDS.includes(c.category) && c.category !== "uncategorised");
  return {
    name: args.name,
    is18Plus: !args.isMinor,
    monthlyIncomePaise: saving.averageIncomePaise,
    otherIncomePaise: 0,
    fixedExpenses: fixed.map((c) => ({ id: `fx-${c.category}`, name: c.category[0]!.toUpperCase() + c.category.slice(1), amountPaise: c.paise, category: c.category })),
    estimatedSpend: Object.fromEntries(variable.map((c) => [c.category, c.paise])),
    riskComfort: args.isMinor ? "low" : "medium",
    points: 0,
    streak: 0,
    lastSortDate: null,
    badges: [],
    createdAt: args.nowIso,
  };
}

/** Bank account record for a linked account (only the last 4 digits are kept). */
export function linkedAccount(args: { id: string; bankName: string; last4: string; holderName: string; openingBalancePaise: number }): Account {
  return {
    id: args.id,
    bankName: args.bankName,
    type: "savings",
    last4: args.last4,
    source: "simulated",
    aaConsentId: null,
    consentExpiry: null,
    openingBalancePaise: args.openingBalancePaise,
    status: "active",
    holderName: args.holderName,
  };
}

// ---------- Mock portfolio-tracking API ----------

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * What the mock portfolio-tracking API returns for a connected account: for every goal with a
 * plan, the months paid in so far (at least one once the user has been redirected to invest),
 * split by the plan's mix, with gains near each instrument's assumed return plus a small,
 * repeatable wobble.
 */
export function mockHoldings(args: {
  account: Pick<InvestmentAccount, "id">;
  goals: Goal[];
  returnsPct: Record<string, number>;
  today: string;
  nowIso: string;
}): Holding[] {
  const out: Holding[] = [];
  for (const goal of args.goals) {
    if (!goal.plan || goal.plan.monthlyPaise <= 0 || goal.status !== "active") continue;
    const months = Math.max(1, monthsBetween(goal.plan.createdAt.slice(0, 10), args.today));
    for (const line of goal.plan.allocation) {
      const monthly = Math.round((goal.plan.monthlyPaise * line.pct) / 100);
      if (monthly <= 0) continue;
      const invested = monthly * months;
      const wobble = ((hash(`${goal.id}:${line.type}:${args.today}`) % 900) - 300) / 10_000;
      const growth = ((args.returnsPct[line.type] ?? 6) / 100) * (months / 24) + wobble;
      const current = Math.max(0, Math.round(invested * (1 + growth)));
      const nav = 10 + (hash(line.type) % 900) / 10;
      out.push({
        id: `h-${args.account.id}-${goal.id}-${line.type}`,
        accountId: args.account.id,
        goalId: goal.id,
        instrumentType: line.type,
        name: INSTRUMENT_LABEL[line.type],
        amountInvestedPaise: invested,
        currentValuePaise: current,
        units: Math.round((current / 100 / nav) * 1000) / 1000,
        syncedAt: args.nowIso,
      });
    }
  }
  return out;
}

// ---------- One-tap demo personas ----------

export type PersonaId = "adult" | "minor";

export const PERSONAS: Record<PersonaId, { label: string; detail: string }> = {
  adult: { label: "Aarav, 24 · salaried", detail: "Own KYC (PAN + Aadhaar), 9 months of bank history, a car goal and a wealth plan" },
  minor: { label: "Ananya, 16 · with guardian", detail: "Guardian KYC by her mother, pocket-money history, saving for a laptop" },
};

const yearsAgo = (today: string, years: number, days = 0) => addDays(addMonths(today, -12 * years), -days);

function plannedGoal(goal: Omit<Goal, "status" | "createdAt" | "monthlyContributionPaise">, plannedAt: string): Goal {
  return { ...goal, monthlyContributionPaise: goal.plan?.monthlyPaise ?? null, status: "active", createdAt: plannedAt };
}

/** A fully onboarded demo account, as if the persona signed up months ago. */
export function personaData(id: PersonaId, today: string, nowIso: string, returnsPct: Record<string, number>): AppData {
  const minor = id === "minor";
  const accountId = minor ? "acc-ananya" : "acc-aarav";
  const name = minor ? "Ananya Rao" : "Aarav Mehta";
  const txns = mockHistory({ kind: minor ? "student" : "salaried", months: minor ? 6 : 9, today, accountId, nowIso, seed: minor ? 16 : 24 });
  const profile = { ...profileFromHistory({ name, isMinor: minor, txns, today, nowIso }), riskComfort: minor ? ("low" as const) : ("medium" as const) };
  const plannedAt = `${addMonths(today, -4)}T09:00:00.000Z`;
  const account = linkedAccount({
    id: accountId,
    bankName: minor ? "State Bank of India" : "HDFC Bank",
    last4: minor ? "7710" : "4821",
    holderName: name,
    openingBalancePaise: minor ? R(6_500) : R(38_000),
  });

  const registration: Registration = {
    name,
    dob: minor ? yearsAgo(today, 16, 40) : yearsAgo(today, 24, 75),
    email: minor ? "ananya.demo@example.com" : "aarav.demo@example.com",
    mobile: minor ? "+919800000016" : "+919800000024",
    isMinor: minor,
    kycStatus: "verified",
    panMasked: minor ? null : "XXXXX4321X",
    aadhaarLast4: minor ? null : "1234",
    guardian: minor ? { name: "Sunita Rao", relation: "mother", panMasked: "XXXXX9876X", aadhaarLast4: "5678", consentedAt: nowIso } : null,
    bank: {
      holderName: name,
      accountLast4: account.last4,
      ifsc: minor ? "SBIN0001234" : "HDFC0004321",
      bankName: account.bankName,
      branch: minor ? "Connaught Place, New Delhi" : "Koramangala, Bengaluru",
      historySource: "aa",
      accountId,
    },
    kycProvider: "demo",
    completedAt: nowIso,
  };

  const goals: Goal[] = minor
    ? [
        plannedGoal(
          {
            id: "goal-laptop",
            name: "New laptop",
            kind: "education",
            path: "bigDay",
            targetPaise: R(60_000),
            targetDate: addMonths(today, 18),
            risk: "low",
            timeline: "short",
            plan: {
              allocation: [
                { type: "rd", pct: 80 },
                { type: "gold", pct: 20 },
              ],
              monthlyPaise: R(2_000),
              requiredPaise: R(2_600),
              projectedPaise: R(47_500),
              expectedReturnPct: 6.9,
              createdAt: plannedAt,
            },
          },
          plannedAt,
        ),
      ]
    : [
        plannedGoal(
          {
            id: "goal-car",
            name: "Car down payment",
            kind: "car",
            path: "bigDay",
            targetPaise: R(3_00_000),
            targetDate: addMonths(today, 30),
            risk: "medium",
            timeline: "short",
            plan: {
              allocation: [
                { type: "rd", pct: 50 },
                { type: "debt", pct: 20 },
                { type: "index", pct: 15 },
                { type: "gold", pct: 10 },
                { type: "hybrid", pct: 5 },
              ],
              monthlyPaise: R(8_000),
              requiredPaise: R(8_900),
              projectedPaise: R(2_78_000),
              expectedReturnPct: 7.6,
              createdAt: plannedAt,
            },
          },
          plannedAt,
        ),
        plannedGoal(
          {
            id: "goal-wealth",
            name: "Escape the rat race",
            kind: "custom",
            path: "wealth",
            targetPaise: R(1_00_00_000),
            targetDate: addMonths(today, 180),
            risk: "high",
            timeline: "long",
            monthlyExpensesPaise: R(33_000),
            plan: {
              allocation: [
                { type: "equity", pct: 50 },
                { type: "index", pct: 30 },
                { type: "stocks", pct: 20 },
              ],
              monthlyPaise: R(5_000),
              requiredPaise: R(21_200),
              projectedPaise: R(25_00_000),
              expectedReturnPct: 12,
              createdAt: plannedAt,
            },
          },
          plannedAt,
        ),
        {
          id: "goal-cushion",
          name: "Crisis Cushion",
          kind: "emergency",
          path: "crisisCushion",
          targetPaise: R(1_98_000),
          targetDate: addMonths(today, 12),
          monthlyContributionPaise: null,
          risk: "low",
          cushionMonths: 6,
          cushionSavedPaise: R(45_000),
          status: "active",
          createdAt: plannedAt,
        },
      ];

  const investmentAccount: InvestmentAccount = {
    id: minor ? "inv-acc-guardian" : "inv-acc-self",
    provider: minor ? "Bank's investment section" : "Mutual fund investment app",
    owner: minor ? "guardian" : "self",
    status: "connected",
    consentAt: plannedAt,
    lastSyncedAt: nowIso,
  };
  const holdings = mockHoldings({ account: investmentAccount, goals, returnsPct, today, nowIso });

  const loans: Loan[] = minor
    ? [
        { id: "loan-kavya", person: "Kavya Singh", amountPaise: R(300), date: addDays(today, -9), dueDate: addDays(today, 5), note: "Canteen lunch", txnId: null, returns: [], forgiven: false, createdAt: nowIso },
      ]
    : [
        { id: "loan-rahul", person: "Rahul Verma", amountPaise: R(2_000), date: addDays(today, -20), dueDate: addDays(today, -4), note: "Goa trip advance", txnId: null, returns: [], forgiven: false, createdAt: nowIso },
        { id: "loan-meera", person: "Meera Iyer", amountPaise: R(1_200), date: addDays(today, -5), dueDate: addDays(today, 2), note: "Concert ticket", txnId: null, returns: [], forgiven: false, createdAt: nowIso },
        { id: "loan-dev", person: "Dev Patel", amountPaise: R(500), date: addDays(today, -40), dueDate: addDays(today, -25), note: "Cab share", txnId: null, returns: [{ id: "ret-dev", amountPaise: R(500), date: addDays(today, -24), txnId: null, handled: true }], forgiven: false, createdAt: nowIso },
      ];

  const consent = consentRequest(today, nowIso);
  const aaConsentId = `aac-${id}`;
  const base = emptyData();
  return {
    ...base,
    registration,
    profile,
    accounts: [{ ...account, aaConsentId, consentExpiry: consent.consentExpiry.slice(0, 10) }],
    aaConsents: [{ id: aaConsentId, aaName: DEMO_AA_NAME, status: "active", detail: consent, accountIds: [accountId], lastFetchedAt: nowIso, createdAt: plannedAt }],
    transactions: txns,
    goals,
    loans,
    investmentAccounts: [investmentAccount],
    holdings,
    consents: [
      { id: "consent-bank", purpose: "bank_data", granted: true, noticeVersion: "2026-10", createdAt: nowIso },
      { id: "consent-ai", purpose: "ai_processing", granted: !minor, noticeVersion: "2026-10", createdAt: nowIso },
    ],
    settings: { ...base.settings, aiEnabled: !minor },
  };
}
