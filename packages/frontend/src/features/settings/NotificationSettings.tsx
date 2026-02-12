// ============================================================================
// NOTIFICATION SETTINGS - Finance Hub
// Notification preferences management
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Mail,
  Smartphone,
  Save,
  Loader2,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Wallet,
  Receipt,
  BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PushNotificationCard } from './PushNotificationCard';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface NotificationPreferences {
  notifications: {
    email: {
      enabled: boolean;
      budgetAlerts: boolean;
      importComplete: boolean;
      securityAlerts: boolean;
      weeklyDigest: boolean;
      monthlyReport: boolean;
    };
    push: {
      enabled: boolean;
      budgetAlerts: boolean;
      priceAlerts: boolean;
      billReminders: boolean;
    };
    smart: {
      enabled: boolean;
      unusualSpending: boolean;
      lowBalanceWarning: boolean;
      billUpcoming: boolean;
      weeklySummary: boolean;
      monthlyReport: boolean;
    };
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

// Default notification preferences
const defaultNotifications: NotificationPreferences['notifications'] = {
  email: {
    enabled: true,
    budgetAlerts: true,
    importComplete: true,
    securityAlerts: true,
    weeklyDigest: false,
    monthlyReport: true,
  },
  push: {
    enabled: true,
    budgetAlerts: true,
    priceAlerts: true,
    billReminders: true,
  },
  smart: {
    enabled: true,
    unusualSpending: true,
    lowBalanceWarning: true,
    billUpcoming: true,
    weeklySummary: true,
    monthlyReport: true,
  },
};

export function NotificationSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<NotificationPreferences['notifications']>(defaultNotifications);

  // Fetch preferences - the API returns full preferences object with notifications property
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => api.get<{ notifications: NotificationPreferences['notifications'] }>('/settings/preferences'),
  });

  // Update form data when preferences load
  useEffect(() => {
    if (preferences?.notifications && !isEditing) {
      setFormData({ ...preferences.notifications });
    }
  }, [preferences, isEditing]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: (notifications: NotificationPreferences['notifications']) =>
      api.patch<NotificationPreferences>('/settings/preferences', { notifications }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      setIsEditing(false);
    },
  });

  const handleEmailChange = (key: keyof NotificationPreferences['notifications']['email'], value: boolean) => {
    if (!formData) return;
    setFormData({
      ...formData,
      email: { ...formData.email, [key]: value },
    });
    setIsEditing(true);
  };

  const handlePushChange = (key: keyof NotificationPreferences['notifications']['push'], value: boolean) => {
    if (!formData) return;
    setFormData({
      ...formData,
      push: { ...formData.push, [key]: value },
    });
    setIsEditing(true);
  };

  const handleSmartChange = (key: keyof NotificationPreferences['notifications']['smart'], value: boolean) => {
    if (!formData) return;
    setFormData({
      ...formData,
      smart: { ...formData.smart, [key]: value },
    });
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      updateMutation.mutate(formData);
    }
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
      {/* Email Notifications */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-ctp-yellow" />
              <div>
                <h2 className="text-lg font-semibold text-ctp-text">
                  {t('settings.notifications.emailNotifications')}
                </h2>
                <p className="text-sm text-ctp-subtext0">
                  {t('settings.notifications.receiveEmailNotifications')}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.email.enabled}
                onChange={(e) => handleEmailChange('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-ctp-surface1 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ctp-blue/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ctp-surface2 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ctp-blue"></div>
            </label>
          </div>
        </div>

        {formData.email.enabled && (
          <div className="p-6 space-y-4">
            {/* Budget Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.budgetAlerts')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.budgetAlertsDescription')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.budgetAlerts}
                onChange={(e) => handleEmailChange('budgetAlerts', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>

            {/* Import Complete */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.importComplete')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.importCompleteDescription')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.importComplete}
                onChange={(e) => handleEmailChange('importComplete', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>

            {/* Security Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.securityAlerts')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.securityAlertsDescription')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.securityAlerts}
                onChange={(e) => handleEmailChange('securityAlerts', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>

            {/* Weekly Digest */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.weeklyDigest')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.weeklyDigestDescription')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.weeklyDigest}
                onChange={(e) => handleEmailChange('weeklyDigest', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>

            {/* Monthly Report */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.monthlyReport')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.monthlyReportDescription')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.monthlyReport}
                onChange={(e) => handleEmailChange('monthlyReport', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>
          </div>
        )}
      </div>

      {/* Push Notifications - Device Subscription */}
      <PushNotificationCard />

      {/* Push Notification Preferences */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-ctp-yellow" />
              <div>
                <h2 className="text-lg font-semibold text-ctp-text">
                  {t('settings.notifications.pushPreferences')}
                </h2>
                <p className="text-sm text-ctp-subtext0">
                  {t('settings.notifications.pushTypesToReceive')}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.push.enabled}
                onChange={(e) => handlePushChange('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-ctp-surface1 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ctp-blue/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ctp-surface2 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ctp-blue"></div>
            </label>
          </div>
        </div>

        {formData.push.enabled && (
          <div className="p-6 space-y-4">
            {/* Budget Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.budgetAlerts')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.instantBudgetAlerts')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.push.budgetAlerts}
                onChange={(e) => handlePushChange('budgetAlerts', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>

            {/* Price Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.priceAlerts')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.priceAlertsDescription')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.push.priceAlerts}
                onChange={(e) => handlePushChange('priceAlerts', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>

            {/* Bill Reminders */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-ctp-subtext1">
                  {t('settings.notifications.billReminders')}
                </span>
                <p className="text-xs text-ctp-subtext0">
                  {t('settings.notifications.billRemindersDescription')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.push.billReminders}
                onChange={(e) => handlePushChange('billReminders', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>
          </div>
        )}
      </div>

      {/* Smart Notifications */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-ctp-mauve" />
              <div>
                <h2 className="text-lg font-semibold text-ctp-text">
                  {t('settings.notifications.smartNotifications')}
                </h2>
                <p className="text-sm text-ctp-subtext0">
                  {t('settings.notifications.smartNotificationsDescription')}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.smart.enabled}
                onChange={(e) => handleSmartChange('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-ctp-surface1 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ctp-mauve/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ctp-surface2 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ctp-mauve"></div>
            </label>
          </div>
        </div>

        {formData.smart.enabled && (
          <div className="p-6 space-y-4">
            {/* Alerts Section */}
            <div className="pb-4 border-b border-ctp-surface0">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-ctp-yellow" />
                <span className="text-sm font-semibold text-ctp-subtext1">{t('settings.notifications.alerts')}</span>
              </div>

              {/* Unusual Spending */}
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div>
                  <span className="text-sm font-medium text-ctp-subtext1">
                    {t('settings.notifications.unusualSpending')}
                  </span>
                  <p className="text-xs text-ctp-subtext0">
                    {t('settings.notifications.unusualSpendingDescription')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.smart.unusualSpending}
                  onChange={(e) => handleSmartChange('unusualSpending', e.target.checked)}
                  className="h-5 w-5 text-ctp-mauve rounded focus:ring-ctp-mauve"
                />
              </label>

              {/* Low Balance Warning */}
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div className="flex items-start gap-2">
                  <Wallet className="h-4 w-4 text-ctp-peach mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-ctp-subtext1">
                      {t('settings.notifications.lowBalance')}
                    </span>
                    <p className="text-xs text-ctp-subtext0">
                      {t('settings.notifications.lowBalanceDescription')}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.smart.lowBalanceWarning}
                  onChange={(e) => handleSmartChange('lowBalanceWarning', e.target.checked)}
                  className="h-5 w-5 text-ctp-mauve rounded focus:ring-ctp-mauve"
                />
              </label>

              {/* Bill Upcoming */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-start gap-2">
                  <Receipt className="h-4 w-4 text-ctp-red mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-ctp-subtext1">
                      {t('settings.notifications.upcomingBills')}
                    </span>
                    <p className="text-xs text-ctp-subtext0">
                      {t('settings.notifications.upcomingBillsDescription')}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.smart.billUpcoming}
                  onChange={(e) => handleSmartChange('billUpcoming', e.target.checked)}
                  className="h-5 w-5 text-ctp-mauve rounded focus:ring-ctp-mauve"
                />
              </label>
            </div>

            {/* Summaries Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-ctp-blue" />
                <span className="text-sm font-semibold text-ctp-subtext1">{t('settings.notifications.summaries')}</span>
              </div>

              {/* Weekly Summary */}
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-ctp-teal mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-ctp-subtext1">
                      {t('settings.notifications.weeklySummary')}
                    </span>
                    <p className="text-xs text-ctp-subtext0">
                      {t('settings.notifications.weeklySummaryDescription')}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.smart.weeklySummary}
                  onChange={(e) => handleSmartChange('weeklySummary', e.target.checked)}
                  className="h-5 w-5 text-ctp-mauve rounded focus:ring-ctp-mauve"
                />
              </label>

              {/* Monthly Report */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-start gap-2">
                  <BarChart3 className="h-4 w-4 text-ctp-green mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-ctp-subtext1">
                      {t('settings.notifications.monthlyReportSmart')}
                    </span>
                    <p className="text-xs text-ctp-subtext0">
                      {t('settings.notifications.monthlyReportSmartDescription')}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.smart.monthlyReport}
                  onChange={(e) => handleSmartChange('monthlyReport', e.target.checked)}
                  className="h-5 w-5 text-ctp-mauve rounded focus:ring-ctp-mauve"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Notification Channels */}
      <div className="bg-ctp-mantle rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-ctp-green" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ctp-text">
              {t('settings.notifications.notificationChannels')}
            </h3>
            <p className="text-xs text-ctp-subtext0">
              {t('settings.notifications.configureChannels')}
            </p>
          </div>
          <Link
            to="/settings/notification-channels"
            className="text-sm text-ctp-blue hover:text-ctp-sapphire font-medium"
          >
            {t('settings.notifications.configure')}
          </Link>
        </div>
      </div>

      {/* In-app notification settings link */}
      <div className="bg-ctp-mantle rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-ctp-yellow" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ctp-text">
              {t('settings.notifications.customAlertRules')}
            </h3>
            <p className="text-xs text-ctp-subtext0">
              {t('settings.notifications.customAlertRulesDescription')}
            </p>
          </div>
          <Link
            to="/notifications/alerts"
            className="text-sm text-ctp-blue hover:text-ctp-sapphire font-medium"
          >
            {t('settings.notifications.configure')}
          </Link>
        </div>
      </div>

      {/* Actions */}
      {isEditing && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              if (preferences) {
                setFormData({ ...preferences.notifications });
              }
              setIsEditing(false);
            }}
            className="px-4 py-2 text-sm font-medium text-ctp-subtext1 hover:bg-ctp-surface0 rounded-lg transition-colors"
          >
            {t('settings.notifications.cancel')}
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
            {t('settings.notifications.save')}
          </button>
        </div>
      )}
    </form>
  );
}
