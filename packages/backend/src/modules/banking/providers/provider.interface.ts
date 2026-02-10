// ============================================================================
// BANK PROVIDER INTERFACE - Finance Hub
// Common interface for all bank connection providers
// ============================================================================

export interface BankInstitution {
  id: string;
  name: string;
  bic: string | null;
  logo: string | null;
  countries: string[];
}

export interface BankAccountInfo {
  id: string;
  iban: string | null;
  name: string;
  currency: string;
  type: string;
  balance: number;
  availableBalance: number | null;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  date: Date;
  bookingDate: Date | null;
  description: string;
  merchantName: string | null;
  category: string | null;
  reference: string | null;
}

export interface AuthorizationResult {
  requisitionId: string;
  authUrl: string;
  expiresAt: Date;
}

export interface ConnectionTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

export interface IBankProvider {
  /**
   * Provider name/identifier
   */
  readonly name: string;

  /**
   * Get list of supported institutions for a country
   */
  getInstitutions(countryCode: string): Promise<BankInstitution[]>;

  /**
   * Search institutions by name
   */
  searchInstitutions(query: string, countryCode?: string): Promise<BankInstitution[]>;

  /**
   * Initiate authorization flow for connecting to a bank
   */
  initiateAuthorization(
    institutionId: string,
    redirectUri: string,
    reference: string
  ): Promise<AuthorizationResult>;

  /**
   * Complete authorization and get tokens
   */
  completeAuthorization(requisitionId: string): Promise<ConnectionTokens>;

  /**
   * Refresh access token
   */
  refreshToken(refreshToken: string): Promise<ConnectionTokens>;

  /**
   * Get accounts for a connection
   */
  getAccounts(connectionId: string, accessToken: string): Promise<BankAccountInfo[]>;

  /**
   * Get transactions for an account
   */
  getTransactions(
    accountId: string,
    accessToken: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<BankTransaction[]>;

  /**
   * Get current balance for an account
   */
  getBalance(accountId: string, accessToken: string): Promise<{
    balance: number;
    availableBalance: number | null;
    currency: string;
  }>;

  /**
   * Revoke access (disconnect)
   */
  revokeAccess(connectionId: string, accessToken: string): Promise<void>;
}

export type BankProviderFactory = () => IBankProvider;
