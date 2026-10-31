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
  is18Plus: z.literal(true),
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

export const AccountSource = z.enum(["aa", "simulated", "csv"]);
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
  createdAt: IsoDateTime,
});
export type Transaction = z.infer<typeof Transaction>;

export const MerchantRule = z.object({
  merchantKey: z.string(),
  category: z.string(),
  createdFrom: z.enum(["correction", "manual"]),
});
export type MerchantRule = z.infer<typeof MerchantRule>;

export const Goal = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  kind: z.enum(["car", "wedding", "trip", "emergency", "home", "education", "custom"]),
  targetPaise: Paise.positive(),
  targetDate: IsoDate,
  /** Committed monthly contribution; null means "use savings capacity". */
  monthlyContributionPaise: Paise.nonnegative().nullable(),
  risk: RiskComfort,
  status: z.enum(["active", "achieved"]),
  createdAt: IsoDateTime,
});
export type Goal = z.infer<typeof Goal>;

export const InstrumentType = z.enum([
  "savings",
  "fd",
  "rd",
  "liquid",
  "short_debt",
  "debt",
  "index",
  "gold",
]);
export type InstrumentType = z.infer<typeof InstrumentType>;

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
]);
export const AppNotification = z.object({
  id: z.string(),
  type: NotificationType,
  message: z.string(),
  read: z.boolean(),
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

/** Everything stored for one user — mirrors the Firestore tree under users/{uid}. */
export interface AppData {
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

export const DISCLAIMER = "Educational guidance, not financial advice.";
export const CARE_NOTE = "ArthMitra is not a medical or emergency service.";
