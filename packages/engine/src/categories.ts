import type { Category } from "@arthmitra/schema";

type Seed = Pick<Category, "id" | "name" | "icon" | "discretionary" | "system">;

/** Icons are Material Symbols names. */
const SEEDS: Seed[] = [
  { id: "rent", name: "Rent", icon: "home", discretionary: false, system: false },
  { id: "food", name: "Food", icon: "restaurant", discretionary: true, system: false },
  { id: "groceries", name: "Groceries", icon: "local_grocery_store", discretionary: false, system: false },
  { id: "travel", name: "Travel", icon: "directions_car", discretionary: true, system: false },
  { id: "shopping", name: "Shopping", icon: "shopping_bag", discretionary: true, system: false },
  { id: "bills", name: "Bills", icon: "receipt_long", discretionary: false, system: false },
  { id: "emi", name: "EMI", icon: "account_balance", discretionary: false, system: false },
  { id: "education", name: "Education", icon: "school", discretionary: false, system: false },
  { id: "health", name: "Health", icon: "medical_services", discretionary: false, system: false },
  { id: "entertainment", name: "Entertainment", icon: "movie", discretionary: true, system: false },
  { id: "others", name: "Others", icon: "category", discretionary: false, system: false },
  { id: "income", name: "Income", icon: "payments", discretionary: false, system: true },
  { id: "refund", name: "Refund", icon: "currency_exchange", discretionary: false, system: true },
  { id: "transfer", name: "Own transfer", icon: "sync_alt", discretionary: false, system: true },
  { id: "investment", name: "Investment", icon: "savings", discretionary: false, system: true },
  { id: "lent", name: "Lent money", icon: "handshake", discretionary: false, system: true },
];

export function defaultCategories(): Category[] {
  return SEEDS.map((seed, order) => ({ ...seed, monthlyLimitPaise: null, order }));
}

/** Categories a debit can be sorted into (not income/refund/transfer/investment). */
export function spendCategories(categories: Category[]): Category[] {
  return categories.filter((c) => !c.system).sort((a, b) => a.order - b.order);
}

export function categoryName(categories: Category[], id: string | null): string {
  if (!id) return "Uncategorised";
  return categories.find((c) => c.id === id)?.name ?? id;
}

/** Slug for a new user category id: "Kids activities" → "kids-activities". */
export function categoryIdFromName(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "category";
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}
