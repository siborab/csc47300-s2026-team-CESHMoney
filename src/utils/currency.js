import { RATE_TO_USD } from "./constants";

export function parseAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function convertAmount(amount, fromCurrency, toCurrency) {
  const fromRate = RATE_TO_USD[fromCurrency];
  const toRate = RATE_TO_USD[toCurrency];
  if (!fromRate || !toRate) {
    return 0;
  }
  return (amount * fromRate) / toRate;
}
