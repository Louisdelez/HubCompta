// ============================================================================
// VAT UTILITIES - Finance Hub
// Multi-country VAT calculation helpers (France & Switzerland)
// ============================================================================

import { PRO } from '@finance-hub/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { type CountryCode, getCountryConfig } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type VatRateKey = keyof typeof PRO.VAT_RATES;

export interface LineCalculation {
  subtotal: Decimal;
  vatAmount: Decimal;
  total: Decimal;
}

export interface DocumentTotals {
  subtotal: Decimal;
  vatAmount: Decimal;
  total: Decimal;
  vatBreakdown: Array<{
    rate: number;
    base: Decimal;
    amount: Decimal;
  }>;
}

// ----------------------------------------------------------------------------
// Country-specific VAT rates
// ----------------------------------------------------------------------------

/** French VAT rates */
export const VAT_RATES_FR = {
  STANDARD: new Decimal(20),
  INTERMEDIATE: new Decimal(10),
  REDUCED: new Decimal(5.5),
  SUPER_REDUCED: new Decimal(2.1),
  EXEMPT: new Decimal(0),
} as const;

/** Swiss VAT rates */
export const VAT_RATES_CH = {
  STANDARD: new Decimal(8.1),
  REDUCED: new Decimal(2.6),
  ACCOMMODATION: new Decimal(3.8),
  EXEMPT: new Decimal(0),
} as const;

/** Get VAT rates for a specific country */
export function getVatRatesForCountry(countryCode: CountryCode = 'FR') {
  const config = getCountryConfig(countryCode);
  return config.vatRates;
}

/** Legacy: French VAT rates (for backward compatibility) */
export const VAT_RATES = VAT_RATES_FR;

/** Default VAT rate for new lines */
export const DEFAULT_VAT_RATE = VAT_RATES.STANDARD;

// ----------------------------------------------------------------------------
// Calculation Functions
// ----------------------------------------------------------------------------

/**
 * Calculate VAT amount from a HT (excluding VAT) amount
 */
export function calculateVatFromHT(amountHT: Decimal, vatRate: Decimal): Decimal {
  return amountHT.mul(vatRate).div(100);
}

/**
 * Calculate HT amount from a TTC (including VAT) amount
 */
export function calculateHTFromTTC(amountTTC: Decimal, vatRate: Decimal): Decimal {
  return amountTTC.div(new Decimal(1).add(vatRate.div(100)));
}

/**
 * Calculate VAT amount from a TTC (including VAT) amount
 */
export function calculateVatFromTTC(amountTTC: Decimal, vatRate: Decimal): Decimal {
  const amountHT = calculateHTFromTTC(amountTTC, vatRate);
  return amountTTC.sub(amountHT);
}

/**
 * Calculate line totals from quantity, unit price, and VAT rate
 */
export function calculateLineTotal(
  quantity: Decimal,
  unitPrice: Decimal,
  vatRate: Decimal
): LineCalculation {
  const subtotal = quantity.mul(unitPrice);
  const vatAmount = calculateVatFromHT(subtotal, vatRate);
  const total = subtotal.add(vatAmount);

  return {
    subtotal: roundToDecimal(subtotal, 4),
    vatAmount: roundToDecimal(vatAmount, 4),
    total: roundToDecimal(total, 4),
  };
}

/**
 * Calculate document totals from an array of lines
 */
export function calculateDocumentTotals(
  lines: Array<{
    quantity: number | Decimal;
    unitPrice: number | Decimal;
    vatRate: number | Decimal;
  }>
): DocumentTotals {
  let subtotal = new Decimal(0);
  let vatAmount = new Decimal(0);
  const vatByRate = new Map<string, { base: Decimal; amount: Decimal }>();

  for (const line of lines) {
    const qty = toDecimal(line.quantity);
    const price = toDecimal(line.unitPrice);
    const rate = toDecimal(line.vatRate);

    const lineCalc = calculateLineTotal(qty, price, rate);

    subtotal = subtotal.add(lineCalc.subtotal);
    vatAmount = vatAmount.add(lineCalc.vatAmount);

    // Aggregate by VAT rate
    const rateKey = rate.toString();
    const existing = vatByRate.get(rateKey) || { base: new Decimal(0), amount: new Decimal(0) };
    vatByRate.set(rateKey, {
      base: existing.base.add(lineCalc.subtotal),
      amount: existing.amount.add(lineCalc.vatAmount),
    });
  }

  const vatBreakdown = Array.from(vatByRate.entries()).map(([rate, values]) => ({
    rate: parseFloat(rate),
    base: roundToDecimal(values.base, 4),
    amount: roundToDecimal(values.amount, 4),
  }));

  return {
    subtotal: roundToDecimal(subtotal, 4),
    vatAmount: roundToDecimal(vatAmount, 4),
    total: roundToDecimal(subtotal.add(vatAmount), 4),
    vatBreakdown,
  };
}

/**
 * Validate SIRET number (French business ID)
 * SIRET = 14 digits, first 9 are SIREN
 */
export function validateSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) {
    return false;
  }

  // Luhn algorithm check
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = siret[i];
    if (!char) return false;
    let digit = parseInt(char, 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Validate Swiss UID (Unternehmens-Identifikationsnummer)
 * Format: CHE-XXX.XXX.XXX or CHE XXX XXX XXX (9 digits after CHE)
 */
export function validateSwissUid(uid: string): boolean {
  // Remove formatting (dots, dashes, spaces)
  const cleaned = uid.replace(/[\s.-]/g, '').toUpperCase();

  // Must start with CHE and have 9 digits
  if (!/^CHE\d{9}$/.test(cleaned)) {
    return false;
  }

  const digits = cleaned.slice(3);

  // Modulo 11 check digit validation
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const char = digits[i];
    if (!char) return false;
    sum += parseInt(char, 10) * (weights[i] ?? 0);
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  const lastDigit = digits[8];

  // Check digit 10 is invalid
  if (checkDigit === 10) return false;

  return lastDigit !== undefined && parseInt(lastDigit, 10) === checkDigit;
}

/**
 * Validate business identifier based on country
 */
export function validateBusinessId(id: string, countryCode: CountryCode): boolean {
  switch (countryCode) {
    case 'FR':
      return validateSiret(id);
    case 'CH':
      return validateSwissUid(id);
    default:
      return true;
  }
}

/**
 * Validate French VAT number (TVA intracommunautaire)
 * Format: FR + 2 chars (check digits) + 9 digits (SIREN)
 */
export function validateFrenchVatNumber(vatNumber: string): boolean {
  const pattern = /^FR[0-9A-HJ-NP-Z]{2}\d{9}$/;
  if (!pattern.test(vatNumber)) {
    return false;
  }

  const siren = vatNumber.slice(4);
  const key = vatNumber.slice(2, 4);

  // Simple validation for numeric keys
  if (/^\d{2}$/.test(key)) {
    const sirenNum = parseInt(siren, 10);
    const expectedKey = (12 + 3 * (sirenNum % 97)) % 97;
    return parseInt(key, 10) === expectedKey;
  }

  // Alphanumeric keys require more complex validation
  return true;
}

/**
 * Validate Swiss VAT number (MWST-Nummer)
 * Format: CHE-XXX.XXX.XXX MWST or CHE XXX XXX XXX MWST
 */
export function validateSwissVatNumber(vatNumber: string): boolean {
  // Remove "MWST", "TVA", "IVA" suffix and formatting
  const cleaned = vatNumber.replace(/\s*(MWST|TVA|IVA)\s*$/i, '').trim();
  return validateSwissUid(cleaned);
}

/**
 * Validate VAT number based on country
 */
export function validateVatNumber(vatNumber: string, countryCode: CountryCode): boolean {
  switch (countryCode) {
    case 'FR':
      return validateFrenchVatNumber(vatNumber);
    case 'CH':
      return validateSwissVatNumber(vatNumber);
    default:
      return true;
  }
}

/**
 * Format amount for display with locale-aware formatting
 */
export function formatAmount(
  amount: Decimal | number,
  currency = 'EUR',
  countryCode: CountryCode = 'FR'
): string {
  const numAmount = typeof amount === 'number' ? amount : amount.toNumber();
  const config = getCountryConfig(countryCode);
  return new Intl.NumberFormat(config.formatting.locale, {
    style: 'currency',
    currency,
  }).format(numAmount);
}

/** @deprecated Use formatAmount with countryCode instead */
export function formatAmountFR(amount: Decimal | number, currency = 'EUR'): string {
  return formatAmount(amount, currency, 'FR');
}

/**
 * Get VAT rate label based on country
 */
export function getVatRateLabel(rate: number, countryCode: CountryCode = 'FR'): string {
  const labels: Record<CountryCode, Record<number, string>> = {
    FR: {
      20: 'TVA 20% (taux normal)',
      10: 'TVA 10% (taux intermediaire)',
      5.5: 'TVA 5,5% (taux reduit)',
      2.1: 'TVA 2,1% (taux super-reduit)',
      0: 'Exonere de TVA',
    },
    CH: {
      8.1: 'TVA 8,1% (taux normal)',
      3.8: 'TVA 3,8% (hebergement)',
      2.6: 'TVA 2,6% (taux reduit)',
      0: 'Exonere de TVA',
    },
  };
  const countryLabels = labels[countryCode] || labels.FR;
  return countryLabels[rate] || `TVA ${rate}%`;
}

/**
 * Get business ID field name for a country
 */
export function getBusinessIdFieldName(countryCode: CountryCode): string {
  switch (countryCode) {
    case 'FR':
      return 'SIRET';
    case 'CH':
      return 'UID';
    default:
      return 'ID';
  }
}

/**
 * Get business ID placeholder for a country
 */
export function getBusinessIdPlaceholder(countryCode: CountryCode): string {
  switch (countryCode) {
    case 'FR':
      return '12345678901234';
    case 'CH':
      return 'CHE-123.456.789';
    default:
      return '';
  }
}

/**
 * Get VAT number placeholder for a country
 */
export function getVatNumberPlaceholder(countryCode: CountryCode): string {
  switch (countryCode) {
    case 'FR':
      return 'FR12345678901';
    case 'CH':
      return 'CHE-123.456.789 MWST';
    default:
      return '';
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function toDecimal(value: number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

function roundToDecimal(value: Decimal, decimals: number): Decimal {
  return value.toDecimalPlaces(decimals);
}
