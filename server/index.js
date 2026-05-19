// loadEnv must be imported first so process.env is populated before any
// other module reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
import "./lib/loadEnv.js";
import express from "express";
import cors from "cors";

import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import expensesRouter from "./routes/expenses.js";
import categoriesRouter from "./routes/categories.js";
import { runSeed } from "./lib/seed.js";
import { loadCurrentUser } from "./lib/currentUser.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Populates req.currentUser from the x-user-id header (sent by axios).
// Permission middleware in individual routes then enforces the flags.
app.use(loadCurrentUser);

// This process is the JSON API only; the React UI is served by Vite (usually :5173).
app.get("/", (_req, res) => {
  res.json({
    message: "SpendWise API",
    health: "/api/health",
    note: "Open the web app with `npm run web` (typically http://localhost:5173)."
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/categories", categoriesRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  console.error("[api] unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

const server = app.listen(port, async () => {
  console.log(`[api] listening on http://localhost:${port}`);
  // Seeds demo accounts on every startup; existing rows are skipped.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await runSeed();
  } else {
    console.warn("[api] Supabase env vars missing - skipping seed. See server/.env.example.");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[api] Port ${port} is already in use — another API may still be running.`);
    console.error("    Stop it (Ctrl+C in that terminal), or:");
    console.error(`    kill $(lsof -t -i :${port})`);
    console.error("    Or set PORT=3002 (or similar) in server/.env.");
  } else {
    console.error("[api] listen error:", err);
  }
  process.exit(1);
});
