const RATE_TO_USD = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  JPY: 0.0067,
  MXN: 0.058
};

const HOME_CURRENCY_KEY = "spendwise_home_currency";
const LOCKED_RATE_KEY = "spendwise_locked_rate_snapshot";
const FAVORITE_PAIRS_KEY = "spendwise_favorite_currency_pairs";

function parseAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function convertAmount(amount, fromCurrency, toCurrency) {
  const fromRate = RATE_TO_USD[fromCurrency];
  const toRate = RATE_TO_USD[toCurrency];
  if (!fromRate || !toRate) {
    return 0;
  }
  const usdAmount = amount * fromRate;
  return usdAmount / toRate;
}

function formatCurrency(amount, currencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatRate(rate) {
  return Number(rate).toFixed(4).replace(/\.?0+$/, "");
}

function readJsonFromStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallbackValue;
    }
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
}

function initCurrencyConversion() {
  const amountInput = document.getElementById("spendAmountInput");
  const spendCurrencySelect = document.getElementById("spendCurrencySelect");
  const homeCurrencySelect = document.getElementById("homeCurrencySelect");
  const swapBtn = document.getElementById("swapCurrenciesBtn");
  const lockRateBtn = document.getElementById("lockRateBtn");
  const clearLockedRateBtn = document.getElementById("clearLockedRateBtn");
  const useLockedRateToggle = document.getElementById("useLockedRateToggle");
  const lockedRateStatusText = document.getElementById("lockedRateStatusText");
  const saveFavoritePairBtn = document.getElementById("saveFavoritePairBtn");
  const favoritePairsList = document.getElementById("favoritePairsList");
  const convertedAmountValue = document.getElementById("convertedAmountValue");
  const conversionRateMetaEl = document.getElementById("conversionRateMeta");

  if (
    !amountInput ||
    !spendCurrencySelect ||
    !homeCurrencySelect ||
    !convertedAmountValue ||
    !conversionRateMetaEl ||
    !lockRateBtn ||
    !clearLockedRateBtn ||
    !useLockedRateToggle ||
    !lockedRateStatusText ||
    !saveFavoritePairBtn ||
    !favoritePairsList
  ) {
    return;
  }

  let lockedRate = readJsonFromStorage(LOCKED_RATE_KEY, null);
  let favoritePairs = readJsonFromStorage(FAVORITE_PAIRS_KEY, []);
  if (!Array.isArray(favoritePairs)) {
    favoritePairs = [];
  }

  const savedHomeCurrency = localStorage.getItem(HOME_CURRENCY_KEY);
  if (savedHomeCurrency && RATE_TO_USD[savedHomeCurrency]) {
    homeCurrencySelect.value = savedHomeCurrency;
  }

  function getCurrentPair() {
    return {
      from: spendCurrencySelect.value,
      to: homeCurrencySelect.value
    };
  }

  function updateLockedRateStatus() {
    if (!lockedRate) {
      lockedRateStatusText.textContent = "No locked rate yet.";
      return;
    }
    lockedRateStatusText.textContent = `Locked: 1 ${lockedRate.from} = ${formatRate(lockedRate.rate)} ${lockedRate.to}`;
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITE_PAIRS_KEY, JSON.stringify(favoritePairs));
  }

  function renderFavorites() {
    if (!favoritePairs.length) {
      favoritePairsList.textContent = "No favorite pairs yet.";
      return;
    }

    favoritePairsList.innerHTML = favoritePairs
      .map((pair) => `
        <div class="favorite-chip" data-pair-id="${pair.id}">
          <button type="button" class="apply-favorite">${pair.from} -> ${pair.to}</button>
          <button type="button" class="remove-favorite" aria-label="Remove favorite ${pair.from} to ${pair.to}">x</button>
        </div>
      `)
      .join("");
  }

  function updateConvertedValue() {
    const amount = parseAmount(amountInput.value);
    const pair = getCurrentPair();
    const liveRate = convertAmount(1, pair.from, pair.to);
    let effectiveRate = liveRate;
    let usingLockedRate = false;

    if (
      useLockedRateToggle.checked &&
      lockedRate &&
      lockedRate.from === pair.from &&
      lockedRate.to === pair.to
    ) {
      effectiveRate = Number(lockedRate.rate);
      usingLockedRate = true;
    }

    if (
      useLockedRateToggle.checked &&
      lockedRate &&
      (lockedRate.from !== pair.from || lockedRate.to !== pair.to)
    ) {
      useLockedRateToggle.checked = false;
    }

    const converted = amount * effectiveRate;

    convertedAmountValue.textContent = formatCurrency(converted, pair.to);
    conversionRateMetaEl.textContent = usingLockedRate
      ? `Locked rate: 1 ${pair.from} = ${formatRate(effectiveRate)} ${pair.to}`
      : `Live rate: 1 ${pair.from} = ${formatRate(liveRate)} ${pair.to}`;
  }

  amountInput.addEventListener("input", updateConvertedValue);
  spendCurrencySelect.addEventListener("change", updateConvertedValue);
  homeCurrencySelect.addEventListener("change", () => {
    localStorage.setItem(HOME_CURRENCY_KEY, homeCurrencySelect.value);
    updateConvertedValue();
  });

  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const expenseCurrency = spendCurrencySelect.value;
      spendCurrencySelect.value = homeCurrencySelect.value;
      homeCurrencySelect.value = expenseCurrency;
      localStorage.setItem(HOME_CURRENCY_KEY, homeCurrencySelect.value);
      updateConvertedValue();
    });
  }

  lockRateBtn.addEventListener("click", () => {
    const pair = getCurrentPair();
    lockedRate = {
      from: pair.from,
      to: pair.to,
      rate: convertAmount(1, pair.from, pair.to),
      lockedAt: new Date().toISOString()
    };
    localStorage.setItem(LOCKED_RATE_KEY, JSON.stringify(lockedRate));
    useLockedRateToggle.checked = true;
    updateLockedRateStatus();
    updateConvertedValue();
  });

  clearLockedRateBtn.addEventListener("click", () => {
    lockedRate = null;
    localStorage.removeItem(LOCKED_RATE_KEY);
    useLockedRateToggle.checked = false;
    updateLockedRateStatus();
    updateConvertedValue();
  });

  useLockedRateToggle.addEventListener("change", updateConvertedValue);

  saveFavoritePairBtn.addEventListener("click", () => {
    const pair = getCurrentPair();
    const pairId = `${pair.from}_${pair.to}`;
    if (favoritePairs.some((item) => item.id === pairId)) {
      return;
    }
    favoritePairs.push({ id: pairId, from: pair.from, to: pair.to });
    saveFavorites();
    renderFavorites();
  });

  favoritePairsList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const chip = target.closest(".favorite-chip");
    if (!chip) {
      return;
    }
    const pairId = chip.getAttribute("data-pair-id");
    if (!pairId) {
      return;
    }

    if (target.classList.contains("remove-favorite")) {
      favoritePairs = favoritePairs.filter((item) => item.id !== pairId);
      saveFavorites();
      renderFavorites();
      return;
    }

    if (target.classList.contains("apply-favorite")) {
      const pair = favoritePairs.find((item) => item.id === pairId);
      if (!pair) {
        return;
      }
      spendCurrencySelect.value = pair.from;
      homeCurrencySelect.value = pair.to;
      localStorage.setItem(HOME_CURRENCY_KEY, pair.to);
      updateConvertedValue();
    }
  });

  updateLockedRateStatus();
  renderFavorites();
  updateConvertedValue();
}

document.addEventListener("DOMContentLoaded", initCurrencyConversion);
