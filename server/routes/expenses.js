import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// Server-side computation of the per-person split, in cents to avoid float drift.
function computeSplit(totalAmount, splitCount) {
  if (!Number.isFinite(splitCount) || splitCount < 2) return null;
  const totalCents = Math.round(totalAmount * 100);
  const perPersonCents = Math.round(totalCents / splitCount);
  return perPersonCents / 100;
}

// GET /api/expenses?userId=...
router.get(
  "/",
  asyncHandler(async (req, res) => {
    let query = supabase.from("expenses").select("*").order("date", { ascending: false });
    if (req.query.userId) {
      query = query.eq("user_id", req.query.userId);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ expenses: data || [] });
  })
);

// POST /api/expenses
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      userId,
      date,
      description,
      category,
      baseAmount,
      tipPercent,
      type = "expense",
      isSplit,
      splitCount
    } = req.body || {};

    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!date) return res.status(400).json({ error: "date is required" });

    const numericBase = Number(baseAmount);
    if (!Number.isFinite(numericBase) || numericBase <= 0) {
      return res.status(400).json({ error: "baseAmount must be > 0" });
    }
    const tip = Number(tipPercent || 0);
    if (!Number.isFinite(tip) || tip < 0) {
      return res.status(400).json({ error: "tipPercent must be >= 0" });
    }

    const totalAmount = numericBase + (numericBase * tip) / 100;
    let effectiveAmount = totalAmount;
    let eachAmount = null;
    let storedSplitCount = null;
    if (isSplit) {
      const split = computeSplit(totalAmount, Number(splitCount));
      if (split === null) {
        return res.status(400).json({ error: "splitCount must be an integer >= 2 when isSplit is true" });
      }
      eachAmount = split;
      storedSplitCount = Number(splitCount);
      effectiveAmount = split;
    }

    const signedAmount = type === "income" ? Math.abs(effectiveAmount) : -Math.abs(effectiveAmount);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: userId,
        date,
        description: description || null,
        category: (category || "other").toLowerCase(),
        amount: signedAmount,
        type,
        split_count: storedSplitCount,
        each_amount: eachAmount
      })
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ expense: data });
  })
);

// PUT /api/expenses/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const updates = {};
    const body = req.body || {};
    if (body.date !== undefined) updates.date = body.date;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = String(body.category).toLowerCase();
    if (body.amount !== undefined) updates.amount = Number(body.amount);
    if (body.type !== undefined) updates.type = body.type;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields supplied" });
    }
    const { data, error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ expense: data });
  })
);

// DELETE /api/expenses/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from("expenses").delete().eq("id", req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  })
);

export default router;
