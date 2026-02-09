// ============================================================================
// YAHOO FINANCE PROVIDER - Finance Hub
// Market data provider for stocks and ETFs using yahoo-finance2
// ============================================================================

import type { AssetType } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import type {
  MarketDataProvider,
  MarketQuote,
  AssetInfo,
  SearchResult,
  HistoricalPrice,
  ProviderConfig,
} from './types.js';

// ----------------------------------------------------------------------------
// Types from yahoo-finance2
// ----------------------------------------------------------------------------

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  currency?: string;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
  regularMarketTime?: Date;
  shortName?: string;
  longName?: string;
  quoteType?: string;
  exchange?: string;
}

interface YahooSearchResult {
  quotes: Array<{
    symbol: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchange?: string;
  }>;
}

interface YahooChartResult {
  quotes: Array<{
    date: Date;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume?: number;
    adjclose?: number;
  }>;
}

// ----------------------------------------------------------------------------
// Provider Implementation
// ----------------------------------------------------------------------------

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = 'yahoo';
  readonly supportedTypes: AssetType[] = ['stock', 'etf', 'bond', 'other'];

  private rateLimit: number;
  private lastRequest: number = 0;
  private yf: InstanceType<typeof YahooFinance>;

  constructor(config: ProviderConfig = {}) {
    this.rateLimit = config.rateLimit || 60; // 60 requests per minute
    this.yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }

  /**
   * Rate limit helper
   */
  private async throttle(): Promise<void> {
    const minInterval = 60000 / this.rateLimit;
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < minInterval) {
      await new Promise((resolve) => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }

  /**
   * Get current quote for a symbol
   */
  async getQuote(symbol: string): Promise<MarketQuote | null> {
    try {
      await this.throttle();

      const result = (await this.yf.quote(symbol)) as YahooQuote;

      if (!result || !result.regularMarketPrice) {
        return null;
      }

      return {
        symbol: result.symbol,
        price: result.regularMarketPrice,
        currency: result.currency || 'USD',
        change: result.regularMarketChange || 0,
        changePercent: result.regularMarketChangePercent || 0,
        volume: result.regularMarketVolume,
        marketCap: result.marketCap,
        high: result.regularMarketDayHigh,
        low: result.regularMarketDayLow,
        open: result.regularMarketOpen,
        previousClose: result.regularMarketPreviousClose,
        timestamp: result.regularMarketTime ? new Date(result.regularMarketTime) : new Date(),
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get quotes for multiple symbols
   */
  async getQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    const quotes = new Map<string, MarketQuote>();

    if (symbols.length === 0) {
      return quotes;
    }

    try {
      await this.throttle();

      const results = (await this.yf.quote(symbols)) as YahooQuote | YahooQuote[];

      // Handle single result vs array
      const resultsArray = Array.isArray(results) ? results : [results];

      for (const result of resultsArray) {
        if (result && result.regularMarketPrice) {
          quotes.set(result.symbol, {
            symbol: result.symbol,
            price: result.regularMarketPrice,
            currency: result.currency || 'USD',
            change: result.regularMarketChange || 0,
            changePercent: result.regularMarketChangePercent || 0,
            volume: result.regularMarketVolume,
            marketCap: result.marketCap,
            high: result.regularMarketDayHigh,
            low: result.regularMarketDayLow,
            open: result.regularMarketOpen,
            previousClose: result.regularMarketPreviousClose,
            timestamp: result.regularMarketTime ? new Date(result.regularMarketTime) : new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }

    return quotes;
  }

  /**
   * Search for assets by query
   */
  async search(query: string, _type?: AssetType): Promise<SearchResult[]> {
    try {
      await this.throttle();

      const result = (await this.yf.search(query, {
        quotesCount: 10,
        newsCount: 0,
      })) as YahooSearchResult;

      if (!result.quotes) {
        return [];
      }

      return result.quotes
        .filter((quote) => quote.symbol)
        .map((quote) => ({
          symbol: quote.symbol,
          name: quote.shortname || quote.longname || quote.symbol,
          type: this.mapQuoteType(quote.quoteType || ''),
          exchange: quote.exchange,
          currency: 'USD', // Search doesn't return currency, default to USD
        }));
    } catch (error) {
      console.error('Error searching:', error);
      return [];
    }
  }

  /**
   * Get asset information
   */
  async getAssetInfo(symbol: string): Promise<AssetInfo | null> {
    try {
      await this.throttle();

      const result = (await this.yf.quote(symbol)) as YahooQuote;

      if (!result) {
        return null;
      }

      return {
        symbol: result.symbol,
        name: result.shortName || result.longName || result.symbol,
        type: this.mapQuoteType(result.quoteType || ''),
        currency: result.currency || 'USD',
        exchange: result.exchange,
      };
    } catch (error) {
      console.error(`Error fetching asset info for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get historical prices
   */
  async getHistory(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<HistoricalPrice[]> {
    try {
      await this.throttle();

      const intervalMap = { daily: '1d', weekly: '1wk', monthly: '1mo' } as const;

      const result = (await this.yf.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: intervalMap[interval],
      })) as YahooChartResult;

      if (!result.quotes || result.quotes.length === 0) {
        return [];
      }

      return result.quotes
        .filter((quote) => quote.open !== null)
        .map((quote) => ({
          date: new Date(quote.date),
          open: quote.open ?? 0,
          high: quote.high ?? 0,
          low: quote.low ?? 0,
          close: quote.close ?? 0,
          volume: quote.volume,
          adjustedClose: quote.adjclose,
        }));
    } catch (error) {
      console.error(`Error fetching history for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Map Yahoo quote type to AssetType
   */
  private mapQuoteType(quoteType: string): AssetType {
    switch (quoteType?.toUpperCase()) {
      case 'EQUITY':
        return 'stock';
      case 'ETF':
        return 'etf';
      case 'MUTUALFUND':
        return 'etf';
      case 'CRYPTOCURRENCY':
        return 'crypto';
      case 'BOND':
        return 'bond';
      default:
        return 'other';
    }
  }
}

// Singleton instance
export const yahooFinance = new YahooFinanceProvider();
