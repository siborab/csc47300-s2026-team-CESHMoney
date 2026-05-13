// Live end-to-end test of the admin permission system.
// Talks to the running local API at http://localhost:3001 and the real Supabase DB.
// Restores all flags back to defaults at the end (even on failure).

import "../server/lib/loadEnv.js";
import { supabase } from "../server/lib/supabase.js";

const API = "http://localhost:3001/api";

const COLORS = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  gray:  (s) => `\x1b[90m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`
};

let passes = 0;
let fails = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    passes++;
    console.log(`  ${COLORS.green("✓")} ${label}`);
  } else {
    fails++;
    failures.push(label);
    console.log(`  ${COLORS.red("✗")} ${label}${detail ? COLORS.gray(`  -- ${detail}`) : ""}`);
  }
}

async function api(method, path, { userId, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, body: json };
}

async function setFlag(userId, column, value) {
  await supabase.from("users").update({ [column]: value }).eq("id", userId);
}

async function getDbUser(email) {
  const { data } = await supabase.from("users").select("*").eq("email", email).single();
  return data;
}

async function main() {
  const admin = await getDbUser("admin@spendwise.com");
  const demo = await getDbUser("demo@spendwise.com");
  console.log(COLORS.bold("\nAccounts:"));
  console.log(`  admin = ${admin.id}`);
  console.log(`  demo  = ${demo.id}\n`);

  // Reset to known-good defaults before starting.
  await setFlag(demo.id, "is_active", true);
  await setFlag(demo.id, "can_manage_subscriptions", true);
  await setFlag(demo.id, "can_export", true);

  // ====================================================================
  // TEST 1 -- baseline: demo can create / list / delete its own subs
  // ====================================================================
  console.log(COLORS.cyan(COLORS.bold("\n[TEST 1] Baseline (all flags ON)")));
  {
    const create = await api("POST", "/subscriptions", {
      userId: demo.id,
      body: { userId: demo.id, name: "PERM-TEST-BASELINE", price: 1.23, billingCycle: "monthly" }
    });
    check("demo can create a subscription when can_manage=true", create.status === 201, `status=${create.status}`);
    const newId = create.body?.subscription?.id;

    if (newId) {
      const del = await api("DELETE", `/subscriptions/${newId}`, { userId: demo.id });
      check("demo can delete the same subscription", del.status === 200, `status=${del.status}`);
    }
  }

  // ====================================================================
  // TEST 2 -- can_manage_subscriptions = false blocks demo
  // ====================================================================
  console.log(COLORS.cyan(COLORS.bold("\n[TEST 2] can_manage_subscriptions = false")));
  await setFlag(demo.id, "can_manage_subscriptions", false);
  {
    // GET should still work (read-only access is allowed)
    const list = await api("GET", `/subscriptions?userId=${demo.id}`, { userId: demo.id });
    check("demo can still LIST subscriptions when manage=off", list.status === 200, `status=${list.status}`);

    // POST is blocked
    const create = await api("POST", "/subscriptions", {
      userId: demo.id,
      body: { userId: demo.id, name: "PERM-TEST-SHOULD-FAIL", price: 9.99, billingCycle: "monthly" }
    });
    check("demo CANNOT create when manage=off (expect 403)", create.status === 403, `status=${create.status} body=${JSON.stringify(create.body)}`);
    check("error message names the restriction", /disabled subscription management/i.test(create.body?.error || ""), create.body?.error);

    // Pick an existing demo subscription (seeded) and try to PUT / DELETE
    const { data: existing } = await supabase.from("subscriptions").select("id").eq("user_id", demo.id).limit(1).maybeSingle();
    if (existing) {
      const update = await api("PUT", `/subscriptions/${existing.id}`, {
        userId: demo.id,
        body: { notes: "hacked" }
      });
      check("demo CANNOT update when manage=off (expect 403)", update.status === 403, `status=${update.status}`);

      const del = await api("DELETE", `/subscriptions/${existing.id}`, { userId: demo.id });
      check("demo CANNOT delete when manage=off (expect 403)", del.status === 403, `status=${del.status}`);
    } else {
      console.log(COLORS.gray("  (no seeded demo subscription, skipped PUT/DELETE checks)"));
    }
  }

  // ====================================================================
  // TEST 3 -- admin always bypasses, even with x-user-id of admin
  // ====================================================================
  console.log(COLORS.cyan(COLORS.bold("\n[TEST 3] admin always bypasses permission checks")));
  {
    const create = await api("POST", "/subscriptions", {
      userId: admin.id,
      body: { userId: demo.id, name: "PERM-TEST-ADMIN-OVERRIDE", price: 5.5, billingCycle: "monthly" }
    });
    check("admin can create a sub on demo's behalf even when demo.manage=off", create.status === 201, `status=${create.status}`);
    const newId = create.body?.subscription?.id;
    if (newId) {
      const del = await api("DELETE", `/subscriptions/${newId}`, { userId: admin.id });
      check("admin can delete it", del.status === 200, `status=${del.status}`);
    }
  }
  await setFlag(demo.id, "can_manage_subscriptions", true);

  // ====================================================================
  // TEST 4 -- is_active = false blocks LOGIN and all mutations
  // ====================================================================
  console.log(COLORS.cyan(COLORS.bold("\n[TEST 4] is_active = false (suspended)")));
  await setFlag(demo.id, "is_active", false);
  {
    const login = await api("POST", "/auth/login", {
      body: { email: "demo@spendwise.com", password: "demo123" }
    });
    check("suspended demo CANNOT log in (expect 403)", login.status === 403, `status=${login.status}`);
    check("login error mentions suspension", /suspended/i.test(login.body?.error || ""), login.body?.error);

    // If demo somehow has a stale token / cached session, mutations are still blocked
    const create = await api("POST", "/subscriptions", {
      userId: demo.id,
      body: { userId: demo.id, name: "PERM-TEST-WHILE-SUSPENDED", price: 0.01, billingCycle: "monthly" }
    });
    check("suspended demo CANNOT create subs even with x-user-id header", create.status === 403, `status=${create.status}`);

    // Admin can still log in
    const adminLogin = await api("POST", "/auth/login", {
      body: { email: "admin@spendwise.com", password: "admin123" }
    });
    check("admin login still works", adminLogin.status === 200, `status=${adminLogin.status}`);
  }
  await setFlag(demo.id, "is_active", true);

  // ====================================================================
  // TEST 5 -- public user payload reports correct flags
  // ====================================================================
  console.log(COLORS.cyan(COLORS.bold("\n[TEST 5] GET /api/users/:id returns permission flags")));
  await setFlag(demo.id, "can_export", false);
  {
    const r = await api("GET", `/users/${demo.id}`, { userId: admin.id });
    check("GET /api/users/:id returns isActive", typeof r.body?.user?.isActive === "boolean", `got=${typeof r.body?.user?.isActive}`);
    check("GET /api/users/:id returns canManageSubscriptions", typeof r.body?.user?.canManageSubscriptions === "boolean", `got=${typeof r.body?.user?.canManageSubscriptions}`);
    check("GET /api/users/:id returns canExport", typeof r.body?.user?.canExport === "boolean", `got=${typeof r.body?.user?.canExport}`);
    check("canExport reflects DB value (false)", r.body?.user?.canExport === false, `got=${r.body?.user?.canExport}`);
  }
  await setFlag(demo.id, "can_export", true);

  // ====================================================================
  // TEST 6 -- PUT /api/users/:id can toggle each flag
  // ====================================================================
  console.log(COLORS.cyan(COLORS.bold("\n[TEST 6] PUT /api/users/:id can toggle flags from the admin")));
  {
    const r1 = await api("PUT", `/users/${demo.id}`, {
      userId: admin.id,
      body: { canManageSubscriptions: false }
    });
    check("admin PUT canManageSubscriptions=false succeeds", r1.status === 200, `status=${r1.status} body=${JSON.stringify(r1.body)}`);
    check("response reflects new value", r1.body?.user?.canManageSubscriptions === false);

    const r2 = await api("PUT", `/users/${demo.id}`, {
      userId: admin.id,
      body: { canExport: false }
    });
    check("admin PUT canExport=false succeeds", r2.status === 200);
    check("response reflects new canExport", r2.body?.user?.canExport === false);

    const r3 = await api("PUT", `/users/${demo.id}`, {
      userId: admin.id,
      body: { isActive: false }
    });
    check("admin PUT isActive=false succeeds", r3.status === 200);
    check("response reflects new isActive", r3.body?.user?.isActive === false);

    // Restore everything
    await api("PUT", `/users/${demo.id}`, {
      userId: admin.id,
      body: { isActive: true, canManageSubscriptions: true, canExport: true }
    });
  }

  // ====================================================================
  // TEST 7 -- requests missing the x-user-id header are refused
  // ====================================================================
  console.log(COLORS.cyan(COLORS.bold("\n[TEST 7] Anonymous requests are rejected on protected routes")));
  {
    const r = await api("POST", "/subscriptions", {
      body: { userId: demo.id, name: "PERM-TEST-NO-HEADER", price: 1, billingCycle: "monthly" }
    });
    check("POST without x-user-id is 401", r.status === 401, `status=${r.status}`);
  }

  // ====================================================================
  // Final restore + summary
  // ====================================================================
  await setFlag(demo.id, "is_active", true);
  await setFlag(demo.id, "can_manage_subscriptions", true);
  await setFlag(demo.id, "can_export", true);

  console.log(COLORS.bold(`\n${COLORS.green("Passed")}: ${passes}    ${COLORS.red("Failed")}: ${fails}`));
  if (fails > 0) {
    console.log(COLORS.red("\nFailed checks:"));
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(2);
});
