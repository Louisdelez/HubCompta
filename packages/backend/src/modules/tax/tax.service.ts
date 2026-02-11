// ============================================================================
// TAX SERVICE - Finance Hub
// Multi-country tax system support (France, Switzerland)
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { TaxYear, TaxDeduction } from '@prisma/client';
import {
  type CountryCode,
  type TaxBracket,
  getCountryConfig,
  getTaxBrackets,
  getDeductionCategories,
  calculateTax,
  getMarginalRate,
} from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TaxDeductionCreateInput {
  category: string;
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
  country: CountryCode;
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  actualTax: number | null;
  effectiveRate: number;
  marginalRate: number;
  deductionsByCategory: Record<string, number>;
  currency: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Get country code for a workspace (from owner's profile)
 */
async function getWorkspaceCountry(workspaceId: string): Promise<CountryCode> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: {
        select: { country: true },
      },
    },
  });

  return (workspace?.owner?.country as CountryCode) ?? 'FR';
}

/**
 * Calculate standard deduction based on country rules
 */
function calculateStandardDeduction(
  grossIncome: number,
  countryCode: CountryCode
): number {
  const config = getCountryConfig(countryCode);

  if (!config.standardDeduction) {
    return 0; // No standard deduction (e.g., Switzerland)
  }

  const deduction = grossIncome * config.standardDeduction.rate;
  return Math.min(
    Math.max(deduction, config.standardDeduction.min),
    config.standardDeduction.max
  );
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

    // Validate deduction category for the country
    const countryCode = await getWorkspaceCountry(workspaceId);
    const validCategories = getDeductionCategories(countryCode);
    const isValidCategory = validCategories.some(c => c.code === input.category);

    if (!isValidCategory) {
      throw new ConflictError(`Invalid deduction category: ${input.category} for country ${countryCode}`);
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

    // Get country code for this workspace
    const countryCode = await getWorkspaceCountry(workspaceId);

    // Calculate income for the year
    const totalIncome = await this.calculateIncome(workspaceId, taxYear.year);

    // Sum up deductions
    const totalDeductions = taxYear.deductions.reduce(
      (sum, d) => sum + d.amount.toNumber(),
      0
    );

    // Apply standard deduction if applicable (France only)
    const hasProfessionalDeductions = taxYear.deductions.some(
      d => d.category === 'professional'
    );

    let effectiveDeductions = totalDeductions;
    if (!hasProfessionalDeductions && totalIncome > 0) {
      effectiveDeductions += calculateStandardDeduction(totalIncome, countryCode);
    }

    // Calculate taxable income
    const taxableIncome = Math.max(0, totalIncome - effectiveDeductions);

    // Calculate estimated tax using country-specific brackets
    const estimatedTax = calculateTax(taxableIncome, countryCode);

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
    const countryCode = await getWorkspaceCountry(workspaceId);
    const config = getCountryConfig(countryCode);

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
    const marginalRate = getMarginalRate(taxableIncome, countryCode) * 100;

    // Group deductions by category
    const deductionsByCategory: Record<string, number> = {};
    for (const deduction of taxYear.deductions) {
      const category = deduction.category;
      deductionsByCategory[category] = (deductionsByCategory[category] ?? 0) + deduction.amount.toNumber();
    }

    return {
      year: taxYear.year,
      status: taxYear.status,
      country: countryCode,
      totalIncome,
      totalDeductions,
      taxableIncome,
      estimatedTax,
      actualTax,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      marginalRate,
      deductionsByCategory,
      currency: config.defaultCurrency,
    };
  },

  /**
   * Get tax brackets for a workspace's country
   */
  async getTaxBrackets(workspaceId: string): Promise<TaxBracket[]> {
    const countryCode = await getWorkspaceCountry(workspaceId);
    return getTaxBrackets(countryCode);
  },

  /**
   * Get deduction categories for a workspace's country
   */
  async getDeductionCategories(workspaceId: string) {
    const countryCode = await getWorkspaceCountry(workspaceId);
    return getDeductionCategories(countryCode);
  },

  /**
   * Get VAT rates for a workspace's country
   */
  async getVATRates(workspaceId: string) {
    const countryCode = await getWorkspaceCountry(workspaceId);
    const config = getCountryConfig(countryCode);
    return config.vatRates;
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
