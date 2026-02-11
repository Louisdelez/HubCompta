// ============================================================================
// SECURITY SETTINGS - Finance Hub
// Security and device management
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Smartphone,
  Tablet,
  Monitor,
  Key,
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Globe,
  LogOut,
  ExternalLink,
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
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
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
// Helpers
// ----------------------------------------------------------------------------

function getDeviceIcon(deviceType: string | null, os: string | null) {
  const osLower = (os ?? '').toLowerCase();
  const typeLower = (deviceType ?? '').toLowerCase();

  if (typeLower === 'mobile' || osLower.includes('android') || osLower.includes('ios')) {
    return Smartphone;
  }
  if (typeLower === 'tablet' || osLower.includes('ipad')) {
    return Tablet;
  }
  return Monitor;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'A l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SecuritySettings() {
  const queryClient = useQueryClient();
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<string | null>(null);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  // Fetch devices
  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['user-devices'],
    queryFn: async () => {
      const result = await api.get<Device[]>('/user/devices');
      return result ?? [];
    },
  });

  // Fetch sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: async () => {
      const result = await api.get<Session[]>('/user/sessions');
      return result ?? [];
    },
  });

  // Fetch MFA methods
  const { data: mfaMethods = [], isLoading: mfaLoading } = useQuery({
    queryKey: ['user-mfa'],
    queryFn: async () => {
      const result = await api.get<MfaMethod[]>('/user/mfa');
      return result ?? [];
    },
  });

  // Fetch security events
  const { data: securityEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['security-events'],
    queryFn: async () => {
      const result = await api.get<SecurityEvent[]>('/user/security-events');
      return result ?? [];
    },
  });

  // Revoke device mutation
  const revokeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await api.delete(`/user/devices/${deviceId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-devices'] });
      void queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      setShowRevokeConfirm(null);
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/user/sessions/${sessionId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      setShowRevokeConfirm(null);
    },
  });

  // Revoke all other sessions mutation
  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      await api.post('/user/sessions/revoke-all');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      setShowRevokeAllConfirm(false);
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
      'auth.session.revoked': 'Session revoquee',
      'auth.sessions.revoked_all': 'Toutes les sessions revoquees',
      'auth.password.changed': 'Mot de passe modifie',
    };
    return labels[action] || action;
  };

  const isLoading = devicesLoading || sessionsLoading || mfaLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-6">
      {/* MFA Methods */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-ctp-red" />
              <div>
                <h2 className="text-lg font-semibold text-ctp-text">
                  Authentification a deux facteurs
                </h2>
                <p className="text-sm text-ctp-subtext0">
                  Securisez votre compte avec une verification supplementaire
                </p>
              </div>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-ctp-blue hover:bg-ctp-surface0 rounded-lg transition-colors">
              Ajouter une methode
            </button>
          </div>
        </div>

        <div className="divide-y divide-ctp-surface1">
          {mfaMethods.length === 0 ? (
            <div className="p-6 text-center">
              <Shield className="h-12 w-12 text-ctp-overlay0 mx-auto mb-3" />
              <p className="text-ctp-subtext0">
                Aucune methode MFA configuree
              </p>
              <p className="text-sm text-ctp-overlay1 mt-1">
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
                          ? 'bg-ctp-green/20'
                          : 'bg-ctp-surface1'
                      }`}
                    >
                      <Key
                        className={`h-5 w-5 ${
                          method.isEnabled
                            ? 'text-ctp-green'
                            : 'text-ctp-overlay1'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ctp-text">
                        {method.name}
                      </p>
                      <p className="text-xs text-ctp-subtext0">
                        {method.type === 'totp' ? 'Application Authenticator' : method.type}
                        {method.lastUsedAt && (
                          <> - Derniere utilisation: {formatDate(method.lastUsedAt)}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <button className="text-sm text-ctp-red hover:text-ctp-maroon font-medium">
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trusted Devices */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-ctp-red" />
            <div>
              <h2 className="text-lg font-semibold text-ctp-text">
                Appareils de confiance
              </h2>
              <p className="text-sm text-ctp-subtext0">
                Appareils autorises a acceder a votre compte
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-ctp-surface1">
          {devices.length === 0 ? (
            <div className="p-6 text-center text-ctp-subtext0">
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
                          ? 'bg-ctp-green/20'
                          : 'bg-ctp-surface1'
                      }`}
                    >
                      <Smartphone
                        className={`h-5 w-5 ${
                          device.isTrusted
                            ? 'text-ctp-green'
                            : 'text-ctp-overlay1'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ctp-text">
                          {device.name}
                        </p>
                        {device.isTrusted && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-ctp-green/20 text-ctp-green rounded-full">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confiance
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ctp-subtext0">
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

                  {showRevokeConfirm === `device-${device.id}` ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRevokeConfirm(null)}
                        className="px-3 py-1 text-sm text-ctp-subtext0"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => revokeDeviceMutation.mutate(device.id)}
                        disabled={revokeDeviceMutation.isPending}
                        className="px-3 py-1 text-sm font-medium text-ctp-base bg-ctp-red rounded hover:bg-ctp-maroon"
                      >
                        {revokeDeviceMutation.isPending ? 'Suppression...' : 'Confirmer'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowRevokeConfirm(`device-${device.id}`)}
                      className="text-sm text-ctp-red hover:text-ctp-maroon"
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
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-ctp-red" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-ctp-text">
                    Sessions actives
                  </h2>
                  <Link
                    to="/settings/sessions"
                    className="text-ctp-blue hover:text-ctp-sapphire"
                    title="Voir les details des sessions"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
                <p className="text-sm text-ctp-subtext0">
                  {sessions.length} session{sessions.length > 1 ? 's' : ''} active{sessions.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {otherSessions.length > 0 && (
              showRevokeAllConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRevokeAllConfirm(false)}
                    className="px-3 py-1 text-sm text-ctp-subtext0"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => revokeAllSessionsMutation.mutate()}
                    disabled={revokeAllSessionsMutation.isPending}
                    className="px-3 py-1 text-sm font-medium text-ctp-base bg-ctp-red rounded hover:bg-ctp-maroon"
                  >
                    {revokeAllSessionsMutation.isPending ? 'Deconnexion...' : 'Confirmer'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowRevokeAllConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-ctp-red hover:bg-ctp-surface0 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Deconnecter tout ({otherSessions.length})
                </button>
              )
            )}
          </div>
        </div>

        <div className="divide-y divide-ctp-surface1">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-ctp-subtext0">
              Aucune session active
            </div>
          ) : (
            sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.deviceType, session.os);
              return (
                <div key={session.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          session.isCurrent
                            ? 'bg-ctp-green/20'
                            : 'bg-ctp-surface1'
                        }`}
                      >
                        <DeviceIcon
                          className={`h-5 w-5 ${
                            session.isCurrent
                              ? 'text-ctp-green'
                              : 'text-ctp-overlay1'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-ctp-text">
                            {session.browser ?? session.deviceName}
                          </p>
                          {session.os && (
                            <span className="text-xs text-ctp-subtext0">
                              sur {session.os}
                            </span>
                          )}
                          {session.isCurrent && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-ctp-green/20 text-ctp-green rounded-full">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Session actuelle
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-ctp-subtext0 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            {formatRelativeTime(session.lastActiveAt)}
                          </span>
                          {session.ipAddress && (
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3 flex-shrink-0" />
                              {session.ipAddress}
                            </span>
                          )}
                          {session.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {session.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      showRevokeConfirm === `session-${session.id}` ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setShowRevokeConfirm(null)}
                            className="px-3 py-1 text-sm text-ctp-subtext0"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => revokeSessionMutation.mutate(session.id)}
                            disabled={revokeSessionMutation.isPending}
                            className="px-3 py-1 text-sm font-medium text-ctp-base bg-ctp-red rounded hover:bg-ctp-maroon"
                          >
                            {revokeSessionMutation.isPending ? 'Deconnexion...' : 'Confirmer'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRevokeConfirm(`session-${session.id}`)}
                          className="text-sm text-ctp-red hover:text-ctp-maroon flex-shrink-0"
                          title="Deconnecter cette session"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Security Events */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-ctp-red" />
            <div>
              <h2 className="text-lg font-semibold text-ctp-text">
                Historique de securite
              </h2>
              <p className="text-sm text-ctp-subtext0">
                Evenements de securite recents
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-ctp-surface1 max-h-80 overflow-y-auto">
          {securityEvents.length === 0 ? (
            <div className="p-6 text-center text-ctp-subtext0">
              Aucun evenement de securite
            </div>
          ) : (
            securityEvents.map((event) => (
              <div key={event.id} className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ctp-text">
                      {getActionLabel(event.action)}
                    </p>
                    <p className="text-xs text-ctp-subtext0">
                      {event.ipAddress || 'IP inconnue'} - {formatDate(event.createdAt)}
                    </p>
                  </div>
                  <div
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      event.action.includes('failed') || event.action.includes('suspicious')
                        ? 'bg-ctp-red'
                        : event.action.includes('removed') || event.action.includes('revoked')
                        ? 'bg-ctp-yellow'
                        : 'bg-ctp-green'
                    }`}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-ctp-red" />
              <div>
                <h3 className="text-sm font-medium text-ctp-text">
                  Changer le mot de passe
                </h3>
                <p className="text-xs text-ctp-subtext0">
                  Il est recommande de changer regulierement votre mot de passe
                </p>
              </div>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-ctp-blue hover:bg-ctp-surface0 rounded-lg transition-colors">
              Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
