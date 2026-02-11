// ============================================================================
// SPENDING LIMIT FORM - Finance Hub
// Set and manage spending limits per member
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Wallet, Loader2, AlertTriangle, Check, Shield, Eye } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface SpendingLimitFormProps {
  workspaceId: string;
  memberId: string;
  memberName: string;
  currentLimit: number | null;
  currentSpent: number;
  approvalRequired?: boolean;
  visibleCategories?: string[];
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SpendingLimitForm({
  workspaceId,
  memberId,
  memberName,
  currentLimit,
  currentSpent,
  approvalRequired: initialApprovalRequired = false,
  visibleCategories: initialVisibleCategories = [],
  onClose,
}: SpendingLimitFormProps) {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(currentLimit?.toString() ?? '');
  const [enabled, setEnabled] = useState(currentLimit !== null);
  const [approval, setApproval] = useState(initialApprovalRequired);
  const [showCategoryRestriction, setShowCategoryRestriction] = useState(initialVisibleCategories.length > 0);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(initialVisibleCategories));

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories`),
    enabled: showCategoryRestriction,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { spendingLimit?: number | null; approvalRequired?: boolean; visibleCategories?: string[] }) =>
      api.patch(`/workspaces/${workspaceId}/members/${memberId}/settings`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      spendingLimit: enabled ? parseFloat(limit) : null,
      approvalRequired: approval,
      visibleCategories: showCategoryRestriction ? Array.from(selectedCategories) : [],
    });
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const percentUsed = currentLimit
    ? Math.min((currentSpent / currentLimit) * 100, 100)
    : 0;
  const isOverLimit = currentLimit ? currentSpent > currentLimit : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-sm w-full">
        {/* Header */}
        <div className="p-4 border-b border-ctp-surface1">
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Limite de depenses
          </h3>
          <p className="text-sm text-ctp-subtext0">{memberName}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Current Status */}
          {currentLimit !== null && (
            <div className="bg-ctp-surface0 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-ctp-subtext0">Depense ce mois</span>
                <span
                  className={clsx(
                    'font-medium',
                    isOverLimit ? 'text-ctp-red' : 'text-ctp-text'
                  )}
                >
                  {formatCurrency(currentSpent)} / {formatCurrency(currentLimit)}
                </span>
              </div>
              <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full transition-all',
                    isOverLimit
                      ? 'bg-ctp-red'
                      : percentUsed >= 80
                      ? 'bg-ctp-yellow'
                      : 'bg-ctp-green'
                  )}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              {isOverLimit && (
                <div className="flex items-center gap-2 mt-2 text-ctp-red text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  Limite depassee de {formatCurrency(currentSpent - currentLimit)}
                </div>
              )}
            </div>
          )}

          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Activer la limite</span>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={clsx(
                'w-10 h-6 rounded-full transition-colors relative',
                enabled ? 'bg-ctp-blue' : 'bg-ctp-surface1'
              )}
            >
              <div
                className={clsx(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  enabled ? 'translate-x-5' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Limit Input */}
          {enabled && (
            <div>
              <label className="block text-sm text-ctp-subtext0 mb-1">
                Limite mensuelle
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  min={0}
                  step={50}
                  required={enabled}
                  className="input-text w-full pr-12"
                  placeholder="500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                  EUR
                </span>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2 mt-2">
                {[200, 500, 1000, 2000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setLimit(amount.toString())}
                    className={clsx(
                      'flex-1 py-1 text-xs rounded-md transition-colors',
                      limit === amount.toString()
                        ? 'bg-ctp-blue text-ctp-base'
                        : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
                    )}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Warning if reducing limit below spent */}
          {enabled && limit && parseFloat(limit) < currentSpent && (
            <div className="bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-ctp-yellow flex-shrink-0 mt-0.5" />
                <p className="text-ctp-subtext0">
                  La nouvelle limite ({formatCurrency(parseFloat(limit))}) est
                  inferieure aux depenses actuelles ({formatCurrency(currentSpent)}).
                </p>
              </div>
            </div>
          )}

          {/* Approval Required */}
          <div className="flex items-center justify-between pt-2 border-t border-ctp-surface1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-ctp-subtext0" />
              <span className="text-sm font-medium">Approbation requise</span>
            </div>
            <button
              type="button"
              onClick={() => setApproval(!approval)}
              className={clsx(
                'w-10 h-6 rounded-full transition-colors relative',
                approval ? 'bg-ctp-mauve' : 'bg-ctp-surface1'
              )}
            >
              <div
                className={clsx(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  approval ? 'translate-x-5' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          {approval && (
            <p className="text-xs text-ctp-subtext0">
              Les depenses devront etre approuvees avant d'etre enregistrees.
            </p>
          )}

          {/* Category Restriction */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-ctp-subtext0" />
              <span className="text-sm font-medium">Limiter les categories</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCategoryRestriction(!showCategoryRestriction)}
              className={clsx(
                'w-10 h-6 rounded-full transition-colors relative',
                showCategoryRestriction ? 'bg-ctp-blue' : 'bg-ctp-surface1'
              )}
            >
              <div
                className={clsx(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  showCategoryRestriction ? 'translate-x-5' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {showCategoryRestriction && categories.length > 0 && (
            <div className="max-h-32 overflow-y-auto bg-ctp-surface0 rounded-lg p-2">
              <p className="text-xs text-ctp-subtext0 mb-2">
                Selectionnez les categories visibles
              </p>
              <div className="grid grid-cols-2 gap-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={clsx(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                      selectedCategories.has(category.id)
                        ? 'bg-ctp-blue/20 text-ctp-blue'
                        : 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2'
                    )}
                  >
                    {category.icon && <span>{category.icon}</span>}
                    <span className="truncate">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-ctp-surface1 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending || (enabled && !limit)}
            className="btn-primary flex-1"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpendingLimitForm;
