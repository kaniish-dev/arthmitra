import type { InstrumentType } from "@arthmitra/schema";
import type { ResearchCriteria, ResearchFund } from "@arthmitra/engine";

/**
 * Category research settings: which AMFI categories make up each plan category's peer group,
 * which schemes count, and how they are judged. Edit here, then rebuild the snapshot with
 * `npm run research:snapshot -w web`. Type imports only, so the build script can load this file.
 */
export interface ResearchCategory extends ResearchCriteria {
  /** What the peer group is, in plain words. */
  peerGroup: string;
  /** AMFI category headers in NAVAll.txt (both old and new spellings). */
  amfiCategories: string[];
  /** Scheme name must match (when set). */
  include?: RegExp;
  exclude?: RegExp;
  kind: (name: string, amfiCategory: string) => ResearchFund["kind"];
  /** Extra caveat shown under the shortlist. */
  note?: string;
}

const isEtf = (c: string) => /ETF/i.test(c);
const fundKind = (name: string, c: string): ResearchFund["kind"] => (isEtf(c) ? "ETF" : /fund of funds|\bfof\b/i.test(name) || /FoF|Fund of Funds/i.test(c) ? "Fund of funds" : "Fund");

export const RESEARCH: Partial<Record<InstrumentType, ResearchCategory>> = {
  index: {
    peerGroup: "Nifty 50 index funds and ETFs",
    amfiCategories: ["Index Funds - Equity Funds", "Other Scheme - Index Funds", "Exchange Traded Funds (ETFs) - Equity ETF", "Other Scheme - Other  ETFs"],
    include: /nifty\s*50\b/i,
    exclude: /elss|tax saver|next|equal|value|momentum|quality|alpha|low\s*vol|shariah|arbitrage|dividend|top\s*\d|fof|fund of funds|\d+\s*:\s*\d+|midcap|smallcap/i,
    kind: (_n, c) => (isEtf(c) ? "ETF" : "Index fund"),
    trackingOnly: true,
    minYears: 3,
    note: "Every fund here holds the same 50 shares, so lower cost and a return closer to the best peer mean less is lost in tracking. For ETFs, also check trading volume and the buy/sell price gap on the exchange — exchange data isn't shown here.",
  },
  equity: {
    peerGroup: "Flexi cap equity funds",
    amfiCategories: ["Equity Scheme - Flexi Cap Fund", "Equity Schemes - Flexi Cap Fund"],
    kind: fundKind,
    minYears: 3,
  },
  hybrid: {
    peerGroup: "Balanced advantage (dynamic asset allocation) funds",
    amfiCategories: ["Hybrid Scheme - Dynamic Asset Allocation or Balanced Advantage", "Hybrid Schemes - Balanced Advantage Fund/ Dynamic Asset Allocation"],
    kind: fundKind,
    minYears: 3,
  },
  debt: {
    peerGroup: "Corporate bond funds",
    amfiCategories: ["Debt Scheme - Corporate Bond Fund", "Income/Debt Oriented Schemes - Corporate Bond Fund"],
    kind: fundKind,
    minYears: 3,
  },
  short_debt: {
    peerGroup: "Short duration debt funds",
    amfiCategories: ["Debt Scheme - Short Duration Fund", "Income/Debt Oriented Schemes - Short Term Fund"],
    kind: fundKind,
    minYears: 3,
  },
  liquid: {
    peerGroup: "Liquid funds",
    amfiCategories: ["Debt Scheme - Liquid Fund", "Income/Debt Oriented Schemes - Liquid Fund"],
    kind: fundKind,
    minYears: 3,
  },
  bonds: {
    peerGroup: "Banking and PSU debt funds",
    amfiCategories: ["Debt Scheme - Banking and PSU Fund", "Income/Debt Oriented Schemes - Banking and PSU Debt Fund"],
    kind: fundKind,
    minYears: 3,
  },
  gsec: {
    peerGroup: "Gilt funds (government securities)",
    amfiCategories: ["Debt Scheme - Gilt Fund", "Income/Debt Oriented Schemes - Gilt Fund", "Gilt"],
    exclude: /constant maturity/i,
    kind: fundKind,
    minYears: 3,
    note: "You can also buy government securities and treasury bills directly through the RBI's own retail platform, with no fund in between.",
  },
  gold: {
    peerGroup: "Gold ETFs and gold funds",
    amfiCategories: ["Other Scheme - Gold ETF", "Exchange Traded Funds (ETFs) - Gold ETF", "Other Scheme - FoF Domestic", "Fund of Funds Scheme (Domestic) - Fund of Funds Scheme (Domestic)"],
    include: /gold/i,
    exclude: /silver|multi|asset/i,
    kind: fundKind,
    trackingOnly: true,
    minYears: 3,
    note: "All of these follow the domestic gold price, so cost and how closely each follows it matter most. Gold ETFs need a demat account; gold funds don't.",
  },
};

/** Stocks get research criteria only: picking individual shares for someone is regulated advice. */
export const STOCK_RESEARCH = {
  title: "How to research a listed company",
  points: [
    "Growth: sales and profit rising steadily over 5 years, not just one good year.",
    "Profitability: return on equity above about 15% for several years.",
    "Debt: debt-to-equity below 1 for most non-bank companies.",
    "Valuation: P/E compared with the company's own history and its sector, not just the market.",
    "Cash: operating cash flow close to reported profit — profit that never turns into cash is a warning.",
    "Spread: no single share above 5 to 10% of your portfolio.",
  ],
  note: "ArthMitra doesn't shortlist individual shares: picking stocks for a person is regulated investment advice in India. An index fund gives you the 50 biggest companies in one go.",
};

/** Where every figure comes from, shown under each shortlist. */
export const RESEARCH_SOURCES = {
  nav: "Daily NAVs published by AMFI (via mfapi.in)",
  ter: "Expense ratios disclosed to AMFI (direct plans; ETFs have one plan)",
};
