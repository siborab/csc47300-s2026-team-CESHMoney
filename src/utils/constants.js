export const SESSION_KEY = "spendwise_session";
export const EXPENSES_DB_KEY = "spendwise_expenses_db_v1";
export const EXPENSES_DB_VERSION_KEY = "spendwise_expenses_db_version";
export const EXPENSES_DB_VERSION = "6";
export const HOME_CURRENCY_KEY = "spendwise_home_currency";
export const LOCKED_RATE_KEY = "spendwise_locked_rate_snapshot";
export const FAVORITE_PAIRS_KEY = "spendwise_favorite_currency_pairs";

export const BUDGET_CATEGORY_ORDER = [
  "rent",
  "groceries",
  "utilities",
  "food",
  "transport",
  "entertainment",
  "other"
];

export const DEFAULT_CATEGORY_BUDGETS = {
  rent: 1600,
  groceries: 450,
  utilities: 300,
  food: 500,
  transport: 250,
  entertainment: 200,
  other: 200
};

export const RATE_TO_USD = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  JPY: 0.0067,
  MXN: 0.058
};
