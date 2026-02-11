// ============================================================================
// USE USER SETTINGS HOOK - Finance Hub
// Provides access to user profile and country-specific settings
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { COUNTRY_DEFAULTS } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type CountryCode = 'FR' | 'CH';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  country: CountryCode;
  locale: string;
  timezone: string;
  theme: string;
}

export interface VatRate {
  value: number;
  label: string;
}

// ----------------------------------------------------------------------------
// Country-specific configurations
// ----------------------------------------------------------------------------

const VAT_RATES_BY_COUNTRY: Record<CountryCode, VatRate[]> = {
  FR: [
    { value: 20, label: 'TVA 20% (normal)' },
    { value: 10, label: 'TVA 10% (intermediaire)' },
    { value: 5.5, label: 'TVA 5,5% (reduit)' },
    { value: 2.1, label: 'TVA 2,1% (super-reduit)' },
    { value: 0, label: 'Exonere' },
  ],
  CH: [
    { value: 8.1, label: 'TVA 8,1% (normal)' },
    { value: 3.8, label: 'TVA 3,8% (hebergement)' },
    { value: 2.6, label: 'TVA 2,6% (reduit)' },
    { value: 0, label: 'Exonere' },
  ],
};

const BUSINESS_ID_CONFIG: Record<CountryCode, { name: string; placeholder: string; maxLength: number; pattern: RegExp }> = {
  FR: {
    name: 'SIRET',
    placeholder: '12345678901234',
    maxLength: 14,
    pattern: /^\d{14}$/,
  },
  CH: {
    name: 'UID',
    placeholder: 'CHE-123.456.789',
    maxLength: 15,
    pattern: /^CHE[- ]?\d{3}[. ]?\d{3}[. ]?\d{3}$/i,
  },
};

const VAT_NUMBER_CONFIG: Record<CountryCode, { placeholder: string; label: string }> = {
  FR: {
    placeholder: 'FR12345678901',
    label: 'Numero de TVA intracommunautaire',
  },
  CH: {
    placeholder: 'CHE-123.456.789 MWST',
    label: 'Numero de TVA (MWST)',
  },
};

const PHONE_PLACEHOLDER: Record<CountryCode, string> = {
  FR: '01 23 45 67 89',
  CH: '+41 12 345 67 89',
};

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useUserSettings() {
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => api.get<UserProfile>('/settings/profile'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const country: CountryCode = profile?.country || 'FR';
  const locale = profile?.locale || COUNTRY_DEFAULTS[country]?.locale || 'fr-FR';
  const timezone = profile?.timezone || COUNTRY_DEFAULTS[country]?.timezone || 'Europe/Paris';
  const currency = COUNTRY_DEFAULTS[country]?.currency || 'EUR';

  return {
    // Profile data
    profile,
    isLoading,
    error,

    // Country settings
    country,
    locale,
    timezone,
    defaultCurrency: currency,

    // VAT rates for the user's country
    vatRates: VAT_RATES_BY_COUNTRY[country] || VAT_RATES_BY_COUNTRY.FR,
    defaultVatRate: VAT_RATES_BY_COUNTRY[country]?.[0]?.value || 20,

    // Business ID configuration (SIRET for FR, UID for CH)
    businessIdConfig: BUSINESS_ID_CONFIG[country] || BUSINESS_ID_CONFIG.FR,

    // VAT number configuration
    vatNumberConfig: VAT_NUMBER_CONFIG[country] || VAT_NUMBER_CONFIG.FR,

    // Phone placeholder
    phonePlaceholder: PHONE_PLACEHOLDER[country] || PHONE_PLACEHOLDER.FR,

    // Helpers
    isFrance: country === 'FR',
    isSwitzerland: country === 'CH',

    // Format helpers with user's locale
    formatCurrency: (amount: number, currencyCode = currency) => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    },

    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(locale, options).format(value);
    },

    formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, options).format(dateObj);
    },
  };
}

export default useUserSettings;
