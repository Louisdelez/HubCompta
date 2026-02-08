// ============================================================================
// YAHOO FINANCE PROVIDER - Finance Hub
// Market data provider for stocks and ETFs
// ============================================================================

import type { AssetType } from '@prisma/client';
import type {
  MarketDataProvider,
  MarketQuote,
  AssetInfo,
  SearchResult,
  HistoricalPrice,
  ProviderConfig,
} from './types.js';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://query1.finance.yahoo.com';
const SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';

// ----------------------------------------------------------------------------
// Provider Implementation
// ----------------------------------------------------------------------------

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = 'yahoo';
  readonly supportedTypes: AssetType[] = ['stock', 'etf', 'bond', 'other'];

  private baseUrl: string;
  private rateLimit: number;
  private lastRequest: number = 0;

  constructor(config: ProviderConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.rateLimit = config.rateLimit || 60; // 60 requests per minute
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

      const url = `${this.baseUrl}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FinanceHub/1.0)',
        },
      });

      if (!response.ok) {
        console.error(`Yahoo Finance API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const result = data?.quoteResponse?.result?.[0];

      if (!result) {
        return null;
      }

      return {
        symbol: result.symbol,
        price: result.regularMarketPrice || 0,
        currency: result.currency || 'USD',
        change: result.regularMarketChange || 0,
        changePercent: result.regularMarketChangePercent || 0,
        volume: result.regularMarketVolume,
        marketCap: result.marketCap,
        high: result.regularMarketDayHigh,
        low: result.regularMarketDayLow,
        open: result.regularMarketOpen,
        previousClose: result.regularMarketPreviousClose,
        timestamp: new Date(result.regularMarketTime * 1000),
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

      const url = `${this.baseUrl}/v7/finance/quote?symbols=${symbols.map(encodeURIComponent).join(',')}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FinanceHub/1.0)',
        },
      });

      if (!response.ok) {
        console.error(`Yahoo Finance API error: ${response.status}`);
        return quotes;
      }

      const data = await response.json();
      const results = data?.quoteResponse?.result || [];

      for (const result of results) {
        quotes.set(result.symbol, {
          symbol: result.symbol,
          price: result.regularMarketPrice || 0,
          currency: result.currency || 'USD',
          change: result.regularMarketChange || 0,
          changePercent: result.regularMarketChangePercent || 0,
          volume: result.regularMarketVolume,
          marketCap: result.marketCap,
          high: result.regularMarketDayHigh,
          low: result.regularMarketDayLow,
          open: result.regularMarketOpen,
          previousClose: result.regularMarketPreviousClose,
          timestamp: new Date(result.regularMarketTime * 1000),
        });
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

      const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FinanceHub/1.0)',
        },
      });

      if (!response.ok) {
        console.error(`Yahoo Finance search error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const quotes = data?.quotes || [];

      return quotes.map((quote: Record<string, unknown>) => ({
        symbol: quote.symbol as string,
        name: (quote.shortname || quote.longname || quote.symbol) as string,
        type: this.mapQuoteType(quote.quoteType as string),
        exchange: quote.exchange as string,
        currency: (quote.currency || 'USD') as string,
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

      const url = `${this.baseUrl}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FinanceHub/1.0)',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const result = data?.quoteResponse?.result?.[0];

      if (!result) {
        return null;
      }

      return {
        symbol: result.symbol,
        name: result.shortName || result.longName || result.symbol,
        type: this.mapQuoteType(result.quoteType),
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

      const intervalMap = { daily: '1d', weekly: '1wk', monthly: '1mo' };
      const period1 = Math.floor(startDate.getTime() / 1000);
      const period2 = Math.floor(endDate.getTime() / 1000);

      const url = `${this.baseUrl}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${intervalMap[interval]}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FinanceHub/1.0)',
        },
      });

      if (!response.ok) {
        console.error(`Yahoo Finance history error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const chart = data?.chart?.result?.[0];

      if (!chart?.timestamp) {
        return [];
      }

      const { timestamp, indicators } = chart;
      const quote = indicators?.quote?.[0];
      const adjClose = indicators?.adjclose?.[0]?.adjclose;

      if (!quote) {
        return [];
      }

      const prices: HistoricalPrice[] = [];
      for (let i = 0; i < timestamp.length; i++) {
        if (quote.open[i] !== null) {
          prices.push({
            date: new Date(timestamp[i] * 1000),
            open: quote.open[i],
            high: quote.high[i],
            low: quote.low[i],
            close: quote.close[i],
            volume: quote.volume?.[i],
            adjustedClose: adjClose?.[i],
          });
        }
      }

      return prices;
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
