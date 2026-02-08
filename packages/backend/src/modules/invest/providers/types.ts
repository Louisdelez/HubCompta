// ============================================================================
// MARKET DATA PROVIDER TYPES - Finance Hub
// ============================================================================

import type { AssetType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface MarketQuote {
  symbol: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  timestamp: Date;
}

export interface AssetInfo {
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  exchange?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
  currency?: string;
}

export interface HistoricalPrice {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  adjustedClose?: number;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  rateLimit?: number; // requests per minute
}

// ----------------------------------------------------------------------------
// Provider Interface
// ----------------------------------------------------------------------------

export interface MarketDataProvider {
  name: string;
  supportedTypes: AssetType[];

  /**
   * Get current quote for a symbol
   */
  getQuote(symbol: string): Promise<MarketQuote | null>;

  /**
   * Get quotes for multiple symbols
   */
  getQuotes(symbols: string[]): Promise<Map<string, MarketQuote>>;

  /**
   * Search for assets by query
   */
  search(query: string, type?: AssetType): Promise<SearchResult[]>;

  /**
   * Get asset information
   */
  getAssetInfo(symbol: string): Promise<AssetInfo | null>;

  /**
   * Get historical prices
   */
  getHistory(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval?: 'daily' | 'weekly' | 'monthly'
  ): Promise<HistoricalPrice[]>;
}
