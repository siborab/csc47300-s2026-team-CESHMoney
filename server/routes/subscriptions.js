import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

const ALLOWED_CYCLES = new Set(["weekly", "monthly", "yearly"]);

function normalizeBody(body) {
  const normalized = {};
  if (body.userId !== undefined) normalized.user_id = body.userId;
  if (body.name !== undefined) normalized.name = String(body.name).trim();
  if (body.category !== undefined) normalized.category = String(body.category).trim().toLowerCase();
  if (body.price !== undefined) normalized.price = Number(body.price);
  if (body.billingCycle !== undefined) {
    const cycle = String(body.billingCycle).trim().toLowerCase();
    normalized.billing_cycle = ALLOWED_CYCLES.has(cycle) ? cycle : "monthly";
  }
  if (body.nextBilling !== undefined) normalized.next_billing = body.nextBilling || null;
  if (body.notes !== undefined) normalized.notes = body.notes || null;
  return normalized;
}

// GET /api/subscriptions?userId=...  - list, optionally scoped to a user.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    let query = supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
    if (req.query.userId) {
      query = query.eq("user_id", req.query.userId);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ subscriptions: data || [] });
  })
);

// GET /api/subscriptions/:id - product details page.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*, owner:users(id, full_name, email)")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Subscription not found" });
    res.json({ subscription: data });
  })
);

// POST /api/subscriptions - create a new product.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = normalizeBody(req.body || {});
    if (!payload.user_id) return res.status(400).json({ error: "userId is required" });
    if (!payload.name) return res.status(400).json({ error: "name is required" });
    if (!Number.isFinite(payload.price) || payload.price < 0) {
      return res.status(400).json({ error: "price must be a non-negative number" });
    }
    payload.billing_cycle = payload.billing_cycle || "monthly";
    payload.category = payload.category || "entertainment";

    const { data, error } = await supabase
      .from("subscriptions")
      .insert(payload)
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ subscription: data });
  })
);

// PUT /api/subscriptions/:id - update fields.
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = normalizeBody(req.body || {});
    delete payload.user_id;
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "No updatable fields supplied" });
    }
    const { data, error } = await supabase
      .from("subscriptions")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ subscription: data });
  })
);

// DELETE /api/subscriptions/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  })
);

export default router;
