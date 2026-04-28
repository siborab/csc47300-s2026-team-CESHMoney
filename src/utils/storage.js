import {
  DEFAULT_CATEGORY_BUDGETS,
  EXPENSES_DB_KEY,
  EXPENSES_DB_VERSION,
  EXPENSES_DB_VERSION_KEY,
  SESSION_KEY
} from "./constants";
import { normalizeCategory } from "./dashboard";

export function readJsonFromStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function readSession() {
  return readJsonFromStorage(SESSION_KEY, null);
}

export function writeSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      isLoggedIn: true,
      user
    })
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function normalizeDbShape(db) {
  const normalizedTransactions = Array.isArray(db.transactions)
    ? db.transactions.map((item) => ({
        ...item,
        category: normalizeCategory(item.category),
        createdAt: item.createdAt || `${item.date}T00:00:00`
      }))
    : [];

  return {
    monthlyIncome: Number(db.monthlyIncome || 0),
    categoryBudgets: {
      ...DEFAULT_CATEGORY_BUDGETS,
      ...(db.categoryBudgets || {})
    },
    startingBalance: Number(db.startingBalance || 0),
    transactions: normalizedTransactions
  };
}

export function writeLocalDb(db) {
  localStorage.setItem(EXPENSES_DB_KEY, JSON.stringify(db));
  localStorage.setItem(EXPENSES_DB_VERSION_KEY, EXPENSES_DB_VERSION);
}

export async function loadDashboardDbFromStorageOrSeed() {
  const localDbVersion = localStorage.getItem(EXPENSES_DB_VERSION_KEY);
  const localDb = localDbVersion === EXPENSES_DB_VERSION ? readJsonFromStorage(EXPENSES_DB_KEY, null) : null;

  if (localDb && Array.isArray(localDb.transactions)) {
    return normalizeDbShape(localDb);
  }

  try {
    const response = await fetch("/expenses.json", { cache: "no-store" });
    const data = await response.json();
    const normalized = normalizeDbShape(data);
    writeLocalDb(normalized);
    return normalized;
  } catch (error) {
    return normalizeDbShape({
      monthlyIncome: 0,
      categoryBudgets: DEFAULT_CATEGORY_BUDGETS,
      startingBalance: 0,
      transactions: []
    });
  }
}
