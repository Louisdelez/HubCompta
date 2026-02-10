// ============================================================================
// DISPLAY SETTINGS - Finance Hub
// Display and dashboard preferences with Catppuccin theme support
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, LayoutDashboard, Save, Loader2, RotateCcw, Palette, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme, THEME_META, type CatppuccinFlavor } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

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
// Theme Preview Card Component
// ----------------------------------------------------------------------------

interface ThemePreviewCardProps {
  flavor: CatppuccinFlavor;
  isSelected: boolean;
  onClick: () => void;
}

function ThemePreviewCard({ flavor, isSelected, onClick }: ThemePreviewCardProps) {
  const meta = THEME_META[flavor];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col rounded-xl border-2 p-3 transition-all hover:scale-[1.02]',
        isSelected
          ? 'border-ctp-blue ring-2 ring-ctp-blue/20'
          : 'border-ctp-surface1 hover:border-ctp-surface2'
      )}
      style={{ backgroundColor: meta.colors.base }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-ctp-blue text-ctp-base rounded-full p-1">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* Color swatches */}
      <div className="flex gap-1 mb-2">
        {['blue', 'mauve', 'pink', 'green', 'red', 'peach', 'yellow'].map((color) => (
          <div
            key={color}
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: meta.colors[color as keyof typeof meta.colors] }}
          />
        ))}
      </div>

      {/* Preview content */}
      <div
        className="rounded-lg p-2 mb-2"
        style={{ backgroundColor: meta.colors.surface }}
      >
        <div
          className="h-2 w-16 rounded mb-1"
          style={{ backgroundColor: meta.colors.text }}
        />
        <div
          className="h-2 w-12 rounded opacity-60"
          style={{ backgroundColor: meta.colors.text }}
        />
      </div>

      {/* Label */}
      <p
        className="text-sm font-medium text-center"
        style={{ color: meta.colors.text }}
      >
        {meta.label}
      </p>
    </button>
  );
}

// ----------------------------------------------------------------------------
// System Theme Card Component
// ----------------------------------------------------------------------------

interface SystemThemeCardProps {
  isSelected: boolean;
  onClick: () => void;
}

function SystemThemeCard({ isSelected, onClick }: SystemThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col rounded-xl border-2 p-3 transition-all hover:scale-[1.02]',
        'bg-gradient-to-br from-[#eff1f5] to-[#1e1e2e]',
        isSelected
          ? 'border-ctp-blue ring-2 ring-ctp-blue/20'
          : 'border-ctp-surface1 hover:border-ctp-surface2'
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-ctp-blue text-ctp-base rounded-full p-1">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* Split color swatches */}
      <div className="flex gap-1 mb-2">
        <div className="flex gap-0.5">
          <div className="w-3 h-4 rounded-l-full bg-[#1e66f5]" />
          <div className="w-3 h-4 rounded-r-full bg-[#89b4fa]" />
        </div>
        <div className="flex gap-0.5">
          <div className="w-3 h-4 rounded-l-full bg-[#8839ef]" />
          <div className="w-3 h-4 rounded-r-full bg-[#cba6f7]" />
        </div>
        <div className="flex gap-0.5">
          <div className="w-3 h-4 rounded-l-full bg-[#40a02b]" />
          <div className="w-3 h-4 rounded-r-full bg-[#a6e3a1]" />
        </div>
      </div>

      {/* Preview with split */}
      <div className="flex rounded-lg overflow-hidden mb-2">
        <div className="flex-1 p-2 bg-[#ccd0da]">
          <div className="h-2 w-6 rounded bg-[#4c4f69] mb-1" />
          <div className="h-2 w-4 rounded bg-[#4c4f69] opacity-60" />
        </div>
        <div className="flex-1 p-2 bg-[#313244]">
          <div className="h-2 w-6 rounded bg-[#cdd6f4] mb-1" />
          <div className="h-2 w-4 rounded bg-[#cdd6f4] opacity-60" />
        </div>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-center text-ctp-subtext1">
        Systeme
      </p>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DisplaySettings() {
  const queryClient = useQueryClient();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserPreferences>>({});

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => api.get<UserPreferences>('/settings/preferences'),
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
    mutationFn: (data: Partial<UserPreferences>) =>
      api.patch<UserPreferences>('/settings/preferences', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      setIsEditing(false);
    },
  });

  // Reset preferences mutation
  const resetMutation = useMutation({
    mutationFn: () => api.post<UserPreferences>('/settings/preferences/reset'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
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
        <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Theme Settings - Catppuccin */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-ctp-mauve" />
            <h2 className="text-lg font-semibold text-ctp-text">Theme Catppuccin</h2>
          </div>
          <p className="mt-1 text-sm text-ctp-subtext0">
            Choisissez parmi les 4 saveurs Catppuccin
          </p>
        </div>

        <div className="p-6">
          {/* Theme grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Latte */}
            <ThemePreviewCard
              flavor="latte"
              isSelected={theme === 'latte'}
              onClick={() => setTheme('latte')}
            />

            {/* Frappé */}
            <ThemePreviewCard
              flavor="frappe"
              isSelected={theme === 'frappe'}
              onClick={() => setTheme('frappe')}
            />

            {/* Macchiato */}
            <ThemePreviewCard
              flavor="macchiato"
              isSelected={theme === 'macchiato'}
              onClick={() => setTheme('macchiato')}
            />

            {/* Mocha */}
            <ThemePreviewCard
              flavor="mocha"
              isSelected={theme === 'mocha'}
              onClick={() => setTheme('mocha')}
            />

            {/* System */}
            <SystemThemeCard
              isSelected={theme === 'system'}
              onClick={() => setTheme('system')}
            />
          </div>

          {/* Current theme info */}
          <div className="mt-4 p-3 bg-ctp-surface0 rounded-lg">
            <p className="text-sm text-ctp-subtext1">
              Theme actif : <span className="font-medium text-ctp-text">{THEME_META[resolvedTheme].label}</span>
              {theme === 'system' && (
                <span className="ml-1 text-ctp-overlay1">(automatique)</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-ctp-mauve" />
            <h2 className="text-lg font-semibold text-ctp-text">Affichage</h2>
          </div>
          <p className="mt-1 text-sm text-ctp-subtext0">
            Personnalisez l'apparence de l'application
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Compact Mode */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Mode compact
              </span>
              <p className="text-xs text-ctp-subtext0">
                Affichage plus dense avec moins d'espacement
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.display?.compactMode ?? false}
              onChange={(e) => handleChange('display', 'compactMode', e.target.checked)}
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>

          {/* Show Balance */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Afficher les soldes
              </span>
              <p className="text-xs text-ctp-subtext0">
                Afficher les soldes des comptes dans la liste
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.display?.showBalance ?? true}
              onChange={(e) => handleChange('display', 'showBalance', e.target.checked)}
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>

          {/* Default Currency */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              Devise par defaut
            </label>
            <select
              value={formData.display?.defaultCurrency ?? 'EUR'}
              onChange={(e) => handleChange('display', 'defaultCurrency', e.target.value)}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
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
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              Format de date
            </label>
            <select
              value={formData.display?.dateFormat ?? 'DD/MM/YYYY'}
              onChange={(e) => handleChange('display', 'dateFormat', e.target.value)}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
            </select>
          </div>

          {/* Number Format */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              Format des nombres
            </label>
            <select
              value={formData.display?.numberFormat ?? 'fr-FR'}
              onChange={(e) => handleChange('display', 'numberFormat', e.target.value)}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value="fr-FR">Francais (1 234,56)</option>
              <option value="en-US">Anglais US (1,234.56)</option>
              <option value="de-DE">Allemand (1.234,56)</option>
            </select>
          </div>

          {/* Start of Week */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              Premier jour de la semaine
            </label>
            <select
              value={formData.display?.startOfWeek ?? 1}
              onChange={(e) => handleChange('display', 'startOfWeek', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value={1}>Lundi</option>
              <option value={0}>Dimanche</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard Settings */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-ctp-mauve" />
            <h2 className="text-lg font-semibold text-ctp-text">
              Tableau de bord
            </h2>
          </div>
          <p className="mt-1 text-sm text-ctp-subtext0">
            Configurez votre tableau de bord
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Default Period */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              Periode par defaut
            </label>
            <select
              value={formData.dashboard?.defaultPeriod ?? 'month'}
              onChange={(e) =>
                handleChange('dashboard', 'defaultPeriod', e.target.value)
              }
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value="month">Mois</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Annee</option>
            </select>
          </div>

          {/* Show Net Worth */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Afficher le patrimoine net
              </span>
              <p className="text-xs text-ctp-subtext0">
                Afficher le total de vos actifs moins vos dettes
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showNetWorth ?? true}
              onChange={(e) => handleChange('dashboard', 'showNetWorth', e.target.checked)}
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>

          {/* Show Budgets */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Afficher les budgets
              </span>
              <p className="text-xs text-ctp-subtext0">
                Afficher l'etat de vos budgets sur le dashboard
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showBudgets ?? true}
              onChange={(e) => handleChange('dashboard', 'showBudgets', e.target.checked)}
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>

          {/* Show Recent Transactions */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Afficher les transactions recentes
              </span>
              <p className="text-xs text-ctp-subtext0">
                Afficher les dernieres transactions
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showRecentTransactions ?? true}
              onChange={(e) =>
                handleChange('dashboard', 'showRecentTransactions', e.target.checked)
              }
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>

          {/* Show Upcoming Bills */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Afficher les factures a venir
              </span>
              <p className="text-xs text-ctp-subtext0">
                Afficher les paiements prevus
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.dashboard?.showUpcomingBills ?? true}
              onChange={(e) => handleChange('dashboard', 'showUpcomingBills', e.target.checked)}
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <h2 className="text-lg font-semibold text-ctp-text">Confidentialite</h2>
          <p className="mt-1 text-sm text-ctp-subtext0">
            Options de confidentialite et de securite de session
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Hide Amounts on Hover */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Masquer les montants
              </span>
              <p className="text-xs text-ctp-subtext0">
                Cacher les montants jusqu'au survol de la souris
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.privacy?.hideAmountsOnHover ?? false}
              onChange={(e) => handleChange('privacy', 'hideAmountsOnHover', e.target.checked)}
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>

          {/* Lock on Inactivity */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                Verrouiller apres inactivite
              </span>
              <p className="text-xs text-ctp-subtext0">
                Verrouiller la session apres une periode d'inactivite
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.privacy?.lockOnInactivity ?? true}
              onChange={(e) => handleChange('privacy', 'lockOnInactivity', e.target.checked)}
              className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
            />
          </label>

          {/* Inactivity Timeout */}
          {formData.privacy?.lockOnInactivity && (
            <div>
              <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
                Delai d'inactivite (minutes)
              </label>
              <select
                value={formData.privacy?.inactivityTimeout ?? 5}
                onChange={(e) =>
                  handleChange('privacy', 'inactivityTimeout', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
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
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              Expiration de session (minutes)
            </label>
            <select
              value={formData.privacy?.sessionTimeout ?? 60}
              onChange={(e) =>
                handleChange('privacy', 'sessionTimeout', parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ctp-subtext1 hover:bg-ctp-surface0 rounded-lg transition-colors"
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
              className="px-4 py-2 text-sm font-medium text-ctp-subtext1 hover:bg-ctp-surface0 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-base text-sm font-medium rounded-lg hover:bg-ctp-sapphire disabled:opacity-50 transition-colors"
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
