// ============================================================================
// DISPLAY SETTINGS - Finance Hub
// Display and dashboard preferences
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, LayoutDashboard, Save, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface UserPreferences {
  display: {
    compactMode: boolean;
    showBalance: boolean;
    defaultCurrency: string;
    dateFormat: string;
    numberFormat: string;
    startOfWeek: number;
  };
  dashboard: {
    defaultPeriod: 'month' | 'quarter' | 'year';
    showNetWorth: boolean;
    showBudgets: boolean;
    showRecentTransactions: boolean;
    showUpcomingBills: boolean;
  };
  privacy: {
    hideAmountsOnHover: boolean;
    sessionTimeout: number;
    lockOnInactivity: boolean;
    inactivityTimeout: number;
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DisplaySettings() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserPreferences>>({});

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const response = await api.get<{ data: UserPreferences }>('/settings/preferences');
      return response.data;
    },
  });

  // Update form data when preferences load
  useEffect(() => {
    if (preferences && !isEditing) {
      setFormData({
        display: { ...preferences.display },
        dashboard: { ...preferences.dashboard },
        privacy: { ...preferences.privacy },
      });
    }
  }, [preferences, isEditing]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const response = await api.patch<{ data: UserPreferences }>('/settings/preferences', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      setIsEditing(false);
    },
  });

  // Reset preferences mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ data: UserPreferences }>('/settings/preferences/reset');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      setIsEditing(false);
    },
  });

  const handleChange = (section: keyof UserPreferences, key: string, value: unknown) => {
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
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Display Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Affichage</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Personnalisez l'apparence de l'application
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Compact Mode */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Mode compact
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Affichage plus dense avec moins d'espacement
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.display?.compactMode ?? false}
              onChange={(e) => handleChange('display', 'compactMode', e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>

          {/* Show Balance */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Afficher les soldes
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Afficher les soldes des comptes dans la liste
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.display?.showBalance ?? true}
              onChange={(e) => handleChange('display', 'showBalance', e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>

          {/* Default Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Devise par defaut
            </label>
            <select
              value={formData.display?.defaultCurrency ?? 'EUR'}
              onChange={(e) => handleChange('display', 'defaultCurrency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="EUR">Euro (EUR)</option>
              <option value="USD">Dollar US (USD)</option>
              <option value="GBP">Livre Sterling (GBP)</option>
              <option value="CHF">Franc Suisse (CHF)</option>
              <option value="CAD">Dollar Canadien (CAD)</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Format de date
            </label>
            <select
              value={formData.display?.dateFormat ?? 'DD/MM/YYYY'}
              onChange={(e) => handleChange('display', 'dateFormat', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
            </select>
          </div>

          {/* Number Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Format des nombres
            </label>
            <select
              value={formData.display?.numberFormat ?? 'fr-FR'}
              onChange={(e) => handleChange('display', 'numberFormat', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="fr-FR">Francais (1 234,56)</option>
              <option value="en-US">Anglais US (1,234.56)</option>
              <option value="de-DE">Allemand (1.234,56)</option>
            </select>
          </div>

          {/* Start of Week */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Premier jour de la semaine
            </label>
            <select
              value={formData.display?.startOfWeek ?? 1}
              onChange={(e) => handleChange('display', 'startOfWeek', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={1}>Lundi</option>
              <option value={0}>Dimanche</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tableau de bord
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configurez votre tableau de bord
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Default Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Periode par defaut
            </label>
            <select
              value={formData.dashboard?.defaultPeriod ?? 'month'}
              onChange={(e) =>
                handleChange('dashboard', 'defaultPeriod', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="month">Mois</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Annee</option>
            </select>
          </div>

          {/* Show Net Worth */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Afficher le patrimoine net
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Afficher le total de vos actifs moins vos dettes
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showNetWorth ?? true}
              onChange={(e) => handleChange('dashboard', 'showNetWorth', e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>

          {/* Show Budgets */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Afficher les budgets
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Afficher l'etat de vos budgets sur le dashboard
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showBudgets ?? true}
              onChange={(e) => handleChange('dashboard', 'showBudgets', e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>

          {/* Show Recent Transactions */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Afficher les transactions recentes
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Afficher les dernieres transactions
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showRecentTransactions ?? true}
              onChange={(e) =>
                handleChange('dashboard', 'showRecentTransactions', e.target.checked)
              }
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>

          {/* Show Upcoming Bills */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Afficher les factures a venir
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Afficher les paiements prevus
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showUpcomingBills ?? true}
              onChange={(e) => handleChange('dashboard', 'showUpcomingBills', e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Confidentialite</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Options de confidentialite et de securite de session
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Hide Amounts on Hover */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Masquer les montants
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cacher les montants jusqu'au survol de la souris
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.privacy?.hideAmountsOnHover ?? false}
              onChange={(e) => handleChange('privacy', 'hideAmountsOnHover', e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>

          {/* Lock on Inactivity */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Verrouiller apres inactivite
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Verrouiller la session apres une periode d'inactivite
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.privacy?.lockOnInactivity ?? true}
              onChange={(e) => handleChange('privacy', 'lockOnInactivity', e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>

          {/* Inactivity Timeout */}
          {formData.privacy?.lockOnInactivity && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delai d'inactivite (minutes)
              </label>
              <select
                value={formData.privacy?.inactivityTimeout ?? 5}
                onChange={(e) =>
                  handleChange('privacy', 'inactivityTimeout', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
          )}

          {/* Session Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expiration de session (minutes)
            </label>
            <select
              value={formData.privacy?.sessionTimeout ?? 60}
              onChange={(e) =>
                handleChange('privacy', 'sessionTimeout', parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 heure</option>
              <option value={120}>2 heures</option>
              <option value={480}>8 heures</option>
              <option value={1440}>24 heures</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
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
                if (preferences) {
                  setFormData({
                    display: { ...preferences.display },
                    dashboard: { ...preferences.dashboard },
                    privacy: { ...preferences.privacy },
                  });
                }
                setIsEditing(false);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? (
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
  );
}
