import { api, unwrapError } from "./client.js";

// Thin wrappers around the REST endpoints exposed by the Express API server.
// Pages import these helpers so that swapping the data layer (Supabase today,
// something else tomorrow) only touches this file.

// ---- Auth ----
export async function signUp({ fullName, email, password }) {
  try {
    const { data } = await api.post("/auth/signup", { fullName, email, password });
    return data.user;
  } catch (error) {
    throw unwrapError(error, "Sign up failed");
  }
}

export async function login({ email, password }) {
  try {
    const { data } = await api.post("/auth/login", { email, password });
    return data.user;
  } catch (error) {
    throw unwrapError(error, "Login failed");
  }
}

// ---- Users ----
export async function listUsers() {
  try {
    const { data } = await api.get("/users");
    return data.users || [];
  } catch (error) {
    throw unwrapError(error, "Failed to load users");
  }
}

export async function getUser(id) {
  try {
    const { data } = await api.get(`/users/${id}`);
    return data;
  } catch (error) {
    throw unwrapError(error, "Failed to load user");
  }
}

export async function updateUser(id, patch) {
  try {
    const { data } = await api.put(`/users/${id}`, patch);
    return data.user;
  } catch (error) {
    throw unwrapError(error, "Failed to update user");
  }
}

export async function deleteUser(id) {
  try {
    await api.delete(`/users/${id}`);
  } catch (error) {
    throw unwrapError(error, "Failed to delete user");
  }
}

// ---- Subscriptions (= product) ----
export async function listSubscriptions(userId) {
  try {
    const { data } = await api.get("/subscriptions", { params: userId ? { userId } : {} });
    return data.subscriptions || [];
  } catch (error) {
    throw unwrapError(error, "Failed to load subscriptions");
  }
}

export async function getSubscription(id) {
  try {
    const { data } = await api.get(`/subscriptions/${id}`);
    return data.subscription;
  } catch (error) {
    throw unwrapError(error, "Failed to load subscription");
  }
}

export async function createSubscription(payload) {
  try {
    const { data } = await api.post("/subscriptions", payload);
    return data.subscription;
  } catch (error) {
    throw unwrapError(error, "Failed to create subscription");
  }
}

export async function updateSubscription(id, payload) {
  try {
    const { data } = await api.put(`/subscriptions/${id}`, payload);
    return data.subscription;
  } catch (error) {
    throw unwrapError(error, "Failed to update subscription");
  }
}

export async function deleteSubscription(id) {
  try {
    await api.delete(`/subscriptions/${id}`);
  } catch (error) {
    throw unwrapError(error, "Failed to delete subscription");
  }
}

// ---- Expenses ----
export async function listExpenses(userId) {
  try {
    const { data } = await api.get("/expenses", { params: userId ? { userId } : {} });
    return data.expenses || [];
  } catch (error) {
    throw unwrapError(error, "Failed to load expenses");
  }
}

export async function createExpense(payload) {
  try {
    const { data } = await api.post("/expenses", payload);
    return data.expense;
  } catch (error) {
    throw unwrapError(error, "Failed to add expense");
  }
}

export async function deleteExpense(id) {
  try {
    await api.delete(`/expenses/${id}`);
  } catch (error) {
    throw unwrapError(error, "Failed to delete expense");
  }
}

// ---- Categories ----
export async function listCategories(userId) {
  try {
    const { data } = await api.get("/categories", { params: { userId } });
    return data.categories || [];
  } catch (error) {
    throw unwrapError(error, "Failed to load categories");
  }
}

export async function saveCategory(payload) {
  try {
    const { data } = await api.post("/categories", payload);
    return data.category;
  } catch (error) {
    throw unwrapError(error, "Failed to save category");
  }
}

export async function deleteCategory(id) {
  try {
    await api.delete(`/categories/${id}`);
  } catch (error) {
    throw unwrapError(error, "Failed to delete category");
  }
}
