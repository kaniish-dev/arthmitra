/**
 * OTP to the mobile number linked with an Aadhaar or PAN. With a real KYC provider (UIDAI
 * e-KYC through a licensed partner, or DigiLocker) the provider sends it to that number,
 * which the app never sees. In this build the code is made in the browser and shown on
 * screen as a "demo SMS", which costs nothing and works offline for presentations. To go
 * live, replace sendOtp/checkOtp with the provider's API (called from a server) and set
 * OTP_CHANNEL to "sms"; the screens don't change.
 */
export const OTP_CHANNEL: "demo" | "sms" = "demo";

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const RESEND_AFTER_S = 30;

export interface OtpSession {
  code: string;
  sentAt: number;
  expiresAt: number;
  attemptsLeft: number;
}

export type OtpResult = "ok" | "wrong" | "expired" | "locked";

/** Starts a 6-digit OTP. */
export function sendOtp(): OtpSession {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  const sentAt = Date.now();
  return { code: String(n).padStart(6, "0"), sentAt, expiresAt: sentAt + OTP_LIFETIME_MS, attemptsLeft: MAX_ATTEMPTS };
}

export function checkOtp(session: OtpSession, entered: string): { result: OtpResult; session: OtpSession } {
  if (session.attemptsLeft <= 0) return { result: "locked", session };
  if (Date.now() > session.expiresAt) return { result: "expired", session };
  if (entered === session.code) return { result: "ok", session };
  const next = { ...session, attemptsLeft: session.attemptsLeft - 1 };
  return { result: next.attemptsLeft <= 0 ? "locked" : "wrong", session: next };
}

