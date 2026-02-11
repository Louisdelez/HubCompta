// ============================================================================
// PENDING APPROVALS - Finance Hub
// Display and manage transactions pending approval in family workspaces
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  User,
  Calendar,
  Wallet,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PendingTransaction {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string;
  requestedBy: {
    id: string;
    displayName: string;
    email: string;
  };
  createdAt: string;
}

interface PendingApprovalsProps {
  workspaceId: string;
  compact?: boolean;
  limit?: number;
  showHeader?: boolean;
  onApprovalChange?: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PendingApprovals({
  workspaceId,
  compact = false,
  limit,
  showHeader = true,
  onApprovalChange,
}: PendingApprovalsProps) {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch pending approvals
  const { data: pendingTransactions, isLoading, error, refetch } = useQuery({
    queryKey: ['pending-approvals', workspaceId],
    queryFn: () =>
      api.get<PendingTransaction[]>(
        `/workspaces/${workspaceId}/transactions/pending-approval${limit ? `?limit=${limit}` : ''}`
      ),
    enabled: !!workspaceId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (transactionId: string) =>
      api.post(`/workspaces/${workspaceId}/transactions/${transactionId}/approve`),
    onMutate: (transactionId) => {
      setProcessingId(transactionId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-approvals', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onApprovalChange?.();
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (transactionId: string) =>
      api.post(`/workspaces/${workspaceId}/transactions/${transactionId}/reject`),
    onMutate: (transactionId) => {
      setProcessingId(transactionId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-approvals', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onApprovalChange?.();
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const handleApprove = (transactionId: string) => {
    approveMutation.mutate(transactionId);
  };

  const handleReject = (transactionId: string) => {
    if (confirm('Rejeter cette transaction ? Elle sera supprimee.')) {
      rejectMutation.mutate(transactionId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-ctp-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-ctp-red/10 border border-ctp-red/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-ctp-red">
          <AlertTriangle className="w-5 h-5" />
          <span>Erreur lors du chargement des approbations</span>
        </div>
        <button
          onClick={() => void refetch()}
          className="mt-2 text-sm text-ctp-blue hover:underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Reessayer
        </button>
      </div>
    );
  }

  const transactions = pendingTransactions ?? [];

  if (transactions.length === 0) {
    return (
      <div className={clsx('text-center py-6', compact && 'py-4')}>
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-ctp-green/10 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-ctp-green" />
        </div>
        <p className="text-ctp-subtext0 text-sm">
          Aucune transaction en attente d'approbation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-ctp-yellow" />
            <h3 className="font-semibold text-ctp-text">
              Approbations en attente ({transactions.length})
            </h3>
          </div>
          <button
            onClick={() => void refetch()}
            className="btn-ghost p-1"
            title="Actualiser"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Transactions list */}
      <div className="space-y-2">
        {transactions.map((transaction) => {
          const isProcessing = processingId === transaction.id;

          return (
            <div
              key={transaction.id}
              className={clsx(
                'rounded-lg border bg-ctp-surface0/50 transition-all',
                isProcessing
                  ? 'border-ctp-blue/50 opacity-75'
                  : 'border-ctp-surface0 hover:border-ctp-surface1'
              )}
            >
              <div className={clsx('p-3', compact && 'p-2')}>
                {/* Main content */}
                <div className="flex items-start gap-3">
                  {/* Category icon or default */}
                  <div
                    className={clsx(
                      'rounded-lg bg-ctp-yellow/10 flex items-center justify-center flex-shrink-0',
                      compact ? 'w-8 h-8' : 'w-10 h-10'
                    )}
                  >
                    {transaction.categoryIcon ? (
                      <span className={compact ? 'text-sm' : 'text-base'}>
                        {transaction.categoryIcon}
                      </span>
                    ) : (
                      <Wallet className={clsx('text-ctp-yellow', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={clsx(
                          'font-medium truncate text-ctp-text',
                          compact && 'text-sm'
                        )}
                      >
                        {transaction.description}
                      </p>
                      <span
                        className={clsx(
                          'font-semibold text-ctp-red flex-shrink-0',
                          compact ? 'text-sm' : 'text-base'
                        )}
                      >
                        -{formatCurrency(transaction.amount, transaction.currency)}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-ctp-subtext0">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {transaction.requestedBy.displayName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(transaction.date)}
                      </span>
                      {transaction.categoryName && (
                        <span className="truncate">{transaction.categoryName}</span>
                      )}
                    </div>

                    {/* Time ago */}
                    {!compact && (
                      <p className="text-xs text-ctp-overlay1 mt-1">
                        Demande{' '}
                        {formatDistanceToNow(new Date(transaction.createdAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-ctp-surface1">
                  <button
                    onClick={() => handleApprove(transaction.id)}
                    disabled={isProcessing}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors',
                      'bg-ctp-green/10 text-ctp-green hover:bg-ctp-green/20',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      compact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    {isProcessing && approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approuver
                  </button>
                  <button
                    onClick={() => handleReject(transaction.id)}
                    disabled={isProcessing}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors',
                      'bg-ctp-red/10 text-ctp-red hover:bg-ctp-red/20',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      compact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    {isProcessing && rejectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View all link if limited */}
      {limit && transactions.length >= limit && (
        <div className="text-center pt-2">
          <a
            href={`/workspaces/${workspaceId}/approvals`}
            className="text-sm text-ctp-blue hover:underline"
          >
            Voir toutes les demandes
          </a>
        </div>
      )}
    </div>
  );
}

export default PendingApprovals;
