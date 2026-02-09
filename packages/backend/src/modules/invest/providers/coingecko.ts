// ============================================================================
// COINGECKO PROVIDER - Finance Hub
// Market data provider for cryptocurrencies
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
import { logger } from '../../../core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
}

interface CoinMarketData {
  current_price?: Record<string, number>;
  price_change_24h_in_currency?: Record<string, number>;
  price_change_percentage_24h?: number;
  total_volume?: Record<string, number>;
  market_cap?: Record<string, number>;
  high_24h?: Record<string, number>;
  low_24h?: Record<string, number>;
}

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  market_data?: CoinMarketData;
}

interface CoinMarketItem {
  id: string;
  symbol: string;
  current_price?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  total_volume?: number;
  market_cap?: number;
  high_24h?: number;
  low_24h?: number;
  last_updated: string;
}

interface SearchResponse {
  coins?: Array<{
    id: string;
    symbol: string;
    name: string;
  }>;
}

interface HistoryResponse {
  prices?: Array<[number, number]>;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://api.coingecko.com/api/v3';

// Common crypto symbol to CoinGecko ID mapping
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  SOL: 'solana',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
};

// ----------------------------------------------------------------------------
// Provider Implementation
// ----------------------------------------------------------------------------

export class CoinGeckoProvider implements MarketDataProvider {
  readonly name = 'coingecko';
  readonly supportedTypes: AssetType[] = ['crypto'];

  private baseUrl: string;
  private apiKey?: string;
  private rateLimit: number;
  private lastRequest: number = 0;
  private coinList: Map<string, { id: string; symbol: string; name: string }> | null = null;
  private defaultCurrency: string;

  constructor(config: ProviderConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.rateLimit = config.rateLimit || 10; // CoinGecko free tier: 10-50 requests/minute
    this.defaultCurrency = 'usd'; // Use USD as default for consistency with Yahoo
  }

  /**
   * Set the default currency for price fetching
   */
  setDefaultCurrency(currency: string): void {
    this.defaultCurrency = currency.toLowerCase();
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
   * Get headers (with API key if configured)
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['x-cg-pro-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Normalize symbol by removing currency suffix (e.g., BTC-USD -> BTC)
   */
  private normalizeSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    // Remove common currency suffixes
    const suffixes = ['-USD', '-EUR', '-GBP', '-JPY', '-CAD', '-AUD'];
    for (const suffix of suffixes) {
      if (upperSymbol.endsWith(suffix)) {
        return upperSymbol.slice(0, -suffix.length);
      }
    }
    return upperSymbol;
  }

  /**
   * Convert symbol to CoinGecko ID
   */
  private async symbolToId(symbol: string): Promise<string | null> {
    // Normalize symbol first (remove -USD suffix etc.)
    const normalizedSymbol = this.normalizeSymbol(symbol);

    // Check mapping first
    if (SYMBOL_TO_ID[normalizedSymbol]) {
      return SYMBOL_TO_ID[normalizedSymbol];
    }

    // Load coin list if needed
    if (!this.coinList) {
      await this.loadCoinList();
    }

    // Find by symbol
    for (const coin of this.coinList?.values() || []) {
      if (coin.symbol.toUpperCase() === normalizedSymbol) {
        return coin.id;
      }
    }

    return null;
  }

  /**
   * Load full coin list from CoinGecko
   */
  private async loadCoinList(): Promise<void> {
    try {
      await this.throttle();

      const response = await fetch(`${this.baseUrl}/coins/list`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'CoinGecko API error');
        return;
      }

      const data = (await response.json()) as CoinListItem[];
      this.coinList = new Map();

      for (const coin of data) {
        this.coinList.set(coin.id, {
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error loading CoinGecko coin list');
    }
  }

  /**
   * Get current quote for a symbol
   */
  async getQuote(symbol: string, currency?: string): Promise<MarketQuote | null> {
    try {
      const coinId = await this.symbolToId(symbol);
      if (!coinId) {
        logger.warn({ symbol }, 'Could not find CoinGecko ID for symbol');
        return null;
      }

      await this.throttle();

      const targetCurrency = (currency || this.defaultCurrency).toLowerCase();
      const url = `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'CoinGecko API error');
        return null;
      }

      const data = (await response.json()) as CoinData;
      const marketData = data.market_data;

      if (!marketData) {
        return null;
      }

      return {
        symbol: data.symbol.toUpperCase(),
        price: marketData.current_price?.[targetCurrency] || marketData.current_price?.usd || 0,
        currency: targetCurrency.toUpperCase(),
        change: marketData.price_change_24h_in_currency?.[targetCurrency] || marketData.price_change_24h_in_currency?.usd || 0,
        changePercent: marketData.price_change_percentage_24h || 0,
        volume: marketData.total_volume?.[targetCurrency] || marketData.total_volume?.usd,
        marketCap: marketData.market_cap?.[targetCurrency] || marketData.market_cap?.usd,
        high: marketData.high_24h?.[targetCurrency] || marketData.high_24h?.usd,
        low: marketData.low_24h?.[targetCurrency] || marketData.low_24h?.usd,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ symbol, error }, 'Error fetching quote');
      return null;
    }
  }

  /**
   * Get quotes for multiple symbols
   */
  async getQuotes(symbols: string[], currency?: string): Promise<Map<string, MarketQuote>> {
    const quotes = new Map<string, MarketQuote>();

    if (symbols.length === 0) {
      return quotes;
    }

    try {
      // Convert symbols to IDs
      const idToSymbol = new Map<string, string>();
      for (const symbol of symbols) {
        const coinId = await this.symbolToId(symbol);
        if (coinId) {
          idToSymbol.set(coinId, symbol.toUpperCase());
        }
      }

      if (idToSymbol.size === 0) {
        return quotes;
      }

      await this.throttle();

      const targetCurrency = (currency || this.defaultCurrency).toLowerCase();
      const ids = Array.from(idToSymbol.keys()).join(',');
      const url = `${this.baseUrl}/coins/markets?vs_currency=${targetCurrency}&ids=${ids}&price_change_percentage=24h`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'CoinGecko API error');
        return quotes;
      }

      const data = (await response.json()) as CoinMarketItem[];

      for (const coin of data) {
        const symbol = idToSymbol.get(coin.id);
        if (symbol) {
          quotes.set(symbol, {
            symbol: coin.symbol.toUpperCase(),
            price: coin.current_price || 0,
            currency: targetCurrency.toUpperCase(),
            change: coin.price_change_24h || 0,
            changePercent: coin.price_change_percentage_24h || 0,
            volume: coin.total_volume,
            marketCap: coin.market_cap,
            high: coin.high_24h,
            low: coin.low_24h,
            timestamp: new Date(coin.last_updated),
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error fetching quotes');
    }

    return quotes;
  }

  /**
   * Search for assets by query
   */
  async search(query: string, _type?: AssetType): Promise<SearchResult[]> {
    try {
      await this.throttle();

      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'CoinGecko search error');
        return [];
      }

      const data = (await response.json()) as SearchResponse;
      const coins = data?.coins || [];

      return coins.slice(0, 10).map((coin) => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        type: 'crypto' as AssetType,
        exchange: undefined,
        currency: 'EUR',
      }));
    } catch (error) {
      logger.error({ error }, 'Error searching');
      return [];
    }
  }

  /**
   * Get asset information
   */
  async getAssetInfo(symbol: string): Promise<AssetInfo | null> {
    try {
      const coinId = await this.symbolToId(symbol);
      if (!coinId) {
        return null;
      }

      await this.throttle();

      const url = `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as CoinData;

      return {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        type: 'crypto',
        currency: this.defaultCurrency.toUpperCase(),
      };
    } catch (error) {
      logger.error({ symbol, error }, 'Error fetching asset info');
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
    _interval: 'daily' | 'weekly' | 'monthly' = 'daily',
    currency?: string
  ): Promise<HistoricalPrice[]> {
    try {
      const coinId = await this.symbolToId(symbol);
      if (!coinId) {
        return [];
      }

      await this.throttle();

      const targetCurrency = (currency || this.defaultCurrency).toLowerCase();
      const from = Math.floor(startDate.getTime() / 1000);
      const to = Math.floor(endDate.getTime() / 1000);

      const url = `${this.baseUrl}/coins/${coinId}/market_chart/range?vs_currency=${targetCurrency}&from=${from}&to=${to}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'CoinGecko history error');
        return [];
      }

      const data = (await response.json()) as HistoryResponse;
      const prices = data?.prices || [];

      // CoinGecko returns [timestamp, price] arrays
      // We need to aggregate by day since the API returns more granular data
      const dailyPrices = new Map<string, HistoricalPrice>();

      for (const [timestamp, price] of prices) {
        const date = new Date(timestamp);
        const dateKey = date.toISOString().split('T')[0] ?? '';

        if (!dailyPrices.has(dateKey)) {
          dailyPrices.set(dateKey, {
            date: new Date(dateKey || date),
            open: price,
            high: price,
            low: price,
            close: price,
          });
        } else {
          const existing = dailyPrices.get(dateKey)!;
          existing.high = Math.max(existing.high, price);
          existing.low = Math.min(existing.low, price);
          existing.close = price; // Last price of the day
        }
      }

      return Array.from(dailyPrices.values()).sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
    } catch (error) {
      logger.error({ symbol, error }, 'Error fetching history');
      return [];
    }
  }
}

// Singleton instance
export const coinGecko = new CoinGeckoProvider();
