// ============================================================================
// CONTRIBUTION MODAL - Finance Hub
// Add contribution to savings goal
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SavingsGoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  remainingAmount: number;
  icon: string | null;
}

interface ContributionModalProps {
  workspaceId: string;
  goal: SavingsGoalWithProgress;
  onClose: () => void;
  onSave: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Quick contribution suggestions
function getSuggestions(remaining: number): number[] {
  const suggestions = [];

  // Standard amounts
  const standardAmounts = [10, 25, 50, 100, 200, 500];
  for (const amt of standardAmounts) {
    if (amt <= remaining * 1.5 && suggestions.length < 4) {
      suggestions.push(amt);
    }
  }

  // Add remaining if it's a round-ish number and different from suggestions
  if (remaining > 0 && !suggestions.includes(remaining)) {
    if (remaining <= 1000 || remaining === Math.round(remaining / 10) * 10) {
      suggestions.push(remaining);
    }
  }

  return [...new Set(suggestions)].slice(0, 4).sort((a, b) => a - b);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ContributionModal({
  workspaceId,
  goal,
  onClose,
  onSave,
}: ContributionModalProps) {
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const suggestions = getSuggestions(goal.remainingAmount);

  const contributeMutation = useMutation({
    mutationFn: () => {
      return api.post(`/workspaces/${workspaceId}/savings/${goal.id}/contribute`, {
        amount: parseFloat(amount),
        date,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['savings', workspaceId] });
      onSave();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Entrez un montant valide');
      return;
    }

    contributeMutation.mutate();
  };

  const handleSuggestionClick = (value: number) => {
    setAmount(value.toString());
  };

  const parsedAmount = parseFloat(amount) || 0;
  const newTotal = goal.currentAmount + parsedAmount;
  const newProgress = goal.targetAmount > 0
    ? Math.min(100, Math.round((newTotal / goal.targetAmount) * 100))
    : 0;
  const willComplete = newTotal >= goal.targetAmount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contribution-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full animate-scale-in">
        <form onSubmit={handleSubmit} className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {goal.icon && <span className="text-2xl">{goal.icon}</span>}
              <h2 id="contribution-modal-title" className="text-xl font-bold">
                Ajouter a {goal.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-ctp-surface1 text-ctp-subtext0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Progress */}
          <div className="bg-ctp-surface0 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-ctp-subtext0">Progression actuelle</span>
              <span className="font-medium text-ctp-text">
                {formatCurrency(goal.currentAmount, goal.currency)} / {formatCurrency(goal.targetAmount, goal.currency)}
              </span>
            </div>
            <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden">
              <div
                className="h-full bg-ctp-blue rounded-full transition-all"
                style={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label htmlFor="amount" className="label">
                Montant <span className="text-ctp-red">*</span>
              </label>
              <div className="relative">
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                  className="input pr-12 text-lg"
                  required
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                  {goal.currency}
                </span>
              </div>
            </div>

            {/* Quick Suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSuggestionClick(value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      parseFloat(amount) === value
                        ? 'bg-ctp-blue text-ctp-base'
                        : 'bg-ctp-surface1 text-ctp-text hover:bg-ctp-surface2'
                    }`}
                  >
                    {value === goal.remainingAmount ? (
                      <>Tout ({formatCurrency(value, goal.currency)})</>
                    ) : (
                      formatCurrency(value, goal.currency)
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Date */}
            <div>
              <label htmlFor="date" className="label">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="label">
                Notes (optionnel)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Bonus du mois"
                className="input resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Preview */}
          {parsedAmount > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-ctp-surface0 border border-ctp-surface1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-ctp-subtext0">Apres contribution</span>
                <span className="font-medium text-ctp-text">
                  {formatCurrency(newTotal, goal.currency)} ({newProgress}%)
                </span>
              </div>
              <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    willComplete ? 'bg-ctp-green' : 'bg-ctp-blue'
                  }`}
                  style={{ width: `${newProgress}%` }}
                />
              </div>
              {willComplete && (
                <p className="text-sm text-ctp-green mt-2 flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Objectif atteint !
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              type="submit"
              disabled={contributeMutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {contributeMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContributionModal;
