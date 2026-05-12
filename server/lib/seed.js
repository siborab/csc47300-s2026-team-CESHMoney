import bcrypt from "bcryptjs";
import { supabase } from "./supabase.js";

const DEFAULT_CATEGORIES = [
  { name: "rent", budget: 1600 },
  { name: "groceries", budget: 450 },
  { name: "utilities", budget: 300 },
  { name: "food", budget: 500 },
  { name: "transport", budget: 250 },
  { name: "entertainment", budget: 200 },
  { name: "other", budget: 200 }
];

const DEMO_SUBSCRIPTIONS = [
  { name: "Netflix", category: "entertainment", price: 15.49, billing_cycle: "monthly", days_until: 7, notes: "Standard plan" },
  { name: "Spotify", category: "entertainment", price: 9.99, billing_cycle: "monthly", days_until: 12, notes: "Individual plan" },
  { name: "iCloud+", category: "utilities", price: 2.99, billing_cycle: "monthly", days_until: 21, notes: "200GB storage" }
];

async function ensureUser({ fullName, email, password, role }) {
  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    console.warn(`[seed] lookup failed for ${email}:`, lookupError.message);
    return null;
  }
  if (existing) {
    return existing.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from("users")
    .insert({ full_name: fullName, email, password: passwordHash, role })
    .select("id")
    .single();

  if (error) {
    console.warn(`[seed] failed to insert ${email}:`, error.message);
    return null;
  }
  console.log(`[seed] created ${role} ${email}`);
  return data.id;
}

async function ensureCategories(userId) {
  if (!userId) return;
  const { data: existing } = await supabase
    .from("categories")
    .select("name")
    .eq("user_id", userId);

  const have = new Set((existing || []).map((row) => row.name));
  const missing = DEFAULT_CATEGORIES.filter((row) => !have.has(row.name));
  if (missing.length === 0) return;

  const payload = missing.map((row) => ({ user_id: userId, ...row }));
  const { error } = await supabase.from("categories").insert(payload);
  if (error) {
    console.warn("[seed] failed to seed categories:", error.message);
  }
}

async function ensureDemoSubscriptions(userId) {
  if (!userId) return;
  const { count } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) return;

  const today = new Date();
  const payload = DEMO_SUBSCRIPTIONS.map(({ days_until, ...row }) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days_until);
    return {
      ...row,
      user_id: userId,
      next_billing: date.toISOString().slice(0, 10)
    };
  });

  const { error } = await supabase.from("subscriptions").insert(payload);
  if (error) {
    console.warn("[seed] failed to seed subscriptions:", error.message);
  } else {
    console.log(`[seed] inserted ${payload.length} demo subscriptions`);
  }
}

export async function runSeed() {
  try {
    const adminId = await ensureUser({
      fullName: "Admin User",
      email: "admin@spendwise.com",
      password: "admin123",
      role: "admin"
    });
    const demoId = await ensureUser({
      fullName: "Demo User",
      email: "demo@spendwise.com",
      password: "demo123",
      role: "user"
    });

    await ensureCategories(adminId);
    await ensureCategories(demoId);
    await ensureDemoSubscriptions(demoId);
  } catch (error) {
    console.warn("[seed] seeding skipped:", error.message);
  }
}
