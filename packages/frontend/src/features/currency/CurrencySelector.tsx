// ============================================================================
// CURRENCY SELECTOR - Finance Hub
// Dropdown for selecting currencies
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface CurrencySelectorProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  showSymbol?: boolean;
  placeholder?: string;
}

// Common currencies to show at the top
const PRIORITY_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CurrencySelector({
  value,
  onChange,
  disabled = false,
  className = '',
  showSymbol = true,
  placeholder = 'Selectionner une devise',
}: CurrencySelectorProps) {
  const { data: currencies, isLoading } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.get<Currency[]>('/currencies'),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Sort currencies: priority first, then alphabetically
  const sortedCurrencies = currencies
    ? [...currencies].sort((a, b) => {
        const aIndex = PRIORITY_CURRENCIES.indexOf(a.code);
        const bIndex = PRIORITY_CURRENCIES.indexOf(b.code);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.code.localeCompare(b.code);
      })
    : [];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      className={`input ${className}`}
    >
      <option value="">{isLoading ? 'Chargement...' : placeholder}</option>

      {/* Priority currencies */}
      {sortedCurrencies
        .filter((c) => PRIORITY_CURRENCIES.includes(c.code))
        .map((currency) => (
          <option key={currency.code} value={currency.code}>
            {showSymbol ? `${currency.symbol} ` : ''}
            {currency.code} - {currency.name}
          </option>
        ))}

      {/* Separator */}
      {sortedCurrencies.length > PRIORITY_CURRENCIES.length && (
        <option disabled>──────────</option>
      )}

      {/* Other currencies */}
      {sortedCurrencies
        .filter((c) => !PRIORITY_CURRENCIES.includes(c.code))
        .map((currency) => (
          <option key={currency.code} value={currency.code}>
            {showSymbol ? `${currency.symbol} ` : ''}
            {currency.code} - {currency.name}
          </option>
        ))}
    </select>
  );
}

export default CurrencySelector;
