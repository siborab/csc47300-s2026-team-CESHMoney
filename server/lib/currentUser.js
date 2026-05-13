import { supabase } from "./supabase.js";

// Middleware: best-effort load of the user the request "belongs to".
// The browser puts its session user id in the `x-user-id` header (see
// src/api/client.js). If anything is wrong with the header we fall back to
// `req.currentUser = null`; downstream guards decide whether to refuse.
export async function loadCurrentUser(req, _res, next) {
  const id = req.header("x-user-id");
  if (!id) {
    req.currentUser = null;
    return next();
  }
  try {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    req.currentUser = data || null;
  } catch (_error) {
    req.currentUser = null;
  }
  next();
}

// Permission helpers -- treat missing columns as permissive so the API keeps
// working against databases that have not run the permissions migration yet.
function permissionOk(user, columnName) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user[columnName] !== false;
}

// Subscription mutations require either admin role or can_manage_subscriptions=true.
export function requireSubscriptionManagement(req, res, next) {
  const user = req.currentUser;
  if (!user) {
    return res.status(401).json({ error: "You must be signed in." });
  }
  if (user.is_active === false) {
    return res.status(403).json({ error: "Your account is suspended." });
  }
  if (!permissionOk(user, "can_manage_subscriptions")) {
    return res.status(403).json({
      error: "An admin has disabled subscription management on your account."
    });
  }
  next();
}

// Export endpoints can use this if we add one later; today export is purely
// client-side, but having the guard ready means /api/export/... is a one-liner.
export function requireExport(req, res, next) {
  const user = req.currentUser;
  if (!user) return res.status(401).json({ error: "You must be signed in." });
  if (user.is_active === false) {
    return res.status(403).json({ error: "Your account is suspended." });
  }
  if (!permissionOk(user, "can_export")) {
    return res.status(403).json({ error: "Export is disabled on your account." });
  }
  next();
}
