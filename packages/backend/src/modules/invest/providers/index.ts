// ============================================================================
// MARKET DATA PROVIDERS INDEX - Finance Hub
// ============================================================================

export * from './types.js';
export { YahooFinanceProvider, yahooFinance } from './yahoo.js';
export { CoinGeckoProvider, coinGecko } from './coingecko.js';

import type { AssetType } from '@prisma/client';
import type { MarketDataProvider } from './types.js';
import { yahooFinance } from './yahoo.js';
import { coinGecko } from './coingecko.js';

/**
 * Get the appropriate provider for an asset type
 */
export function getProviderForType(type: AssetType): MarketDataProvider {
  if (type === 'crypto') {
    return coinGecko;
  }
  return yahooFinance;
}

/**
 * Get all available providers
 */
export function getAllProviders(): MarketDataProvider[] {
  return [yahooFinance, coinGecko];
}
