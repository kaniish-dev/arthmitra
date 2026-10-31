import { todayIso } from "@arthmitra/engine";
import type { Goal, Holding, InvestmentAccount } from "@arthmitra/schema";
import { mockHoldings } from "@arthmitra/seed";
import { ALLOCATION_CONFIG } from "@/config/plan";
import { shortId } from "@/lib/ids";

/**
 * Portfolio tracking: read-only holdings from the user's (or guardian's) account on a
 * third-party investment app. MOCKED — holdings are made from each goal's plan. Live, a
 * portfolio-tracking provider (for mutual funds, the RTA consolidated-statement APIs; for
 * shares and bonds, the depository's) is called from a server with the user's consent.
 */
export interface PortfolioTrackingAPI {
  readonly live: boolean;
  connect(args: { provider: string; owner: InvestmentAccount["owner"] }): Promise<InvestmentAccount>;
  fetchHoldings(account: InvestmentAccount, goals: Goal[]): Promise<Holding[]>;
}

export const mockPortfolio: PortfolioTrackingAPI = {
  live: false,
  async connect({ provider, owner }) {
    await new Promise((r) => setTimeout(r, 900));
    return {
      id: `inv-acc-${shortId()}`,
      provider,
      owner,
      status: "connected",
      consentAt: new Date().toISOString(),
      lastSyncedAt: null,
    };
  },
  async fetchHoldings(account, goals) {
    await new Promise((r) => setTimeout(r, 1100));
    return mockHoldings({ account, goals, returnsPct: ALLOCATION_CONFIG.returnsPct, today: todayIso(), nowIso: new Date().toISOString() });
  },
};

export const portfolioApi: PortfolioTrackingAPI = mockPortfolio;
