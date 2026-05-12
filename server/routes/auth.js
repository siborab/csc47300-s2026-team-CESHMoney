import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabase.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// Returns a sanitized user object that is safe to send to the browser.
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

// POST /api/auth/signup
// Creates a new account in Supabase, hashes the password with bcrypt,
// and returns the new user (without the password hash).
router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "fullName, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from("users")
      .insert({
        full_name: String(fullName).trim(),
        email: normalizedEmail,
        password: passwordHash,
        role: "user"
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Seed the new user's default category budgets so the dashboard works immediately.
    const defaults = [
      ["rent", 1600], ["groceries", 450], ["utilities", 300],
      ["food", 500], ["transport", 250], ["entertainment", 200], ["other", 200]
    ];
    await supabase.from("categories").insert(
      defaults.map(([name, budget]) => ({ user_id: data.id, name, budget }))
    );

    res.status(201).json({ user: publicUser(data) });
  })
);

// POST /api/auth/login
// Verifies email + password against bcrypt hash and returns the user.
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordOk = await bcrypt.compare(password, data.password);
    if (!passwordOk) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({ user: publicUser(data) });
  })
);

export default router;
export { publicUser };
