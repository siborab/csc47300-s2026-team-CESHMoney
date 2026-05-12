import axios from "axios";

// Shared axios instance used by every page that talks to the API server.
// Base URL is relative so the Vite dev server proxies /api -> :3001 transparently,
// and the same code works in production when the API is served from the same origin.
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" }
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
