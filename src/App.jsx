import React, { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SignInPage, SignUpPage } from "./auth.jsx";
import { DashboardPage } from "./dashboard.jsx";
import {
  FAVORITE_PAIRS_KEY,
  HOME_CURRENCY_KEY,
  LOCKED_RATE_KEY,
  RATE_TO_USD,
  clearSession,
  convertAmount,
  formatCurrency,
  formatRate,
  parseAmount,
  readJsonFromStorage,
  readSession
} from "./utils.js";

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
