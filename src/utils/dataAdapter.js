// Bridges the Supabase row shape (snake_case, fields like each_amount)
// with the shape the original UI was built around (createdAt, splitBetween, etc.).
// Keeping this in one place means most pages don't need to know about the DB columns.

export function expenseRowToTransaction(row) {
  if (!row) return null;
  const splitInfo = row.split_count && row.each_amount
    ? { splitCount: Number(row.split_count), eachAmount: Number(row.each_amount) }
    : null;
  return {
    id: row.id,
    date: row.date,
    createdAt: row.created_at || `${row.date}T00:00:00`,
    description: row.description || "",
    category: row.category || "other",
    amount: Number(row.amount || 0),
    type: row.type || "expense",
    splitBetween: splitInfo
  };
}

export function categoryRowToBudgetEntry(row) {
  return {
    id: row.id,
    category: row.name,
    budget: Number(row.budget || 0)
  };
}

export function subscriptionRowToCard(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    price: Number(row.price || 0),
    billingCycle: row.billing_cycle,
    nextBilling: row.next_billing,
    notes: row.notes || "",
    createdAt: row.created_at,
    owner: row.owner || null
  };
}
