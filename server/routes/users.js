import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabase.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { publicUser } from "./auth.js";

const router = Router();

// GET /api/users - list all users (admin view).
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: (data || []).map(publicUser) });
  })
);

// GET /api/users/:id - profile + activity history (expenses + subscriptions).
// Used by both the public profile page and the admin detail page.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!user) return res.status(404).json({ error: "User not found" });

    const [{ data: expenses }, { data: subscriptions }] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", id)
        .order("date", { ascending: false })
        .limit(50),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
    ]);

    res.json({
      user: publicUser(user),
      expenses: expenses || [],
      subscriptions: subscriptions || []
    });
  })
);

// PUT /api/users/:id - update name / email / role / password (admin or self).
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { fullName, email, role, password } = req.body || {};
    const updates = {};
    if (fullName !== undefined) updates.full_name = String(fullName).trim();
    if (email !== undefined) updates.email = String(email).trim().toLowerCase();
    if (role !== undefined) updates.role = role === "admin" ? "admin" : "user";
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      updates.password = await bcrypt.hash(password, 10);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields supplied" });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: publicUser(data) });
  })
);

// DELETE /api/users/:id - remove user (cascades to their data).
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  })
);

export default router;
