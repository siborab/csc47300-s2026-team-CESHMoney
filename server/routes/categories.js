import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// GET /api/categories?userId=...
router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.query.userId) {
      return res.status(400).json({ error: "userId query parameter is required" });
    }
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", req.query.userId)
      .order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ categories: data || [] });
  })
);

// POST /api/categories - upsert by (user_id, name)
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { userId, name, budget } = req.body || {};
    if (!userId || !name) return res.status(400).json({ error: "userId and name are required" });
    const numericBudget = Number(budget);
    if (!Number.isFinite(numericBudget) || numericBudget < 0) {
      return res.status(400).json({ error: "budget must be a non-negative number" });
    }
    const payload = {
      user_id: userId,
      name: String(name).trim().toLowerCase(),
      budget: numericBudget
    };
    const { data, error } = await supabase
      .from("categories")
      .upsert(payload, { onConflict: "user_id,name" })
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ category: data });
  })
);

// PUT /api/categories/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim().toLowerCase();
    if (req.body.budget !== undefined) updates.budget = Number(req.body.budget);
    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ category: data });
  })
);

// DELETE /api/categories/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  })
);

export default router;
