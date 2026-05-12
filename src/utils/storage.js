import { SESSION_KEY } from "./constants";

// Local session helpers. Auth still lives client-side because Supabase Auth
// is intentionally bypassed (the Express server does its own bcrypt check),
// but the signed-in user object is cached here for quick access.
export function readJsonFromStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function readSession() {
  return readJsonFromStorage(SESSION_KEY, null);
}

export function writeSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ isLoggedIn: true, user })
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
