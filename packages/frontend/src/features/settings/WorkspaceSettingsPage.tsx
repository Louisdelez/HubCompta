// ============================================================================
// WORKSPACE SETTINGS PAGE - Finance Hub
// Workspace configuration and settings
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Settings,
  FileText,
  Save,
  Loader2,
  RotateCcw,
  FolderOpen,
  Briefcase,
} from 'lucide-react';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceDetails {
  id: string;
  name: string;
  type: string;
  currency: string;
  settings: WorkspaceSettings;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    displayName: string | null;
  };
  _count: {
    accounts: number;
    transactions: number;
    categories: number;
    memberships: number;
  };
}

interface WorkspaceSettings {
  general: {
    defaultAccountId?: string;
    defaultCategoryId?: string;
    fiscalYearStart: number;
  };
  features: {
    proMode: boolean;
    investMode: boolean;
    budgets: boolean;
    tags: boolean;
    rules: boolean;
    documents: boolean;
  };
  import: {
    defaultDateFormat: string;
    defaultDelimiter: string;
    autoApplyRules: boolean;
    duplicateDetection: boolean;
  };
  pro: {
    companyName?: string;
    companyAddress?: string;
    companySiret?: string;
    companyVat?: string;
    defaultPaymentTerms: number;
    defaultQuoteValidity: number;
    invoicePrefix: string;
    quotePrefix: string;
    logoUrl?: string;
    bankDetails?: string;
    legalNotice?: string;
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'features' | 'import' | 'pro'>('general');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<WorkspaceSettings>>({});
  const [workspaceInfo, setWorkspaceInfo] = useState({ name: '', currency: '' });

  // Fetch workspace details
  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ['workspace-details', workspaceId],
    queryFn: async () => {
      const response = await api.get<{ data: WorkspaceDetails }>(
        `/settings/workspaces/${workspaceId}`
      );
      return response.data;
    },
    enabled: !!workspaceId,
  });

  // Fetch workspace settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['workspace-settings', workspaceId],
    queryFn: async () => {
      const response = await api.get<{ data: WorkspaceSettings }>(
        `/settings/workspaces/${workspaceId}/settings`
      );
      return response.data;
    },
    enabled: !!workspaceId,
  });

  // Update form data when workspace loads
  useEffect(() => {
    if (workspace) {
      setWorkspaceInfo({ name: workspace.name, currency: workspace.currency });
    }
  }, [workspace]);

  // Update form data when settings load
  useEffect(() => {
    if (settings && !isEditing) {
      setFormData(settings);
    }
  }, [settings, isEditing]);

  // Update workspace info mutation
  const updateWorkspaceMutation = useMutation({
    mutationFn: async (data: { name?: string; currency?: string }) => {
      const response = await api.patch<{ data: WorkspaceDetails }>(
        `/settings/workspaces/${workspaceId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-details', workspaceId] });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<WorkspaceSettings>) => {
      const response = await api.patch<{ data: WorkspaceSettings }>(
        `/settings/workspaces/${workspaceId}/settings`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings', workspaceId] });
      setIsEditing(false);
    },
  });

  // Reset settings mutation
  const resetSettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ data: WorkspaceSettings }>(
        `/settings/workspaces/${workspaceId}/settings/reset`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings', workspaceId] });
      setIsEditing(false);
    },
  });

  const handleChange = (section: keyof WorkspaceSettings, key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, unknown>),
        [key]: value,
      },
    }));
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(formData);
  };

  const isLoading = workspaceLoading || settingsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!workspace || !settings) {
    return (
      <div className="text-center py-12 text-gray-500">Workspace non trouve</div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'features', label: 'Fonctionnalites', icon: FolderOpen },
    { id: 'import', label: 'Import', icon: FileText },
    { id: 'pro', label: 'Mode Pro', icon: Briefcase },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Parametres du workspace
        </h1>
        <p className="text-gray-500 dark:text-gray-400">{workspace.name}</p>
      </div>

      {/* Workspace Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Informations
            </h2>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du workspace
              </label>
              <input
                type="text"
                value={workspaceInfo.name}
                onChange={(e) => setWorkspaceInfo({ ...workspaceInfo, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Devise
              </label>
              <select
                value={workspaceInfo.currency}
                onChange={(e) =>
                  setWorkspaceInfo({ ...workspaceInfo, currency: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="EUR">Euro (EUR)</option>
                <option value="USD">Dollar US (USD)</option>
                <option value="GBP">Livre Sterling (GBP)</option>
                <option value="CHF">Franc Suisse (CHF)</option>
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {workspace._count.accounts}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Comptes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {workspace._count.transactions}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Transactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {workspace._count.categories}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {workspace._count.memberships}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Membres</div>
            </div>
          </div>

          {(workspaceInfo.name !== workspace.name ||
            workspaceInfo.currency !== workspace.currency) && (
            <div className="flex justify-end mt-4">
              <button
                onClick={() =>
                  updateWorkspaceMutation.mutate({
                    name: workspaceInfo.name,
                    currency: workspaceInfo.currency,
                  })
                }
                disabled={updateWorkspaceMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                {updateWorkspaceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <form onSubmit={handleSubmit}>
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Debut de l'annee fiscale
                </label>
                <select
                  value={formData.general?.fiscalYearStart ?? 1}
                  onChange={(e) =>
                    handleChange('general', 'fiscalYearStart', parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {[
                    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
                  ].map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Features Settings */}
          {activeTab === 'features' && (
            <div className="p-6 space-y-4">
              {[
                { key: 'budgets', label: 'Budgets', desc: 'Suivez vos depenses par categorie' },
                { key: 'tags', label: 'Tags', desc: 'Organisez vos transactions avec des tags' },
                { key: 'rules', label: 'Regles', desc: 'Categorisation automatique' },
                { key: 'documents', label: 'Documents', desc: 'Attachez des justificatifs' },
                { key: 'proMode', label: 'Mode Pro', desc: 'Facturation et comptabilite pro' },
                { key: 'investMode', label: 'Investissements', desc: 'Suivi de portefeuille' },
              ].map((feature) => (
                <label
                  key={feature.key}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {feature.label}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{feature.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={
                      formData.features?.[feature.key as keyof WorkspaceSettings['features']] ??
                      false
                    }
                    onChange={(e) => handleChange('features', feature.key, e.target.checked)}
                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          )}

          {/* Import Settings */}
          {activeTab === 'import' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Format de date par defaut
                </label>
                <select
                  value={formData.import?.defaultDateFormat ?? 'DD/MM/YYYY'}
                  onChange={(e) => handleChange('import', 'defaultDateFormat', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Separateur CSV par defaut
                </label>
                <select
                  value={formData.import?.defaultDelimiter ?? ';'}
                  onChange={(e) => handleChange('import', 'defaultDelimiter', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value=";">Point-virgule (;)</option>
                  <option value=",">Virgule (,)</option>
                  <option value="\t">Tabulation</option>
                </select>
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Appliquer les regles automatiquement
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Categoriser automatiquement lors de l'import
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.import?.autoApplyRules ?? true}
                  onChange={(e) => handleChange('import', 'autoApplyRules', e.target.checked)}
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Detection des doublons
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Detecter et signaler les transactions en double
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.import?.duplicateDetection ?? true}
                  onChange={(e) => handleChange('import', 'duplicateDetection', e.target.checked)}
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            </div>
          )}

          {/* Pro Mode Settings */}
          {activeTab === 'pro' && (
            <div className="p-6 space-y-4">
              {!formData.features?.proMode ? (
                <div className="text-center py-8">
                  <Briefcase className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Activez le mode Pro pour acceder a ces parametres
                  </p>
                  <button
                    type="button"
                    onClick={() => handleChange('features', 'proMode', true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Activer le mode Pro
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nom de l'entreprise
                      </label>
                      <input
                        type="text"
                        value={formData.pro?.companyName ?? ''}
                        onChange={(e) => handleChange('pro', 'companyName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SIRET
                      </label>
                      <input
                        type="text"
                        value={formData.pro?.companySiret ?? ''}
                        onChange={(e) => handleChange('pro', 'companySiret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Adresse
                    </label>
                    <textarea
                      value={formData.pro?.companyAddress ?? ''}
                      onChange={(e) => handleChange('pro', 'companyAddress', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        N° TVA
                      </label>
                      <input
                        type="text"
                        value={formData.pro?.companyVat ?? ''}
                        onChange={(e) => handleChange('pro', 'companyVat', e.target.value)}
                        placeholder="FR12345678901"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Delai de paiement (jours)
                      </label>
                      <input
                        type="number"
                        value={formData.pro?.defaultPaymentTerms ?? 30}
                        onChange={(e) =>
                          handleChange('pro', 'defaultPaymentTerms', parseInt(e.target.value))
                        }
                        min={0}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Prefixe factures
                      </label>
                      <input
                        type="text"
                        value={formData.pro?.invoicePrefix ?? 'FAC'}
                        onChange={(e) => handleChange('pro', 'invoicePrefix', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Prefixe devis
                      </label>
                      <input
                        type="text"
                        value={formData.pro?.quotePrefix ?? 'DEV'}
                        onChange={(e) => handleChange('pro', 'quotePrefix', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Coordonnees bancaires
                    </label>
                    <textarea
                      value={formData.pro?.bankDetails ?? ''}
                      onChange={(e) => handleChange('pro', 'bankDetails', e.target.value)}
                      rows={3}
                      placeholder="IBAN, BIC, nom de la banque..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mentions legales
                    </label>
                    <textarea
                      value={formData.pro?.legalNotice ?? ''}
                      onChange={(e) => handleChange('pro', 'legalNotice', e.target.value)}
                      rows={3}
                      placeholder="Penalites de retard, conditions de paiement..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <button
              type="button"
              onClick={() => resetSettingsMutation.mutate()}
              disabled={resetSettingsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reinitialiser
            </button>

            {isEditing && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(settings);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updateSettingsMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Enregistrer
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
