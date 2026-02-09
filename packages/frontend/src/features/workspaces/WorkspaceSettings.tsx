// ============================================================================
// WORKSPACE SETTINGS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceSettings {
  fiscalYearStart: string;
  dateFormat: string;
  decimalSeparator: string;
  enableProMode: boolean;
  enableInvestMode: boolean;
}

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'family' | 'flatshare' | 'company';
  currency: string;
  settings: WorkspaceSettings;
  stats: {
    accounts: number;
    transactions: number;
    documents: number;
  };
}

interface WorkspaceFormData {
  name: string;
  currency: string;
  fiscalYearStart: string;
  dateFormat: string;
  decimalSeparator: string;
  enableProMode: boolean;
  enableInvestMode: boolean;
}

interface WorkspaceSettingsProps {
  workspaceId: string;
  currentUserRole: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const CURRENCIES = [
  { value: 'EUR', label: 'Euro' },
  { value: 'USD', label: '$ Dollar US' },
  { value: 'GBP', label: 'Livre Sterling' },
  { value: 'CHF', label: 'CHF Franc Suisse' },
];

const WORKSPACE_TYPE_LABELS: Record<Workspace['type'], string> = {
  personal: 'Personnel',
  family: 'Famille',
  flatshare: 'Colocation',
  company: 'Entreprise',
};

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
];

const DECIMAL_SEPARATORS = [
  { value: ',', label: 'Virgule (1 234,56)' },
  { value: '.', label: 'Point (1,234.56)' },
];

const FISCAL_YEAR_MONTHS = [
  { value: '01-01', label: 'Janvier' },
  { value: '04-01', label: 'Avril' },
  { value: '07-01', label: 'Juillet' },
  { value: '10-01', label: 'Octobre' },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WorkspaceSettings({
  workspaceId,
  currentUserRole,
}: WorkspaceSettingsProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canEdit = ['owner', 'admin'].includes(currentUserRole);
  const isOwner = currentUserRole === 'owner';

  // Fetch workspace
  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<Workspace>(`/workspaces/${workspaceId}`),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<WorkspaceFormData>({
    defaultValues: workspace
      ? {
          name: workspace.name,
          currency: workspace.currency,
          fiscalYearStart: workspace.settings.fiscalYearStart,
          dateFormat: workspace.settings.dateFormat,
          decimalSeparator: workspace.settings.decimalSeparator,
          enableProMode: workspace.settings.enableProMode,
          enableInvestMode: workspace.settings.enableInvestMode,
        }
      : {
          name: '',
          currency: 'EUR',
          fiscalYearStart: '01-01',
          dateFormat: 'DD/MM/YYYY',
          decimalSeparator: ',',
          enableProMode: false,
          enableInvestMode: false,
        },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: WorkspaceFormData) =>
      api.patch(`/workspaces/${workspaceId}`, {
        name: data.name,
        currency: data.currency,
        settings: {
          fiscalYearStart: data.fiscalYearStart,
          dateFormat: data.dateFormat,
          decimalSeparator: data.decimalSeparator,
          enableProMode: data.enableProMode,
          enableInvestMode: data.enableInvestMode,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setSuccess('Paramètres enregistrés');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      window.location.href = '/';
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setShowDeleteConfirm(false);
    },
  });

  const onSubmit = (data: WorkspaceFormData) => {
    setError(null);
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-32 bg-ctp-surface1 rounded" />
          <div className="h-32 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6">
        <p className="text-ctp-subtext0">Espace non trouvé</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-ctp-subtext0">
          {WORKSPACE_TYPE_LABELS[workspace.type]}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-ctp-green/10 text-ctp-green text-sm">
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Statistiques</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-ctp-blue">{workspace.stats.accounts}</p>
            <p className="text-sm text-ctp-subtext0">Comptes</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-ctp-blue">{workspace.stats.transactions}</p>
            <p className="text-sm text-ctp-subtext0">Transactions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-ctp-blue">{workspace.stats.documents}</p>
            <p className="text-sm text-ctp-subtext0">Documents</p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }} className="space-y-6">
        {/* General */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Général</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Nom de l&apos;espace
              </label>
              <input
                id="name"
                type="text"
                className="input"
                disabled={!canEdit}
                {...register('name', { required: 'Nom requis' })}
              />
              {errors.name && (
                <p className="error-text">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="currency" className="label">
                Devise
              </label>
              <select
                id="currency"
                className="input"
                disabled={!canEdit}
                {...register('currency')}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Format */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Format</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="dateFormat" className="label">
                Format de date
              </label>
              <select
                id="dateFormat"
                className="input"
                disabled={!canEdit}
                {...register('dateFormat')}
              >
                {DATE_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="decimalSeparator" className="label">
                Séparateur décimal
              </label>
              <select
                id="decimalSeparator"
                className="input"
                disabled={!canEdit}
                {...register('decimalSeparator')}
              >
                {DECIMAL_SEPARATORS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fiscalYearStart" className="label">
                Début de l&apos;année fiscale
              </label>
              <select
                id="fiscalYearStart"
                className="input"
                disabled={!canEdit}
                {...register('fiscalYearStart')}
              >
                {FISCAL_YEAR_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Fonctionnalités</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-ctp-surface2 text-ctp-blue focus:ring-ctp-blue"
                disabled={!canEdit}
                {...register('enableProMode')}
              />
              <div>
                <p className="font-medium">Mode Pro</p>
                <p className="text-sm text-ctp-subtext0">
                  Facturation, devis, clients et fournisseurs
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-ctp-surface2 text-ctp-blue focus:ring-ctp-blue"
                disabled={!canEdit}
                {...register('enableInvestMode')}
              />
              <div>
                <p className="font-medium">Mode Investissement</p>
                <p className="text-sm text-ctp-subtext0">
                  Suivi de portefeuille et cours des marchés
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Save button */}
        {canEdit && (
          <button
            type="submit"
            disabled={!isDirty || updateMutation.isPending}
            className="btn-primary w-full"
          >
            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        )}
      </form>

      {/* Danger Zone */}
      {isOwner && (
        <div className="card border-ctp-red">
          <h2 className="text-lg font-semibold text-ctp-red mb-4">
            Zone dangereuse
          </h2>

          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Supprimer l&apos;espace</p>
                <p className="text-sm text-ctp-subtext0">
                  Cette action est irréversible
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger"
              >
                Supprimer
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-ctp-red/10 rounded-lg">
                <p className="text-ctp-red font-medium mb-2">
                  Attention !
                </p>
                <p className="text-sm text-ctp-red/80">
                  Vous êtes sur le point de supprimer cet espace et toutes ses données :
                </p>
                <ul className="text-sm text-ctp-red/80 mt-2 list-disc list-inside">
                  <li>{workspace.stats.accounts} compte(s)</li>
                  <li>{workspace.stats.transactions} transaction(s)</li>
                  <li>{workspace.stats.documents} document(s)</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  onClick={() => { void deleteMutation.mutateAsync(); }}
                  disabled={deleteMutation.isPending}
                  className="btn-danger flex-1"
                >
                  {deleteMutation.isPending ? 'Suppression...' : 'Confirmer la suppression'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkspaceSettings;
