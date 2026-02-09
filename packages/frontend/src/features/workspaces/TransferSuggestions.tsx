// ============================================================================
// TRANSFER SUGGESTIONS - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { CheckCircle, Check, Lightbulb } from 'lucide-react';
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
    'bg-ctp-blue',
    'bg-ctp-green',
    'bg-ctp-mauve',
    'bg-ctp-peach',
    'bg-ctp-pink',
    'bg-ctp-teal',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? 'bg-ctp-blue';
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
        <CheckCircle className="w-10 h-10 mx-auto mb-3 text-ctp-green" />
        <h3 className="text-lg font-semibold text-ctp-green">Tout est équilibré !</h3>
        <p className="text-ctp-subtext0 mt-1">
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
          <p className="text-sm text-ctp-subtext0">
            {transfers.length} transfert{transfers.length > 1 ? 's' : ''} pour équilibrer les comptes
          </p>
        </div>
        {allCompleted && (
          <span className="px-3 py-1 bg-ctp-green/20 text-ctp-green rounded-full text-sm font-medium">
            Tout réglé
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
                  ? 'border-ctp-green bg-ctp-green/10 opacity-60'
                  : 'border-ctp-surface1 hover:border-ctp-blue'
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
                  <div className="h-0.5 w-8 bg-ctp-surface2" />
                  <div className="px-3 py-1 bg-ctp-blue/20 rounded-full">
                    <span className="font-bold text-ctp-blue">
                      {formatCurrency(transfer.amount, currency)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-0.5 w-8 bg-ctp-surface2" />
                    <span className="text-ctp-overlay1">→</span>
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
                    ? 'bg-ctp-green border-ctp-green text-white'
                    : 'border-ctp-surface2'
                )}
              >
                {isCompleted && <Check className="w-4 h-4" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-ctp-blue/10 rounded-lg">
        <p className="text-sm text-ctp-blue flex items-start gap-2">
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Cliquez sur un transfert pour le marquer comme effectué. Ces transferts minimisent le nombre d'échanges nécessaires.</span>
        </p>
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-ctp-surface1">
        <div className="flex justify-between items-center">
          <span className="text-ctp-subtext0">Total à transférer</span>
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
