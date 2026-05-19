import { BUDGET_CATEGORY_ORDER } from "./constants";

export function isInCurrentMonth(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export function normalizeCategory(rawCategory) {
  const category = String(rawCategory || "").trim().toLowerCase();
  if (category === "housing") {
    return "rent";
  }
  // Return the custom category instead of forcing "other"
  return category || "other";
}

export function categoryLabel(category) {
  const labels = {
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
  
  // Return known label, or capitalize the custom name
  if (labels[category]) return labels[category];
  if (!category) return "Other";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function transactionSortValue(item) {
  const datePart = item.date || "";
  const createdPart = item.createdAt || `${datePart}T00:00:00`;
  return `${datePart}|${createdPart}`;
}

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

export function expenseTypeToDescription(type) {
  const labels = {
    rent: "Rent",
    groceries: "Groceries",
    utilities: "Utilities",
    food: "Food",
    transport: "Transport",
    entertainment: "Entertainment",
    other: "Other"
  };
  return labels[type] || "Expense";
}

export function buildEqualSplit(count, totalAmount) {
  const totalCents = Math.round(totalAmount * 100);
  const perPersonCents = Math.round(totalCents / count);
  return perPersonCents / 100;
}
