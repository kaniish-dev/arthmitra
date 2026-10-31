/**
 * Client-side format checks and masking for PAN and Aadhaar. These catch typos only;
 * confirming a number belongs to the person needs a licensed KYC provider (lib/services/kyc.ts).
 */

/** Strips spaces and hyphens and upper-cases, the way people type these numbers. */
export const cleanId = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");

/** AAAAA9999A: five letters, four digits, one letter. */
export const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR = /^\d{12}$/;

export function panError(raw: string): string | null {
  const v = cleanId(raw);
  if (!v) return "Enter the PAN.";
  return PAN.test(v) ? null : "PAN looks like ABCDE1234F — 5 letters, 4 digits, 1 letter.";
}

export function aadhaarError(raw: string): string | null {
  const v = cleanId(raw);
  if (!v) return "Enter the Aadhaar number.";
  return AADHAAR.test(v) ? null : "Aadhaar is exactly 12 digits.";
}

/** XXXXX1234X — the only form of a PAN that is stored. */
export const maskPan = (raw: string) => `XXXXX${cleanId(raw).slice(5, 9)}X`;

/** The last 4 Aadhaar digits — the only part that is stored. */
export const aadhaarLast4 = (raw: string) => cleanId(raw).slice(-4);

/** XXXX-XXXX-1234, how a stored Aadhaar is shown. */
export const showAadhaar = (last4: string) => `XXXX-XXXX-${last4}`;

/** Age in whole years on `today` (both YYYY-MM-DD). */
export function ageOn(dob: string, today: string): number {
  const [y, m, d] = dob.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}
