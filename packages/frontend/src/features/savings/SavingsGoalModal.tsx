// ============================================================================
// SAVINGS GOAL MODAL - Finance Hub
// Create/edit modal with icon picker
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Account {
  id: string;
  name: string;
  icon: string | null;
  type: string;
  currency: string;
}

interface SavingsGoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string | null;
  icon: string | null;
  color: string | null;
  accountId: string | null;
  isCompleted: boolean;
}

interface SavingsGoalModalProps {
  workspaceId: string;
  goal?: SavingsGoalWithProgress | null;
  onClose: () => void;
  onSave: () => void;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const GOAL_ICONS = [
  // Savings
  '💰', '🏦', '💵', '💎', '🪙',
  // Travel
  '✈️', '🏖️', '🌍', '🗺️', '🚗',
  // Home
  '🏠', '🏡', '🛋️', '🔑', '🏗️',
  // Education
  '📚', '🎓', '💻', '📝', '🎨',
  // Health
  '🏥', '💪', '🏋️', '🧘', '🧠',
  // Family
  '👶', '👨‍👩‍👧', '❤️', '💒', '🎂',
  // Other
  '🎯', '🚀', '⭐', '🏆', '🎁',
];

const GOAL_COLORS = [
  '#a6e3a1', // Green (ctp-green)
  '#89dceb', // Sky (ctp-sky)
  '#89b4fa', // Blue (ctp-blue)
  '#cba6f7', // Mauve (ctp-mauve)
  '#f38ba8', // Red (ctp-red)
  '#fab387', // Peach (ctp-peach)
  '#f9e2af', // Yellow (ctp-yellow)
  '#94e2d5', // Teal (ctp-teal)
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SavingsGoalModal({
  workspaceId,
  goal,
  onClose,
  onSave,
}: SavingsGoalModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!goal;

  const [name, setName] = useState(goal?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount?.toString() ?? '');
  const [targetDate, setTargetDate] = useState(
    goal?.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : ''
  );
  const [icon, setIcon] = useState(goal?.icon ?? '');
  const [color, setColor] = useState(goal?.color ?? '');
  const [accountId, setAccountId] = useState(goal?.accountId ?? '');
  const [error, setError] = useState<string | null>(null);

  // Fetch savings accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  const savingsAccounts = accounts?.filter(
    (a) => a.type === 'savings' || a.type === 'checking'
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        name,
        targetAmount: parseFloat(targetAmount),
        targetDate: targetDate || null,
        icon: icon || null,
        color: color || null,
        accountId: accountId || null,
      };

      if (isEditing) {
        return api.patch(`/workspaces/${workspaceId}/savings/${goal.id}`, data);
      }
      return api.post(`/workspaces/${workspaceId}/savings`, data);
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

    if (!name.trim()) {
      setError("Entrez un nom pour l'objectif");
      return;
    }
    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      setError('Entrez un montant cible valide');
      return;
    }

    saveMutation.mutate();
  };

  const modalTitle = isEditing ? "Modifier l'objectif" : 'Nouvel objectif';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <form onSubmit={handleSubmit} className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 id="goal-modal-title" className="text-xl font-bold">
              {modalTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-ctp-surface1 text-ctp-subtext0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Icon Picker */}
            <div>
              <label className="label">Icone</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(icon === emoji ? '' : emoji)}
                    className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 transition-all ${
                      icon === emoji
                        ? 'border-ctp-blue bg-ctp-blue/20'
                        : 'border-ctp-surface1 hover:border-ctp-surface2'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="label">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(color === c ? '' : c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c ? 'border-ctp-text scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="label">
                Nom de l'objectif <span className="text-ctp-red">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Vacances en Italie"
                className="input"
                required
              />
            </div>

            {/* Target Amount */}
            <div>
              <label htmlFor="targetAmount" className="label">
                Montant cible <span className="text-ctp-red">*</span>
              </label>
              <div className="relative">
                <input
                  id="targetAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="5000.00"
                  className="input pr-12"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                  EUR
                </span>
              </div>
            </div>

            {/* Target Date */}
            <div>
              <label htmlFor="targetDate" className="label">
                Date cible (optionnel)
              </label>
              <input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="input"
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-ctp-subtext0 mt-1">
                Permet de suivre si vous etes en bonne voie
              </p>
            </div>

            {/* Linked Account */}
            <div>
              <label htmlFor="accountId" className="label">
                Compte lie (optionnel)
              </label>
              <select
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="input"
              >
                <option value="">Aucun compte</option>
                {savingsAccounts?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ctp-subtext0 mt-1">
                Liez un compte epargne pour suivre automatiquement
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="btn-primary flex-1"
            >
              {saveMutation.isPending
                ? 'Enregistrement...'
                : isEditing
                  ? 'Enregistrer'
                  : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SavingsGoalModal;
