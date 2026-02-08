// ============================================================================
// NOTIFICATION SETTINGS - Finance Hub
// Notification preferences management
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

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<NotificationPreferences['notifications'] | null>(null);

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const response = await api.get<{ data: NotificationPreferences }>('/settings/preferences');
      return response.data;
    },
  });

  // Update form data when preferences load
  useEffect(() => {
    if (preferences && !isEditing) {
      setFormData({ ...preferences.notifications });
    }
  }, [preferences, isEditing]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (notifications: NotificationPreferences['notifications']) => {
      const response = await api.patch<{ data: NotificationPreferences }>(
        '/settings/preferences',
        { notifications }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
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

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notifications par email
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {formData.email.enabled && (
          <div className="p-6 space-y-4">
            {/* Budget Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alertes budget
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Soyez prevenu quand vous approchez ou depassez un budget
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.budgetAlerts}
                onChange={(e) => handleEmailChange('budgetAlerts', e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            {/* Import Complete */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Import termine
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Notification quand un import de transactions est termine
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.importComplete}
                onChange={(e) => handleEmailChange('importComplete', e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            {/* Security Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alertes securite
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Connexions suspectes, nouveaux appareils, etc.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.securityAlerts}
                onChange={(e) => handleEmailChange('securityAlerts', e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            {/* Weekly Digest */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Resume hebdomadaire
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Recevez un resume de votre activite chaque semaine
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.email.weeklyDigest}
                onChange={(e) => handleEmailChange('weeklyDigest', e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* Push Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-gray-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notifications push
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {formData.push.enabled && (
          <div className="p-6 space-y-4">
            {/* Budget Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alertes budget
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Alertes instantanees sur les budgets
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.push.budgetAlerts}
                onChange={(e) => handlePushChange('budgetAlerts', e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            {/* Price Alerts */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alertes prix
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Alertes sur les variations de prix (investissements)
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.push.priceAlerts}
                onChange={(e) => handlePushChange('priceAlerts', e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            {/* Bill Reminders */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rappels de factures
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Rappels pour les paiements a venir
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.push.billReminders}
                onChange={(e) => handlePushChange('billReminders', e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* In-app notification settings link */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-gray-500" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Regles d'alertes personnalisees
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configurez des alertes personnalisees (budget, solde, prix, etc.)
            </p>
          </div>
          <a
            href="/notifications/alerts"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
    </form>
  );
}
