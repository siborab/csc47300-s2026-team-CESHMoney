// Shared constants and helper functions used by auth, dashboard, and converter
// pages. Centralized here so the page components stay focused on rendering.

// Browser storage keys used across auth, dashboard, and converter features.
// These keys keep app data in localStorage so the browser remembers state after refresh.
export const SESSION_KEY = "spendwise_session";
export const EXPENSES_DB_KEY = "spendwise_expenses_db_v1";
export const EXPENSES_DB_VERSION_KEY = "spendwise_expenses_db_version";
export const EXPENSES_DB_VERSION = "6";
export const HOME_CURRENCY_KEY = "spendwise_home_currency";
export const LOCKED_RATE_KEY = "spendwise_locked_rate_snapshot";
export const FAVORITE_PAIRS_KEY = "spendwise_favorite_currency_pairs";
// Staged category edits awaiting approval (not applied to EXPENSES_DB_KEY until approved).
export const PENDING_CATEGORIES_KEY = "spendwise_category_pending_approval_v1";

// Default categories used by the dashboard budget summary.
// Categories are stored as an array of { category, budget } so the user can add
// or remove categories at runtime via the "Edit Categories" modal.
export const DEFAULT_CATEGORY_BUDGET_LIST = [
  { category: "rent", budget: 1600 },
  { category: "groceries", budget: 450 },
  { category: "utilities", budget: 300 },
  { category: "food", budget: 500 },
  { category: "transport", budget: 250 },
  { category: "entertainment", budget: 200 },
  { category: "other", budget: 200 }
];

// Demo exchange rates used by the converter feature.
export const RATE_TO_USD = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  JPY: 0.0067,
  MXN: 0.058
};

// Safely reads JSON data from localStorage.
export function readJsonFromStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

// Makes email comparisons case-insensitive.
export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// Reads the saved login session from the browser.
export function readSession() {
  return readJsonFromStorage(SESSION_KEY, null);
}

export function writeSession(user) {
  // Save a minimal signed-in user object for client-side auth.
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      isLoggedIn: true,
      user
    })
  );
}

// Clears the saved login session from the browser.
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Formats numbers for cards, tables, and converter results.
export function formatCurrency(amount, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(amount);
}

// Adds a plus or minus sign for transaction table amounts.
export function formatTableAmount(amount) {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

// Makes exchange rates shorter and easier to read.
export function formatRate(rate) {
  return Number(rate).toFixed(4).replace(/\.?0+$/, "");
}

// Converts an ISO date string into a short month/day label.
export function formatShortDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

// Checks whether a transaction belongs to the current month.
export function isInCurrentMonth(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

// Maps raw values into one of the user's configured budget categories.
// Falls back to "other" when the raw value does not match a known category.
export function normalizeCategory(rawCategory, categoryBudgetList) {
  const category = String(rawCategory || "").trim().toLowerCase();
  if (category === "housing") {
    return "rent";
  }
  if (category === "income") {
    return "income";
  }
  const list = Array.isArray(categoryBudgetList) ? categoryBudgetList : [];
  const known = list.some((item) => String(item.category).toLowerCase() === category);
  return known ? category : "other";
}

// Labels displayed in the UI for each category.
// Custom categories are title-cased automatically.
export function categoryLabel(category) {
  const builtInLabels = {
    rent: "Rent",
    groceries: "Groceries",
    utilities: "Utilities",
    food: "Food",
    transport: "Transport",
    entertainment: "Entertainment",
    other: "Other",
    housing: "Housing",
    income: "Income"
  };
  if (builtInLabels[category]) {
    return builtInLabels[category];
  }
  return String(category || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || "Other";
}

// Builds a sortable value so recent transactions show first.
export function transactionSortValue(item) {
  const datePart = item.date || "";
  const createdPart = item.createdAt || `${datePart}T00:00:00`;
  return `${datePart}|${createdPart}`;
}

// Shared expenses store a per-person amount, so this returns the displayed amount.
export function getEffectiveExpenseAmount(item) {
  const rawAmount = Number(item.amount || 0);
  const splitInfo = item.splitBetween;

  if (
    rawAmount < 0 &&
    splitInfo &&
    typeof splitInfo === "object" &&
    Number.isFinite(Number(splitInfo.eachAmount)) &&
    Number(splitInfo.eachAmount) > 0
  ) {
    return -Math.abs(Number(splitInfo.eachAmount));
  }

  return rawAmount;
}

// Builds a categoryBudget2 array from any supported saved-data shape.
// Prefers an explicit `categoryBudget2` array, falls back to a legacy
// `categoryBudgets` object, then to the default list.
export function buildCategoryBudgetList(db) {
  if (Array.isArray(db && db.categoryBudget2) && db.categoryBudget2.length > 0) {
    return db.categoryBudget2.map((item) => ({
      category: String(item.category || "").trim().toLowerCase() || "other",
      budget: Number(item.budget || 0)
    }));
  }

  if (db && db.categoryBudgets && typeof db.categoryBudgets === "object") {
    const entries = Object.entries(db.categoryBudgets);
    if (entries.length > 0) {
      return entries.map(([category, budget]) => ({
        category: String(category).trim().toLowerCase(),
        budget: Number(budget || 0)
      }));
    }
  }

  return DEFAULT_CATEGORY_BUDGET_LIST.map((item) => ({ ...item }));
}

// Normalizes seeded or saved data into the shape the dashboard expects.
export function normalizeDbShape(db) {
  const categoryBudget2 = buildCategoryBudgetList(db);
  const normalizedTransactions = Array.isArray(db && db.transactions)
    ? db.transactions.map((item) => ({
        ...item,
        category: normalizeCategory(item.category, categoryBudget2),
        createdAt: item.createdAt || `${item.date}T00:00:00`
      }))
    : [];

  return {
    monthlyIncome: Number((db && db.monthlyIncome) || 0),
    categoryBudget2,
    startingBalance: Number((db && db.startingBalance) || 0),
    transactions: normalizedTransactions
  };
}

// Saves the current dashboard database back to localStorage.
export function writeLocalDb(db) {
  localStorage.setItem(EXPENSES_DB_KEY, JSON.stringify(db));
  localStorage.setItem(EXPENSES_DB_VERSION_KEY, EXPENSES_DB_VERSION);
}

// Reads number inputs safely for converter calculations.
export function parseAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// Converts between currencies by using USD as a common base.
export function convertAmount(amount, fromCurrency, toCurrency) {
  const fromRate = RATE_TO_USD[fromCurrency];
  const toRate = RATE_TO_USD[toCurrency];
  if (!fromRate || !toRate) {
    return 0;
  }
  return (amount * fromRate) / toRate;
}

// Labels for expense types in the add-expense modal.
export function expenseTypeToDescription(type) {
  const builtIn = {
    rent: "Rent",
    groceries: "Groceries",
    utilities: "Utilities",
    food: "Food",
    transport: "Transport",
    entertainment: "Entertainment",
    other: "Other"
  };
  return builtIn[type] || categoryLabel(type) || "Expense";
}

// Split in cents first to avoid common floating-point rounding issues.
export function buildEqualSplit(count, totalAmount) {
  const totalCents = Math.round(totalAmount * 100);
  const perPersonCents = Math.round(totalCents / count);
  return perPersonCents / 100;
}

export function readPendingCategoryChanges() {
  return readJsonFromStorage(PENDING_CATEGORIES_KEY, null);
}

export function writePendingCategoryChanges(payload) {
  localStorage.setItem(PENDING_CATEGORIES_KEY, JSON.stringify(payload));
}

export function clearPendingCategoryChanges() {
  localStorage.removeItem(PENDING_CATEGORIES_KEY);
}

// Applies renames in order so chained renames (a→b, b→c) update transactions correctly.
export function applyCategoryRenamesToTransactions(transactions, renames) {
  if (!Array.isArray(transactions) || !Array.isArray(renames) || renames.length === 0) {
    return Array.isArray(transactions) ? transactions : [];
  }
  let txs = transactions;
  for (const { from, to } of renames) {
    if (!from || from === to) {
      continue;
    }
    txs = txs.map((t) => (t.category === from ? { ...t, category: to } : t));
  }
  return txs;
}
