// ============================================================================
// SECURITY SETTINGS - Finance Hub
// Security and device management
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Smartphone,
  Key,
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
} from 'lucide-react';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Device {
  id: string;
  name: string;
  fingerprint: string;
  isTrusted: boolean;
  lastUsedAt: string;
  createdAt: string;
  ipAddress?: string;
  location?: string;
}

interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface MfaMethod {
  id: string;
  type: string;
  name: string;
  isEnabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface SecurityEvent {
  id: string;
  action: string;
  changes: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SecuritySettings() {
  const queryClient = useQueryClient();
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<string | null>(null);

  // Fetch devices
  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['user-devices'],
    queryFn: async () => {
      const response = await api.get<{ data: Device[] }>('/user/devices');
      return response.data;
    },
  });

  // Fetch sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: async () => {
      const response = await api.get<{ data: Session[] }>('/user/sessions');
      return response.data;
    },
  });

  // Fetch MFA methods
  const { data: mfaMethods = [], isLoading: mfaLoading } = useQuery({
    queryKey: ['user-mfa'],
    queryFn: async () => {
      const response = await api.get<{ data: MfaMethod[] }>('/user/mfa');
      return response.data;
    },
  });

  // Fetch security events
  const { data: securityEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['security-events'],
    queryFn: async () => {
      const response = await api.get<{ data: SecurityEvent[] }>('/user/security-events');
      return response.data;
    },
  });

  // Revoke device mutation
  const revokeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await api.delete(`/user/devices/${deviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-devices'] });
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      setShowRevokeConfirm(null);
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/user/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
  });

  // Revoke all other sessions mutation
  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      await api.post('/user/sessions/revoke-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'auth.login.succeeded': 'Connexion reussie',
      'auth.login.failed': 'Tentative de connexion echouee',
      'auth.logout': 'Deconnexion',
      'auth.mfa.setup': 'MFA configure',
      'auth.mfa.removed': 'MFA supprime',
      'auth.device.revoked': 'Appareil revoque',
      'auth.session.locked': 'Session verrouillee',
      'auth.password.changed': 'Mot de passe modifie',
    };
    return labels[action] || action;
  };

  const isLoading = devicesLoading || sessionsLoading || mfaLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* MFA Methods */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-gray-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Authentification a deux facteurs
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Securisez votre compte avec une verification supplementaire
                </p>
              </div>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Ajouter une methode
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {mfaMethods.length === 0 ? (
            <div className="p-6 text-center">
              <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Aucune methode MFA configuree
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Nous recommandons d'activer le MFA pour securiser votre compte
              </p>
            </div>
          ) : (
            mfaMethods.map((method) => (
              <div key={method.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        method.isEnabled
                          ? 'bg-green-100 dark:bg-green-900'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Key
                        className={`h-5 w-5 ${
                          method.isEnabled
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {method.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {method.type === 'totp' ? 'Application Authenticator' : method.type}
                        {method.lastUsedAt && (
                          <> - Derniere utilisation: {formatDate(method.lastUsedAt)}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trusted Devices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Appareils de confiance
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Appareils autorises a acceder a votre compte
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {devices.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Aucun appareil enregistre
            </div>
          ) : (
            devices.map((device) => (
              <div key={device.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        device.isTrusted
                          ? 'bg-green-100 dark:bg-green-900'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Smartphone
                        className={`h-5 w-5 ${
                          device.isTrusted
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.name}
                        </p>
                        {device.isTrusted && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confiance
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(device.lastUsedAt)}
                        </span>
                        {device.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {device.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {showRevokeConfirm === device.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRevokeConfirm(null)}
                        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => revokeDeviceMutation.mutate(device.id)}
                        disabled={revokeDeviceMutation.isPending}
                        className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
                      >
                        {revokeDeviceMutation.isPending ? 'Suppression...' : 'Confirmer'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowRevokeConfirm(device.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sessions actives
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gerez vos sessions de connexion
                </p>
              </div>
            </div>
            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <button
                onClick={() => revokeAllSessionsMutation.mutate()}
                disabled={revokeAllSessionsMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Deconnecter tout
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sessions.map((session) => (
            <div key={session.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      session.isCurrent
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <Smartphone
                      className={`h-5 w-5 ${
                        session.isCurrent
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {session.deviceName}
                      </p>
                      {session.isCurrent && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                          Session actuelle
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {session.ipAddress} - Derniere activite: {formatDate(session.lastActiveAt)}
                    </p>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSessionMutation.mutate(session.id)}
                    disabled={revokeSessionMutation.isPending}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Deconnecter
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Historique de securite
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Evenements de securite recents
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
          {securityEvents.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Aucun evenement de securite
            </div>
          ) : (
            securityEvents.map((event) => (
              <div key={event.id} className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {getActionLabel(event.action)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {event.ipAddress || 'IP inconnue'} - {formatDate(event.createdAt)}
                    </p>
                  </div>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      event.action.includes('failed') || event.action.includes('suspicious')
                        ? 'bg-red-500'
                        : event.action.includes('removed') || event.action.includes('revoked')
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-gray-500" />
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Changer le mot de passe
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Il est recommande de changer regulierement votre mot de passe
                </p>
              </div>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
