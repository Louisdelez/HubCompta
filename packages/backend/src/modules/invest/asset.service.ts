// ============================================================================
// ASSET SERVICE - Finance Hub
// Asset management and market data
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { AssetType, Prisma } from '@prisma/client';
import { getProviderForType, yahooFinance, coinGecko } from './providers/index.js';
import type { MarketQuote, SearchResult } from './providers/types.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AssetWithPrice {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  exchange: string | null;
  lastPrice: number | null;
  lastPriceAt: Date | null;
  quote?: MarketQuote | null;
}

export interface AssetSearchFilters {
  query: string;
  type?: AssetType;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

class AssetService {
  /**
   * Search for assets across all providers
   */
  async search(filters: AssetSearchFilters): Promise<SearchResult[]> {
    const { query, type } = filters;

    if (!query || query.length < 2) {
      return [];
    }

    // Search in database first
    const dbAssets = await prisma.asset.findMany({
      where: {
        OR: [
          { symbol: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
        ...(type && { type }),
      },
      take: 5,
    });

    const dbResults: SearchResult[] = dbAssets.map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      exchange: asset.exchange || undefined,
      currency: asset.currency,
    }));

    // Search providers for additional results
    const providerResults: SearchResult[] = [];

    if (!type || type !== 'crypto') {
      try {
        const yahooResults = await yahooFinance.search(query, type);
        providerResults.push(...yahooResults);
      } catch (error) {
        logger.error({ error, query }, 'Yahoo search error');
      }
    }

    if (!type || type === 'crypto') {
      try {
        const geckoResults = await coinGecko.search(query, 'crypto');
        providerResults.push(...geckoResults);
      } catch (error) {
        logger.error({ error, query }, 'CoinGecko search error');
      }
    }

    // Merge and deduplicate results
    const seenSymbols = new Set(dbResults.map((r) => r.symbol.toUpperCase()));
    const uniqueProviderResults = providerResults.filter((r) => {
      const symbol = r.symbol.toUpperCase();
      if (seenSymbols.has(symbol)) return false;
      seenSymbols.add(symbol);
      return true;
    });

    return [...dbResults, ...uniqueProviderResults].slice(0, 15);
  }

  /**
   * Get or create an asset
   */
  async getOrCreate(symbol: string, type?: AssetType, name?: string, currency?: string): Promise<AssetWithPrice | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check if exists in database
    let asset = await prisma.asset.findUnique({
      where: { symbol: upperSymbol },
    });

    if (asset) {
      return this.assetToWithPrice(asset);
    }

    // Fetch from provider
    const assetType = type || (await this.detectAssetType(upperSymbol));
    const provider = getProviderForType(assetType);

    const info = await provider.getAssetInfo(upperSymbol);

    // Get current price
    const quote = await provider.getQuote(upperSymbol);

    // Create in database - use provider info or fallback to provided/default values
    asset = await prisma.asset.create({
      data: {
        symbol: info?.symbol?.toUpperCase() || upperSymbol,
        name: info?.name || name || upperSymbol,
        type: info?.type || assetType,
        currency: info?.currency || currency || 'USD',
        exchange: info?.exchange || null,
        lastPrice: quote?.price ?? null,
        lastPriceAt: quote ? new Date() : null,
      },
    });

    return {
      ...this.assetToWithPrice(asset),
      quote,
    };
  }

  /**
   * Get asset by ID
   */
  async getById(id: string): Promise<AssetWithPrice | null> {
    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) return null;

    return this.assetToWithPrice(asset);
  }

  /**
   * Get asset by symbol
   */
  async getBySymbol(symbol: string): Promise<AssetWithPrice | null> {
    const asset = await prisma.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });

    if (!asset) return null;

    return this.assetToWithPrice(asset);
  }

  /**
   * Update prices for given assets
   */
  async updatePrices(assetIds: string[]): Promise<Map<string, MarketQuote>> {
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
    });

    const quotes = new Map<string, MarketQuote>();

    // Group by provider
    const stockSymbols: string[] = [];
    const cryptoSymbols: string[] = [];

    for (const asset of assets) {
      if (asset.type === 'crypto') {
        cryptoSymbols.push(asset.symbol);
      } else {
        stockSymbols.push(asset.symbol);
      }
    }

    // Fetch from Yahoo Finance
    if (stockSymbols.length > 0) {
      try {
        const yahooQuotes = await yahooFinance.getQuotes(stockSymbols);
        for (const [symbol, quote] of yahooQuotes) {
          quotes.set(symbol, quote);
        }
      } catch (error) {
        logger.error({ error, symbols: stockSymbols }, 'Error fetching stock prices');
      }
    }

    // Fetch from CoinGecko
    if (cryptoSymbols.length > 0) {
      try {
        const geckoQuotes = await coinGecko.getQuotes(cryptoSymbols);
        for (const [symbol, quote] of geckoQuotes) {
          quotes.set(symbol, quote);
        }
      } catch (error) {
        logger.error({ error, symbols: cryptoSymbols }, 'Error fetching crypto prices');
      }
    }

    // Update database
    const now = new Date();
    for (const asset of assets) {
      const quote = quotes.get(asset.symbol);
      if (quote) {
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            lastPrice: quote.price,
            lastPriceAt: now,
          },
        });
      }
    }

    return quotes;
  }

  /**
   * Update all asset prices (for scheduled job)
   */
  async updateAllPrices(): Promise<{ updated: number; failed: number }> {
    // Get all assets that have positions
    const assetsWithPositions = await prisma.asset.findMany({
      where: {
        positions: {
          some: {},
        },
      },
    });

    if (assetsWithPositions.length === 0) {
      return { updated: 0, failed: 0 };
    }

    const quotes = await this.updatePrices(assetsWithPositions.map((a) => a.id));

    return {
      updated: quotes.size,
      failed: assetsWithPositions.length - quotes.size,
    };
  }

  /**
   * Get current quote for an asset
   */
  async getQuote(assetId: string): Promise<MarketQuote | null> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) return null;

    const provider = getProviderForType(asset.type);
    return provider.getQuote(asset.symbol);
  }

  /**
   * Get current quote by symbol (without requiring asset in DB)
   */
  async getQuoteBySymbol(symbol: string, type?: AssetType): Promise<MarketQuote | null> {
    const assetType = type || (await this.detectAssetType(symbol));
    const provider = getProviderForType(assetType);
    return provider.getQuote(symbol);
  }

  /**
   * Get historical prices
   */
  async getHistory(
    assetId: string,
    startDate: Date,
    endDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' = 'daily'
  ) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) return [];

    const provider = getProviderForType(asset.type);
    return provider.getHistory(asset.symbol, startDate, endDate, interval);
  }

  /**
   * Detect asset type from symbol
   */
  private async detectAssetType(symbol: string): Promise<AssetType> {
    // Try crypto first (common crypto symbols)
    const cryptoSymbols = ['BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'DOT'];
    if (cryptoSymbols.includes(symbol.toUpperCase())) {
      return 'crypto';
    }

    // Try Yahoo Finance
    const info = await yahooFinance.getAssetInfo(symbol);
    if (info) {
      return info.type;
    }

    // Default to stock
    return 'stock';
  }

  /**
   * Convert database asset to AssetWithPrice
   */
  private assetToWithPrice(asset: {
    id: string;
    symbol: string;
    name: string;
    type: AssetType;
    currency: string;
    exchange: string | null;
    lastPrice: Prisma.Decimal | null;
    lastPriceAt: Date | null;
  }): AssetWithPrice {
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      currency: asset.currency,
      exchange: asset.exchange,
      lastPrice: asset.lastPrice?.toNumber() ?? null,
      lastPriceAt: asset.lastPriceAt,
    };
  }
}

export const assetService = new AssetService();
