import {
  addDays,
  addMonths,
  daysInMonth,
  dedupeKey,
  defaultCategories,
  normalizeMerchant,
  toIso,
} from "@arthmitra/engine";
import type { AaDepositData, Account, AppData, Goal, Investment, Loan, PartnerLink, Profile, Transaction } from "@arthmitra/schema";

/**
 * Fictional demo account "Rohit" from the PRD demo script. Every name, bank and
 * number here is invented. Sized so the goal screen shows ₹19,500 needed against
 * ₹17,000 capacity, ₹2,500 of room in Food and Entertainment, and dragging the
 * date out two months turns the goal on track.
 */

export const DEMO_GOAL_ID = "goal-car";
export const NOTICE_VERSION = "2026-10";

const R = (rupees: number) => Math.round(rupees * 100);

export const DEFAULT_SETTINGS: AppData["settings"] = {
  aiEnabled: true,
  aaEnabled: true,
  confidenceThreshold: 0.8,
  cashReminder: true,
  streakNudges: true,
  emergencyMode: false,
};

/** No investing platform is named; the partner app comes from apps/web/src/config/partner.ts. */
export const DEFAULT_PARTNERS: PartnerLink[] = [];

/** A blank account for "Start fresh". */
export function emptyData(): AppData {
  return {
    registration: null,
    profile: null,
    accounts: [],
    transactions: [],
    categories: defaultCategories(),
    merchantRules: [],
    goals: [],
    plans: [],
    investments: [],
    notifications: [],
    consents: [],
    partners: DEFAULT_PARTNERS,
    splits: [],
    aaConsents: [],
    loans: [],
    investmentAccounts: [],
    holdings: [],
    merchantCache: {},
    settings: DEFAULT_SETTINGS,
  };
}

export function demoProfile(nowIso: string): Profile {
  return {
    name: "Rohit (demo)",
    is18Plus: true,
    monthlyIncomePaise: R(50_000),
    otherIncomePaise: 0,
    fixedExpenses: [
      { id: "fx-rent", name: "Rent", amountPaise: R(12_000), category: "rent" },
      { id: "fx-utilities", name: "Electricity and internet", amountPaise: R(2_000), category: "bills" },
    ],
    estimatedSpend: {
      food: R(6_000),
      groceries: R(4_000),
      travel: R(2_500),
      shopping: R(2_500),
      entertainment: R(1_500),
      health: R(1_000),
      others: R(1_500),
    },
    riskComfort: "medium",
    points: 0,
    streak: 0,
    lastSortDate: null,
    badges: [],
    createdAt: nowIso,
  };
}

export function demoGoal(today: string, nowIso: string): Goal {
  return {
    id: DEMO_GOAL_ID,
    name: "Car down payment",
    kind: "car",
    targetPaise: R(240_000),
    targetDate: addMonths(today, 12),
    monthlyContributionPaise: null,
    risk: "medium",
    status: "active",
    createdAt: nowIso,
  };
}

/**
 * Money Rohit lent in cash. Ramesh is overdue; the "Money from a friend ₹800" demo payment
 * is Ramesh paying it back, which the ingest pipeline spots.
 */
export function demoLoans(today: string, nowIso: string): Loan[] {
  return [
    {
      id: "loan-ramesh",
      person: "Ramesh Kumar",
      amountPaise: R(800),
      date: addDays(today, -18),
      dueDate: addDays(today, -3),
      note: "Auto fare and lunch",
      txnId: null,
      returns: [],
      forgiven: false,
      createdAt: nowIso,
    },
    {
      id: "loan-priya",
      person: "Priya Sharma",
      amountPaise: R(1_500),
      date: addDays(today, -6),
      dueDate: addDays(today, 12),
      note: "Concert ticket",
      txnId: null,
      returns: [],
      forgiven: false,
      createdAt: nowIso,
    },
  ];
}

/** Profile, goal, loans and consents as they stand after onboarding — before the bank is linked. */
export function demoOnboarded(today: string, nowIso: string): AppData {
  return {
    ...emptyData(),
    profile: demoProfile(nowIso),
    goals: [demoGoal(today, nowIso)],
    loans: demoLoans(today, nowIso),
    consents: [{ id: "consent-ai-1", purpose: "ai_processing", granted: true, noticeVersion: NOTICE_VERSION, createdAt: nowIso }],
  };
}

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: "acc-demo-1",
    bankName: "Demo Bank",
    type: "savings",
    last4: "4321",
    source: "simulated",
    aaConsentId: null,
    consentExpiry: null,
    openingBalancePaise: R(42_000),
    status: "active",
  },
  {
    id: "acc-demo-2",
    bankName: "Sample Bank",
    type: "savings",
    last4: "8765",
    source: "simulated",
    aaConsentId: null,
    consentExpiry: null,
    openingBalancePaise: R(18_000),
    status: "active",
  },
];

type Line = [day: number, raw: string, rupees: number, category: string];

/** One month of Rohit's spending. `heavy` is the month that ran over on Food and Entertainment. */
function monthLines(heavy: boolean): Line[] {
  return [
    [1, "NEFT-SALARY ACME TECH PVT LTD", 50_000, "income"],
    [2, "UPI/SWIGGY*ORDER1102/swiggy@icici", -420, "food"],
    [3, "UPI-RENT-LANDLORD SHARMA", -12_000, "rent"],
    [4, "UPI/BLINKIT/blinkit@hdfc", -1_250, "groceries"],
    [5, "BILLPAY-ELECTRICITY BESCOM", -1_200, "bills"],
    [6, "UPI/AIRTEL BROADBAND/airtel@ybl", -800, "bills"],
    [7, "UPI/UBER INDIA/uber@axis", -350, "travel"],
    [8, "UPI/ZOMATO/zomato@hdfc", -560, "food"],
    [9, "NETFLIX.COM", -649, "entertainment"],
    [10, "UPI/AMAZON PAY/amazon@apl", -1_299, "shopping"],
    [11, "UPI/CAFE COFFEE HOUSE", -380, "food"],
    [12, "POS 4521 DMART", -1_650, "groceries"],
    [13, "UPI/JIOHOTSTAR/hotstar@icici", -299, "entertainment"],
    [14, "UPI/SWIGGY*ORDER1187/swiggy@icici", -650, "food"],
    [15, "UPI/RAPIDO/rapido@ybl", -180, "travel"],
    [16, "UPI/APOLLO PHARMACY", -800, "health"],
    [17, "UPI/DOMINOS PIZZA", -540, "food"],
    [18, "UPI/GIFT GALLERY", -1_000, "others"],
    [19, "POS IOCL FUEL STATION", -1_200, "travel"],
    [20, "UPI/ZOMATO/zomato@hdfc", -720, "food"],
    [21, "UPI/BOOKMYSHOW/bms@icici", heavy ? -1_552 : -552, "entertainment"],
    [22, "UPI/MYNTRA/myntra@icici", -701, "shopping"],
    [23, "UPI/BIRYANI BLUES", -890, "food"],
    [24, "UPI/ZEPTO/zepto@ybl", -900, "groceries"],
    [25, "UPI/HAIR STUDIO", -500, "others"],
    [26, "UPI/SWIGGY*ORDER1240/swiggy@icici", -480, "food"],
    [27, "UPI/OLA/ola@axis", -470, "travel"],
    [28, "POS RESTAURANT SPICE ROUTE", heavy ? -2_860 : -1_560, "food"],
  ];
}

function makeTxn(
  id: string,
  date: string,
  raw: string,
  amountPaise: number,
  category: string,
  accountId: string,
  nowIso: string,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
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
    ...extra,
  };
}

/**
 * What the bank link "fetches": two full past months plus this month up to yesterday,
 * one own-account transfer, and the ₹6,000 RD instalment already saved for the goal.
 */
export function demoBankHistory(today: string, nowIso: string): Pick<AppData, "accounts" | "transactions" | "investments"> {
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const months = [
    { offset: -2, heavy: false },
    { offset: -1, heavy: true },
    { offset: 0, heavy: false },
  ];
  const txns: Transaction[] = [];
  const acc1 = DEMO_ACCOUNTS[0]!.id;
  const acc2 = DEMO_ACCOUNTS[1]!.id;
  let rdDebitId = "";
  let rdDate = "";

  for (const { offset, heavy } of months) {
    const first = addMonths(toIso(ty, tm, 1), offset);
    const [y, m] = first.split("-").map(Number) as [number, number];
    const lastDay = offset === 0 ? td - 1 : daysInMonth(y, m);
    for (const [day, raw, rupees, category] of monthLines(heavy)) {
      if (day > lastDay) continue;
      const date = toIso(y, m, day);
      txns.push(makeTxn(`seed-${y}${m}-${day}`, date, raw, R(rupees), category, acc1, nowIso));
    }
    if (offset === -2) {
      const date = toIso(y, m, Math.min(29, daysInMonth(y, m)));
      const pair = { isTransfer: true, category: "transfer" };
      txns.push(makeTxn(`seed-${y}${m}-xfer-out`, date, "IMPS-TO SELF-SAMPLE BANK", R(-5_000), "transfer", acc1, nowIso, pair));
      txns.push(makeTxn(`seed-${y}${m}-xfer-in`, date, "IMPS-CR-SELF-DEMO BANK", R(5_000), "transfer", acc2, nowIso, pair));
    }
    if (offset === -1) {
      rdDate = toIso(y, m, Math.min(29, daysInMonth(y, m)));
      rdDebitId = `seed-${y}${m}-rd`;
      txns.push(
        makeTxn(rdDebitId, rdDate, "ACH/RD INSTALMENT", R(-6_000), "investment", acc1, nowIso, {
          isInvestment: true,
          goalId: DEMO_GOAL_ID,
        }),
      );
    }
  }

  const rd: Investment = {
    id: "inv-rd-1",
    goalId: DEMO_GOAL_ID,
    instrumentType: "rd",
    platform: "Demo Bank",
    amountPaise: R(6_000),
    date: rdDate,
    status: "confirmed",
    matchedTxnId: rdDebitId,
    maturityDate: addMonths(rdDate, 12),
    lockInUntil: null,
    exitLoadUntil: null,
    schemeCode: null,
    units: null,
    currentValuePaise: null,
    createdAt: nowIso,
  };

  txns.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { accounts: DEMO_ACCOUNTS, transactions: txns, investments: [rd] };
}

export interface ScriptedPayment {
  id: string;
  label: string;
  merchantRaw: string;
  amountPaise: number;
}

/**
 * Buttons on the demo panel. Swiggy sorts itself; RK Traders lands in the inbox. Once RK Traders
 * is sorted, Shree RK Traders is sorted by the smart-sorting model; the ₹6,500 dinner raises an
 * unusual-payment alert.
 */
export const SCRIPTED_PAYMENTS: ScriptedPayment[] = [
  { id: "swiggy", label: "Swiggy order ₹450", merchantRaw: "UPI/SWIGGY*ORDER7781/swiggy@icici", amountPaise: R(-450) },
  { id: "rk-traders", label: "RK Traders ₹1,200", merchantRaw: "UPI-RK TRADERS-rktraders@okaxis", amountPaise: R(-1_200) },
  { id: "uber", label: "Uber ride ₹320", merchantRaw: "UPI/UBER INDIA/uber@axis", amountPaise: R(-320) },
  { id: "friend", label: "Money from a friend ₹800", merchantRaw: "UPI-RAMESH KUMAR-ramesh@oksbi", amountPaise: R(800) },
  { id: "rk-traders-again", label: "Shree RK Traders ₹350", merchantRaw: "UPI-SHREE RK TRADERS-shreerk@okaxis", amountPaise: R(-350) },
  { id: "big-dinner", label: "Spice Route ₹6,500", merchantRaw: "POS RESTAURANT SPICE ROUTE", amountPaise: R(-6_500) },
];

/** Name shown for the simulated Account Aggregator. */
export const DEMO_AA_NAME = "Demo AA";

/**
 * What the simulated AA sends for one account: decrypted ReBIT deposit data, the same
 * shape a real AA delivers, so the demo runs through the real reader.
 */
export function demoFiData(
  account: Pick<Account, "last4" | "type">,
  balancePaise: number,
  txns: Array<{ txnId: string; date: string; amountPaise: number; narration: string }>,
): AaDepositData {
  const rupees = (paise: number) => (Math.abs(paise) / 100).toFixed(2);
  return {
    account: {
      type: "deposit",
      maskedAccNumber: `XXXXXXXX${account.last4}`,
      summary: { currentBalance: (balancePaise / 100).toFixed(2), type: account.type.toUpperCase() },
      transactions: {
        transaction: txns.map((t) => ({
          txnId: t.txnId,
          type: t.amountPaise < 0 ? ("DEBIT" as const) : ("CREDIT" as const),
          mode: t.narration.startsWith("UPI") ? "UPI" : "OTHERS",
          amount: rupees(t.amountPaise),
          transactionTimestamp: `${t.date}T12:00:00+05:30`,
          valueDate: t.date,
          narration: t.narration,
        })),
      },
    },
  };
}

export * from "./personas";
