// ============================================================================
// CHANNEL PREFERENCES - Finance Hub
// Component for configuring notification types per channel
// ============================================================================

import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import {
  useNotificationTypes,
  useUpdateChannelPreferences,
  type NotificationChannel,
  getChannelLabel,
} from '../hooks/useNotificationChannels';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ChannelPreferencesProps {
  open: boolean;
  channel: NotificationChannel | null;
  onClose: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ChannelPreferences({ open, channel, onClose }: ChannelPreferencesProps) {
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const { data: notificationTypes, isLoading: isLoadingTypes } = useNotificationTypes();
  const updatePreferences = useUpdateChannelPreferences(channel?.id ?? '');

  // Reset state when channel changes
  useEffect(() => {
    if (channel) {
      setEnabledTypes(new Set(channel.enabledTypes));
      setHasChanges(false);
    }
  }, [channel]);

  const handleToggle = (type: string) => {
    const newEnabled = new Set(enabledTypes);
    if (newEnabled.has(type)) {
      newEnabled.delete(type);
    } else {
      newEnabled.add(type);
    }
    setEnabledTypes(newEnabled);
    setHasChanges(true);
  };

  const handleToggleCategory = (types: string[]) => {
    const allEnabled = types.every((t) => enabledTypes.has(t));
    const newEnabled = new Set(enabledTypes);

    types.forEach((type) => {
      if (allEnabled) {
        newEnabled.delete(type);
      } else {
        newEnabled.add(type);
      }
    });

    setEnabledTypes(newEnabled);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!channel) return;

    try {
      await updatePreferences.mutateAsync(Array.from(enabledTypes));
      setHasChanges(false);
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  if (!open || !channel) return null;

  const label = getChannelLabel(channel.channelType);

  const renderCategory = (
    title: string,
    types: Array<{ type: string; label: string; description: string }>
  ) => {
    const categoryTypes = types.map((t) => t.type);
    const allEnabled = categoryTypes.every((t) => enabledTypes.has(t));
    const someEnabled = categoryTypes.some((t) => enabledTypes.has(t));

    return (
      <div className="border-b border-ctp-surface0 pb-4 last:border-b-0 last:pb-0">
        <label className="flex items-center gap-3 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allEnabled}
            ref={(el) => {
              if (el) {
                el.indeterminate = someEnabled && !allEnabled;
              }
            }}
            onChange={() => handleToggleCategory(categoryTypes)}
            className="h-5 w-5 text-ctp-blue rounded focus:ring-ctp-blue"
          />
          <span className="font-medium text-ctp-text">{title}</span>
        </label>

        <div className="ml-8 space-y-2">
          {types.map((item) => (
            <label
              key={item.type}
              className="flex items-start gap-3 cursor-pointer py-1"
            >
              <input
                type="checkbox"
                checked={enabledTypes.has(item.type)}
                onChange={() => handleToggle(item.type)}
                className="h-4 w-4 mt-0.5 text-ctp-blue rounded focus:ring-ctp-blue"
              />
              <div>
                <span className="text-sm text-ctp-subtext1">{item.label}</span>
                <p className="text-xs text-ctp-subtext0">{item.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface0 shrink-0">
          <h2 className="text-lg font-semibold text-ctp-text">
            Preferences {label}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ctp-surface0 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-ctp-subtext0" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingTypes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
            </div>
          ) : notificationTypes ? (
            <div className="space-y-4">
              <p className="text-sm text-ctp-subtext0 mb-4">
                Selectionnez les types de notifications que vous souhaitez recevoir sur ce canal.
              </p>

              {notificationTypes.alerts.length > 0 &&
                renderCategory('Alertes', notificationTypes.alerts)}

              {notificationTypes.reminders.length > 0 &&
                renderCategory('Rappels', notificationTypes.reminders)}

              {notificationTypes.reports.length > 0 &&
                renderCategory('Rapports', notificationTypes.reports)}

              {notificationTypes.savings.length > 0 &&
                renderCategory('Epargne', notificationTypes.savings)}

              {notificationTypes.activity.length > 0 &&
                renderCategory('Activite', notificationTypes.activity)}

              {notificationTypes.system.length > 0 &&
                renderCategory('Systeme', notificationTypes.system)}
            </div>
          ) : (
            <p className="text-center text-ctp-subtext0 py-8">
              Impossible de charger les types de notifications.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ctp-surface0 shrink-0">
          <span className="text-sm text-ctp-subtext0">
            {enabledTypes.size} type(s) selectionne(s)
          </span>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-ctp-subtext1 hover:bg-ctp-surface0 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || updatePreferences.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-base text-sm font-medium rounded-lg hover:bg-ctp-sapphire disabled:opacity-50 transition-colors"
            >
              {updatePreferences.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
