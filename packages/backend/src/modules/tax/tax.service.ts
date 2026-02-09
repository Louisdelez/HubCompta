// ============================================================================
// TAX SERVICE - Finance Hub
// French tax system defaults (bareme progressif 2024)
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { TaxYear, TaxDeduction } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TaxDeductionCreateInput {
  category: 'professional' | 'medical' | 'charitable' | 'other';
  description: string;
  amount: number;
  documentId?: string;
}

export interface TaxYearUpdateInput {
  status?: 'open' | 'filed' | 'closed';
  actualTax?: number;
  notes?: string;
}

export interface TaxYearWithDeductions extends TaxYear {
  deductions: TaxDeduction[];
}

export interface TaxSummary {
  year: number;
  status: string;
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  actualTax: number | null;
  effectiveRate: number;
  marginalRate: number;
  deductionsByCategory: Record<string, number>;
}

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

// ----------------------------------------------------------------------------
// French Tax Brackets (2024 Bareme)
// ----------------------------------------------------------------------------

const FRENCH_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 11294, rate: 0 },
  { min: 11294, max: 28797, rate: 0.11 },
  { min: 28797, max: 82341, rate: 0.30 },
  { min: 82341, max: 177106, rate: 0.41 },
  { min: 177106, max: null, rate: 0.45 },
];

// Standard deduction percentage for professional expenses (if no real expenses declared)
const STANDARD_DEDUCTION_RATE = 0.10;
const STANDARD_DEDUCTION_MIN = 495;
const STANDARD_DEDUCTION_MAX = 14171;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Calculate French income tax based on progressive brackets
 */
function calculateFrenchTax(taxableIncome: number, brackets: TaxBracket[]): number {
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
function getMarginalRate(taxableIncome: number, brackets: TaxBracket[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    const bracket = brackets[i];
    if (bracket && taxableIncome > bracket.min) {
      return bracket.rate;
    }
  }
  return 0;
}

/**
 * Calculate standard deduction (abattement forfaitaire)
 */
function calculateStandardDeduction(grossIncome: number): number {
  const deduction = grossIncome * STANDARD_DEDUCTION_RATE;
  return Math.min(Math.max(deduction, STANDARD_DEDUCTION_MIN), STANDARD_DEDUCTION_MAX);
}

// ----------------------------------------------------------------------------
// Tax Service
// ----------------------------------------------------------------------------

export const taxService = {
  /**
   * Get or create tax year for a workspace
   */
  async getOrCreateYear(workspaceId: string, year: number): Promise<TaxYearWithDeductions> {
    let taxYear = await prisma.taxYear.findUnique({
      where: {
        workspaceId_year: { workspaceId, year },
      },
      include: {
        deductions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!taxYear) {
      taxYear = await prisma.taxYear.create({
        data: {
          workspaceId,
          year,
          status: 'open',
        },
        include: {
          deductions: true,
        },
      });

      // Calculate initial values
      await this.recalculate(taxYear.id, workspaceId);

      // Refetch with updated values
      taxYear = await prisma.taxYear.findUnique({
        where: { id: taxYear.id },
        include: {
          deductions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      }) as TaxYearWithDeductions;
    }

    return taxYear;
  },

  /**
   * Get tax year by ID
   */
  async getById(workspaceId: string, taxYearId: string): Promise<TaxYearWithDeductions | null> {
    return prisma.taxYear.findFirst({
      where: {
        id: taxYearId,
        workspaceId,
      },
      include: {
        deductions: {
          include: {
            document: {
              select: { id: true, filename: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  /**
   * List all tax years for a workspace
   */
  async list(workspaceId: string): Promise<TaxYear[]> {
    return prisma.taxYear.findMany({
      where: { workspaceId },
      orderBy: { year: 'desc' },
    });
  },

  /**
   * Update tax year
   */
  async update(
    workspaceId: string,
    taxYearId: string,
    input: TaxYearUpdateInput
  ): Promise<TaxYear> {
    const taxYear = await prisma.taxYear.findFirst({
      where: { id: taxYearId, workspaceId },
    });

    if (!taxYear) {
      throw new NotFoundError('TaxYear', taxYearId);
    }

    const updateData: Record<string, unknown> = {};

    if (input.status) {
      updateData.status = input.status;
      if (input.status === 'filed') {
        updateData.filedAt = new Date();
      }
    }

    if (input.actualTax !== undefined) {
      updateData.actualTax = input.actualTax;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    return prisma.taxYear.update({
      where: { id: taxYearId },
      data: updateData,
    });
  },

  /**
   * Calculate total income from transactions for a year
   */
  async calculateIncome(workspaceId: string, year: number): Promise<number> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const result = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: 'income',
        deletedAt: null,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    return result._sum.amount?.toNumber() ?? 0;
  },

  /**
   * Add a deduction to a tax year
   */
  async addDeduction(
    workspaceId: string,
    taxYearId: string,
    input: TaxDeductionCreateInput
  ): Promise<TaxDeduction> {
    const taxYear = await prisma.taxYear.findFirst({
      where: { id: taxYearId, workspaceId },
    });

    if (!taxYear) {
      throw new NotFoundError('TaxYear', taxYearId);
    }

    if (taxYear.status === 'closed') {
      throw new ConflictError('Cannot add deductions to a closed tax year');
    }

    // Verify document belongs to workspace if provided
    if (input.documentId) {
      const doc = await prisma.document.findFirst({
        where: { id: input.documentId, workspaceId },
      });
      if (!doc) {
        throw new NotFoundError('Document', input.documentId);
      }
    }

    const deduction = await prisma.taxDeduction.create({
      data: {
        taxYearId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        documentId: input.documentId,
      },
    });

    // Recalculate tax year totals
    await this.recalculate(taxYearId, workspaceId);

    return deduction;
  },

  /**
   * Remove a deduction
   */
  async removeDeduction(
    workspaceId: string,
    taxYearId: string,
    deductionId: string
  ): Promise<void> {
    const taxYear = await prisma.taxYear.findFirst({
      where: { id: taxYearId, workspaceId },
    });

    if (!taxYear) {
      throw new NotFoundError('TaxYear', taxYearId);
    }

    if (taxYear.status === 'closed') {
      throw new ConflictError('Cannot remove deductions from a closed tax year');
    }

    const deduction = await prisma.taxDeduction.findFirst({
      where: { id: deductionId, taxYearId },
    });

    if (!deduction) {
      throw new NotFoundError('TaxDeduction', deductionId);
    }

    await prisma.taxDeduction.delete({
      where: { id: deductionId },
    });

    // Recalculate tax year totals
    await this.recalculate(taxYearId, workspaceId);
  },

  /**
   * Recalculate tax year totals based on income and deductions
   */
  async recalculate(taxYearId: string, workspaceId: string): Promise<TaxYear> {
    const taxYear = await prisma.taxYear.findUnique({
      where: { id: taxYearId },
      include: { deductions: true },
    });

    if (!taxYear) {
      throw new NotFoundError('TaxYear', taxYearId);
    }

    // Calculate income for the year
    const totalIncome = await this.calculateIncome(workspaceId, taxYear.year);

    // Sum up deductions
    const totalDeductions = taxYear.deductions.reduce(
      (sum, d) => sum + d.amount.toNumber(),
      0
    );

    // Apply standard deduction if no professional deductions
    const hasProfessionalDeductions = taxYear.deductions.some(
      d => d.category === 'professional'
    );

    let effectiveDeductions = totalDeductions;
    if (!hasProfessionalDeductions && totalIncome > 0) {
      effectiveDeductions += calculateStandardDeduction(totalIncome);
    }

    // Calculate taxable income
    const taxableIncome = Math.max(0, totalIncome - effectiveDeductions);

    // Calculate estimated tax using French brackets
    const estimatedTax = calculateFrenchTax(taxableIncome, FRENCH_TAX_BRACKETS);

    return prisma.taxYear.update({
      where: { id: taxYearId },
      data: {
        totalIncome,
        totalDeductions: effectiveDeductions,
        taxableIncome,
        estimatedTax,
      },
    });
  },

  /**
   * Mark tax year as filed
   */
  async fileTax(workspaceId: string, taxYearId: string, actualTax?: number): Promise<TaxYear> {
    const taxYear = await prisma.taxYear.findFirst({
      where: { id: taxYearId, workspaceId },
    });

    if (!taxYear) {
      throw new NotFoundError('TaxYear', taxYearId);
    }

    return prisma.taxYear.update({
      where: { id: taxYearId },
      data: {
        status: 'filed',
        filedAt: new Date(),
        actualTax: actualTax ?? taxYear.estimatedTax,
      },
    });
  },

  /**
   * Get tax summary with breakdown
   */
  async getSummary(workspaceId: string, year: number): Promise<TaxSummary> {
    const taxYear = await this.getOrCreateYear(workspaceId, year);

    const totalIncome = taxYear.totalIncome?.toNumber() ?? 0;
    const totalDeductions = taxYear.totalDeductions?.toNumber() ?? 0;
    const taxableIncome = taxYear.taxableIncome?.toNumber() ?? 0;
    const estimatedTax = taxYear.estimatedTax?.toNumber() ?? 0;
    const actualTax = taxYear.actualTax?.toNumber() ?? null;

    // Calculate effective rate
    const effectiveRate = totalIncome > 0
      ? (estimatedTax / totalIncome) * 100
      : 0;

    // Get marginal rate
    const marginalRate = getMarginalRate(taxableIncome, FRENCH_TAX_BRACKETS) * 100;

    // Group deductions by category
    const deductionsByCategory: Record<string, number> = {};
    for (const deduction of taxYear.deductions) {
      const category = deduction.category;
      deductionsByCategory[category] = (deductionsByCategory[category] ?? 0) + deduction.amount.toNumber();
    }

    return {
      year: taxYear.year,
      status: taxYear.status,
      totalIncome,
      totalDeductions,
      taxableIncome,
      estimatedTax,
      actualTax,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      marginalRate,
      deductionsByCategory,
    };
  },

  /**
   * Get French tax brackets for display
   */
  getTaxBrackets(): TaxBracket[] {
    return FRENCH_TAX_BRACKETS;
  },

  /**
   * List deductions for a tax year
   */
  async listDeductions(workspaceId: string, taxYearId: string): Promise<TaxDeduction[]> {
    const taxYear = await prisma.taxYear.findFirst({
      where: { id: taxYearId, workspaceId },
    });

    if (!taxYear) {
      throw new NotFoundError('TaxYear', taxYearId);
    }

    return prisma.taxDeduction.findMany({
      where: { taxYearId },
      include: {
        document: {
          select: { id: true, filename: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export default taxService;
