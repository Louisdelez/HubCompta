// ============================================================================
// NORDIGEN (GoCardless) BANK PROVIDER - Finance Hub
// Free Open Banking provider for EU
// Documentation: https://nordigen.com/en/docs/
// ============================================================================

import type {
  IBankProvider,
  BankInstitution,
  BankAccountInfo,
  BankTransaction,
  AuthorizationResult,
  ConnectionTokens,
} from './provider.interface.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface NordigenTokenResponse {
  access: string;
  access_expires: number;
  refresh: string;
  refresh_expires: number;
}

interface NordigenInstitution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
}

interface NordigenRequisition {
  id: string;
  link: string;
  status: string;
  accounts: string[];
}

interface _NordigenAccount {
  id: string;
  iban: string;
  institution_id: string;
  status: string;
}

interface NordigenAccountDetails {
  account: {
    resourceId: string;
    iban: string;
    currency: string;
    name: string;
    product: string;
    ownerName: string;
    cashAccountType: string;
  };
}

interface NordigenBalance {
  balanceAmount: { amount: string; currency: string };
  balanceType: string;
  referenceDate: string;
}

interface NordigenTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  creditorName?: string;
  debtorName?: string;
  merchantCategoryCode?: string;
}

// ----------------------------------------------------------------------------
// Nordigen Provider Implementation
// ----------------------------------------------------------------------------

export class NordigenProvider implements IBankProvider {
  readonly name = 'nordigen';

  private baseUrl = 'https://ob.nordigen.com/api/v2';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly secretId: string,
    private readonly secretKey: string
  ) {}

  /**
   * Get or refresh API access token
   */
  private async getApiToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/token/new/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret_id: this.secretId,
        secret_key: this.secretKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get Nordigen token: ${response.status}`);
    }

    const data = (await response.json()) as NordigenTokenResponse;
    this.accessToken = data.access;
    this.tokenExpiresAt = new Date(Date.now() + data.access_expires * 1000);

    return this.accessToken;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    method: string,
    endpoint: string,
    body?: object
  ): Promise<T> {
    const token = await this.getApiToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ method, endpoint, status: response.status, error }, 'Nordigen API error');
      throw new Error(`Nordigen API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getInstitutions(countryCode: string): Promise<BankInstitution[]> {
    const data = await this.apiRequest<NordigenInstitution[]>(
      'GET',
      `/institutions/?country=${countryCode.toUpperCase()}`
    );

    return data.map((inst) => ({
      id: inst.id,
      name: inst.name,
      bic: inst.bic || null,
      logo: inst.logo || null,
      countries: inst.countries,
    }));
  }

  async searchInstitutions(query: string, countryCode?: string): Promise<BankInstitution[]> {
    const institutions = await this.getInstitutions(countryCode ?? 'FR');

    const queryLower = query.toLowerCase();
    return institutions.filter(
      (inst) =>
        inst.name.toLowerCase().includes(queryLower) ||
        (inst.bic && inst.bic.toLowerCase().includes(queryLower))
    );
  }

  async initiateAuthorization(
    institutionId: string,
    redirectUri: string,
    reference: string
  ): Promise<AuthorizationResult> {
    // First create an end user agreement
    const agreement = await this.apiRequest<{ id: string }>('POST', '/agreements/enduser/', {
      institution_id: institutionId,
      max_historical_days: 90,
      access_valid_for_days: 90,
      access_scope: ['balances', 'details', 'transactions'],
    });

    // Then create a requisition
    const requisition = await this.apiRequest<NordigenRequisition>('POST', '/requisitions/', {
      redirect: redirectUri,
      institution_id: institutionId,
      reference,
      agreement: agreement.id,
      user_language: 'FR',
    });

    return {
      requisitionId: requisition.id,
      authUrl: requisition.link,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    };
  }

  async completeAuthorization(requisitionId: string): Promise<ConnectionTokens> {
    const requisition = await this.apiRequest<NordigenRequisition>(
      'GET',
      `/requisitions/${requisitionId}/`
    );

    if (requisition.status !== 'LN') {
      throw new Error(`Authorization not complete. Status: ${requisition.status}`);
    }

    // For Nordigen, we don't get separate tokens - we use the requisition ID
    // The access is valid for 90 days from agreement creation
    return {
      accessToken: requisitionId,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };
  }

  async refreshToken(_refreshToken: string): Promise<ConnectionTokens> {
    // Nordigen doesn't use refresh tokens in the same way
    // Access is valid for 90 days, then user must re-authenticate
    throw new Error('Nordigen does not support token refresh. User must re-authenticate.');
  }

  async getAccounts(connectionId: string, _accessToken: string): Promise<BankAccountInfo[]> {
    const requisition = await this.apiRequest<NordigenRequisition>(
      'GET',
      `/requisitions/${connectionId}/`
    );

    const accounts: BankAccountInfo[] = [];

    for (const accountId of requisition.accounts) {
      try {
        const details = await this.apiRequest<NordigenAccountDetails>(
          'GET',
          `/accounts/${accountId}/details/`
        );

        const balances = await this.apiRequest<{ balances: NordigenBalance[] }>(
          'GET',
          `/accounts/${accountId}/balances/`
        );

        const currentBalance = balances.balances.find(
          (b) => b.balanceType === 'expected' || b.balanceType === 'closingBooked'
        );
        const availableBalance = balances.balances.find(
          (b) => b.balanceType === 'interimAvailable'
        );

        accounts.push({
          id: accountId,
          iban: details.account.iban || null,
          name: details.account.name || details.account.ownerName || 'Compte bancaire',
          currency: details.account.currency,
          type: this.mapAccountType(details.account.cashAccountType),
          balance: parseFloat(currentBalance?.balanceAmount.amount ?? '0'),
          availableBalance: availableBalance
            ? parseFloat(availableBalance.balanceAmount.amount)
            : null,
        });
      } catch (error) {
        logger.error({ accountId, error }, 'Failed to fetch account details');
      }
    }

    return accounts;
  }

  async getTransactions(
    accountId: string,
    _accessToken: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<BankTransaction[]> {
    let endpoint = `/accounts/${accountId}/transactions/`;

    const params = new URLSearchParams();
    if (fromDate) {
      params.set('date_from', fromDate.toISOString().split('T')[0]!);
    }
    if (toDate) {
      params.set('date_to', toDate.toISOString().split('T')[0]!);
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const data = await this.apiRequest<{
      transactions: { booked: NordigenTransaction[]; pending: NordigenTransaction[] };
    }>('GET', endpoint);

    const transactions: BankTransaction[] = [];

    // Process booked transactions
    for (const tx of data.transactions.booked) {
      transactions.push(this.mapTransaction(accountId, tx));
    }

    // Optionally include pending (uncomment if needed)
    // for (const tx of data.transactions.pending) {
    //   transactions.push(this.mapTransaction(accountId, tx));
    // }

    return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getBalance(
    accountId: string,
    _accessToken: string
  ): Promise<{ balance: number; availableBalance: number | null; currency: string }> {
    const data = await this.apiRequest<{ balances: NordigenBalance[] }>(
      'GET',
      `/accounts/${accountId}/balances/`
    );

    const currentBalance = data.balances.find(
      (b) => b.balanceType === 'expected' || b.balanceType === 'closingBooked'
    );
    const availableBalance = data.balances.find((b) => b.balanceType === 'interimAvailable');

    return {
      balance: parseFloat(currentBalance?.balanceAmount.amount ?? '0'),
      availableBalance: availableBalance ? parseFloat(availableBalance.balanceAmount.amount) : null,
      currency: currentBalance?.balanceAmount.currency ?? 'EUR',
    };
  }

  async revokeAccess(connectionId: string, _accessToken: string): Promise<void> {
    await this.apiRequest('DELETE', `/requisitions/${connectionId}/`);
  }

  // ----------------------------------------------------------------------------
  // Helper Methods
  // ----------------------------------------------------------------------------

  private mapAccountType(nordigenType: string): string {
    const typeMap: Record<string, string> = {
      CACC: 'checking',
      SVGS: 'savings',
      CARD: 'credit_card',
      CASH: 'cash',
      LOAN: 'loan',
    };
    return typeMap[nordigenType] ?? 'checking';
  }

  private mapTransaction(accountId: string, tx: NordigenTransaction): BankTransaction {
    const amount = parseFloat(tx.transactionAmount.amount);

    return {
      id: tx.transactionId,
      accountId,
      amount,
      currency: tx.transactionAmount.currency,
      date: new Date(tx.valueDate || tx.bookingDate),
      bookingDate: tx.bookingDate ? new Date(tx.bookingDate) : null,
      description:
        tx.remittanceInformationUnstructured || tx.creditorName || tx.debtorName || 'Transaction',
      merchantName: amount < 0 ? tx.creditorName ?? null : tx.debtorName ?? null,
      category: tx.merchantCategoryCode ?? null,
      reference: tx.transactionId,
    };
  }
}

/**
 * Create Nordigen provider instance
 */
export function createNordigenProvider(): NordigenProvider {
  const secretId = process.env.NORDIGEN_SECRET_ID;
  const secretKey = process.env.NORDIGEN_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error('NORDIGEN_SECRET_ID and NORDIGEN_SECRET_KEY must be set');
  }

  return new NordigenProvider(secretId, secretKey);
}

export default NordigenProvider;
