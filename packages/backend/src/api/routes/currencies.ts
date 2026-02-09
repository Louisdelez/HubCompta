// ============================================================================
// CURRENCY ROUTES - Finance Hub
// Multi-currency support API
// ============================================================================

import type { FastifyPluginAsync } from 'fastify';
import { currencyService } from '@/modules/currency/index.js';
import { auditService } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { prisma } from '@/core/database/client.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ConvertQuery {
  from: string;
  to: string;
  amount: string;
  date?: string;
}

interface RateParams {
  base: string;
  target: string;
}

interface SetRateBody {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  date: string;
}

interface HistoricalQuery {
  startDate: string;
  endDate?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const currencyRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // List Currencies
  // ==========================================================================

  /**
   * GET /currencies
   * List all available currencies
   */
  fastify.get<{
    Querystring: { activeOnly?: string };
  }>('/', async (request) => {
    const activeOnly = request.query.activeOnly !== 'false';
    const currencies = await currencyService.listCurrencies(activeOnly);
    return { success: true, data: currencies };
  });

  // ==========================================================================
  // Convert Amount
  // ==========================================================================

  /**
   * GET /currencies/convert
   * Convert amount between currencies
   * NOTE: Must be defined before /:code to avoid being captured as a param
   */
  fastify.get<{
    Querystring: ConvertQuery;
  }>('/convert', async (request, reply) => {
    const { from, to, amount, date } = request.query;

    if (!from || !to || !amount) {
      return reply.status(400).send({
        error: 'Parametres manquants',
        message: 'from, to et amount sont requis',
      });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return reply.status(400).send({ error: 'Montant invalide' });
    }

    const conversionDate = date ? new Date(date) : new Date();
    const result = await currencyService.convert(numAmount, from, to, conversionDate);

    if (!result) {
      return reply.status(404).send({
        error: 'Taux de change non disponible',
        message: `Aucun taux disponible pour ${from}/${to}`,
      });
    }

    return { success: true, data: result };
  });

  // ==========================================================================
  // Get Available Sources
  // ==========================================================================

  /**
   * GET /currencies/sources
   * Get available exchange rate sources
   * NOTE: Must be defined before /:code to avoid being captured as a param
   */
  fastify.get('/sources', () => {
    const sources = [
      {
        id: 'ecb',
        name: 'European Central Bank',
        baseCurrency: 'EUR',
        currencies: 29,
        available: true,
        requiresApiKey: false,
      },
      {
        id: 'fed-h10',
        name: 'Federal Reserve H.10',
        baseCurrency: 'USD',
        currencies: 22,
        available: true,
        requiresApiKey: false,
      },
      {
        id: 'snb',
        name: 'Swiss National Bank',
        baseCurrency: 'CHF',
        currencies: 4,
        available: true,
        requiresApiKey: false,
      },
      {
        id: 'fred',
        name: 'Federal Reserve (FRED API)',
        baseCurrency: 'USD',
        currencies: 21,
        available: !!process.env.FRED_API_KEY,
        requiresApiKey: true,
      },
    ];

    return { success: true, data: sources };
  });

  // ==========================================================================
  // Get Currency
  // ==========================================================================

  /**
   * GET /currencies/:code
   * Get currency by code
   */
  fastify.get<{
    Params: { code: string };
  }>('/:code', async (request, reply) => {
    const currency = await currencyService.getCurrency(request.params.code);

    if (!currency) {
      return reply.status(404).send({ error: 'Devise non trouvee' });
    }

    return { success: true, data: currency };
  });

  // ==========================================================================
  // Get Exchange Rate
  // ==========================================================================

  /**
   * GET /currencies/rates/:base/:target
   * Get exchange rate for currency pair
   */
  fastify.get<{
    Params: RateParams;
    Querystring: { date?: string };
  }>('/rates/:base/:target', async (request, reply) => {
    const { base, target } = request.params;
    const date = request.query.date ? new Date(request.query.date) : new Date();

    const rate = await currencyService.getRate(base, target, date);

    if (!rate) {
      return reply.status(404).send({
        error: 'Taux non disponible',
        message: `Aucun taux disponible pour ${base}/${target}`,
      });
    }

    return {
      success: true,
      data: {
        baseCurrency: base.toUpperCase(),
        targetCurrency: target.toUpperCase(),
        ...rate,
      },
    };
  });

  // ==========================================================================
  // Get Latest Rates
  // ==========================================================================

  /**
   * GET /currencies/rates/:base
   * Get all latest rates for a base currency
   */
  fastify.get<{
    Params: { base: string };
  }>('/rates/:base', async (request) => {
    const rates = await currencyService.getLatestRates(request.params.base);
    return {
      success: true,
      data: {
        baseCurrency: request.params.base.toUpperCase(),
        rates,
      },
    };
  });

  // ==========================================================================
  // Get Historical Rates
  // ==========================================================================

  /**
   * GET /currencies/rates/:base/:target/history
   * Get historical exchange rates
   */
  fastify.get<{
    Params: RateParams;
    Querystring: HistoricalQuery;
  }>('/rates/:base/:target/history', async (request, reply) => {
    const { base, target } = request.params;
    const { startDate, endDate } = request.query;

    if (!startDate) {
      return reply.status(400).send({
        error: 'Date de debut requise',
        message: 'Le parametre startDate est requis',
      });
    }

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    const rates = await currencyService.getHistoricalRates(base, target, start, end);

    return {
      success: true,
      data: {
        baseCurrency: base.toUpperCase(),
        targetCurrency: target.toUpperCase(),
        startDate: start,
        endDate: end,
        rates,
      },
    };
  });

  // ==========================================================================
  // Set Exchange Rate (Admin)
  // ==========================================================================

  /**
   * POST /currencies/rates
   * Set exchange rate manually (admin only)
   */
  fastify.post<{
    Body: SetRateBody;
  }>('/rates', { preHandler: [authGuard] }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    // Check if user is instance admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isInstanceAdmin: true },
    });

    if (!user?.isInstanceAdmin) {
      return reply.status(403).send({ error: 'Acces reserve aux administrateurs' });
    }

    const { baseCurrency, targetCurrency, rate, date } = request.body;

    if (!baseCurrency || !targetCurrency || !rate || !date) {
      return reply.status(400).send({
        error: 'Parametres manquants',
        message: 'baseCurrency, targetCurrency, rate et date sont requis',
      });
    }

    if (rate <= 0) {
      return reply.status(400).send({ error: 'Le taux doit etre positif' });
    }

    const exchangeRate = await currencyService.setRate({
      baseCurrency,
      targetCurrency,
      rate,
      date: new Date(date),
      source: 'manual',
    });

    await auditService.log({
      userId,
      action: 'exchange_rate.set',
      entityType: 'exchange_rate',
      entityId: exchangeRate.id,
      changes: { baseCurrency, targetCurrency, rate, date },
      ipAddress: request.ip,
    });

    return reply.status(201).send({ success: true, data: exchangeRate });
  });

  // ==========================================================================
  // Fetch ECB Rates
  // ==========================================================================

  /**
   * POST /currencies/rates/fetch-ecb
   * Fetch latest rates from ECB
   */
  fastify.post('/rates/fetch-ecb', { preHandler: [authGuard] }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    try {
      const result = await currencyService.fetchECBRates();

      await auditService.log({
        userId,
        action: 'exchange_rate.fetch_ecb',
        changes: { imported: result.imported, date: result.date },
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
        message: `${result.imported} taux importes depuis la BCE`,
      };
    } catch (error) {
      return reply.status(500).send({
        error: 'Erreur lors de la recuperation des taux',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  });

  // ==========================================================================
  // Fetch FRED Rates
  // ==========================================================================

  /**
   * POST /currencies/rates/fetch-fred
   * Fetch latest rates from FRED (Federal Reserve)
   * Requires FRED_API_KEY environment variable
   */
  fastify.post('/rates/fetch-fred', { preHandler: [authGuard] }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    if (!process.env.FRED_API_KEY) {
      return reply.status(400).send({
        error: 'FRED API non configuree',
        message: 'La variable FRED_API_KEY doit etre definie',
      });
    }

    try {
      const result = await currencyService.fetchFREDRates();

      await auditService.log({
        userId,
        action: 'exchange_rate.fetch_fred',
        changes: { imported: result.imported, date: result.date, currencies: result.currencies },
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
        message: `${result.imported} taux importes depuis FRED (${result.currencies.join(', ')})`,
      };
    } catch (error) {
      return reply.status(500).send({
        error: 'Erreur lors de la recuperation des taux FRED',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  });

  // ==========================================================================
  // Fetch Fed H.10 Rates (no API key required)
  // ==========================================================================

  /**
   * POST /currencies/rates/fetch-fed
   * Fetch latest rates from Federal Reserve H.10 (no API key required)
   */
  fastify.post('/rates/fetch-fed', { preHandler: [authGuard] }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    try {
      const result = await currencyService.fetchFedH10Rates();

      await auditService.log({
        userId,
        action: 'exchange_rate.fetch_fed_h10',
        changes: { imported: result.imported, date: result.date, currencies: result.currencies },
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
        message: `${result.imported} taux importes depuis Fed H.10 (${result.currencies.join(', ')})`,
      };
    } catch (error) {
      return reply.status(500).send({
        error: 'Erreur lors de la recuperation des taux Fed H.10',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  });

  // ==========================================================================
  // Fetch SNB Rates (no API key required)
  // ==========================================================================

  /**
   * POST /currencies/rates/fetch-snb
   * Fetch latest rates from Swiss National Bank (no API key required)
   * Limited to 4 currencies: EUR, USD, GBP, JPY
   */
  fastify.post('/rates/fetch-snb', { preHandler: [authGuard] }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    try {
      const result = await currencyService.fetchSNBRates();

      await auditService.log({
        userId,
        action: 'exchange_rate.fetch_snb',
        changes: { imported: result.imported, date: result.date, currencies: result.currencies },
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
        message: `${result.imported} taux importes depuis SNB (${result.currencies.join(', ')})`,
      };
    } catch (error) {
      return reply.status(500).send({
        error: 'Erreur lors de la recuperation des taux SNB',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  });

  // ==========================================================================
  // Fetch All Rates
  // ==========================================================================

  /**
   * POST /currencies/rates/fetch-all
   * Fetch rates from all available sources (ECB + Fed H.10 + SNB + FRED if configured)
   */
  fastify.post('/rates/fetch-all', { preHandler: [authGuard] }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    try {
      const result = await currencyService.fetchAllRates();

      await auditService.log({
        userId,
        action: 'exchange_rate.fetch_all',
        changes: {
          ecb: { imported: result.ecb.imported },
          fed: result.fed ? { imported: result.fed.imported } : null,
          snb: result.snb ? { imported: result.snb.imported } : null,
          fred: result.fred ? { imported: result.fred.imported } : null,
        },
        ipAddress: request.ip,
      });

      const totalImported = result.ecb.imported + (result.fed?.imported ?? 0) + (result.snb?.imported ?? 0) + (result.fred?.imported ?? 0);

      return {
        success: true,
        data: result,
        message: `${totalImported} taux importes (BCE: ${result.ecb.imported}, Fed: ${result.fed?.imported ?? 0}, SNB: ${result.snb?.imported ?? 0}, FRED: ${result.fred?.imported ?? 0})`,
      };
    } catch (error) {
      return reply.status(500).send({
        error: 'Erreur lors de la recuperation des taux',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  });

  // ==========================================================================
  // Initialize Currencies
  // ==========================================================================

  /**
   * POST /currencies/initialize
   * Initialize default currencies (admin only)
   */
  fastify.post('/initialize', { preHandler: [authGuard] }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const result = await currencyService.initializeCurrencies();

    if (result.created > 0) {
      await auditService.log({
        userId,
        action: 'currency.initialize',
        changes: { created: result.created },
        ipAddress: request.ip,
      });
    }

    return { success: true, data: result };
  });
};

export { currencyRoutes };
export default currencyRoutes;
