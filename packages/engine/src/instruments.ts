import type { InstrumentType } from "@arthmitra/schema";

/**
 * One generic table per time horizon, identical for every user. ArthMitra never
 * names a fund, stock or insurance product and never pre-fills a return figure.
 */
export type HorizonBand = "under_1y" | "1_to_3y" | "over_3y";

export const BAND_LABEL: Record<HorizonBand, string> = {
  under_1y: "Under 1 year",
  "1_to_3y": "1–3 years",
  over_3y: "Over 3 years",
};

export function horizonBand(monthsLeft: number): HorizonBand {
  if (monthsLeft < 12) return "under_1y";
  if (monthsLeft <= 36) return "1_to_3y";
  return "over_3y";
}

export interface InstrumentInfo {
  type: InstrumentType;
  name: string;
  risk: "Low" | "Low to moderate" | "Moderate" | "High";
  liquidity: string;
  why: string;
  regulator: string;
  bands: HorizonBand[];
}

export const INSTRUMENTS: Record<InstrumentType, InstrumentInfo> = {
  savings: {
    type: "savings",
    name: "Savings account",
    risk: "Low",
    liquidity: "Any day",
    why: "Money stays available whenever you need it, which suits a goal that is close.",
    regulator: "RBI (bank deposit)",
    bands: ["under_1y"],
  },
  fd: {
    type: "fd",
    name: "Fixed deposit (FD)",
    risk: "Low",
    liquidity: "At maturity; early exit usually costs a penalty",
    why: "A fixed rate for a fixed term, so you know the amount on the maturity date.",
    regulator: "RBI (bank deposit)",
    bands: ["under_1y", "1_to_3y", "over_3y"],
  },
  rd: {
    type: "rd",
    name: "Recurring deposit (RD)",
    risk: "Low",
    liquidity: "At maturity; early exit usually costs a penalty",
    why: "You put in the same amount every month, which matches a monthly saving plan.",
    regulator: "RBI (bank deposit)",
    bands: ["under_1y", "1_to_3y"],
  },
  liquid: {
    type: "liquid",
    name: "Liquid fund",
    risk: "Low to moderate",
    liquidity: "Usually next working day; small exit load in the first 7 days",
    why: "A mutual fund holding very short-term debt, for money you may need at short notice.",
    regulator: "SEBI (mutual fund)",
    bands: ["under_1y"],
  },
  short_debt: {
    type: "short_debt",
    name: "Short-duration debt fund",
    risk: "Moderate",
    liquidity: "Any working day; check the scheme's exit load",
    why: "Holds bonds maturing in a few years; its value moves with interest rates, so it suits money not needed for at least a year.",
    regulator: "SEBI (mutual fund)",
    bands: ["1_to_3y"],
  },
  debt: {
    type: "debt",
    name: "Debt fund",
    risk: "Low to moderate",
    liquidity: "Any working day; check the scheme's exit load",
    why: "The steadier part of a long goal, holding bonds rather than shares.",
    regulator: "SEBI (mutual fund)",
    bands: ["over_3y"],
  },
  index: {
    type: "index",
    name: "Equity index fund or ETF",
    risk: "High",
    liquidity: "Any working day; value can fall sharply in a bad year",
    why: "Tracks a market index at low cost; ups and downs even out only over several years.",
    regulator: "SEBI (mutual fund / ETF)",
    bands: ["over_3y"],
  },
  gold: {
    type: "gold",
    name: "Gold ETF or gold mutual fund",
    risk: "Moderate",
    liquidity: "Any working day",
    why: "The SEBI-regulated way to hold gold, which often moves differently from shares. Not unregulated \"digital gold\".",
    regulator: "SEBI (ETF / mutual fund)",
    bands: ["over_3y"],
  },
  bonds: {
    type: "bonds",
    name: "High-rated bonds",
    risk: "Low to moderate",
    liquidity: "At maturity, or sold on an exchange at the day's price",
    why: "You lend to a company or bank for a fixed interest; pick only high-rated (AAA) issuers.",
    regulator: "SEBI (listed bonds)",
    bands: ["1_to_3y", "over_3y"],
  },
  gsec: {
    type: "gsec",
    name: "Government bonds (G-Secs)",
    risk: "Low",
    liquidity: "At maturity, or sold through RBI Retail Direct / an exchange",
    why: "A loan to the Government of India, the safest borrower in the country.",
    regulator: "RBI (Retail Direct)",
    bands: ["1_to_3y", "over_3y"],
  },
  tbill: {
    type: "tbill",
    name: "Treasury bills (T-Bills)",
    risk: "Low",
    liquidity: "Matures in 91, 182 or 364 days",
    why: "Very short government loans; good parking for money needed within a year.",
    regulator: "RBI (Retail Direct)",
    bands: ["under_1y", "1_to_3y"],
  },
  hybrid: {
    type: "hybrid",
    name: "Hybrid mutual fund",
    risk: "Moderate",
    liquidity: "Any working day; check the scheme's exit load",
    why: "Mixes shares and bonds in one fund, so the ups and downs are softer than pure equity.",
    regulator: "SEBI (mutual fund)",
    bands: ["1_to_3y", "over_3y"],
  },
  equity: {
    type: "equity",
    name: "Equity mutual fund",
    risk: "High",
    liquidity: "Any working day; value can fall sharply in a bad year",
    why: "A professionally managed basket of shares; the highest growth potential, best held 7+ years.",
    regulator: "SEBI (mutual fund)",
    bands: ["over_3y"],
  },
  stocks: {
    type: "stocks",
    name: "Direct stocks",
    risk: "High",
    liquidity: "Any trading day; single companies can swing a lot",
    why: "Owning shares of companies directly. Keep it a small slice and spread across sectors.",
    regulator: "SEBI (stock exchange)",
    bands: ["over_3y"],
  },
};

/** Category-level labels used on plans, holdings and "Invest" buttons, e.g. "Nifty 50 index fund". */
export const INSTRUMENT_LABEL: Record<InstrumentType, string> = {
  savings: "Savings account",
  fd: "Bank fixed deposit (FD)",
  rd: "Bank recurring deposit (RD)",
  liquid: "Liquid fund",
  short_debt: "Short-duration debt fund",
  debt: "Debt mutual fund",
  index: "Nifty 50 index fund",
  gold: "Gold ETF / gold fund",
  bonds: "AAA-rated bonds",
  gsec: "Government bonds (G-Secs)",
  tbill: "Treasury bills",
  hybrid: "Hybrid mutual fund",
  equity: "Equity mutual fund (flexi-cap)",
  stocks: "Direct stocks (diversified)",
};

export function instrumentsForBand(band: HorizonBand): InstrumentInfo[] {
  return Object.values(INSTRUMENTS).filter((i) => i.bands.includes(band));
}
