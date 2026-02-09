// ============================================================================
// LINK TO TRANSACTION - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Document {
  id: string;
  filename: string;
  mimeType: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
  account: {
    id: string;
    name: string;
  };
}

interface LinkToTransactionProps {
  workspaceId: string;
  document: Document;
  onClose: () => void;
  onLinked: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LinkToTransaction({
  workspaceId,
  document,
  onClose,
  onLinked,
}: LinkToTransactionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Fetch recent transactions
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', workspaceId, 'recent', searchQuery],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: '20',
        sortBy: 'date',
        sortOrder: 'desc',
      });
      if (searchQuery) params.append('search', searchQuery);
      return api.get<{ transactions: Transaction[]; total: number }>(
        `/workspaces/${workspaceId}/transactions?${params}`
      );
    },
    enabled: !!workspaceId,
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: (transactionId: string) =>
      api.post(`/workspaces/${workspaceId}/documents/${document.id}/link`, {
        transactionId,
      }),
    onSuccess: onLinked,
  });

  const handleLink = () => {
    if (selectedTransaction) {
      linkMutation.mutate(selectedTransaction.id);
    }
  };

  const transactions = data?.transactions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden animate-scale-in">
        <div className="p-6 border-b border-ctp-surface1">
          <h2 className="text-xl font-bold">Lier à une transaction</h2>
          <p className="text-sm text-ctp-subtext0 mt-1">
            Associez "{document.filename}" à une transaction
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-ctp-surface1">
          <input
            type="text"
            placeholder="Rechercher une transaction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-ctp-surface0 border border-ctp-surface1 text-ctp-text placeholder-ctp-overlay0 focus:border-ctp-blue focus:ring-2 focus:ring-ctp-blue/20 outline-none transition-colors"
            autoFocus
          />
        </div>

        {/* Transaction List */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-ctp-blue border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-ctp-subtext0">Chargement...</p>
            </div>
          ) : transactions.length > 0 ? (
            <div className="divide-y divide-ctp-surface1">
              {transactions.map((txn) => (
                <button
                  key={txn.id}
                  onClick={() => setSelectedTransaction(txn)}
                  className={clsx(
                    'w-full p-4 text-left hover:bg-ctp-surface0 transition-colors',
                    selectedTransaction?.id === txn.id &&
                      'bg-ctp-blue/10 ring-2 ring-ctp-blue'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {txn.category?.icon && (
                          <span>{txn.category.icon}</span>
                        )}
                        <p className="font-medium truncate">{txn.description}</p>
                      </div>
                      <p className="text-sm text-ctp-subtext0">
                        {formatDate(txn.date)} • {txn.account.name}
                      </p>
                    </div>
                    <p
                      className={clsx(
                        'font-bold whitespace-nowrap',
                        txn.amount >= 0 ? 'text-ctp-green' : ''
                      )}
                    >
                      {formatCurrency(txn.amount)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-ctp-subtext0">
                {searchQuery ? 'Aucun résultat' : 'Aucune transaction récente'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-ctp-surface1 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedTransaction || linkMutation.isPending}
            className="btn-primary flex-1"
          >
            {linkMutation.isPending ? 'Liaison...' : 'Lier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LinkToTransaction;
