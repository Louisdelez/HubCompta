// ============================================================================
// COUNTRY CONFIGURATIONS - Finance Hub
// Multi-country support for tax, VAT, and formatting
// ============================================================================

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type CountryCode = 'FR' | 'CH';

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

export interface VATRate {
  code: string;
  name: string;
  rate: number;
}

export interface DeductionCategory {
  code: string;
  name: string;
  description: string;
  maxAmount?: number;
  rateLimit?: number; // percentage of income
}

export interface StandardDeduction {
  rate: number;
  min: number;
  max: number;
}

export interface CountryFormatting {
  locale: string;
  alternateLocales: string[];
  dateFormat: string;
  numberFormat: {
    decimalSeparator: string;
    thousandsSeparator: string;
  };
  currencyFormat: {
    decimalSeparator: string;
    thousandsSeparator: string;
  };
}

export interface BankingConfig {
  ibanLength: number;
  ibanPrefix: string;
  supportsQRBill: boolean;
  paymentSystems: string[];
}

export interface CountryConfig {
  code: CountryCode;
  name: string;
  nameLocal: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
  timezone: string;
  taxBrackets: TaxBracket[];
  vatRates: VATRate[];
  deductionCategories: DeductionCategory[];
  standardDeduction?: StandardDeduction;
  formatting: CountryFormatting;
  banking: BankingConfig;
  fiscalYearStart: number; // month 1-12
  features: {
    cantonalTax?: boolean; // Switzerland specific
    pillar3a?: boolean; // Switzerland specific
    qrBill?: boolean; // Switzerland specific
  };
}

// ----------------------------------------------------------------------------
// France Configuration
// ----------------------------------------------------------------------------

export const FRANCE_CONFIG: CountryConfig = {
  code: 'FR',
  name: 'France',
  nameLocal: 'France',
  defaultCurrency: 'EUR',
  supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF'],
  timezone: 'Europe/Paris',
  fiscalYearStart: 1, // January

  // Tax brackets 2024
  taxBrackets: [
    { min: 0, max: 11294, rate: 0 },
    { min: 11294, max: 28797, rate: 0.11 },
    { min: 28797, max: 82341, rate: 0.30 },
    { min: 82341, max: 177106, rate: 0.41 },
    { min: 177106, max: null, rate: 0.45 },
  ],

  // VAT rates
  vatRates: [
    { code: 'standard', name: 'Taux normal', rate: 20 },
    { code: 'intermediate', name: 'Taux intermediaire', rate: 10 },
    { code: 'reduced', name: 'Taux reduit', rate: 5.5 },
    { code: 'super_reduced', name: 'Taux super reduit', rate: 2.1 },
    { code: 'exempt', name: 'Exonere', rate: 0 },
  ],

  // Deduction categories
  deductionCategories: [
    {
      code: 'professional',
      name: 'Frais professionnels',
      description: 'Frais lies a l\'activite professionnelle',
    },
    {
      code: 'medical',
      name: 'Frais medicaux',
      description: 'Depenses de sante non remboursees',
    },
    {
      code: 'charitable',
      name: 'Dons',
      description: 'Dons a des organismes reconnus d\'utilite publique',
      rateLimit: 20, // 20% of income max
    },
    {
      code: 'childcare',
      name: 'Garde d\'enfants',
      description: 'Frais de garde pour enfants de moins de 6 ans',
      maxAmount: 3500,
    },
    {
      code: 'home_services',
      name: 'Services a domicile',
      description: 'Emploi a domicile, jardinage, menage',
      maxAmount: 12000,
    },
    {
      code: 'retirement',
      name: 'Epargne retraite',
      description: 'Versements PER, PERP',
    },
    {
      code: 'other',
      name: 'Autres',
      description: 'Autres deductions',
    },
  ],

  // Standard deduction (abattement forfaitaire 10%)
  standardDeduction: {
    rate: 0.10,
    min: 495,
    max: 14171,
  },

  formatting: {
    locale: 'fr-FR',
    alternateLocales: ['fr'],
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimalSeparator: ',',
      thousandsSeparator: ' ',
    },
    currencyFormat: {
      decimalSeparator: ',',
      thousandsSeparator: ' ',
    },
  },

  banking: {
    ibanLength: 27,
    ibanPrefix: 'FR',
    supportsQRBill: false,
    paymentSystems: ['SEPA', 'SWIFT'],
  },

  features: {},
};

// ----------------------------------------------------------------------------
// Switzerland Configuration
// ----------------------------------------------------------------------------

export const SWITZERLAND_CONFIG: CountryConfig = {
  code: 'CH',
  name: 'Switzerland',
  nameLocal: 'Suisse',
  defaultCurrency: 'CHF',
  supportedCurrencies: ['CHF', 'EUR', 'USD', 'GBP'],
  timezone: 'Europe/Zurich',
  fiscalYearStart: 1, // January

  // Federal tax brackets 2024 (simplified - actual varies by canton)
  // This is the federal direct tax, cantons add their own rates
  taxBrackets: [
    { min: 0, max: 17800, rate: 0 },
    { min: 17800, max: 31600, rate: 0.0077 },
    { min: 31600, max: 41400, rate: 0.0088 },
    { min: 41400, max: 55200, rate: 0.0264 },
    { min: 55200, max: 72500, rate: 0.0297 },
    { min: 72500, max: 78100, rate: 0.0561 },
    { min: 78100, max: 103600, rate: 0.066 },
    { min: 103600, max: 134600, rate: 0.088 },
    { min: 134600, max: 176000, rate: 0.11 },
    { min: 176000, max: 755200, rate: 0.132 },
    { min: 755200, max: null, rate: 0.115 }, // Max rate
  ],

  // VAT rates (as of 2024)
  vatRates: [
    { code: 'standard', name: 'Taux normal', rate: 8.1 },
    { code: 'reduced', name: 'Taux reduit', rate: 2.6 },
    { code: 'accommodation', name: 'Hebergement', rate: 3.8 },
    { code: 'exempt', name: 'Exonere', rate: 0 },
  ],

  // Deduction categories (Swiss specific)
  deductionCategories: [
    {
      code: 'professional',
      name: 'Frais professionnels',
      description: 'Frais forfaitaires ou effectifs',
      rateLimit: 3, // 3% min flat rate
      maxAmount: 4000,
    },
    {
      code: 'commuting',
      name: 'Transport domicile-travail',
      description: 'Transports publics ou frais kilometres',
      maxAmount: 3200, // CHF per year
    },
    {
      code: 'meals',
      name: 'Frais de repas',
      description: 'Repas pris a l\'exterieur pendant le travail',
      maxAmount: 3200,
    },
    {
      code: 'pillar3a',
      name: 'Pilier 3a',
      description: 'Prevoyance individuelle liee',
      maxAmount: 7056, // 2024: 7056 CHF for employed, 35280 for self-employed
    },
    {
      code: 'pillar2_buyback',
      name: 'Rachat 2e pilier',
      description: 'Rachat volontaire caisse de pension',
    },
    {
      code: 'insurance',
      name: 'Assurances',
      description: 'Primes maladie, vie, accident',
      maxAmount: 1800, // per adult, 3600 per couple
    },
    {
      code: 'medical',
      name: 'Frais medicaux',
      description: 'Frais de sante non rembourses (> seuil)',
    },
    {
      code: 'childcare',
      name: 'Garde d\'enfants',
      description: 'Frais de garde par des tiers',
      maxAmount: 25000, // varies by canton
    },
    {
      code: 'education',
      name: 'Formation continue',
      description: 'Frais de formation professionnelle',
      maxAmount: 12900,
    },
    {
      code: 'charitable',
      name: 'Dons',
      description: 'Dons a des organisations reconnues',
      rateLimit: 20, // max 20% of net income
    },
    {
      code: 'mortgage_interest',
      name: 'Interets hypothecaires',
      description: 'Interets sur prets immobiliers',
    },
    {
      code: 'maintenance',
      name: 'Frais d\'entretien immobilier',
      description: 'Entretien et reparations immobilieres',
    },
    {
      code: 'alimony',
      name: 'Pension alimentaire',
      description: 'Versements au conjoint/enfants',
    },
    {
      code: 'other',
      name: 'Autres deductions',
      description: 'Autres deductions admises',
    },
  ],

  // No standard deduction in Switzerland (actual expenses or flat rates)
  // Property omitted - standardDeduction is optional

  formatting: {
    locale: 'de-CH',
    alternateLocales: ['fr-CH', 'it-CH'],
    dateFormat: 'DD.MM.YYYY',
    numberFormat: {
      decimalSeparator: '.',
      thousandsSeparator: "'", // Swiss apostrophe
    },
    currencyFormat: {
      decimalSeparator: '.',
      thousandsSeparator: "'",
    },
  },

  banking: {
    ibanLength: 21,
    ibanPrefix: 'CH',
    supportsQRBill: true,
    paymentSystems: ['SIC', 'euroSIC', 'SWIFT'],
  },

  features: {
    cantonalTax: true,
    pillar3a: true,
    qrBill: true,
  },
};

// ----------------------------------------------------------------------------
// Country Registry
// ----------------------------------------------------------------------------

export const COUNTRY_CONFIGS: Record<CountryCode, CountryConfig> = {
  FR: FRANCE_CONFIG,
  CH: SWITZERLAND_CONFIG,
};

export const SUPPORTED_COUNTRIES: Array<{ code: CountryCode; name: string; flag: string }> = [
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
];

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

export function getCountryConfig(code: CountryCode): CountryConfig {
  const config = COUNTRY_CONFIGS[code];
  if (!config) {
    throw new Error(`Unsupported country code: ${code}`);
  }
  return config;
}

export function getDefaultsForCountry(code: CountryCode) {
  const config = getCountryConfig(code);
  return {
    currency: config.defaultCurrency,
    locale: config.formatting.locale,
    timezone: config.timezone,
    dateFormat: config.formatting.dateFormat,
    fiscalYearStart: config.fiscalYearStart,
  };
}

export function getTaxBrackets(code: CountryCode): TaxBracket[] {
  return getCountryConfig(code).taxBrackets;
}

export function getVATRates(code: CountryCode): VATRate[] {
  return getCountryConfig(code).vatRates;
}

export function getDeductionCategories(code: CountryCode): DeductionCategory[] {
  return getCountryConfig(code).deductionCategories;
}

/**
 * Calculate tax for a given country
 */
export function calculateTax(
  taxableIncome: number,
  countryCode: CountryCode,
): number {
  const brackets = getTaxBrackets(countryCode);
  let tax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize = bracket.max !== null
      ? bracket.max - bracket.min
      : remainingIncome;

    const taxableInBracket = Math.min(remainingIncome, bracketSize);
    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  return Math.round(tax * 100) / 100;
}

/**
 * Get marginal tax rate for a given income
 */
export function getMarginalRate(
  taxableIncome: number,
  countryCode: CountryCode,
): number {
  const brackets = getTaxBrackets(countryCode);

  for (let i = brackets.length - 1; i >= 0; i--) {
    const bracket = brackets[i];
    if (bracket && taxableIncome > bracket.min) {
      return bracket.rate;
    }
  }
  return 0;
}

/**
 * Format number according to country conventions
 */
export function formatNumber(
  value: number,
  countryCode: CountryCode,
  options?: { decimals?: number; isCurrency?: boolean }
): string {
  const config = getCountryConfig(countryCode);
  const format = options?.isCurrency
    ? config.formatting.currencyFormat
    : config.formatting.numberFormat;

  const decimals = options?.decimals ?? 2;
  const parts = value.toFixed(decimals).split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = parts[1] || '';

  // Format integer part with thousands separator
  const formattedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    format.thousandsSeparator
  );

  return decimals > 0
    ? `${formattedInteger}${format.decimalSeparator}${decimalPart}`
    : formattedInteger;
}
