// ============================================================================
// MARKET DATA JOB - Finance Hub Worker
// Fetches and updates market prices for assets
// ============================================================================

import { prisma } from '../lib/prisma.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface MarketDataResult {
  updated: number;
  failed: number;
  duration: number;
}

interface MarketQuote {
  symbol: string;
  price: number;
  currency: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const YAHOO_API_URL = 'https://query1.finance.yahoo.com';
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// Common crypto symbols to CoinGecko ID mapping
const CRYPTO_SYMBOL_TO_ID: Record<string, string> = {
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
// Yahoo Finance Fetcher
// ----------------------------------------------------------------------------

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
  const quotes = new Map<string, MarketQuote>();

  if (symbols.length === 0) return quotes;

  try {
    const url = `${YAHOO_API_URL}/v7/finance/quote?symbols=${symbols.join(',')}`;
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
      if (result.regularMarketPrice) {
        quotes.set(result.symbol, {
          symbol: result.symbol,
          price: result.regularMarketPrice,
          currency: result.currency || 'USD',
        });
      }
    }
  } catch (error) {
    console.error('Error fetching Yahoo quotes:', error);
  }

  return quotes;
}

// ----------------------------------------------------------------------------
// CoinGecko Fetcher
// ----------------------------------------------------------------------------

async function fetchCoinGeckoQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
  const quotes = new Map<string, MarketQuote>();

  if (symbols.length === 0) return quotes;

  try {
    // Convert symbols to CoinGecko IDs
    const ids: string[] = [];
    const symbolToId = new Map<string, string>();

    for (const symbol of symbols) {
      const id = CRYPTO_SYMBOL_TO_ID[symbol.toUpperCase()];
      if (id) {
        ids.push(id);
        symbolToId.set(id, symbol.toUpperCase());
      }
    }

    if (ids.length === 0) return quotes;

    const url = `${COINGECKO_API_URL}/coins/markets?vs_currency=eur&ids=${ids.join(',')}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return quotes;
    }

    const data = await response.json();

    for (const coin of data) {
      const symbol = symbolToId.get(coin.id);
      if (symbol && coin.current_price) {
        quotes.set(symbol, {
          symbol,
          price: coin.current_price,
          currency: 'EUR',
        });
      }
    }
  } catch (error) {
    console.error('Error fetching CoinGecko quotes:', error);
  }

  return quotes;
}

// ----------------------------------------------------------------------------
// Main Job
// ----------------------------------------------------------------------------

/**
 * Update prices for all assets that have active positions
 */
export async function updateMarketData(): Promise<MarketDataResult> {
  const startTime = Date.now();
  let updated = 0;
  let failed = 0;

  console.log('Starting market data update...');

  // Get all assets with positions
  const assets = await prisma.asset.findMany({
    where: {
      positions: {
        some: {
          quantity: { gt: 0 },
        },
      },
    },
  });

  if (assets.length === 0) {
    console.log('No assets with positions to update');
    return { updated: 0, failed: 0, duration: Date.now() - startTime };
  }

  console.log(`Found ${assets.length} assets to update`);

  // Separate by type
  const stockSymbols: string[] = [];
  const cryptoSymbols: string[] = [];

  for (const asset of assets) {
    if (asset.type === 'crypto') {
      cryptoSymbols.push(asset.symbol);
    } else {
      stockSymbols.push(asset.symbol);
    }
  }

  // Fetch quotes from both providers
  const [stockQuotes, cryptoQuotes] = await Promise.all([
    fetchYahooQuotes(stockSymbols),
    fetchCoinGeckoQuotes(cryptoSymbols),
  ]);

  // Merge quotes
  const allQuotes = new Map([...stockQuotes, ...cryptoQuotes]);

  console.log(`Fetched ${allQuotes.size} quotes`);

  // Update assets in database
  const now = new Date();

  for (const asset of assets) {
    const quote = allQuotes.get(asset.symbol);

    if (quote) {
      try {
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            lastPrice: quote.price,
            lastPriceAt: now,
          },
        });
        updated++;
      } catch (error) {
        console.error(`Error updating ${asset.symbol}:`, error);
        failed++;
      }
    } else {
      console.warn(`No quote found for ${asset.symbol}`);
      failed++;
    }
  }

  const duration = Date.now() - startTime;

  console.log(`Market data update completed in ${duration}ms`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);

  return { updated, failed, duration };
}

// ----------------------------------------------------------------------------
// Job Handler for BullMQ
// ----------------------------------------------------------------------------

export async function handleMarketDataJob(data: {
  assetIds?: string[];
}): Promise<MarketDataResult> {
  if (data.assetIds && data.assetIds.length > 0) {
    // Update specific assets
    const startTime = Date.now();
    let updated = 0;
    let failed = 0;

    const assets = await prisma.asset.findMany({
      where: { id: { in: data.assetIds } },
    });

    const stockSymbols = assets.filter((a) => a.type !== 'crypto').map((a) => a.symbol);
    const cryptoSymbols = assets.filter((a) => a.type === 'crypto').map((a) => a.symbol);

    const [stockQuotes, cryptoQuotes] = await Promise.all([
      fetchYahooQuotes(stockSymbols),
      fetchCoinGeckoQuotes(cryptoSymbols),
    ]);

    const allQuotes = new Map([...stockQuotes, ...cryptoQuotes]);
    const now = new Date();

    for (const asset of assets) {
      const quote = allQuotes.get(asset.symbol);
      if (quote) {
        try {
          await prisma.asset.update({
            where: { id: asset.id },
            data: {
              lastPrice: quote.price,
              lastPriceAt: now,
            },
          });
          updated++;
        } catch {
          failed++;
        }
      } else {
        failed++;
      }
    }

    return { updated, failed, duration: Date.now() - startTime };
  }

  return updateMarketData();
}

export default handleMarketDataJob;
