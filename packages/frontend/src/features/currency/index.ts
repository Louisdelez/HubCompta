// ============================================================================
// CURRENCY MODULE - Finance Hub
// Multi-currency support components and utilities
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

export { CurrencySelector } from './CurrencySelector';
export {
  CurrencyDisplay,
  formatCurrency,
  formatCompactCurrency,
  formatWithConversion,
  getCurrencySymbol,
  type FormatCurrencyOptions,
} from './CurrencyDisplay';
export { CurrencyConverter } from './CurrencyConverter';
export { MultiCurrencySummary } from './MultiCurrencySummary';
export { ExchangeRatesPage } from './ExchangeRatesPage';
export { ManualRateModal } from './ManualRateModal';
