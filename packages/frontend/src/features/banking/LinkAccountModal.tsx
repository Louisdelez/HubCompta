// ============================================================================
// LINK ACCOUNT MODAL - Finance Hub
// Link a bank account to an existing app account
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, X, Loader2, Wallet, Building2, Check, Plus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

interface BankAccount {
  id: string;
  name: string;
  iban: string | null;
  balance: number;
  currency: string;
  type: string;
  linkedAccountId: string | null;
}

interface LinkAccountModalProps {
  workspaceId: string;
  bankAccount: BankAccount;
  onClose: () => void;
  onLinked: () => void;
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function AccountTypeIcon({ type: _type }: { type: string }) {
  return (
    <div className="w-8 h-8 bg-ctp-surface1 rounded-lg flex items-center justify-center">
      <Wallet className="w-4 h-4 text-ctp-subtext0" />
    </div>
  );
}

export function LinkAccountModal({
  workspaceId,
  bankAccount,
  onClose,
  onLinked,
}: LinkAccountModalProps) {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState(bankAccount.name);

  // Fetch existing accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Link account mutation
  const linkMutation = useMutation({
    mutationFn: (linkedAccountId: string) =>
      api.post(`/workspaces/${workspaceId}/banking/accounts/${bankAccount.id}/link`, {
        linkedAccountId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['banking'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onLinked();
      onClose();
    },
  });

  // Create and link account mutation
  const createAndLinkMutation = useMutation({
    mutationFn: async () => {
      // First create the account
      const newAccount = await api.post<{ id: string }>(
        `/workspaces/${workspaceId}/accounts`,
        {
          name: newAccountName,
          type: mapBankAccountType(bankAccount.type),
          currency: bankAccount.currency,
          initialBalance: bankAccount.balance,
        }
      );
      // Then link it
      await api.post(
        `/workspaces/${workspaceId}/banking/accounts/${bankAccount.id}/link`,
        { linkedAccountId: newAccount.id }
      );
      return newAccount;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['banking'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onLinked();
      onClose();
    },
  });

  // Map bank account type to app account type
  function mapBankAccountType(bankType: string): string {
    const typeMap: Record<string, string> = {
      checking: 'checking',
      savings: 'savings',
      credit_card: 'credit',
      cash: 'cash',
      loan: 'loan',
    };
    return typeMap[bankType] ?? 'checking';
  }

  // Filter out already linked accounts and match by currency
  const availableAccounts = accounts.filter(
    (acc) => acc.currency === bankAccount.currency
  );

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleLink = () => {
    if (showCreateNew) {
      createAndLinkMutation.mutate();
    } else if (selectedAccountId) {
      linkMutation.mutate(selectedAccountId);
    }
  };

  const isLoading = linkMutation.isPending || createAndLinkMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ctp-surface1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            Lier le compte
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ctp-surface0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bank Account Info */}
        <div className="p-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3 p-3 bg-ctp-surface0 rounded-lg">
            <div className="w-10 h-10 bg-ctp-surface1 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-ctp-subtext0" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-ctp-text">{bankAccount.name}</p>
              <p className="text-xs text-ctp-subtext0">
                {bankAccount.iban ?? bankAccount.type} -{' '}
                {formatCurrency(bankAccount.balance, bankAccount.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {loadingAccounts ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-2" />
              <p className="text-ctp-subtext0">Chargement des comptes...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ctp-subtext0 mb-3">
                Selectionnez un compte existant ou creez-en un nouveau :
              </p>

              {/* Existing Accounts */}
              {availableAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    setSelectedAccountId(account.id);
                    setShowCreateNew(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                    selectedAccountId === account.id && !showCreateNew
                      ? 'bg-ctp-blue/20 border-2 border-ctp-blue'
                      : 'bg-ctp-surface0 hover:bg-ctp-surface1 border-2 border-transparent'
                  )}
                >
                  <AccountTypeIcon type={account.type} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ctp-text truncate">
                      {account.name}
                    </p>
                    <p className="text-xs text-ctp-subtext0">
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                  </div>
                  {selectedAccountId === account.id && !showCreateNew && (
                    <Check className="w-5 h-5 text-ctp-blue" />
                  )}
                </button>
              ))}

              {/* Create New Option */}
              <button
                onClick={() => {
                  setShowCreateNew(true);
                  setSelectedAccountId(null);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                  showCreateNew
                    ? 'bg-ctp-green/20 border-2 border-ctp-green'
                    : 'bg-ctp-surface0 hover:bg-ctp-surface1 border-2 border-transparent'
                )}
              >
                <div className="w-8 h-8 bg-ctp-green/20 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-ctp-green" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ctp-text">Creer un nouveau compte</p>
                  <p className="text-xs text-ctp-subtext0">
                    Un compte sera cree automatiquement
                  </p>
                </div>
                {showCreateNew && <Check className="w-5 h-5 text-ctp-green" />}
              </button>

              {/* New Account Name Input */}
              {showCreateNew && (
                <div className="mt-3 p-3 bg-ctp-surface0 rounded-lg">
                  <label className="block text-sm font-medium mb-1">
                    Nom du compte
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="input-text w-full"
                    placeholder="Mon compte courant"
                  />
                </div>
              )}

              {/* No matching currency warning */}
              {availableAccounts.length === 0 && !showCreateNew && (
                <div className="py-4 text-center text-ctp-subtext0">
                  <p className="mb-2">
                    Aucun compte en {bankAccount.currency} disponible.
                  </p>
                  <button
                    onClick={() => setShowCreateNew(true)}
                    className="text-ctp-blue hover:underline"
                  >
                    Creer un nouveau compte
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ctp-surface1 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            onClick={handleLink}
            disabled={
              isLoading ||
              (!selectedAccountId && !showCreateNew) ||
              (showCreateNew && !newAccountName.trim())
            }
            className="btn-primary flex-1"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            {showCreateNew ? 'Creer et lier' : 'Lier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LinkAccountModal;
