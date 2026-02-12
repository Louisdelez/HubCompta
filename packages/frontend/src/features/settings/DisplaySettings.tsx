// ============================================================================
// DISPLAY SETTINGS - Finance Hub
// Display and dashboard preferences with Catppuccin theme support
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Monitor, LayoutDashboard, Save, Loader2, RotateCcw, Palette, Check, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme, THEME_META, type CatppuccinFlavor } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { RestartTutorialButton } from '@/features/onboarding';

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

interface SystemThemeCardPropsWithT extends SystemThemeCardProps {
  label: string;
}

function SystemThemeCard({ isSelected, onClick, label }: SystemThemeCardPropsWithT) {
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
        {label}
      </p>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DisplaySettings() {
  const { t } = useTranslation();
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
            <h2 className="text-lg font-semibold text-ctp-text">{t('settings.display.catppuccinTheme')}</h2>
          </div>
          <p className="mt-1 text-sm text-ctp-subtext0">
            {t('settings.display.themeDescription')}
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
              label={t('settings.display.systemTheme')}
            />
          </div>

          {/* Current theme info */}
          <div className="mt-4 p-3 bg-ctp-surface0 rounded-lg">
            <p className="text-sm text-ctp-subtext1">
              {t('settings.display.activeTheme')} : <span className="font-medium text-ctp-text">{THEME_META[resolvedTheme].label}</span>
              {theme === 'system' && (
                <span className="ml-1 text-ctp-overlay1">({t('settings.display.automatic')})</span>
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
            <h2 className="text-lg font-semibold text-ctp-text">{t('settings.display.displaySettings')}</h2>
          </div>
          <p className="mt-1 text-sm text-ctp-subtext0">
            {t('settings.display.customizeAppearance')}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Compact Mode */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                {t('settings.display.compactMode')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.display.compactModeDescription')}
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
                {t('settings.display.showBalance')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.display.showBalanceDescription')}
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
              {t('settings.display.defaultCurrency')}
            </label>
            <select
              value={formData.display?.defaultCurrency ?? 'EUR'}
              onChange={(e) => handleChange('display', 'defaultCurrency', e.target.value)}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value="EUR">{t('settings.display.currencies.eur')}</option>
              <option value="USD">{t('settings.display.currencies.usd')}</option>
              <option value="GBP">{t('settings.display.currencies.gbp')}</option>
              <option value="CHF">{t('settings.display.currencies.chf')}</option>
              <option value="CAD">{t('settings.display.currencies.cad')}</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              {t('settings.display.dateFormat')}
            </label>
            <select
              value={formData.display?.dateFormat ?? 'DD/MM/YYYY'}
              onChange={(e) => handleChange('display', 'dateFormat', e.target.value)}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value="DD/MM/YYYY">{t('settings.display.dateFormats.dmy')}</option>
              <option value="MM/DD/YYYY">{t('settings.display.dateFormats.mdy')}</option>
              <option value="YYYY-MM-DD">{t('settings.display.dateFormats.ymd')}</option>
            </select>
          </div>

          {/* Number Format */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              {t('settings.display.numberFormat')}
            </label>
            <select
              value={formData.display?.numberFormat ?? 'fr-FR'}
              onChange={(e) => handleChange('display', 'numberFormat', e.target.value)}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value="fr-FR">{t('settings.display.numberFormats.fr')}</option>
              <option value="en-US">{t('settings.display.numberFormats.en')}</option>
              <option value="de-DE">{t('settings.display.numberFormats.de')}</option>
            </select>
          </div>

          {/* Start of Week */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              {t('settings.display.startOfWeek')}
            </label>
            <select
              value={formData.display?.startOfWeek ?? 1}
              onChange={(e) => handleChange('display', 'startOfWeek', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value={1}>{t('settings.display.monday')}</option>
              <option value={0}>{t('settings.display.sunday')}</option>
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
              {t('settings.dashboard.title')}
            </h2>
          </div>
          <p className="mt-1 text-sm text-ctp-subtext0">
            {t('settings.dashboard.description')}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Default Period */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              {t('settings.dashboard.defaultPeriod')}
            </label>
            <select
              value={formData.dashboard?.defaultPeriod ?? 'month'}
              onChange={(e) =>
                handleChange('dashboard', 'defaultPeriod', e.target.value)
              }
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value="month">{t('settings.dashboard.periods.month')}</option>
              <option value="quarter">{t('settings.dashboard.periods.quarter')}</option>
              <option value="year">{t('settings.dashboard.periods.year')}</option>
            </select>
          </div>

          {/* Show Net Worth */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                {t('settings.dashboard.showNetWorth')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.dashboard.showNetWorthDescription')}
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
                {t('settings.dashboard.showBudgets')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.dashboard.showBudgetsDescription')}
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
                {t('settings.dashboard.showRecentTransactions')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.dashboard.showRecentTransactionsDescription')}
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
                {t('settings.dashboard.showUpcomingBills')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.dashboard.showUpcomingBillsDescription')}
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

      {/* Help & Tutorial */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-ctp-mauve" />
            <h2 className="text-lg font-semibold text-ctp-text">{t('settings.help.title')}</h2>
          </div>
          <p className="mt-1 text-sm text-ctp-subtext0">
            {t('settings.help.description')}
          </p>
        </div>

        <div className="p-6">
          <RestartTutorialButton variant="card" />
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <h2 className="text-lg font-semibold text-ctp-text">{t('settings.privacy.title')}</h2>
          <p className="mt-1 text-sm text-ctp-subtext0">
            {t('settings.privacy.description')}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Hide Amounts on Hover */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-ctp-subtext1">
                {t('settings.privacy.hideAmounts')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.privacy.hideAmountsDescription')}
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
                {t('settings.privacy.lockOnInactivity')}
              </span>
              <p className="text-xs text-ctp-subtext0">
                {t('settings.privacy.lockOnInactivityDescription')}
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
                {t('settings.privacy.inactivityTimeout')}
              </label>
              <select
                value={formData.privacy?.inactivityTimeout ?? 5}
                onChange={(e) =>
                  handleChange('privacy', 'inactivityTimeout', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
              >
                <option value={1}>{t('settings.privacy.timeouts.1min')}</option>
                <option value={5}>{t('settings.privacy.timeouts.5min')}</option>
                <option value={10}>{t('settings.privacy.timeouts.10min')}</option>
                <option value={15}>{t('settings.privacy.timeouts.15min')}</option>
                <option value={30}>{t('settings.privacy.timeouts.30min')}</option>
              </select>
            </div>
          )}

          {/* Session Timeout */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              {t('settings.privacy.sessionTimeout')}
            </label>
            <select
              value={formData.privacy?.sessionTimeout ?? 60}
              onChange={(e) =>
                handleChange('privacy', 'sessionTimeout', parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg bg-ctp-base text-ctp-text focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
            >
              <option value={30}>{t('settings.privacy.timeouts.30min')}</option>
              <option value={60}>{t('settings.privacy.timeouts.1hour')}</option>
              <option value={120}>{t('settings.privacy.timeouts.2hours')}</option>
              <option value={480}>{t('settings.privacy.timeouts.8hours')}</option>
              <option value={1440}>{t('settings.privacy.timeouts.24hours')}</option>
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
          {t('settings.display.reset')}
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
              {t('settings.display.cancel')}
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
              {t('settings.display.save')}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
