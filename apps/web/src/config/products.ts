import { ILLUSTRATIVE_PRODUCTS, type ProductTerms } from "@arthmitra/engine";

/**
 * Deposit products the savings recommendation chooses from. Until a provider's product API is
 * connected, this is the illustrative catalogue: typical tenures, minimums and withdrawal rules,
 * with no rates, so no maturity amount is shown and every recommendation is labelled
 * illustrative. To go live, replace this list with the partner's actual products (tenures
 * offered, minimum deposit, rate, premature-withdrawal rule, availability) and set
 * source: "provider".
 */
export const PRODUCTS: ProductTerms[] = ILLUSTRATIVE_PRODUCTS;
