/** IFSC: 4-letter bank code, a zero, then a 6-character branch code (SBIN0001234). */
export const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// The bank code is the first 4 letters of every IFSC, so the bank's name needn't be asked for.
const BANKS: Record<string, string> = {
  SBIN: "State Bank of India",
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  BKID: "Bank of India",
  IDIB: "Indian Bank",
  IOBA: "Indian Overseas Bank",
  CBIN: "Central Bank of India",
  UCBA: "UCO Bank",
  MAHB: "Bank of Maharashtra",
  PSIB: "Punjab & Sind Bank",
  IBKL: "IDBI Bank",
  IDFB: "IDFC FIRST Bank",
  INDB: "IndusInd Bank",
  YESB: "Yes Bank",
  FDRL: "Federal Bank",
  RATN: "RBL Bank",
  BDBL: "Bandhan Bank",
  AUBL: "AU Small Finance Bank",
  ESFB: "Equitas Small Finance Bank",
  KARB: "Karnataka Bank",
  KVBL: "Karur Vysya Bank",
  SIBL: "South Indian Bank",
  CIUB: "City Union Bank",
  TMBL: "Tamilnad Mercantile Bank",
  DCBL: "DCB Bank",
  JAKA: "Jammu & Kashmir Bank",
  DBSS: "DBS Bank India",
  CITI: "Citibank",
  HSBC: "HSBC",
  SCBL: "Standard Chartered",
  PYTM: "Paytm Payments Bank",
  AIRP: "Airtel Payments Bank",
  IPOS: "India Post Payments Bank",
  FINO: "Fino Payments Bank",
};

/** The bank's name for a valid IFSC, or a generic label when the bank code isn't in the list. */
export function bankFromIfsc(ifsc: string): string {
  return BANKS[ifsc.slice(0, 4)] ?? `Bank ${ifsc.slice(0, 4)}`;
}
