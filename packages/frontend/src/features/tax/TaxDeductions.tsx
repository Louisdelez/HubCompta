// ============================================================================
// TAX DEDUCTIONS - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileText, Briefcase, Heart, Gift, MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api/client';
import { TaxDeductionModal } from './TaxDeductionModal';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TaxDeduction {
  id: string;
  category: string;
  description: string;
  amount: number;
  documentId?: string;
  document?: {
    id: string;
    filename: string;
  };
  createdAt: string;
}

interface TaxDeductionsProps {
  workspaceId: string;
  year: number;
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

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  professional: {
    label: 'Frais professionnels',
    icon: <Briefcase className="w-4 h-4" />,
    color: 'text-ctp-blue bg-ctp-blue/10',
  },
  medical: {
    label: 'Frais medicaux',
    icon: <Heart className="w-4 h-4" />,
    color: 'text-ctp-green bg-ctp-green/10',
  },
  charitable: {
    label: 'Dons',
    icon: <Gift className="w-4 h-4" />,
    color: 'text-ctp-mauve bg-ctp-mauve/10',
  },
  other: {
    label: 'Autres',
    icon: <MoreHorizontal className="w-4 h-4" />,
    color: 'text-ctp-overlay1 bg-ctp-surface1',
  },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TaxDeductions({ workspaceId, year }: TaxDeductionsProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Fetch deductions
  const { data: deductions, isLoading } = useQuery({
    queryKey: ['tax', workspaceId, year, 'deductions'],
    queryFn: () => api.get<TaxDeduction[]>(`/workspaces/${workspaceId}/tax/${year}/deductions`),
    enabled: !!workspaceId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (dedId: string) =>
      api.delete(`/workspaces/${workspaceId}/tax/${year}/deductions/${dedId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tax', workspaceId, year] });
    },
  });

  const handleDelete = (dedId: string, description: string) => {
    if (confirm(`Supprimer la deduction "${description}" ?`)) {
      deleteMutation.mutate(dedId);
    }
  };

  const handleSave = () => {
    void queryClient.invalidateQueries({ queryKey: ['tax', workspaceId, year] });
    setShowModal(false);
  };

  // Calculate total
  const total = deductions?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  // Group by category
  const groupedDeductions = deductions?.reduce((acc, d) => {
    const existing = acc[d.category];
    if (!existing) {
      acc[d.category] = [d];
    } else {
      existing.push(d);
    }
    return acc;
  }, {} as Record<string, TaxDeduction[]>) ?? {};

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-ctp-surface1 rounded w-1/4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-ctp-surface1 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Deductions declarees</h2>
          <p className="text-sm text-ctp-subtext0">
            Total : <span className="font-medium text-ctp-blue">{formatCurrency(total)}</span>
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Deductions List */}
      {Object.keys(groupedDeductions).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedDeductions).map(([category, items]) => {
            const configEntry = categoryConfig[category];
            const config = configEntry ?? categoryConfig.other;
            if (!config) return null;
            const categoryTotal = items.reduce((sum, d) => sum + d.amount, 0);

            return (
              <div key={category} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${config.color}`}>
                      {config.icon}
                    </span>
                    <h3 className="font-medium">{config.label}</h3>
                    <span className="text-sm text-ctp-subtext0">({items.length})</span>
                  </div>
                  <span className="font-medium text-ctp-blue">{formatCurrency(categoryTotal)}</span>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {items.map((deduction) => (
                    <div
                      key={deduction.id}
                      className="card flex items-center justify-between py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{deduction.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-ctp-subtext0">
                          {deduction.document && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {deduction.document.filename}
                            </span>
                          )}
                          <span>
                            {new Date(deduction.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="font-bold text-ctp-blue">
                          {formatCurrency(deduction.amount)}
                        </span>
                        <button
                          onClick={() => handleDelete(deduction.id, deduction.description)}
                          className="btn-ghost text-ctp-red p-1"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <h3 className="text-xl font-bold mb-2">Aucune deduction</h3>
          <p className="text-ctp-subtext0 mb-6">
            Ajoutez vos frais deductibles pour reduire votre impot
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Ajouter une deduction
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-ctp-blue/5 border border-ctp-blue/20">
        <h4 className="font-medium text-ctp-blue mb-2">Abattement forfaitaire</h4>
        <p className="text-sm text-ctp-subtext0">
          Si vous ne declarez pas de frais professionnels reels, un abattement forfaitaire de 10%
          est automatiquement applique (min. 495 EUR, max. 14 171 EUR).
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <TaxDeductionModal
          workspaceId={workspaceId}
          year={year}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default TaxDeductions;
