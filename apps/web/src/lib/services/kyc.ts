import { aadhaarError, aadhaarLast4, cleanId, maskPan, panError } from "@/lib/id-check";

/**
 * KYC: PAN and Aadhaar verification. MOCKED in this prototype — a short wait, then
 * "Verified". In the live app a licensed provider (UIDAI e-KYC through a KUA/AUA partner,
 * NSDL/UTIITSL for PAN) runs the check from a server, and only the last 4 Aadhaar digits
 * come back to be stored.
 */
export interface KycResult {
  status: "verified" | "failed";
  panMasked: string;
  aadhaarLast4: string;
  /** Why it failed, when it did. */
  reason?: string;
}

export interface KycService {
  readonly live: boolean;
  verify(input: { pan: string; aadhaar: string; name: string }): Promise<KycResult>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockKyc: KycService = {
  live: false,
  async verify({ pan, aadhaar }) {
    await wait(1400);
    const problem = panError(pan) ?? aadhaarError(aadhaar);
    // The raw numbers are dropped here; only masked forms leave this function.
    return {
      status: problem ? "failed" : "verified",
      panMasked: maskPan(cleanId(pan)),
      aadhaarLast4: aadhaarLast4(aadhaar),
      reason: problem ?? undefined,
    };
  },
};

/** Swap for the live provider here. */
export const kyc: KycService = mockKyc;
