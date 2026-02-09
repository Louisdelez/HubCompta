// ============================================================================
// TAX DEDUCTION MODAL - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Briefcase, Heart, Gift, MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Document {
  id: string;
  filename: string;
}

interface TaxDeductionModalProps {
  workspaceId: string;
  year: number;
  onClose: () => void;
  onSave: () => void;
}

type DeductionCategory = 'professional' | 'medical' | 'charitable' | 'other';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const categories: { value: DeductionCategory; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'professional',
    label: 'Frais professionnels',
    icon: <Briefcase className="w-5 h-5" />,
    description: 'Materiel, formation, deplacements...',
  },
  {
    value: 'medical',
    label: 'Frais medicaux',
    icon: <Heart className="w-5 h-5" />,
    description: 'Soins non rembourses, mutuelle...',
  },
  {
    value: 'charitable',
    label: 'Dons',
    icon: <Gift className="w-5 h-5" />,
    description: 'Dons aux associations...',
  },
  {
    value: 'other',
    label: 'Autres',
    icon: <MoreHorizontal className="w-5 h-5" />,
    description: 'Autres deductions eligibles',
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TaxDeductionModal({ workspaceId, year, onClose, onSave }: TaxDeductionModalProps) {
  const [category, setCategory] = useState<DeductionCategory>('professional');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents for linking
  const { data: documents } = useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: () => api.get<Document[]>(`/workspaces/${workspaceId}/documents?status=inbox`),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/tax/${year}/deductions`, {
        category,
        description,
        amount: parseFloat(amount),
        documentId: documentId || undefined,
      }),
    onSuccess: onSave,
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError('Entrez une description');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Entrez un montant valide');
      return;
    }

    saveMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deduction-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full animate-scale-in">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 id="deduction-modal-title" className="text-xl font-bold mb-4">
            Nouvelle deduction
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className="label">Categorie</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      category === cat.value
                        ? 'border-ctp-mauve bg-ctp-mauve/10'
                        : 'border-ctp-surface1 hover:bg-ctp-surface0'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={category === cat.value ? 'text-ctp-mauve' : 'text-ctp-text'}>
                        {cat.icon}
                      </span>
                      <span className="font-medium text-sm">{cat.label}</span>
                    </div>
                    <p className="text-xs text-ctp-subtext0">{cat.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="label">
                Description <span className="text-ctp-red">*</span>
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Achat ordinateur portable"
                className="input"
                required
              />
            </div>

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
                  placeholder="500.00"
                  className="input pr-12"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                  EUR
                </span>
              </div>
            </div>

            {/* Document Link */}
            <div>
              <label htmlFor="document" className="label">
                Justificatif (optionnel)
              </label>
              <select
                id="document"
                value={documentId ?? ''}
                onChange={(e) => setDocumentId(e.target.value || null)}
                className="input"
              >
                <option value="">Aucun document</option>
                {documents?.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ctp-subtext0 mt-1">
                Liez un justificatif depuis vos documents
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
              {saveMutation.isPending ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaxDeductionModal;
