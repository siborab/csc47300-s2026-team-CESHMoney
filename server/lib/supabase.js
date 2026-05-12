import { createClient } from "@supabase/supabase-js";

// Single shared Supabase client used by all route handlers.
// Uses the service_role key so the API server has full DB access.
// This key must never reach the browser; it stays in server/.env.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Copy server/.env.example to server/.env and fill in values from your Supabase project."
  );
}

export const supabase = createClient(supabaseUrl || "http://localhost", supabaseKey || "missing", {
  auth: { persistSession: false }
});
