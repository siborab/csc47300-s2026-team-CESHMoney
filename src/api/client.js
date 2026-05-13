import axios from "axios";
import { SESSION_KEY } from "../utils/constants";

// Shared axios instance used by every page that talks to the API server.
// Base URL is relative so the Vite dev server proxies /api -> :3001 transparently,
// and the same code works in production when the API is served from the same origin.
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" }
});

// Attach the signed-in user's id to every request so the API can enforce
// per-user permissions (is_active, can_manage_subscriptions, ...).
api.interceptors.request.use((config) => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
    if (raw) {
      const session = JSON.parse(raw);
      const id = session?.user?.id;
      if (id) config.headers["x-user-id"] = id;
    }
  } catch (_error) {
    // Ignore JSON / storage errors - the request still goes through unauth'd.
  }
  return config;
});

// Unwraps the AxiosError into a plain Error with a useful message.
// Pages can then just do `try { ... } catch (error) { setMessage(error.message); }`.
export function unwrapError(error, fallback = "Request failed") {
  if (error?.response?.data?.error) {
    return new Error(error.response.data.error);
  }
  if (error?.message) {
    return new Error(error.message);
  }
  return new Error(fallback);
}
