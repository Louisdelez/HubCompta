// ============================================================================
// PUSH NOTIFICATION CARD - Finance Hub
// Component for managing PWA push notification subscriptions
// ============================================================================

import { useState } from 'react';
import {
  Bell,
  BellOff,
  Smartphone,
  Loader2,
  Trash2,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PushNotificationCard() {
  const {
    isSupported,
    permission,
    isSubscribed,
    subscriptions,
    status,
    isLoading,
    subscribe,
    unsubscribe,
    unsubscribeDevice,
    sendTest,
    isSubscribing,
    isUnsubscribing,
    isSendingTest,
  } = usePushNotifications();

  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Handle subscription toggle
  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const success = await subscribe();
      if (!success && permission === 'denied') {
        // Permission was denied, show message
      }
    }
  };

  // Handle test notification
  const handleTest = async () => {
    setTestSent(false);
    setTestError(null);

    const success = await sendTest();
    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } else {
      setTestError('Erreur lors de l\'envoi');
      setTimeout(() => setTestError(null), 3000);
    }
  };

  // Not supported
  if (!isSupported) {
    return (
      <div className="bg-ctp-mantle rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-ctp-surface0 rounded-lg">
            <BellOff className="h-5 w-5 text-ctp-subtext0" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ctp-text">
              Notifications push
            </h3>
            <p className="text-xs text-ctp-subtext0">
              Les notifications push ne sont pas supportees sur ce navigateur
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Service not configured on server
  if (status && !status.isConfigured) {
    return (
      <div className="bg-ctp-mantle rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-ctp-yellow/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-ctp-yellow" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ctp-text">
              Notifications push
            </h3>
            <p className="text-xs text-ctp-subtext0">
              Le service de notifications push n'est pas configure sur le serveur
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <div className="bg-ctp-mantle rounded-lg shadow p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-ctp-red/10 rounded-lg">
            <XCircle className="h-5 w-5 text-ctp-red" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ctp-text">
              Notifications push bloquees
            </h3>
            <p className="text-xs text-ctp-subtext0 mt-1">
              Les notifications sont bloquees dans les parametres de votre navigateur.
              Pour les activer, modifiez les permissions du site dans les parametres de votre navigateur.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ctp-mantle rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-ctp-surface1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isSubscribed ? 'bg-ctp-green/10' : 'bg-ctp-surface0'}`}>
              <Bell className={`h-5 w-5 ${isSubscribed ? 'text-ctp-green' : 'text-ctp-subtext0'}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ctp-text">
                Notifications push
              </h2>
              <p className="text-sm text-ctp-subtext0">
                Recevez des alertes sur cet appareil
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSubscribed}
              onChange={handleToggle}
              disabled={isSubscribing || isUnsubscribing}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-ctp-surface1 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ctp-blue/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ctp-surface2 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ctp-green peer-disabled:opacity-50"></div>
            {(isSubscribing || isUnsubscribing) && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin text-ctp-subtext0" />
            )}
          </label>
        </div>
      </div>

      {/* Content */}
      {isSubscribed && (
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2 text-sm text-ctp-green">
            <CheckCircle2 className="h-4 w-4" />
            <span>Notifications actives sur {subscriptions.length} appareil(s)</span>
          </div>

          {/* Device List */}
          {subscriptions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-ctp-subtext0 uppercase tracking-wider">
                Appareils enregistres
              </h4>
              <div className="space-y-2">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 bg-ctp-surface0 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-ctp-subtext0" />
                      <div>
                        <p className="text-sm font-medium text-ctp-text">
                          {sub.deviceName ?? 'Appareil inconnu'}
                        </p>
                        {sub.lastUsedAt && (
                          <p className="text-xs text-ctp-subtext0">
                            Derniere utilisation: {new Date(sub.lastUsedAt).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => unsubscribeDevice(sub.id)}
                      disabled={isUnsubscribing}
                      className="p-2 text-ctp-subtext0 hover:text-ctp-red hover:bg-ctp-surface1 rounded-lg transition-colors disabled:opacity-50"
                      title="Supprimer cet appareil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Button */}
          <div className="pt-4 border-t border-ctp-surface0">
            <button
              onClick={handleTest}
              disabled={isSendingTest || !isSubscribed}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testSent ? (
                <CheckCircle2 className="h-4 w-4 text-ctp-green" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {testSent ? 'Notification envoyee !' : 'Envoyer une notification test'}
            </button>
            {testError && (
              <p className="mt-2 text-xs text-ctp-red">{testError}</p>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ctp-blue" />
        </div>
      )}
    </div>
  );
}

export default PushNotificationCard;
