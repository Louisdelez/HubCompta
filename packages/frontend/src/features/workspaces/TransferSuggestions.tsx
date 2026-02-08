// ============================================================================
// TRANSFER SUGGESTIONS - Finance Hub
// ============================================================================

import { useState } from 'react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Transfer {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

interface TransferSuggestionsProps {
  transfers: Transfer[];
  currency: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? 'bg-blue-500';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TransferSuggestions({ transfers, currency }: TransferSuggestionsProps) {
  const [completedTransfers, setCompletedTransfers] = useState<Set<number>>(new Set());

  const toggleCompleted = (index: number) => {
    const newCompleted = new Set(completedTransfers);
    if (newCompleted.has(index)) {
      newCompleted.delete(index);
    } else {
      newCompleted.add(index);
    }
    setCompletedTransfers(newCompleted);
  };

  if (transfers.length === 0) {
    return (
      <div className="card text-center py-8">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-semibold text-success-600">Tout est équilibré !</h3>
        <p className="text-gray-500 mt-1">
          Personne ne doit d'argent à personne
        </p>
      </div>
    );
  }

  const allCompleted = completedTransfers.size === transfers.length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Transferts suggérés</h2>
          <p className="text-sm text-gray-500">
            {transfers.length} transfert{transfers.length > 1 ? 's' : ''} pour équilibrer les comptes
          </p>
        </div>
        {allCompleted && (
          <span className="px-3 py-1 bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300 rounded-full text-sm font-medium">
            ✓ Tout réglé
          </span>
        )}
      </div>

      <div className="space-y-3">
        {transfers.map((transfer, index) => {
          const isCompleted = completedTransfers.has(index);

          return (
            <div
              key={index}
              className={clsx(
                'flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer',
                isCompleted
                  ? 'border-success-300 bg-success-50 dark:bg-success-900/10 dark:border-success-700 opacity-60'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
              )}
              onClick={() => toggleCompleted(index)}
            >
              {/* From */}
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm',
                    getAvatarColor(transfer.from.name)
                  )}
                >
                  {getInitials(transfer.from.name)}
                </div>
                <span className="font-medium">{transfer.from.name}</span>
              </div>

              {/* Arrow */}
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-8 bg-gray-300 dark:bg-gray-600" />
                  <div className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                    <span className="font-bold text-primary-700 dark:text-primary-300">
                      {formatCurrency(transfer.amount, currency)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-0.5 w-8 bg-gray-300 dark:bg-gray-600" />
                    <span className="text-gray-400 dark:text-gray-500">→</span>
                  </div>
                </div>
              </div>

              {/* To */}
              <div className="flex items-center gap-2">
                <span className="font-medium">{transfer.to.name}</span>
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm',
                    getAvatarColor(transfer.to.name)
                  )}
                >
                  {getInitials(transfer.to.name)}
                </div>
              </div>

              {/* Checkbox */}
              <div
                className={clsx(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                  isCompleted
                    ? 'bg-success-500 border-success-500 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {isCompleted && <span className="text-sm">✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 Cliquez sur un transfert pour le marquer comme effectué. Ces transferts minimisent le nombre d'échanges nécessaires.
        </p>
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Total à transférer</span>
          <span className="text-xl font-bold">
            {formatCurrency(
              transfers.reduce((sum, t) => sum + t.amount, 0),
              currency
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TransferSuggestions;
