// ============================================================================
// POSITION SERVICE - Finance Hub
// Investment position management with PRU calculation
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { InvestTransactionType, Prisma } from '@prisma/client';
import { NotFoundError } from '@/core/middleware/errorHandler.js';
import { assetService } from './asset.service.js';
import { currencyService } from '../currency/currency.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PositionWithDetails {
  id: string;
  workspaceId: string;
  accountId: string;
  assetId: string;
  quantity: number;
  averageCost: number;
  realizedGain: number;
  createdAt: Date;
  updatedAt: Date;
  asset: {
    id: string;
    symbol: string;
    name: string;
    type: string;
    currency: string;
    lastPrice: number | null;
    lastPriceAt: Date | null;
  };
  account: {
    id: string;
    name: string;
  };
  // Calculated fields
  currentValue: number;
  totalCost: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalUnrealizedGain: number;
  totalRealizedGain: number;
  totalReturn: number;
  totalReturnPercent: number;
  positions: PositionWithDetails[];
  allocation: Array<{
    type: string;
    value: number;
    percent: number;
  }>;
}

export interface NormalizedPortfolioSummary extends PortfolioSummary {
  baseCurrency: string;
  positionsWithConversion: Array<PositionWithDetails & {
    valueInBaseCurrency: number;
    costInBaseCurrency: number;
    conversionRate: number;
  }>;
  lastUpdated: Date;
}

export interface TransactionInput {
  type: InvestTransactionType;
  quantity: number;
  price: number;
  fees?: number;
  date: Date;
  notes?: string;
}

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
  invested: number;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

class PositionService {
  /**
   * List positions for a workspace
   */
  async list(workspaceId: string, accountId?: string): Promise<PositionWithDetails[]> {
    const positions = await prisma.position.findMany({
      where: {
        workspaceId,
        ...(accountId && { accountId }),
        quantity: { gt: 0 },
      },
      include: {
        asset: true,
        account: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { asset: { type: 'asc' } },
        { asset: { symbol: 'asc' } },
      ],
    });

    return positions.map((pos) => this.enrichPosition(pos));
  }

  /**
   * Get position by ID
   */
  async getById(workspaceId: string, id: string): Promise<PositionWithDetails | null> {
    const position = await prisma.position.findFirst({
      where: { id, workspaceId },
      include: {
        asset: true,
        account: {
          select: { id: true, name: true },
        },
      },
    });

    if (!position) return null;

    return this.enrichPosition(position);
  }

  /**
   * Get or create a position for an asset
   */
  async getOrCreate(
    workspaceId: string,
    accountId: string,
    assetId: string
  ): Promise<PositionWithDetails> {
    let position = await prisma.position.findUnique({
      where: {
        workspaceId_accountId_assetId: {
          workspaceId,
          accountId,
          assetId,
        },
      },
      include: {
        asset: true,
        account: {
          select: { id: true, name: true },
        },
      },
    });

    if (!position) {
      position = await prisma.position.create({
        data: {
          workspaceId,
          accountId,
          assetId,
          quantity: 0,
          averageCost: 0,
          realizedGain: 0,
        },
        include: {
          asset: true,
          account: {
            select: { id: true, name: true },
          },
        },
      });
    }

    return this.enrichPosition(position);
  }

  /**
   * Add a transaction to a position (buy, sell, dividend, split)
   */
  async addTransaction(
    workspaceId: string,
    positionId: string,
    input: TransactionInput
  ): Promise<PositionWithDetails> {
    const position = await prisma.position.findFirst({
      where: { id: positionId, workspaceId },
      include: { asset: true },
    });

    if (!position) {
      throw new NotFoundError('Position non trouvée');
    }

    const currentQty = position.quantity.toNumber();
    const currentAvgCost = position.averageCost.toNumber();
    const currentRealizedGain = position.realizedGain.toNumber();

    let newQty = currentQty;
    let newAvgCost = currentAvgCost;
    let newRealizedGain = currentRealizedGain;
    const fees = input.fees || 0;

    switch (input.type) {
      case 'buy': {
        // PRU calculation: (oldQty * oldAvgCost + newQty * newPrice + fees) / (oldQty + newQty)
        const totalOldCost = currentQty * currentAvgCost;
        const newCost = input.quantity * input.price + fees;
        newQty = currentQty + input.quantity;
        newAvgCost = newQty > 0 ? (totalOldCost + newCost) / newQty : 0;
        break;
      }

      case 'sell': {
        if (input.quantity > currentQty) {
          throw new Error('Quantité insuffisante pour la vente');
        }
        // Calculate realized gain: (sellPrice - avgCost) * quantity - fees
        const sellValue = input.quantity * input.price - fees;
        const costBasis = input.quantity * currentAvgCost;
        const gain = sellValue - costBasis;
        newRealizedGain = currentRealizedGain + gain;
        newQty = currentQty - input.quantity;
        // Average cost doesn't change on sell
        break;
      }

      case 'dividend': {
        // Dividends are pure gain
        const dividendAmount = input.quantity * input.price - fees;
        newRealizedGain = currentRealizedGain + dividendAmount;
        // Quantity doesn't change
        break;
      }

      case 'split': {
        // Stock split: quantity changes, average cost adjusts inversely
        // input.quantity is the split ratio (e.g., 2 for a 2:1 split)
        const splitRatio = input.quantity;
        newQty = currentQty * splitRatio;
        newAvgCost = currentAvgCost / splitRatio;
        break;
      }
    }

    // Create transaction and update position in a transaction
    const updatedPosition = await prisma.$transaction(async (tx) => {
      // Create the transaction record
      await tx.investTransaction.create({
        data: {
          positionId,
          type: input.type,
          quantity: input.quantity,
          price: input.price,
          fees,
          date: input.date,
          notes: input.notes,
        },
      });

      // Update the position
      return tx.position.update({
        where: { id: positionId },
        data: {
          quantity: newQty,
          averageCost: newAvgCost,
          realizedGain: newRealizedGain,
        },
        include: {
          asset: true,
          account: {
            select: { id: true, name: true },
          },
        },
      });
    });

    return this.enrichPosition(updatedPosition);
  }

  /**
   * Open a new position (convenience method)
   */
  async openPosition(
    workspaceId: string,
    accountId: string,
    symbol: string,
    quantity: number,
    price: number,
    date: Date,
    fees?: number
  ): Promise<PositionWithDetails> {
    // Get or create the asset
    const asset = await assetService.getOrCreate(symbol);
    if (!asset) {
      throw new NotFoundError(`Asset non trouvé: ${symbol}`);
    }

    // Get or create the position
    const position = await this.getOrCreate(workspaceId, accountId, asset.id);

    // Add buy transaction
    return this.addTransaction(workspaceId, position.id, {
      type: 'buy',
      quantity,
      price,
      fees,
      date,
    });
  }

  /**
   * Get transaction history for a position
   */
  async getTransactions(
    workspaceId: string,
    positionId: string
  ) {
    const position = await prisma.position.findFirst({
      where: { id: positionId, workspaceId },
    });

    if (!position) {
      throw new NotFoundError('Position non trouvée');
    }

    return prisma.investTransaction.findMany({
      where: { positionId },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(
    workspaceId: string,
    accountId?: string
  ): Promise<PortfolioSummary> {
    const positions = await this.list(workspaceId, accountId);

    let totalValue = 0;
    let totalCost = 0;
    let totalRealizedGain = 0;
    const allocationByType = new Map<string, number>();

    for (const pos of positions) {
      totalValue += pos.currentValue;
      totalCost += pos.totalCost;
      totalRealizedGain += pos.realizedGain;

      const currentAlloc = allocationByType.get(pos.asset.type) || 0;
      allocationByType.set(pos.asset.type, currentAlloc + pos.currentValue);
    }

    const totalUnrealizedGain = totalValue - totalCost;
    const totalReturn = totalUnrealizedGain + totalRealizedGain;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // Build allocation array
    const allocation = Array.from(allocationByType.entries()).map(([type, value]) => ({
      type,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }));

    return {
      totalValue,
      totalCost,
      totalUnrealizedGain,
      totalRealizedGain,
      totalReturn,
      totalReturnPercent,
      positions,
      allocation,
    };
  }

  /**
   * Get portfolio summary normalized to a target currency
   * Converts all position values to the specified base currency
   */
  async getNormalizedPortfolioSummary(
    workspaceId: string,
    baseCurrency: string,
    accountId?: string
  ): Promise<NormalizedPortfolioSummary> {
    const positions = await this.list(workspaceId, accountId);

    let totalValue = 0;
    let totalCost = 0;
    let totalRealizedGain = 0;
    const allocationByType = new Map<string, number>();
    const positionsWithConversion: NormalizedPortfolioSummary['positionsWithConversion'] = [];

    for (const pos of positions) {
      const assetCurrency = pos.asset.currency;
      let conversionRate = 1;
      let valueInBaseCurrency = pos.currentValue;
      let costInBaseCurrency = pos.totalCost;
      let realizedGainInBaseCurrency = pos.realizedGain;

      // Convert if different currencies
      if (assetCurrency !== baseCurrency) {
        const rateInfo = await currencyService.getRate(assetCurrency, baseCurrency);
        if (rateInfo) {
          conversionRate = rateInfo.rate;
          valueInBaseCurrency = pos.currentValue * conversionRate;
          costInBaseCurrency = pos.totalCost * conversionRate;
          realizedGainInBaseCurrency = pos.realizedGain * conversionRate;
        }
      }

      totalValue += valueInBaseCurrency;
      totalCost += costInBaseCurrency;
      totalRealizedGain += realizedGainInBaseCurrency;

      const currentAlloc = allocationByType.get(pos.asset.type) || 0;
      allocationByType.set(pos.asset.type, currentAlloc + valueInBaseCurrency);

      positionsWithConversion.push({
        ...pos,
        valueInBaseCurrency,
        costInBaseCurrency,
        conversionRate,
      });
    }

    const totalUnrealizedGain = totalValue - totalCost;
    const totalReturn = totalUnrealizedGain + totalRealizedGain;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // Build allocation array
    const allocation = Array.from(allocationByType.entries()).map(([type, value]) => ({
      type,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }));

    return {
      baseCurrency,
      totalValue,
      totalCost,
      totalUnrealizedGain,
      totalRealizedGain,
      totalReturn,
      totalReturnPercent,
      positions,
      positionsWithConversion,
      allocation,
      lastUpdated: new Date(),
    };
  }

  /**
   * Refresh prices for all positions in a workspace
   */
  async refreshPrices(workspaceId: string): Promise<{ updated: number; failed: number }> {
    const positions = await prisma.position.findMany({
      where: { workspaceId, quantity: { gt: 0 } },
      select: { assetId: true },
    });

    const assetIds = [...new Set(positions.map((p) => p.assetId))];

    if (assetIds.length === 0) {
      return { updated: 0, failed: 0 };
    }

    const quotes = await assetService.updatePrices(assetIds);

    return {
      updated: quotes.size,
      failed: assetIds.length - quotes.size,
    };
  }

  /**
   * Delete a position (only if empty)
   */
  async delete(workspaceId: string, id: string): Promise<void> {
    const position = await prisma.position.findFirst({
      where: { id, workspaceId },
    });

    if (!position) {
      throw new NotFoundError('Position non trouvée');
    }

    if (position.quantity.toNumber() > 0) {
      throw new Error('Impossible de supprimer une position avec des parts actives');
    }

    await prisma.position.delete({
      where: { id },
    });
  }

  /**
   * Take a snapshot of the portfolio for today
   * Creates or updates the snapshot for the current date
   */
  async takePortfolioSnapshot(workspaceId: string): Promise<{ date: Date; totalValue: number; totalCost: number }> {
    const summary = await this.getPortfolioSummary(workspaceId);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues

    const snapshot = await prisma.portfolioSnapshot.upsert({
      where: {
        workspaceId_date: {
          workspaceId,
          date: today,
        },
      },
      create: {
        workspaceId,
        date: today,
        totalValue: summary.totalValue,
        totalCost: summary.totalCost,
      },
      update: {
        totalValue: summary.totalValue,
        totalCost: summary.totalCost,
      },
    });

    return {
      date: snapshot.date,
      totalValue: snapshot.totalValue.toNumber(),
      totalCost: snapshot.totalCost.toNumber(),
    };
  }

  /**
   * Get portfolio history between two dates
   */
  async getPortfolioHistory(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PortfolioHistoryPoint[]> {
    const where: { workspaceId: string; date?: { gte?: Date; lte?: Date } } = { workspaceId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const snapshots = await prisma.portfolioSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return snapshots.map((snapshot) => ({
      date: snapshot.date.toISOString().slice(0, 10),
      value: snapshot.totalValue.toNumber(),
      invested: snapshot.totalCost.toNumber(),
    }));
  }

  /**
   * Take snapshots for all workspaces with positions
   * Used by the scheduled job
   */
  async takeAllWorkspacesSnapshots(): Promise<{ workspaceId: string; success: boolean }[]> {
    // Get all workspaces that have at least one position
    const workspacesWithPositions = await prisma.position.findMany({
      where: { quantity: { gt: 0 } },
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });

    const results: { workspaceId: string; success: boolean }[] = [];

    for (const { workspaceId } of workspacesWithPositions) {
      try {
        await this.takePortfolioSnapshot(workspaceId);
        results.push({ workspaceId, success: true });
      } catch (error) {
        console.error(`Failed to take snapshot for workspace ${workspaceId}:`, error);
        results.push({ workspaceId, success: false });
      }
    }

    return results;
  }

  /**
   * Enrich position with calculated fields
   */
  private enrichPosition(position: {
    id: string;
    workspaceId: string;
    accountId: string;
    assetId: string;
    quantity: Prisma.Decimal;
    averageCost: Prisma.Decimal;
    realizedGain: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    asset: {
      id: string;
      symbol: string;
      name: string;
      type: string;
      currency: string;
      lastPrice: Prisma.Decimal | null;
      lastPriceAt: Date | null;
    };
    account: {
      id: string;
      name: string;
    };
  }): PositionWithDetails {
    const quantity = position.quantity.toNumber();
    const averageCost = position.averageCost.toNumber();
    const realizedGain = position.realizedGain.toNumber();
    const lastPrice = position.asset.lastPrice?.toNumber() ?? averageCost;

    const totalCost = quantity * averageCost;
    const currentValue = quantity * lastPrice;
    const unrealizedGain = currentValue - totalCost;
    const unrealizedGainPercent = totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;
    const totalReturn = unrealizedGain + realizedGain;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    return {
      id: position.id,
      workspaceId: position.workspaceId,
      accountId: position.accountId,
      assetId: position.assetId,
      quantity,
      averageCost,
      realizedGain,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
      asset: {
        id: position.asset.id,
        symbol: position.asset.symbol,
        name: position.asset.name,
        type: position.asset.type,
        currency: position.asset.currency,
        lastPrice: position.asset.lastPrice?.toNumber() ?? null,
        lastPriceAt: position.asset.lastPriceAt,
      },
      account: position.account,
      currentValue,
      totalCost,
      unrealizedGain,
      unrealizedGainPercent,
      totalReturn,
      totalReturnPercent,
    };
  }
}

export const positionService = new PositionService();
