import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Load server/.env no matter where Node was invoked from. Sibling modules
// (supabase.js, seed.js) read process.env at import time, so this file must
// be imported before any of them. It's safe to import multiple times.
// `override: true` makes the file values win over any pre-existing shell
// environment variables (a common foot-gun when developers have stale or
// placeholder SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in their ~/.zshrc).
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env"), override: true });
