// ============================================================================
// VAT UTILITIES - Finance Hub
// French VAT (TVA) calculation helpers
// ============================================================================

import { PRO } from '@finance-hub/shared';
import { Decimal } from '@prisma/client/runtime/library';

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
// Constants
// ----------------------------------------------------------------------------

/** French VAT rates */
export const VAT_RATES = {
  /** Standard rate (20%) - most goods and services */
  STANDARD: new Decimal(20),
  /** Intermediate rate (10%) - restaurants, transport, renovation */
  INTERMEDIATE: new Decimal(10),
  /** Reduced rate (5.5%) - food, books, energy */
  REDUCED: new Decimal(5.5),
  /** Super-reduced rate (2.1%) - press, medicines */
  SUPER_REDUCED: new Decimal(2.1),
  /** Exempt (0%) - exports, intra-EU, medical */
  EXEMPT: new Decimal(0),
} as const;

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
    let digit = parseInt(siret[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
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
 * Format amount for display with French locale
 */
export function formatAmountFR(amount: Decimal | number, currency = 'EUR'): string {
  const numAmount = typeof amount === 'number' ? amount : amount.toNumber();
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(numAmount);
}

/**
 * Get VAT rate label in French
 */
export function getVatRateLabel(rate: number): string {
  const labels: Record<number, string> = {
    20: 'TVA 20% (taux normal)',
    10: 'TVA 10% (taux intermédiaire)',
    5.5: 'TVA 5,5% (taux réduit)',
    2.1: 'TVA 2,1% (taux super-réduit)',
    0: 'Exonéré de TVA',
  };
  return labels[rate] || `TVA ${rate}%`;
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
