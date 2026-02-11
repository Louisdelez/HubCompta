// ============================================================================
// SESSIONS PAGE - Finance Hub
// Dedicated page for viewing and managing active sessions
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Shield,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  CheckCircle,
  Clock,
  MapPin,
  Globe,
  LogOut,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

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
    year: 'numeric',
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SessionsPage() {
  const queryClient = useQueryClient();
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<string | null>(null);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Fetch sessions
  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: async () => {
      const result = await api.get<Session[]>('/user/sessions');
      return result ?? [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ctp-base">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ctp-base">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-ctp-red/10 border border-ctp-red/20 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-ctp-red flex-shrink-0" />
            <p className="text-ctp-text">Erreur lors du chargement des sessions</p>
          </div>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="min-h-screen bg-ctp-base">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/settings#security"
            className="inline-flex items-center gap-2 text-sm text-ctp-subtext0 hover:text-ctp-text mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux parametres de securite
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ctp-text flex items-center gap-3">
                <Shield className="h-7 w-7 text-ctp-red" />
                Sessions actives
              </h1>
              <p className="text-ctp-subtext0 mt-1">
                {sessions.length} session{sessions.length > 1 ? 's' : ''} actuellement active{sessions.length > 1 ? 's' : ''}
              </p>
            </div>
            {otherSessions.length > 0 && (
              showRevokeAllConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRevokeAllConfirm(false)}
                    className="px-4 py-2 text-sm text-ctp-subtext0 hover:text-ctp-text"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => revokeAllSessionsMutation.mutate()}
                    disabled={revokeAllSessionsMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-ctp-base bg-ctp-red rounded-lg hover:bg-ctp-maroon disabled:opacity-50"
                  >
                    {revokeAllSessionsMutation.isPending ? 'Deconnexion...' : 'Confirmer la deconnexion'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowRevokeAllConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-ctp-red hover:bg-ctp-surface0 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Deconnecter toutes les autres sessions
                </button>
              )
            )}
          </div>
        </div>

        {/* Current Session */}
        {currentSession && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-ctp-subtext0 uppercase tracking-wide mb-3">
              Session actuelle
            </h2>
            <SessionCard
              session={currentSession}
              isExpanded={expandedSession === currentSession.id}
              onToggleExpand={() =>
                setExpandedSession(
                  expandedSession === currentSession.id ? null : currentSession.id
                )
              }
              onRevoke={() => {}}
              showRevokeConfirm={false}
              setShowRevokeConfirm={() => {}}
              revoking={false}
            />
          </div>
        )}

        {/* Other Sessions */}
        {otherSessions.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-ctp-subtext0 uppercase tracking-wide mb-3">
              Autres sessions ({otherSessions.length})
            </h2>
            <div className="space-y-3">
              {otherSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isExpanded={expandedSession === session.id}
                  onToggleExpand={() =>
                    setExpandedSession(
                      expandedSession === session.id ? null : session.id
                    )
                  }
                  onRevoke={() => revokeSessionMutation.mutate(session.id)}
                  showRevokeConfirm={showRevokeConfirm === session.id}
                  setShowRevokeConfirm={(show) =>
                    setShowRevokeConfirm(show ? session.id : null)
                  }
                  revoking={revokeSessionMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="bg-ctp-mantle rounded-lg p-8 text-center">
            <Shield className="h-12 w-12 text-ctp-overlay0 mx-auto mb-4" />
            <p className="text-ctp-subtext0">Aucune session active trouvee</p>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 p-4 bg-ctp-surface0 rounded-lg">
          <h3 className="font-medium text-ctp-text mb-2">A propos des sessions</h3>
          <ul className="text-sm text-ctp-subtext0 space-y-1">
            <li>
              Chaque connexion a votre compte cree une session.
            </li>
            <li>
              La deconnexion d'une session revoque immediatement son acces.
            </li>
            <li>
              Si vous ne reconnaissez pas une session, deconnectez-la et changez votre mot de passe.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Session Card Component
// ----------------------------------------------------------------------------

interface SessionCardProps {
  session: Session;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRevoke: () => void;
  showRevokeConfirm: boolean;
  setShowRevokeConfirm: (show: boolean) => void;
  revoking: boolean;
}

function SessionCard({
  session,
  isExpanded,
  onToggleExpand,
  onRevoke,
  showRevokeConfirm,
  setShowRevokeConfirm,
  revoking,
}: SessionCardProps) {
  // Get the icon component - using IIFE pattern to satisfy linter
  const renderDeviceIcon = () => {
    const Icon = getDeviceIcon(session.deviceType, session.os);
    return (
      <Icon
        className={`h-6 w-6 ${
          session.isCurrent ? 'text-ctp-green' : 'text-ctp-overlay1'
        }`}
      />
    );
  };

  return (
    <div className="bg-ctp-mantle rounded-lg shadow overflow-hidden">
      <div
        className="px-6 py-4 cursor-pointer hover:bg-ctp-surface0 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                session.isCurrent ? 'bg-ctp-green/20' : 'bg-ctp-surface1'
              }`}
            >
              {renderDeviceIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-medium text-ctp-text">
                  {session.browser ?? session.deviceName}
                </p>
                {session.os && (
                  <span className="text-sm text-ctp-subtext0">sur {session.os}</span>
                )}
                {session.isCurrent && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-ctp-green/20 text-ctp-green rounded-full">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Session actuelle
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-ctp-subtext0 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatRelativeTime(session.lastActiveAt)}
                </span>
                {session.ipAddress && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    {session.ipAddress}
                  </span>
                )}
                {session.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {session.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!session.isCurrent && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {showRevokeConfirm ? (
                <>
                  <button
                    onClick={() => setShowRevokeConfirm(false)}
                    className="px-3 py-1.5 text-sm text-ctp-subtext0 hover:text-ctp-text"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={onRevoke}
                    disabled={revoking}
                    className="px-3 py-1.5 text-sm font-medium text-ctp-base bg-ctp-red rounded-lg hover:bg-ctp-maroon disabled:opacity-50"
                  >
                    {revoking ? 'Deconnexion...' : 'Confirmer'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-ctp-red hover:bg-ctp-surface0 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Deconnecter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-6 py-4 border-t border-ctp-surface1 bg-ctp-surface0/50">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-ctp-subtext0">Premiere connexion</dt>
              <dd className="text-ctp-text font-medium">
                {formatFullDate(session.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-ctp-subtext0">Derniere activite</dt>
              <dd className="text-ctp-text font-medium">
                {formatFullDate(session.lastActiveAt)}
              </dd>
            </div>
            <div>
              <dt className="text-ctp-subtext0">Expiration</dt>
              <dd className="text-ctp-text font-medium">
                {formatFullDate(session.expiresAt)}
              </dd>
            </div>
            {session.userAgent && (
              <div className="col-span-2">
                <dt className="text-ctp-subtext0">User Agent</dt>
                <dd className="text-ctp-text font-mono text-xs mt-1 break-all">
                  {session.userAgent}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

export default SessionsPage;
