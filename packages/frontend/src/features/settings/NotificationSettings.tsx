// ============================================================================
// NOTIFICATION SETTINGS - Finance Hub
// Notification preferences management
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, Smartphone, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

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
    };
    push: {
      enabled: boolean;
      budgetAlerts: boolean;
      priceAlerts: boolean;
      billReminders: boolean;
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
  },
  push: {
    enabled: true,
    budgetAlerts: true,
    priceAlerts: true,
    billReminders: true,
  },
};

export function NotificationSettings() {
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
                  Notifications par email
                </h2>
                <p className="text-sm text-ctp-subtext0">
                  Recevez des notifications par email
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
                  Alertes budget
                </span>
                <p className="text-xs text-ctp-subtext0">
                  Soyez prevenu quand vous approchez ou depassez un budget
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
                  Import termine
                </span>
                <p className="text-xs text-ctp-subtext0">
                  Notification quand un import de transactions est termine
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
                  Alertes securite
                </span>
                <p className="text-xs text-ctp-subtext0">
                  Connexions suspectes, nouveaux appareils, etc.
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
                  Resume hebdomadaire
                </span>
                <p className="text-xs text-ctp-subtext0">
                  Recevez un resume de votre activite chaque semaine
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.weeklyDigest}
                onChange={(e) => handleEmailChange('weeklyDigest', e.target.checked)}
                className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
            </label>
          </div>
        )}
      </div>

      {/* Push Notifications */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-ctp-yellow" />
              <div>
                <h2 className="text-lg font-semibold text-ctp-text">
                  Notifications push
                </h2>
                <p className="text-sm text-ctp-subtext0">
                  Recevez des notifications sur votre appareil
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
                  Alertes budget
                </span>
                <p className="text-xs text-ctp-subtext0">
                  Alertes instantanees sur les budgets
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
                  Alertes prix
                </span>
                <p className="text-xs text-ctp-subtext0">
                  Alertes sur les variations de prix (investissements)
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
                  Rappels de factures
                </span>
                <p className="text-xs text-ctp-subtext0">
                  Rappels pour les paiements a venir
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

      {/* In-app notification settings link */}
      <div className="bg-ctp-mantle rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-ctp-yellow" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ctp-text">
              Regles d'alertes personnalisees
            </h3>
            <p className="text-xs text-ctp-subtext0">
              Configurez des alertes personnalisees (budget, solde, prix, etc.)
            </p>
          </div>
          <a
            href="/notifications/alerts"
            className="text-sm text-ctp-blue hover:text-ctp-sapphire font-medium"
          >
            Configurer
          </a>
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
    </form>
  );
}
