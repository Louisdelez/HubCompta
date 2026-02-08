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

  constructor(config: ProviderConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.rateLimit = config.rateLimit || 10; // CoinGecko free tier: 10-50 requests/minute
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
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['x-cg-pro-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Convert symbol to CoinGecko ID
   */
  private async symbolToId(symbol: string): Promise<string | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check mapping first
    if (SYMBOL_TO_ID[upperSymbol]) {
      return SYMBOL_TO_ID[upperSymbol];
    }

    // Load coin list if needed
    if (!this.coinList) {
      await this.loadCoinList();
    }

    // Find by symbol
    for (const coin of this.coinList?.values() || []) {
      if (coin.symbol.toUpperCase() === upperSymbol) {
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
        console.error(`CoinGecko API error: ${response.status}`);
        return;
      }

      const data = await response.json();
      this.coinList = new Map();

      for (const coin of data) {
        this.coinList.set(coin.id, {
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
        });
      }
    } catch (error) {
      console.error('Error loading CoinGecko coin list:', error);
    }
  }

  /**
   * Get current quote for a symbol
   */
  async getQuote(symbol: string): Promise<MarketQuote | null> {
    try {
      const coinId = await this.symbolToId(symbol);
      if (!coinId) {
        console.warn(`Could not find CoinGecko ID for symbol: ${symbol}`);
        return null;
      }

      await this.throttle();

      const url = `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`CoinGecko API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const marketData = data.market_data;

      if (!marketData) {
        return null;
      }

      return {
        symbol: data.symbol.toUpperCase(),
        price: marketData.current_price?.eur || 0,
        currency: 'EUR',
        change: marketData.price_change_24h_in_currency?.eur || 0,
        changePercent: marketData.price_change_percentage_24h || 0,
        volume: marketData.total_volume?.eur,
        marketCap: marketData.market_cap?.eur,
        high: marketData.high_24h?.eur,
        low: marketData.low_24h?.eur,
        timestamp: new Date(),
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

      const ids = Array.from(idToSymbol.keys()).join(',');
      const url = `${this.baseUrl}/coins/markets?vs_currency=eur&ids=${ids}&price_change_percentage=24h`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`CoinGecko API error: ${response.status}`);
        return quotes;
      }

      const data = await response.json();

      for (const coin of data) {
        const symbol = idToSymbol.get(coin.id);
        if (symbol) {
          quotes.set(symbol, {
            symbol: coin.symbol.toUpperCase(),
            price: coin.current_price || 0,
            currency: 'EUR',
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

      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`CoinGecko search error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const coins = data?.coins || [];

      return coins.slice(0, 10).map((coin: Record<string, unknown>) => ({
        symbol: (coin.symbol as string).toUpperCase(),
        name: coin.name as string,
        type: 'crypto' as AssetType,
        exchange: undefined,
        currency: 'EUR',
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

      const data = await response.json();

      return {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        type: 'crypto',
        currency: 'EUR',
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
    _interval: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<HistoricalPrice[]> {
    try {
      const coinId = await this.symbolToId(symbol);
      if (!coinId) {
        return [];
      }

      await this.throttle();

      const from = Math.floor(startDate.getTime() / 1000);
      const to = Math.floor(endDate.getTime() / 1000);

      const url = `${this.baseUrl}/coins/${coinId}/market_chart/range?vs_currency=eur&from=${from}&to=${to}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`CoinGecko history error: ${response.status}`);
        return [];
      }

      const data = await response.json();
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
      console.error(`Error fetching history for ${symbol}:`, error);
      return [];
    }
  }
}

// Singleton instance
export const coinGecko = new CoinGeckoProvider();
