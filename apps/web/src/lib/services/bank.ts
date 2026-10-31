import { IFSC, bankFromIfsc } from "@/lib/ifsc";

/**
 * Bank details: IFSC lookup and account-number checks. The IFSC lookup is MOCKED: the bank
 * comes from the IFSC's first 4 letters and the branch from a small sample list. Live, call
 * RBI's IFSC master (or a lookup API) from a server. Account number and IFSC alone give no
 * transaction history — that needs AA consent or a statement (aa.ts).
 */
export interface IfscInfo {
  ifsc: string;
  bank: string;
  branch: string;
}

export interface BankService {
  readonly live: boolean;
  lookupIfsc(ifsc: string): Promise<IfscInfo | null>;
}

const BRANCHES = [
  "Koramangala, Bengaluru",
  "Andheri West, Mumbai",
  "Connaught Place, New Delhi",
  "T. Nagar, Chennai",
  "Salt Lake, Kolkata",
  "Banjara Hills, Hyderabad",
  "Fatehsagar Road, Udaipur",
  "Civil Lines, Jaipur",
  "Aundh, Pune",
  "Navrangpura, Ahmedabad",
];

export const isIfsc = (v: string) => IFSC.test(v);

/** 9 to 18 digits, the range Indian banks use. */
export function accountNumberError(raw: string): string | null {
  const v = raw.replace(/\s/g, "");
  if (!v) return "Enter the account number.";
  return /^\d{9,18}$/.test(v) ? null : "Account numbers are 9 to 18 digits.";
}

export const mockBank: BankService = {
  live: false,
  async lookupIfsc(raw) {
    const ifsc = raw.toUpperCase();
    if (!IFSC.test(ifsc)) return null;
    const n = [...ifsc.slice(5)].reduce((s, c) => s + c.charCodeAt(0), 0);
    return { ifsc, bank: bankFromIfsc(ifsc), branch: BRANCHES[n % BRANCHES.length]! };
  },
};

export const bank: BankService = mockBank;
