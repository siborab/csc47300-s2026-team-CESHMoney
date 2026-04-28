import React, { useEffect, useState } from "react";
import { FAVORITE_PAIRS_KEY, HOME_CURRENCY_KEY, LOCKED_RATE_KEY, RATE_TO_USD } from "../utils/constants";
import { convertAmount, parseAmount } from "../utils/currency";
import { formatCurrency, formatRate } from "../utils/format";
import { readJsonFromStorage } from "../utils/storage";

export default function CurrencyConverterPage() {
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
    if (useLockedRate && lockedRate && (lockedRate.from !== spendCurrency || lockedRate.to !== homeCurrency)) {
      setUseLockedRate(false);
    }
  }, [homeCurrency, lockedRate, spendCurrency, useLockedRate]);

  const liveRate = convertAmount(1, spendCurrency, homeCurrency);
  const effectiveRate = useLockedRate &&
    lockedRate &&
    lockedRate.from === spendCurrency &&
    lockedRate.to === homeCurrency
    ? Number(lockedRate.rate)
    : liveRate;
  const convertedAmount = parseAmount(amount) * effectiveRate;

  function lockCurrentRate() {
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
    localStorage.removeItem(LOCKED_RATE_KEY);
    setLockedRate(null);
    setUseLockedRate(false);
  }

  function saveFavoritePair() {
    const pairId = `${spendCurrency}_${homeCurrency}`;
    if (favoritePairs.some((item) => item.id === pairId)) {
      return;
    }
    setFavoritePairs((current) => [...current, { id: pairId, from: spendCurrency, to: homeCurrency }]);
  }

  function applyFavoritePair(pair) {
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
                <option value="EUR">EUR</option><option value="GBP">GBP</option><option value="CAD">CAD</option>
                <option value="USD">USD</option><option value="JPY">JPY</option><option value="MXN">MXN</option>
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
                <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                <option value="CAD">CAD</option><option value="JPY">JPY</option><option value="MXN">MXN</option>
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
                {lockedRate ? `Locked: 1 ${lockedRate.from} = ${formatRate(lockedRate.rate)} ${lockedRate.to}` : "No locked rate yet."}
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
