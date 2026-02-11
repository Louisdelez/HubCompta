// ============================================================================
// BANKING MODULE - Finance Hub
// Open Banking integration with Nordigen/GoCardless
// ============================================================================

// Services
export { bankConnectionService } from './bank-connection.service.js';
export type { BankConnectionWithAccounts, SyncResult } from './bank-connection.service.js';

export { bankSyncService } from './bank-sync.service.js';
export type { TransactionMatch, SyncStats } from './bank-sync.service.js';

// Providers
export { NordigenProvider, createNordigenProvider } from './providers/nordigen.provider.js';
export type {
  IBankProvider,
  BankInstitution,
  BankAccountInfo,
  BankTransaction,
  AuthorizationResult,
  ConnectionTokens,
} from './providers/provider.interface.js';
