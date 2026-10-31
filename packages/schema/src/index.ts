import { z } from "zod";

/** Money is always integer paise. Positive = money in, negative = money out. */
export const Paise = z.number().int();
/** Calendar date as YYYY-MM-DD (no time zone). */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
/** Timestamp as an ISO 8601 string. */
export const IsoDateTime = z.string();

export const RiskComfort = z.enum(["low", "medium", "high"]);
export type RiskComfort = z.infer<typeof RiskComfort>;

/** System categories are not editable and never count as spending. */
export const SYSTEM_CATEGORY_IDS = ["income", "refund", "transfer", "investment", "lent"] as const;
export type SystemCategoryId = (typeof SYSTEM_CATEGORY_IDS)[number];

export const Category = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  icon: z.string(),
  monthlyLimitPaise: Paise.nullable(),
  /** Discretionary categories are where "room to cut" is looked for. */
  discretionary: z.boolean(),
  system: z.boolean(),
  order: z.number(),
});
export type Category = z.infer<typeof Category>;

export const FixedExpense = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  amountPaise: Paise.nonnegative(),
  category: z.string(),
});
export type FixedExpense = z.infer<typeof FixedExpense>;

export const Profile = z.object({
  name: z.string().min(1).max(60),
  /** False for under-18 accounts, which are supervised by a guardian (see Registration). */
  is18Plus: z.boolean(),
  monthlyIncomePaise: Paise.nonnegative(),
  otherIncomePaise: Paise.nonnegative(),
  fixedExpenses: z.array(FixedExpense),
  /** Estimated variable spend per category id, per month. */
  estimatedSpend: z.record(z.string(), Paise.nonnegative()),
  riskComfort: RiskComfort,
  points: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  lastSortDate: IsoDate.nullable(),
  badges: z.array(z.string()),
  createdAt: IsoDateTime,
});
export type Profile = z.infer<typeof Profile>;

export const AccountSource = z.enum(["aa", "simulated", "csv", "manual"]);
export const Account = z.object({
  id: z.string(),
  bankName: z.string(),
  type: z.enum(["savings", "current"]),
  last4: z.string().regex(/^\d{4}$/),
  source: AccountSource,
  aaConsentId: z.string().nullable(),
  consentExpiry: IsoDate.nullable(),
  openingBalancePaise: Paise,
  status: z.enum(["active", "revoked"]),
  /** Name on the account, for accounts added by hand. */
  holderName: z.string().max(80).nullable().optional(),
});
export type Account = z.infer<typeof Account>;

export const TxnSource = z.enum(["bank", "cash", "bill", "csv"]);
export type TxnSource = z.infer<typeof TxnSource>;
export const TxnStatus = z.enum(["pending", "categorised", "uncategorised"]);
export type TxnStatus = z.infer<typeof TxnStatus>;

export const Transaction = z.object({
  id: z.string(),
  accountId: z.string().nullable(),
  date: IsoDate,
  amountPaise: Paise,
  merchantRaw: z.string(),
  merchantKey: z.string(),
  category: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  suggestions: z.array(z.string()).max(3),
  status: TxnStatus,
  source: TxnSource,
  isTransfer: z.boolean(),
  /** Set when a debit/credit pair looks like an own-account transfer; user confirms. */
  transferSuggested: z.boolean(),
  isInvestment: z.boolean(),
  goalId: z.string().nullable(),
  billId: z.string().nullable(),
  note: z.string().nullable(),
  dedupeKey: z.string(),
  /**
   * The user's answer to an unusual-payment alert: "confirmed" (it was them — a party, a big
   * day) or "reported" (it wasn't). Missing until they answer.
   */
  unusualCheck: z.enum(["confirmed", "reported"]).optional(),
  createdAt: IsoDateTime,
});
export type Transaction = z.infer<typeof Transaction>;

export const MerchantRule = z.object({
  merchantKey: z.string(),
  category: z.string(),
  createdFrom: z.enum(["correction", "manual"]),
});
export type MerchantRule = z.infer<typeof MerchantRule>;

/** Instrument categories. Plans split money at this level; category research (engine research.ts) lists funds that meet published criteria, never individual stocks. */
export const InstrumentType = z.enum([
  "savings",
  "fd",
  "rd",
  "liquid",
  "short_debt",
  "debt",
  "index",
  "gold",
  "bonds",
  "gsec",
  "tbill",
  "hybrid",
  "equity",
  "stocks",
]);
export type InstrumentType = z.infer<typeof InstrumentType>;

/** Short (under 3 years), medium (3–7) or long (over 7): how aggressive the user is on the goal. */
export const Timeline = z.enum(["short", "medium", "long"]);
export type Timeline = z.infer<typeof Timeline>;

/** Which path a goal came from: Save for a Big Day, Wealth Generator, Crisis Cushion, or a coach goal. */
export const GoalPath = z.enum(["bigDay", "wealth", "crisisCushion", "custom"]);
export type GoalPath = z.infer<typeof GoalPath>;

export const AllocationLine = z.object({
  type: InstrumentType,
  /** Share of the monthly amount, 0–100. */
  pct: z.number().min(0).max(100),
});
export type AllocationLine = z.infer<typeof AllocationLine>;

/** The investment plan saved with a goal (category level only). */
export const GoalPlan = z.object({
  allocation: z.array(AllocationLine),
  /** What the user chose to put in each month. */
  monthlyPaise: Paise.nonnegative(),
  /** Monthly amount needed to reach the target on time at the assumed returns. */
  requiredPaise: Paise.nonnegative(),
  /** Value at the target date if monthlyPaise goes in every month. */
  projectedPaise: Paise.nonnegative(),
  /** Weighted assumed annual return of the mix, in percent. */
  expectedReturnPct: z.number(),
  createdAt: IsoDateTime,
});
export type GoalPlan = z.infer<typeof GoalPlan>;

/** How the user will fund a goal: money available today, regular saving, and liquidity needs. */
export const GoalFunding = z.object({
  /** Available today for this goal (not the target). */
  lumpSumPaise: Paise.nonnegative(),
  /** Saved each period. */
  recurringPaise: Paise.nonnegative(),
  frequency: z.enum(["monthly", "weekly", "quarterly", "irregular", "none"]),
  needsEarlyAccess: z.enum(["yes", "no", "unsure"]),
  /** Can keep to a fixed deposit schedule. */
  canCommit: z.boolean(),
});
export type GoalFunding = z.infer<typeof GoalFunding>;

export const Goal = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  kind: z.enum(["car", "wedding", "trip", "emergency", "home", "education", "custom"]),
  /** Missing on goals saved before paths existed; read as "bigDay". */
  path: GoalPath.optional(),
  /** Missing on older goals; read as "monthly saving of the plan amount". */
  funding: GoalFunding.optional(),
  timeline: Timeline.optional(),
  plan: GoalPlan.nullable().optional(),
  /** Wealth Generator: monthly fixed + variable expenses that passive income must cover. */
  monthlyExpensesPaise: Paise.nonnegative().optional(),
  /** Crisis Cushion: months of expenses to keep, and what is already set aside. */
  cushionMonths: z.number().int().min(1).max(24).optional(),
  cushionSavedPaise: Paise.nonnegative().optional(),
  targetPaise: Paise.positive(),
  targetDate: IsoDate,
  /** Committed monthly contribution; null means "use savings capacity". */
  monthlyContributionPaise: Paise.nonnegative().nullable(),
  risk: RiskComfort,
  status: z.enum(["active", "achieved"]),
  createdAt: IsoDateTime,
});
export type Goal = z.infer<typeof Goal>;

/** The user's own plan: types they picked and the return range THEY entered. */
export const Plan = z.object({
  id: z.string(),
  goalId: z.string(),
  chosenTypes: z.array(InstrumentType),
  userReturnLowPct: z.number().min(0).max(30).nullable(),
  userReturnHighPct: z.number().min(0).max(30).nullable(),
  createdAt: IsoDateTime,
});
export type Plan = z.infer<typeof Plan>;

export const InvestmentStatus = z.enum(["planned", "paid", "confirmed"]);
export type InvestmentStatus = z.infer<typeof InvestmentStatus>;

export const Investment = z.object({
  id: z.string(),
  goalId: z.string(),
  instrumentType: InstrumentType,
  platform: z.string(),
  amountPaise: Paise.positive(),
  date: IsoDate,
  status: InvestmentStatus,
  matchedTxnId: z.string().nullable(),
  maturityDate: IsoDate.nullable(),
  lockInUntil: IsoDate.nullable(),
  exitLoadUntil: IsoDate.nullable(),
  schemeCode: z.string().nullable(),
  units: z.number().nonnegative().nullable(),
  currentValuePaise: Paise.nonnegative().nullable(),
  createdAt: IsoDateTime,
});
export type Investment = z.infer<typeof Investment>;

export const NotificationType = z.enum([
  "uncategorised",
  "transfer",
  "cash_reminder",
  "goal_behind",
  "investment",
  "badge",
  "budget",
  "loan",
  /** A payment far above the user's usual amount in its category (ml.ts). */
  "unusual",
]);
export const AppNotification = z.object({
  id: z.string(),
  type: NotificationType,
  message: z.string(),
  read: z.boolean(),
  /** The payment an alert is about, so it can be answered from the bell. */
  txnId: z.string().optional(),
  createdAt: IsoDateTime,
});
export type AppNotification = z.infer<typeof AppNotification>;

export const ConsentPurpose = z.enum(["bank_data", "ai_processing"]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;
/** Append-only: withdrawing writes a new record with granted=false. */
export const Consent = z.object({
  id: z.string(),
  purpose: ConsentPurpose,
  granted: z.boolean(),
  noticeVersion: z.string(),
  createdAt: IsoDateTime,
});
export type Consent = z.infer<typeof Consent>;

export const PartnerLink = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  url: z.string().url(),
});
export type PartnerLink = z.infer<typeof PartnerLink>;

export const AppSettings = z.object({
  aiEnabled: z.boolean(),
  aaEnabled: z.boolean(),
  confidenceThreshold: z.number().min(0).max(1),
  cashReminder: z.boolean(),
  streakNudges: z.boolean(),
  /** Essentials-only view: goal saving paused, emergency plan first. */
  emergencyMode: z.boolean(),
});
export type AppSettings = z.infer<typeof AppSettings>;

export const SplitPerson = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  sharePaise: Paise.nonnegative(),
  settled: z.boolean(),
});
export type SplitPerson = z.infer<typeof SplitPerson>;

/** A payment shared with friends. ArthMitra only records who owes what; it never asks anyone for money. */
export const Split = z.object({
  id: z.string(),
  txnId: z.string(),
  totalPaise: Paise.positive(),
  yourSharePaise: Paise.nonnegative(),
  people: z.array(SplitPerson).min(1).max(9),
  createdAt: IsoDateTime,
});
export type Split = z.infer<typeof Split>;

// ---------- Money lent ----------

export const LoanReturn = z.object({
  id: z.string(),
  amountPaise: Paise.positive(),
  date: IsoDate,
  /** The credit it came back as; null when recorded by hand (cash). */
  txnId: z.string().nullable(),
  /** The user has acted on the coach plan for it, so it leaves the next steps. */
  handled: z.boolean(),
});
export type LoanReturn = z.infer<typeof LoanReturn>;

/** Money the user lent someone. ArthMitra only keeps the record; it never asks anyone for money. */
export const Loan = z.object({
  id: z.string(),
  person: z.string().min(1).max(40),
  amountPaise: Paise.positive(),
  date: IsoDate,
  dueDate: IsoDate.nullable(),
  note: z.string().max(80).nullable(),
  /** The payment it went out as; null when added by hand. */
  txnId: z.string().nullable(),
  returns: z.array(LoanReturn),
  /** The user let it go; it no longer counts as owed. */
  forgiven: z.boolean(),
  createdAt: IsoDateTime,
});
export type Loan = z.infer<typeof Loan>;

// ---------- Account Aggregator (ReBIT API spec) ----------

/** What ArthMitra asks the AA for. Field names follow the ReBIT consent detail. */
export const AaConsentDetail = z.object({
  consentStart: IsoDateTime,
  consentExpiry: IsoDateTime,
  consentMode: z.enum(["VIEW", "STORE", "QUERY", "STREAM"]),
  fetchType: z.enum(["ONETIME", "PERIODIC"]),
  consentTypes: z.array(z.enum(["PROFILE", "SUMMARY", "TRANSACTIONS"])),
  fiTypes: z.array(z.string()),
  purpose: z.object({ code: z.string(), text: z.string() }),
  fiDataRange: z.object({ from: IsoDateTime, to: IsoDateTime }),
  dataLife: z.object({ unit: z.enum(["DAY", "MONTH", "YEAR", "INF"]), value: z.number().int().nonnegative() }),
  frequency: z.object({ unit: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]), value: z.number().int().positive() }),
});
export type AaConsentDetail = z.infer<typeof AaConsentDetail>;

/** A consent the user approved on their AA. Pausing or revoking stops every fetch under it. */
export const AaConsent = z.object({
  id: z.string(),
  aaName: z.string(),
  status: z.enum(["active", "paused", "revoked", "expired"]),
  detail: AaConsentDetail,
  accountIds: z.array(z.string()),
  lastFetchedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type AaConsent = z.infer<typeof AaConsent>;

const AaAmount = z.union([z.string(), z.number()]);

/**
 * One deposit account's decrypted FI data, in the ReBIT format every AA delivers.
 * Unknown fields, including the holder profile ArthMitra never requests, are stripped.
 */
export const AaDepositData = z.object({
  account: z.object({
    type: z.string(),
    maskedAccNumber: z.string(),
    summary: z.object({ currentBalance: AaAmount, type: z.string().optional() }).optional(),
    transactions: z.object({
      transaction: z.array(
        z.object({
          txnId: z.string(),
          type: z.enum(["DEBIT", "CREDIT"]),
          mode: z.string().optional(),
          amount: AaAmount,
          transactionTimestamp: z.string().optional(),
          valueDate: z.string().optional(),
          narration: z.string().optional(),
          reference: z.string().optional(),
        }),
      ),
    }),
  }),
});
export type AaDepositData = z.infer<typeof AaDepositData>;

// ---------- Registration (sign-up: basic details, KYC, bank link) ----------

export const AgeGroup = z.enum(["under18", "adult"]);
export type AgeGroup = z.infer<typeof AgeGroup>;

/** Only the last 4 Aadhaar digits are ever stored, shown as XXXX-XXXX-1234. */
export const AadhaarLast4 = z.string().regex(/^\d{4}$/);

/** Parent or legal guardian who completes KYC for an under-18 account; the account is linked to them. */
export const Guardian = z.object({
  name: z.string().min(1).max(60),
  relation: z.enum(["mother", "father", "legal_guardian"]),
  /** e.g. XXXXX1234X */
  panMasked: z.string(),
  aadhaarLast4: AadhaarLast4,
  consentedAt: IsoDateTime,
});
export type Guardian = z.infer<typeof Guardian>;

/** Bank account linked at sign-up. Only the last 4 digits of the account number are kept. */
export const BankLink = z.object({
  holderName: z.string().min(1).max(80),
  accountLast4: z.string().regex(/^\d{4}$/),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  bankName: z.string(),
  branch: z.string(),
  historySource: z.enum(["aa", "statement"]),
  /** The Account record its transactions belong to. */
  accountId: z.string(),
});
export type BankLink = z.infer<typeof BankLink>;

export const Registration = z.object({
  name: z.string().min(1).max(60),
  dob: IsoDate,
  email: z.string().email().nullable(),
  mobile: z.string().regex(/^\+91[6-9]\d{9}$/),
  /** Worked out from the date of birth; decides the KYC path. */
  isMinor: z.boolean(),
  kycStatus: z.enum(["pending", "verified"]),
  /** The user's own PAN and Aadhaar (18+); null for minors, whose guardian completes KYC. */
  panMasked: z.string().nullable(),
  aadhaarLast4: AadhaarLast4.nullable(),
  guardian: Guardian.nullable(),
  bank: BankLink.nullable(),
  /** "demo" while KYC and OTPs are mocked on screen. */
  kycProvider: z.enum(["demo", "live"]),
  completedAt: IsoDateTime,
});
export type Registration = z.infer<typeof Registration>;

// ---------- Portfolio tracking ----------

/** An account on a third-party investment app, connected for read-only holdings sync. */
export const InvestmentAccount = z.object({
  id: z.string(),
  /** Generic provider label from config; never a broker brand. */
  provider: z.string(),
  /** Whose account: the user's, or (for a minor) the guardian's. */
  owner: z.enum(["self", "guardian"]),
  status: z.enum(["connected", "disconnected"]),
  consentAt: IsoDateTime,
  lastSyncedAt: IsoDateTime.nullable(),
});
export type InvestmentAccount = z.infer<typeof InvestmentAccount>;

export const Holding = z.object({
  id: z.string(),
  accountId: z.string(),
  goalId: z.string().nullable(),
  instrumentType: InstrumentType,
  /** Category-level label, e.g. "Nifty 50 index fund". */
  name: z.string(),
  amountInvestedPaise: Paise.nonnegative(),
  currentValuePaise: Paise.nonnegative(),
  units: z.number().nonnegative(),
  syncedAt: IsoDateTime,
});
export type Holding = z.infer<typeof Holding>;

/** Everything stored for one user — mirrors the Firestore tree under users/{uid}. */
export interface AppData {
  /** Sign-up details (basic details, KYC, bank link); null until those steps are done. */
  registration: Registration | null;
  profile: Profile | null;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  merchantRules: MerchantRule[];
  goals: Goal[];
  plans: Plan[];
  investments: Investment[];
  notifications: AppNotification[];
  consents: Consent[];
  partners: PartnerLink[];
  splits: Split[];
  aaConsents: AaConsent[];
  loans: Loan[];
  investmentAccounts: InvestmentAccount[];
  holdings: Holding[];
  merchantCache: Record<string, { category: string; confidence: number }>;
  settings: AppSettings;
}

// ---------- Gemini (Genkit) output contracts ----------

export const CategoriseOutput = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      confidence: z.number().min(0).max(1),
      suggestions: z.array(z.string()).max(3),
    }),
  ),
});
export type CategoriseOutput = z.infer<typeof CategoriseOutput>;

const Scored = <T extends z.ZodType>(value: T) =>
  z.object({ value, confidence: z.number().min(0).max(1) });

/** Gemini returns rupees as strings; the engine converts with toPaise(). */
export const BillExtraction = z.object({
  merchant: Scored(z.string()),
  date: Scored(IsoDate),
  totalRupees: Scored(z.string()),
  lineItems: z.array(z.object({ name: z.string(), amountRupees: z.string() })),
});
export type BillExtraction = z.infer<typeof BillExtraction>;

export const CoachAnswer = z.object({
  answer: z.string(),
  figuresUsed: z.array(z.string()),
  /** Buttons under the answer, from COACH_ACTIONS ids only. */
  actionIds: z.array(z.string()).max(3),
  disclaimer: z.string(),
});
export type CoachAnswer = z.infer<typeof CoachAnswer>;

export const DISCLAIMER = "Educational guidance, not investment advice. Returns are not guaranteed.";
export const CARE_NOTE = "ArthMitra is not a medical or emergency service.";
