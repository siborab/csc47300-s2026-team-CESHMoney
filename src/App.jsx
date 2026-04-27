import React, { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

// Browser storage keys used across auth, dashboard, and converter features.
// These keys keep app data in localStorage so the browser remembers state after refresh.
const SESSION_KEY = "spendwise_session";
const EXPENSES_DB_KEY = "spendwise_expenses_db_v1";
const EXPENSES_DB_VERSION_KEY = "spendwise_expenses_db_version";
const EXPENSES_DB_VERSION = "6";
const HOME_CURRENCY_KEY = "spendwise_home_currency";
const LOCKED_RATE_KEY = "spendwise_locked_rate_snapshot";
const FAVORITE_PAIRS_KEY = "spendwise_favorite_currency_pairs";

// Default categories used by the dashboard budget summary.
// Categories are stored as an array of { category, budget } so the user can add
// or remove categories at runtime via the "Edit Categories" modal.
const DEFAULT_CATEGORY_BUDGET_LIST = [
  { category: "rent", budget: 1600 },
  { category: "groceries", budget: 450 },
  { category: "utilities", budget: 300 },
  { category: "food", budget: 500 },
  { category: "transport", budget: 250 },
  { category: "entertainment", budget: 200 },
  { category: "other", budget: 200 }
];

// Demo exchange rates used by the converter feature.
const RATE_TO_USD = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  JPY: 0.0067,
  MXN: 0.058
};

// Safely reads JSON data from localStorage.
function readJsonFromStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

// Makes email comparisons case-insensitive.
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// Reads the saved login session from the browser.
function readSession() {
  return readJsonFromStorage(SESSION_KEY, null);
}

function writeSession(user) {
  // Save a minimal signed-in user object for client-side auth.
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      isLoggedIn: true,
      user
    })
  );
}

// Clears the saved login session from the browser.
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Formats numbers for cards, tables, and converter results.
function formatCurrency(amount, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(amount);
}

// Adds a plus or minus sign for transaction table amounts.
function formatTableAmount(amount) {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

// Makes exchange rates shorter and easier to read.
function formatRate(rate) {
  return Number(rate).toFixed(4).replace(/\.?0+$/, "");
}

// Converts an ISO date string into a short month/day label.
function formatShortDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

// Checks whether a transaction belongs to the current month.
function isInCurrentMonth(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

// Maps raw values into one of the user's configured budget categories.
// Falls back to "other" when the raw value does not match a known category.
function normalizeCategory(rawCategory, categoryBudgetList) {
  const category = String(rawCategory || "").trim().toLowerCase();
  if (category === "housing") {
    return "rent";
  }
  if (category === "income") {
    return "income";
  }
  const list = Array.isArray(categoryBudgetList) ? categoryBudgetList : [];
  const known = list.some((item) => String(item.category).toLowerCase() === category);
  return known ? category : "other";
}

// Labels displayed in the UI for each category.
// Custom categories are title-cased automatically.
function categoryLabel(category) {
  const builtInLabels = {
    rent: "Rent",
    groceries: "Groceries",
    utilities: "Utilities",
    food: "Food",
    transport: "Transport",
    entertainment: "Entertainment",
    other: "Other",
    housing: "Housing",
    income: "Income"
  };
  if (builtInLabels[category]) {
    return builtInLabels[category];
  }
  return String(category || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || "Other";
}

// Builds a sortable value so recent transactions show first.
function transactionSortValue(item) {
  const datePart = item.date || "";
  const createdPart = item.createdAt || `${datePart}T00:00:00`;
  return `${datePart}|${createdPart}`;
}

// Shared expenses store a per-person amount, so this returns the displayed amount.
function getEffectiveExpenseAmount(item) {
  const rawAmount = Number(item.amount || 0);
  const splitInfo = item.splitBetween;

  if (
    rawAmount < 0 &&
    splitInfo &&
    typeof splitInfo === "object" &&
    Number.isFinite(Number(splitInfo.eachAmount)) &&
    Number(splitInfo.eachAmount) > 0
  ) {
    return -Math.abs(Number(splitInfo.eachAmount));
  }

  return rawAmount;
}

// Builds a categoryBudget2 array from any supported saved-data shape.
// Prefers an explicit `categoryBudget2` array, falls back to a legacy
// `categoryBudgets` object, then to the default list.
function buildCategoryBudgetList(db) {
  if (Array.isArray(db && db.categoryBudget2) && db.categoryBudget2.length > 0) {
    return db.categoryBudget2.map((item) => ({
      category: String(item.category || "").trim().toLowerCase() || "other",
      budget: Number(item.budget || 0)
    }));
  }

  if (db && db.categoryBudgets && typeof db.categoryBudgets === "object") {
    const entries = Object.entries(db.categoryBudgets);
    if (entries.length > 0) {
      return entries.map(([category, budget]) => ({
        category: String(category).trim().toLowerCase(),
        budget: Number(budget || 0)
      }));
    }
  }

  return DEFAULT_CATEGORY_BUDGET_LIST.map((item) => ({ ...item }));
}

function normalizeDbShape(db) {
  // Normalizes seeded or saved data into the shape the dashboard expects.
  const categoryBudget2 = buildCategoryBudgetList(db);
  const normalizedTransactions = Array.isArray(db && db.transactions)
    ? db.transactions.map((item) => ({
        ...item,
        category: normalizeCategory(item.category, categoryBudget2),
        createdAt: item.createdAt || `${item.date}T00:00:00`
      }))
    : [];

  return {
    monthlyIncome: Number((db && db.monthlyIncome) || 0),
    categoryBudget2,
    startingBalance: Number((db && db.startingBalance) || 0),
    transactions: normalizedTransactions
  };
}

// Saves the current dashboard database back to localStorage.
function writeLocalDb(db) {
  localStorage.setItem(EXPENSES_DB_KEY, JSON.stringify(db));
  localStorage.setItem(EXPENSES_DB_VERSION_KEY, EXPENSES_DB_VERSION);
}

// Reads number inputs safely for converter calculations.
function parseAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// Converts between currencies by using USD as a common base.
function convertAmount(amount, fromCurrency, toCurrency) {
  const fromRate = RATE_TO_USD[fromCurrency];
  const toRate = RATE_TO_USD[toCurrency];
  if (!fromRate || !toRate) {
    return 0;
  }
  return (amount * fromRate) / toRate;
}

// Labels for expense types in the add-expense modal.
function expenseTypeToDescription(type) {
  const builtIn = {
    rent: "Rent",
    groceries: "Groceries",
    utilities: "Utilities",
    food: "Food",
    transport: "Transport",
    entertainment: "Entertainment",
    other: "Other"
  };
  return builtIn[type] || categoryLabel(type) || "Expense";
}

function buildEqualSplit(count, totalAmount) {
  // Split in cents first to avoid common floating-point rounding issues.
  const totalCents = Math.round(totalAmount * 100);
  const perPersonCents = Math.round(totalCents / count);
  return perPersonCents / 100;
}

// Shared header shown on all pages.
function Header({ session, onLogout }) {
  const location = useLocation();
  const onHomePage = location.pathname === "/";

  return (
    <header>
      <div className="container">
        <h1><Link to="/">SpendWise</Link></h1>
        <nav>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li className="login-menu">
              <details>
                <summary>Features</summary>
                <ul className="login-dropdown">
                  <li><Link to="/budget-timeline">Budget Timeline</Link></li>
                  <li><Link to="/currency-conversion">Currency Conversion</Link></li>
                  <li><Link to="/export-center">Export Center</Link></li>
                  <li><Link to="/subscription-notifications">Subscription Alerts</Link></li>
                </ul>
              </details>
            </li>
            <li><a href={onHomePage ? "#about" : "/#about"}>About</a></li>
            <li className="login-menu">
              {session && session.isLoggedIn ? (
                <button type="button" className="logout-btn" onClick={onLogout}>Logout</button>
              ) : (
                <details>
                  <summary>Login</summary>
                  <ul className="login-dropdown">
                    <li><Link to="/signin">Sign In</Link></li>
                    <li><Link to="/signup">Sign Up</Link></li>
                  </ul>
                </details>
              )}
            </li>
            <li><a href={onHomePage ? "#contact" : "/#contact"}>Contact</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

// Shared footer shown on all pages.
function Footer() {
  return (
    <footer>
      <div className="container">
        <p>&copy; 2026 SpendWise. All rights reserved.</p>
      </div>
    </footer>
  );
}

// Landing page component.
function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <h2>Manage Shared Finances Simply</h2>
          <p>Track expenses, categorize spending, and split bills effortlessly.</p>
          <Link to="/dashboard" className="btn">Get Started</Link>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2>Key Features</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Expense Tracking</h3>
              <p>Input expenses and assign them to categories like rent, groceries, and bills.</p>
            </div>
            <div className="feature-card">
              <h3>Shared Dashboard</h3>
              <p>View summaries of total expenses and see who owes what in your group.</p>
            </div>
            <div className="feature-card">
              <h3>Budget Alerts</h3>
              <p>Set monthly limits and get notified when you're approaching your budget.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="about">
        <div className="container">
          <h2>About SpendWise</h2>
          <p>SpendWise helps individuals and groups manage shared finances in a transparent way.</p>
        </div>
      </section>
    </main>
  );
}

// Sign-in page component.
function SignInPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      // Demo auth reads users from a local JSON file instead of a backend.
      const response = await fetch("/user.json", { cache: "no-store" });
      const data = await response.json();
      const users = Array.isArray(data.users) ? data.users : [];
      const matchedUser = users.find(
        (user) => normalizeEmail(user.email) === normalizeEmail(email) && user.password === password
      );

      if (!matchedUser) {
        setMessage("Invalid email or password");
        setMessageType("error");
        return;
      }

      writeSession({
        id: matchedUser.id,
        fullName: matchedUser.fullName,
        email: matchedUser.email
      });
      // Update app state immediately so the header can reflect the logged-in session.
      onLogin();
      setMessage("Login success, redirecting...");
      setMessageType("success");
      setTimeout(() => {
        navigate("/");
      }, 700);
    } catch (error) {
      setMessage("Cannot read user.json");
      setMessageType("error");
    }
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to continue managing shared expenses.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="signinEmail">Email</label>
            <input id="signinEmail" name="signinEmail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <div>
            <label htmlFor="signinPassword">Password</label>
            <input id="signinPassword" name="signinPassword" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <button type="submit" className="auth-submit">Sign In</button>
          <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
        </form>

        <p className="auth-links">Need an account? <Link to="/signup">Create one here</Link>.</p>
      </section>
    </main>
  );
}

// Sign-up page component.
function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!fullName.trim() || !normalizeEmail(email) || !password) {
      setMessage("Please fill all required fields.");
      setMessageType("error");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setMessageType("error");
      return;
    }

    setMessage("Sign-up submitted. Demo mode only: add this account to user.json to enable login.");
    setMessageType("success");
    setFullName("");
    setEmail("");
    setPassword("");
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <h2>Create Account</h2>
        <p className="auth-subtitle">Set up your SpendWise account in a few seconds.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" name="fullName" type="text" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>

          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength="6" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <button type="submit" className="auth-submit">Sign Up</button>
          <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
        </form>

        <p className="auth-links">Already have an account? <Link to="/signin">Sign in here</Link>.</p>
      </section>
    </main>
  );
}

// Dashboard page with summary cards, transaction table, and add-expense modal.
function DashboardPage() {
  const [db, setDb] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [formData, setFormData] = useState({
    expenseType: "",
    baseAmount: "",
    tipPercent: "0",
    expenseNote: "",
    isSplitExpense: false,
    splitCount: "2"
  });
  // State for the "Edit Categories" modal that lets the user add/remove budget categories.
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ categoryName: "", categoryBudget: "" });
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categoryMessageType, setCategoryMessageType] = useState("");

  useEffect(() => {
    async function loadDb() {
      // Prefer the saved local expense database, but seed it from expenses.json on first load.
      const localDbVersion = localStorage.getItem(EXPENSES_DB_VERSION_KEY);
      const localDb = localDbVersion === EXPENSES_DB_VERSION ? readJsonFromStorage(EXPENSES_DB_KEY, null) : null;

      if (localDb && Array.isArray(localDb.transactions)) {
        setDb(normalizeDbShape(localDb));
        return;
      }

      try {
        const response = await fetch("/expenses.json", { cache: "no-store" });
        const data = await response.json();
        const normalized = normalizeDbShape(data);
        writeLocalDb(normalized);
        setDb(normalized);
      } catch (error) {
        setDb(normalizeDbShape({
          monthlyIncome: 0,
          categoryBudget2: DEFAULT_CATEGORY_BUDGET_LIST.map((item) => ({ ...item })),
          startingBalance: 0,
          transactions: []
        }));
      }
    }

    loadDb();
  }, []);

  function getTotalWithTip() {
    // Adds tip on top of the entered base amount.
    const baseAmount = Number(formData.baseAmount);
    const tipPercent = Number(formData.tipPercent || 0);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return 0;
    }
    return baseAmount + (baseAmount * Math.max(0, tipPercent) / 100);
  }

  function resetForm() {
    // Clears the form after submit or modal close.
    setFormData({
      expenseType: "",
      baseAmount: "",
      tipPercent: "0",
      expenseNote: "",
      isSplitExpense: false,
      splitCount: "2"
    });
    setMessage("");
    setMessageType("");
  }

  function closeModal() {
    setShowModal(false);
    resetForm();
  }

  function handleInputChange(event) {
    // Handles both text inputs and the split-expense checkbox.
    const { name, value, type, checked } = event.target;
    setFormData((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value
      };
      if (name === "isSplitExpense" && !checked) {
        next.splitCount = "2";
      }
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!db) {
      return;
    }

    const expenseType = formData.expenseType;
    const baseAmount = Number(formData.baseAmount);
    const tipPercent = Number(formData.tipPercent || 0);
    const note = formData.expenseNote.trim();
    const totalAmount = getTotalWithTip();

    if (!expenseType || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      setMessage("Please fill all fields with a valid amount.");
      setMessageType("error");
      return;
    }

    if (!Number.isFinite(tipPercent) || tipPercent < 0) {
      setMessage("Tip must be zero or a positive value.");
      setMessageType("error");
      return;
    }

    let splitDetails = [];
    let effectiveAmount = totalAmount;

    if (formData.isSplitExpense) {
      const splitCount = Number.parseInt(formData.splitCount, 10);
      if (!Number.isFinite(splitCount) || splitCount < 2) {
        setMessage("Split count must be at least 2.");
        setMessageType("error");
        return;
      }

      splitDetails = {
        splitCount,
        eachAmount: buildEqualSplit(splitCount, totalAmount)
      };
      // The dashboard stores the per-person value for shared expenses.
      effectiveAmount = splitDetails.eachAmount;
    }

    const splitTag = formData.isSplitExpense ? ` (Split bill: ${splitDetails.splitCount} people)` : "";
    const description = note
      ? `${expenseTypeToDescription(expenseType)}${splitTag} - ${note}`
      : `${expenseTypeToDescription(expenseType)}${splitTag}`;

    const nextDb = {
      ...db,
      transactions: [
        // Store the newest expense at the top of the transaction list.
        {
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          description,
          category: normalizeCategory(expenseType, db.categoryBudget2),
          amount: -Math.abs(effectiveAmount),
          totalAmount: -Math.abs(totalAmount),
          type: "expense",
          baseAmount,
          tipPercent,
          paidBy: "self",
          splitBetween: splitDetails
        },
        ...db.transactions
      ]
    };

    writeLocalDb(nextDb);
    setDb(nextDb);
    setMessage("Expense added successfully.");
    setMessageType("success");
    setTimeout(() => {
      closeModal();
    }, 500);
  }

  function closeCategoryModal() {
    setShowCategoryModal(false);
    setCategoryForm({ categoryName: "", categoryBudget: "" });
    setCategoryMessage("");
    setCategoryMessageType("");
  }

  function handleCategoryFormChange(event) {
    const { name, value } = event.target;
    setCategoryForm((current) => ({ ...current, [name]: value }));
  }

  function handleDeleteCategory(categoryName) {
    if (!db) {
      return;
    }
    const nextList = db.categoryBudget2.filter(
      (item) => item.category !== categoryName
    );
    const nextDb = { ...db, categoryBudget2: nextList };
    writeLocalDb(nextDb);
    setDb(nextDb);
    // Clear the expense-type selection if it referenced the deleted category.
    if (formData.expenseType === categoryName) {
      setFormData((current) => ({ ...current, expenseType: "" }));
    }
  }

  function handleAddCategory(event) {
    event.preventDefault();
    if (!db) {
      return;
    }

    const rawName = String(categoryForm.categoryName || "").trim();
    const name = rawName.toLowerCase();
    const budget = Number(categoryForm.categoryBudget);

    if (!rawName || !Number.isFinite(budget) || budget <= 0) {
      setCategoryMessage("Please fill all fields with a valid amount.");
      setCategoryMessageType("error");
      return;
    }

    if (db.categoryBudget2.some((item) => item.category === name)) {
      setCategoryMessage("Category already exists.");
      setCategoryMessageType("error");
      return;
    }

    const nextDb = {
      ...db,
      // Newest categories appear first to match the prior dashboard.js behavior.
      categoryBudget2: [{ category: name, budget }, ...db.categoryBudget2]
    };
    writeLocalDb(nextDb);
    setDb(nextDb);
    setCategoryForm({ categoryName: "", categoryBudget: "" });
    setCategoryMessage("Category added successfully.");
    setCategoryMessageType("success");
    setTimeout(closeCategoryModal, 500);
  }

  if (!db) {
    // Shows a simple loading state while dashboard data is prepared.
    return <main className="dashboard-main"><div className="dashboard-container"><p>Loading...</p></div></main>;
  }

  const monthlyTransactions = db.transactions.filter((item) => isInCurrentMonth(item.date));
  const sortedTransactions = [...monthlyTransactions].sort((a, b) => {
    const aKey = transactionSortValue(a);
    const bKey = transactionSortValue(b);
    if (aKey === bKey) {
      return 0;
    }
    return aKey < bKey ? 1 : -1;
  });

  const monthlyIncome = Number(db.monthlyIncome || 0);
  const monthlySpend = monthlyTransactions
    .filter((item) => getEffectiveExpenseAmount(item) < 0)
    .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);

  const categoryBudgetList = Array.isArray(db.categoryBudget2) ? db.categoryBudget2 : [];
  const totalBudget = categoryBudgetList.reduce(
    (sum, item) => sum + Number(item.budget || 0),
    0
  );

  const budgetRemaining = Math.max(0, totalBudget - monthlySpend);
  const totalBalance = monthlyIncome - monthlySpend;
  const totalWithTip = getTotalWithTip();
  const splitCount = Number.parseInt(formData.splitCount, 10);
  const splitPreview = !formData.isSplitExpense
    ? ""
    : (!Number.isFinite(splitCount) || splitCount < 2 || totalWithTip <= 0)
      ? "Enter how many people to split with."
      : `Auto split -> ${splitCount} people, each pays ${formatCurrency(buildEqualSplit(splitCount, totalWithTip))}`;

  return (
    <>
      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h1>Dashboard</h1>
            <div>
              <button type="button" className="btn-edit-categories" onClick={() => setShowCategoryModal(true)}>
                Categories
              </button>
              <button type="button" className="btn-add-expense" onClick={() => setShowModal(true)}>
                Add Expense
              </button>
            </div>
          </div>

          <div className="cards">
            <div className="card">
              <h3>Monthly Balance</h3>
              <p>{formatCurrency(totalBalance)}</p>
            </div>
            <div className="card">
              <h3>Monthly Income</h3>
              <p>{formatCurrency(monthlyIncome)}</p>
            </div>
            <div className="card">
              <h3>Monthly Spend</h3>
              <p>{formatCurrency(monthlySpend)}</p>
            </div>
            <div className="card">
              <h3>Budget Remaining</h3>
              <p>{formatCurrency(budgetRemaining)}</p>
            </div>
          </div>

          <div className="section">
            <h2>Budget Progress</h2>
            <div>
              {categoryBudgetList.map(({ category, budget }) => {
                const numericBudget = Number(budget || 0);
                const used = monthlyTransactions
                  .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
                  .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
                const usedPercent = numericBudget > 0 ? Math.min(100, (used / numericBudget) * 100) : 0;

                return (
                  <div className="budget-item" key={category}>
                    <p>
                      {categoryLabel(category)} Used: <strong>{formatCurrency(used)} ({Math.round(usedPercent)}%)</strong>
                      {" "}• Budget: <strong>{formatCurrency(numericBudget)}</strong>
                    </p>
                    <div className="bar" style={{ "--progress": `${Math.round(usedPercent)}%` }}>
                      <div className="bar-fill"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="section">
            <h2>Recent Transactions</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.length > 0 ? (
                    sortedTransactions.map((item) => (
                      <tr key={`${item.createdAt}-${item.description}`}>
                        <td>{formatShortDate(item.date)}</td>
                        <td>{item.description}</td>
                        <td>{categoryLabel(item.category)}</td>
                        <td>{formatTableAmount(getEffectiveExpenseAmount(item))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4">No transactions for this month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <div
        className={`modal-overlay${showModal ? " active" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeModal();
          }
        }}
      >
        <div className="modal">
          <button type="button" className="modal-close" aria-label="Close" onClick={closeModal}>&times;</button>
          <h2>Add Expense</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="expenseType">Expense Type</label>
              <select id="expenseType" name="expenseType" required value={formData.expenseType} onChange={handleInputChange}>
                <option value="">Select type...</option>
                {categoryBudgetList.map(({ category }) => (
                  <option key={category} value={category}>{categoryLabel(category)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="baseAmount">Amount Before Tip ($)</label>
              <input type="number" id="baseAmount" name="baseAmount" min="0" step="0.01" placeholder="0.00" required value={formData.baseAmount} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label htmlFor="tipPercent">Tip (%)</label>
              <input type="number" id="tipPercent" name="tipPercent" min="0" step="0.01" value={formData.tipPercent} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label htmlFor="expenseNote">Note (Optional)</label>
              <input type="text" id="expenseNote" name="expenseNote" maxLength="120" placeholder="e.g. dinner with friends" value={formData.expenseNote} onChange={handleInputChange} />
            </div>
            <div className="form-group total-preview">
              <span>Total With Tip:</span>
              <strong>{formatCurrency(totalWithTip)}</strong>
            </div>
            <div className="form-group split-toggle-row">
              <label>
                <input type="checkbox" id="isSplitExpense" name="isSplitExpense" checked={formData.isSplitExpense} onChange={handleInputChange} />
                {" "}Split this expense
              </label>
            </div>
            <div className={`split-section${formData.isSplitExpense ? "" : " hidden"}`}>
              <div className="form-group">
                <label htmlFor="splitCount">Split With (Auto-equal split)</label>
                <input type="number" id="splitCount" name="splitCount" min="2" step="1" value={formData.splitCount} placeholder="How many people" onChange={handleInputChange} />
              </div>
              <p className="split-preview">{splitPreview}</p>
            </div>
            <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn-submit">Add Expense</button>
            </div>
          </form>
        </div>
      </div>

      <div
        className={`modal-overlay${showCategoryModal ? " active" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeCategoryModal();
          }
        }}
      >
        <div className="modal">
          <button type="button" className="modal-close" aria-label="Close" onClick={closeCategoryModal}>&times;</button>
          <h2>Edit Categories</h2>
          <form onSubmit={handleAddCategory}>
            <div id="categoryBudgetListEdit">
              {categoryBudgetList.map(({ category, budget }) => (
                <div className="categoryAdditionInput category-item" key={category}>
                  <h4>{categoryLabel(category)}</h4>
                  <div>
                    <span className="category-budget-amount">{formatCurrency(Number(budget || 0))}</span>
                    {" "}
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteCategory(category)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="form-group">
              <label htmlFor="categoryNameInput">Add a Category</label>
              <div className="categoryAdditionInput">
                <input
                  type="text"
                  id="categoryNameInput"
                  name="categoryName"
                  maxLength="50"
                  placeholder="Add a Category"
                  value={categoryForm.categoryName}
                  onChange={handleCategoryFormChange}
                />
                <input
                  type="number"
                  id="categoryBudgetInput"
                  name="categoryBudget"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={categoryForm.categoryBudget}
                  onChange={handleCategoryFormChange}
                />
              </div>
            </div>
            <p className={`auth-message ${categoryMessageType}`} aria-live="polite">{categoryMessage}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeCategoryModal}>Cancel</button>
              <button type="submit" className="btn-submit">Make Changes</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// Currency converter page with home currency memory, locked rate, and favorite pairs.
function CurrencyConverterPage() {
  const [amount, setAmount] = useState("245.00");
  const [spendCurrency, setSpendCurrency] = useState("EUR");
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [lockedRate, setLockedRate] = useState(() => readJsonFromStorage(LOCKED_RATE_KEY, null));
  const [favoritePairs, setFavoritePairs] = useState(() => {
    const parsed = readJsonFromStorage(FAVORITE_PAIRS_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  });
  const [useLockedRate, setUseLockedRate] = useState(false);

  useEffect(() => {
    // Load the user's saved home currency on first render.
    const savedHomeCurrency = localStorage.getItem(HOME_CURRENCY_KEY);
    if (savedHomeCurrency && RATE_TO_USD[savedHomeCurrency]) {
      setHomeCurrency(savedHomeCurrency);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HOME_CURRENCY_KEY, homeCurrency);
  }, [homeCurrency]);

  useEffect(() => {
    localStorage.setItem(FAVORITE_PAIRS_KEY, JSON.stringify(favoritePairs));
  }, [favoritePairs]);

  useEffect(() => {
    if (
      useLockedRate &&
      lockedRate &&
      (lockedRate.from !== spendCurrency || lockedRate.to !== homeCurrency)
    ) {
      setUseLockedRate(false);
    }
  }, [homeCurrency, lockedRate, spendCurrency, useLockedRate]);

  const liveRate = convertAmount(1, spendCurrency, homeCurrency);
  // Use the locked snapshot only when the saved pair matches the current pair.
  const effectiveRate = useLockedRate &&
    lockedRate &&
    lockedRate.from === spendCurrency &&
    lockedRate.to === homeCurrency
    ? Number(lockedRate.rate)
    : liveRate;
  const convertedAmount = parseAmount(amount) * effectiveRate;

  function lockCurrentRate() {
    // Save the current exchange rate so later changes do not affect this conversion.
    const snapshot = {
      from: spendCurrency,
      to: homeCurrency,
      rate: liveRate,
      lockedAt: new Date().toISOString()
    };
    localStorage.setItem(LOCKED_RATE_KEY, JSON.stringify(snapshot));
    setLockedRate(snapshot);
    setUseLockedRate(true);
  }

  function clearLockedRateValue() {
    // Removes the saved rate snapshot and turns off locked-rate mode.
    localStorage.removeItem(LOCKED_RATE_KEY);
    setLockedRate(null);
    setUseLockedRate(false);
  }

  function saveFavoritePair() {
    // Favorite pairs make common conversions reusable in one click.
    const pairId = `${spendCurrency}_${homeCurrency}`;
    if (favoritePairs.some((item) => item.id === pairId)) {
      return;
    }
    setFavoritePairs((current) => [
      ...current,
      { id: pairId, from: spendCurrency, to: homeCurrency }
    ]);
  }

  function applyFavoritePair(pair) {
    // Clicking a favorite pair updates both currency dropdowns.
    setSpendCurrency(pair.from);
    setHomeCurrency(pair.to);
  }

  function removeFavoritePair(pairId) {
    setFavoritePairs((current) => current.filter((item) => item.id !== pairId));
  }

  return (
    <main className="feature-main">
      <div className="conversion-shell">
        <section className="conversion-card">
          <h1>Currency Converter</h1>
          <p className="conversion-subtitle">Set your home currency and convert any expense instantly.</p>

          <div className="conversion-fields">
            <div className="field">
              <label htmlFor="spendAmountInput">Amount</label>
              <input id="spendAmountInput" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="spendCurrencySelect">Expense Currency</label>
              <select id="spendCurrencySelect" value={spendCurrency} onChange={(event) => setSpendCurrency(event.target.value)}>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="JPY">JPY</option>
                <option value="MXN">MXN</option>
              </select>
            </div>

            <button
              className="swap-currency-btn"
              type="button"
              aria-label="Swap expense and home currency"
              onClick={() => {
                const currentExpenseCurrency = spendCurrency;
                setSpendCurrency(homeCurrency);
                setHomeCurrency(currentExpenseCurrency);
              }}
            >
              Swap
            </button>

            <div className="field">
              <label htmlFor="homeCurrencySelect">Home Currency</label>
              <select id="homeCurrencySelect" value={homeCurrency} onChange={(event) => setHomeCurrency(event.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="JPY">JPY</option>
                <option value="MXN">MXN</option>
              </select>
            </div>
          </div>

          <div className="conversion-result">
            <p className="result-label">Converted Amount</p>
            <p className="result-value">{formatCurrency(convertedAmount, homeCurrency)}</p>
            <p className="result-meta">
              {useLockedRate && lockedRate && lockedRate.from === spendCurrency && lockedRate.to === homeCurrency
                ? `Locked rate: 1 ${spendCurrency} = ${formatRate(effectiveRate)} ${homeCurrency}`
                : `Live rate: 1 ${spendCurrency} = ${formatRate(liveRate)} ${homeCurrency}`}
            </p>
            <div className="result-actions">
              <button type="button" className="action-btn" onClick={lockCurrentRate}>Lock This Rate</button>
              <button type="button" className="action-btn secondary" onClick={saveFavoritePair}>Save Favorite Pair</button>
            </div>
          </div>

          <div className="feature-row">
            <section className="mini-panel">
              <h2>Locked Rate</h2>
              <p className="panel-meta">
                {lockedRate
                  ? `Locked: 1 ${lockedRate.from} = ${formatRate(lockedRate.rate)} ${lockedRate.to}`
                  : "No locked rate yet."}
              </p>
              <label className="toggle-row" htmlFor="useLockedRateToggle">
                <input id="useLockedRateToggle" type="checkbox" checked={useLockedRate} onChange={(event) => setUseLockedRate(event.target.checked)} />
                Use locked rate for this conversion
              </label>
              <button type="button" className="action-btn subtle" onClick={clearLockedRateValue}>Clear Locked Rate</button>
            </section>

            <section className="mini-panel">
              <h2>Favorite Pairs</h2>
              <div className="favorites-list">
                {favoritePairs.length > 0 ? favoritePairs.map((pair) => (
                  <div className="favorite-chip" key={pair.id}>
                    <button type="button" className="apply-favorite" onClick={() => applyFavoritePair(pair)}>
                      {pair.from} -&gt; {pair.to}
                    </button>
                    <button
                      type="button"
                      className="remove-favorite"
                      aria-label={`Remove favorite ${pair.from} to ${pair.to}`}
                      onClick={() => removeFavoritePair(pair.id)}
                    >
                      x
                    </button>
                  </div>
                )) : "No favorite pairs yet."}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

// Simple placeholder used for features that are not built yet.
function PlaceholderFeaturePage({ title }) {
  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section placeholder-section">
          <h1>{title}</h1>
          <p>Still contributing.</p>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(() => readSession());
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    setSession(null);
    navigate("/");
  }

  return (
    <>
      <Header session={session} onLogout={handleLogout} />
      {/* React Router replaces the old multi-page HTML files with route-based pages. */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignInPage onLogin={() => setSession(readSession())} />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/currency-conversion" element={<CurrencyConverterPage />} />
        <Route path="/budget-timeline" element={<PlaceholderFeaturePage title="Budget Timeline" />} />
        <Route path="/export-center" element={<PlaceholderFeaturePage title="Export Center" />} />
        <Route path="/subscription-notifications" element={<PlaceholderFeaturePage title="Subscription Alerts" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
