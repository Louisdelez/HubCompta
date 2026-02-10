// ============================================================================
// FAMILY INVITE MODAL - Finance Hub
// Simplified invitation for family members with spending limits
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Users,
  X,
  Mail,
  Loader2,
  Shield,
  Wallet,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface FamilyInviteModalProps {
  workspaceId: string;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FamilyInviteModal({ workspaceId, onClose }: FamilyInviteModalProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [enableSpendingLimit, setEnableSpendingLimit] = useState(false);
  const [spendingLimit, setSpendingLimit] = useState('500');
  const [requireApproval, setRequireApproval] = useState(false);
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set());
  const [showCategoryRestriction, setShowCategoryRestriction] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () =>
      api.get<Category[]>(`/workspaces/${workspaceId}/categories`),
    enabled: showCategoryRestriction,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: {
      email: string;
      displayName: string;
      role: string;
      spendingLimit?: number;
      approvalRequired?: boolean;
      visibleCategories?: string[];
    }) => api.post(`/workspaces/${workspaceId}/members/invite`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({
      email,
      displayName,
      role: 'family_member',
      ...(enableSpendingLimit && { spendingLimit: parseFloat(spendingLimit) }),
      approvalRequired: requireApproval,
      ...(showCategoryRestriction && {
        visibleCategories: Array.from(visibleCategories),
      }),
    });
  };

  const toggleCategory = (categoryId: string) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ctp-surface1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Inviter un membre famille
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ctp-surface0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext0 mb-1">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-subtext0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-text pl-10 w-full"
                placeholder="membre@exemple.com"
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext0 mb-1">
              Nom affiche
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="input-text w-full"
              placeholder="Prenom ou surnom"
            />
          </div>

          {/* Info Box */}
          <div className="bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg p-3">
            <p className="text-sm text-ctp-subtext0">
              Les membres famille peuvent voir les transactions et ajouter des
              depenses, mais ne peuvent pas modifier les parametres.
            </p>
          </div>

          {/* Spending Limit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-ctp-subtext0" />
                <span className="text-sm font-medium">Limite de depenses</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableSpendingLimit(!enableSpendingLimit)}
                className={clsx(
                  'w-10 h-6 rounded-full transition-colors relative',
                  enableSpendingLimit ? 'bg-ctp-blue' : 'bg-ctp-surface1'
                )}
              >
                <div
                  className={clsx(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    enableSpendingLimit ? 'translate-x-5' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {enableSpendingLimit && (
              <div>
                <label className="block text-xs text-ctp-subtext0 mb-1">
                  Limite mensuelle
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={spendingLimit}
                    onChange={(e) => setSpendingLimit(e.target.value)}
                    min={0}
                    step={50}
                    className="input-text w-full pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                    EUR
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[200, 500, 1000, 2000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setSpendingLimit(amount.toString())}
                      className={clsx(
                        'flex-1 py-1 text-xs rounded-md transition-colors',
                        spendingLimit === amount.toString()
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
          </div>

          {/* Approval Required */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-ctp-subtext0" />
              <span className="text-sm font-medium">Approbation requise</span>
            </div>
            <button
              type="button"
              onClick={() => setRequireApproval(!requireApproval)}
              className={clsx(
                'w-10 h-6 rounded-full transition-colors relative',
                requireApproval ? 'bg-ctp-blue' : 'bg-ctp-surface1'
              )}
            >
              <div
                className={clsx(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  requireApproval ? 'translate-x-5' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          {requireApproval && (
            <p className="text-xs text-ctp-subtext0 -mt-2">
              Les depenses devront etre approuvees avant d'etre enregistrees.
            </p>
          )}

          {/* Category Restriction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showCategoryRestriction ? (
                  <Eye className="w-4 h-4 text-ctp-subtext0" />
                ) : (
                  <EyeOff className="w-4 h-4 text-ctp-subtext0" />
                )}
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
              <div className="max-h-40 overflow-y-auto bg-ctp-surface0 rounded-lg p-2">
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
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                        visibleCategories.has(category.id)
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
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-ctp-surface1 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!email || !displayName || inviteMutation.isPending}
            className="btn-primary flex-1"
          >
            {inviteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Envoyer l'invitation
          </button>
        </div>
      </div>
    </div>
  );
}

export default FamilyInviteModal;
